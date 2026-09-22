import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { ApiError } from "../src/data/api";
import { initializeDatabase, type Database } from "../src/data/repository";
import { createSyncBackend } from "../src/data/sync";
import { emptySinger, type Singer, type SingerInput } from "../src/data/singers";
import { adapter } from "./helpers/sqlite";

/** A stand-in for singers.php that can be unplugged from the network. */
function fakeServer() {
  let rows: Singer[] = [];
  let nextId = 100;
  const server = {
    online: true,
    calls: [] as string[],
    rows: () => rows,
    seed(singers: Singer[]) {
      rows = singers;
    },
  };
  const reachable = () => {
    if (!server.online)
      throw new ApiError("Couldn’t reach the directory server.");
  };
  const find = (id: number) => rows.find((row) => row.id === id);
  const api = {
    async list() {
      reachable();
      server.calls.push("list");
      return rows.map((row) => ({ ...row }));
    },
    async get(id: number) {
      reachable();
      return find(id) ?? null;
    },
    async create(input: SingerInput) {
      reachable();
      server.calls.push(`create:${input.name}`);
      if (rows.some((row) => row.name.toLowerCase() === input.name.toLowerCase()))
        throw new ApiError("A singer with this name already exists.", 409);
      const singer: Singer = {
        ...input,
        id: nextId++,
        favorite: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      rows.push(singer);
      return singer.id;
    },
    async update(id: number, input: SingerInput) {
      reachable();
      server.calls.push(`update:${id}:${input.name}`);
      const singer = find(id);
      if (!singer) throw new ApiError("This singer no longer exists.", 404);
      Object.assign(singer, input);
    },
    async remove(id: number) {
      reachable();
      server.calls.push(`remove:${id}`);
      if (!find(id)) throw new ApiError("This singer no longer exists.", 404);
      rows = rows.filter((row) => row.id !== id);
    },
    async toggleFavorite(id: number) {
      reachable();
      const singer = find(id);
      if (singer) singer.favorite = singer.favorite === 1 ? 0 : 1;
    },
    async setFavorite(id: number, favorite: boolean) {
      reachable();
      server.calls.push(`favorite:${id}:${favorite ? 1 : 0}`);
      const singer = find(id);
      if (!singer) throw new ApiError("This singer no longer exists.", 404);
      singer.favorite = favorite ? 1 : 0;
    },
  };
  return { server, api };
}

async function harness() {
  const native = new DatabaseSync(":memory:");
  const db = adapter(native);
  await initializeDatabase(db, { seed: false });
  const { server, api } = fakeServer();
  const backend = createSyncBackend(db, api);
  const outbox = () =>
    native.prepare("SELECT op, target, payload FROM outbox ORDER BY seq").all() as {
      op: string;
      target: number;
      payload: string;
    }[];
  return { native, db: db as Database, server, api, backend, outbox };
}

const singer = (name: string): SingerInput => ({ ...emptySinger, name });

/** Everything the server was asked to change, ignoring plain reads. */
const writes = (server: { calls: string[] }) =>
  server.calls.filter((call) => call !== "list");

test("writes made offline queue up, then land on the server when it returns", async () => {
  const { native, server, backend, outbox } = await harness();
  try {
    server.seed([
      {
        ...emptySinger,
        id: 1,
        name: "Lea Salonga",
        genre: "Theatre",
        favorite: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    await backend.open();
    await backend.refresh();
    assert.equal((await backend.list()).length, 1, "the server's copy is cached");
    assert.equal(backend.status().lastSyncedAt !== null, true);

    server.online = false;
    const id = await backend.create(singer("Moira dela Torre"));
    await backend.refresh();

    assert.ok(id < 0, "an offline create gets a temporary negative id");
    assert.equal((await backend.list()).length, 2, "and shows up straight away");
    assert.equal(backend.status().online, false);
    assert.equal(backend.status().pending, 1);
    assert.equal(server.rows().length, 1, "nothing reached the server yet");

    server.online = true;
    await backend.refresh();

    assert.equal(backend.status().pending, 0);
    assert.equal(backend.status().online, true);
    assert.equal(server.rows().length, 2, "the queued write landed");
    const rows = await backend.list();
    assert.equal(rows.length, 2);
    assert.ok(
      rows.every((row) => row.id > 0),
      "the temporary id was replaced by the server's",
    );
  } finally {
    native.close();
  }
});

test("repeated edits to an unsent row collapse into one write", async () => {
  const { native, server, backend, outbox } = await harness();
  try {
    await backend.open();
    await backend.refresh();
    server.online = false;

    const id = await backend.create(singer("Draft"));
    await backend.update(id, { ...singer("Final name"), hometown: "Cebu" });
    await backend.toggleFavorite(id);
    await backend.toggleFavorite(id);

    const queue = outbox();
    assert.deepEqual(
      queue.map((row) => row.op),
      ["create", "favorite"],
      "the edit folded into the create; only the latest favourite survives",
    );
    assert.equal(JSON.parse(queue[0].payload).name, "Final name");
    assert.equal(JSON.parse(queue[1].payload).favorite, 0);

    server.online = true;
    await backend.refresh();
    assert.deepEqual(writes(server), ["create:Final name", "favorite:100:0"]);
    assert.equal(server.rows()[0].hometown, "Cebu");
  } finally {
    native.close();
  }
});

test("a row created and deleted while offline never reaches the server", async () => {
  const { native, server, backend, outbox } = await harness();
  try {
    await backend.open();
    await backend.refresh();
    server.online = false;

    const id = await backend.create(singer("Mistake"));
    await backend.remove(id);
    assert.deepEqual(outbox(), [], "the queue cancelled itself out");

    server.online = true;
    await backend.refresh();
    assert.equal(server.rows().length, 0);
    assert.equal((await backend.list()).length, 0);
  } finally {
    native.close();
  }
});

test("a write the server refuses is dropped, and the server's version wins", async () => {
  const { native, server, backend, outbox } = await harness();
  try {
    await backend.open();
    await backend.refresh();
    server.online = false;

    // Someone else adds the same name while this device is offline.
    await backend.create(singer("Lea Salonga"));
    server.seed([
      {
        ...emptySinger,
        id: 1,
        name: "Lea Salonga",
        genre: "Theatre",
        hometown: "Manila",
        favorite: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    server.online = true;
    await backend.refresh();

    assert.deepEqual(outbox(), [], "the refused write was dropped");
    assert.match(backend.status().rejected[0], /already exists/);
    const rows = await backend.list();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].hometown, "Manila", "the server's row replaced ours");
    assert.equal(backend.status().pending, 0);
  } finally {
    native.close();
  }
});

test("edits and deletes made offline are replayed in order", async () => {
  const { native, server, backend } = await harness();
  try {
    server.seed([
      {
        ...emptySinger,
        id: 1,
        name: "Keep",
        favorite: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        ...emptySinger,
        id: 2,
        name: "Drop",
        favorite: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    await backend.open();
    await backend.refresh();

    server.online = false;
    await backend.update(1, { ...singer("Kept"), song: "Tinig" });
    await backend.toggleFavorite(1);
    await backend.remove(2);
    assert.equal(backend.status().pending, 3);

    server.online = true;
    await backend.refresh();

    assert.deepEqual(writes(server), [
      "update:1:Kept",
      "favorite:1:1",
      "remove:2",
    ]);
    const rows = await backend.list();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, "Kept");
    assert.equal(rows[0].song, "Tinig");
    assert.equal(rows[0].favorite, 1);
  } finally {
    native.close();
  }
});
