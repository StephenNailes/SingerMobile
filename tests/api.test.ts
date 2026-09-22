import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError, createApiRepository } from "../src/data/api";
import { friendlyError } from "../src/data/repository";
import { emptySinger } from "../src/data/singers";

// api.ts reads the environment on each request, so setting this here is enough.
process.env.EXPO_PUBLIC_API_URL = "https://example.test/api/singers.php";

type Call = { url: string; method: string; body: unknown };

/** Stands in for the network: records the request, replays a canned reply. */
function stubFetch(reply: { status: number; payload: unknown } | Error) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({
      url: String(url),
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (reply instanceof Error) throw reply;
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      text: async () => JSON.stringify(reply.payload),
    };
  }) as unknown as typeof fetch;
  return calls;
}

const sample = {
  ...emptySinger,
  id: 7,
  name: "Lea Salonga",
  genre: "Theatre" as const,
  favorite: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("each operation hits the endpoint singers.php expects", async () => {
  const api = createApiRepository();

  let calls = stubFetch({ status: 200, payload: [sample] });
  assert.deepEqual(await api.list(), [sample]);
  assert.equal(calls[0].url, "https://example.test/api/singers.php");
  assert.equal(calls[0].method, "GET");

  calls = stubFetch({ status: 201, payload: sample });
  assert.equal(await api.create({ ...emptySinger, name: "  Lea Salonga  " }), 7);
  assert.equal(calls[0].method, "POST");
  // The name is trimmed before it leaves the device.
  assert.equal((calls[0].body as { name: string }).name, "Lea Salonga");

  calls = stubFetch({ status: 200, payload: sample });
  await api.update(7, { ...emptySinger, name: "Lea Salonga" });
  assert.equal(calls[0].method, "PUT");
  assert.equal(calls[0].url, "https://example.test/api/singers.php?id=7");

  calls = stubFetch({ status: 200, payload: sample });
  await api.toggleFavorite(7);
  assert.equal(calls[0].method, "PATCH");

  calls = stubFetch({ status: 200, payload: { status: 1, id: 7 } });
  await api.remove(7);
  assert.equal(calls[0].method, "DELETE");
  assert.equal(calls[0].url, "https://example.test/api/singers.php?id=7");
});

test("bad input never reaches the network", async () => {
  const calls = stubFetch({ status: 201, payload: sample });
  await assert.rejects(
    createApiRepository().create({ ...emptySinger, name: "   " }),
    /Enter the singer/,
  );
  assert.equal(calls.length, 0);
});

test("server and network failures arrive as readable messages", async () => {
  const api = createApiRepository();

  stubFetch({
    status: 409,
    payload: { status: 0, message: "A singer with this name already exists." },
  });
  const duplicate = await api
    .create({ ...emptySinger, name: "Lea Salonga" })
    .catch((error) => error);
  assert.ok(duplicate instanceof ApiError);
  assert.equal(duplicate.status, 409);
  // friendlyError must pass the server's wording through untouched.
  assert.equal(friendlyError(duplicate), "A singer with this name already exists.");

  stubFetch(new TypeError("Network request failed"));
  const offline = await api.list().then(() => "", friendlyError);
  assert.match(offline, /connection/);

  // A PHP warning or a host error page instead of JSON.
  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    text: async () => "<br />Warning: mysqli_connect(): access denied",
  })) as unknown as typeof fetch;
  const garbled = await api.list().then(() => "", friendlyError);
  assert.match(garbled, /couldn’t read/);
});
