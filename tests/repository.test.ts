import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  createRepository,
  initializeDatabase,
  type Database,
} from "../src/data/repository";
import { emptySinger, seedSingers, validateSinger } from "../src/data/singers";

function adapter(native: DatabaseSync): Database {
  const parameters = (args: unknown[]) =>
    Array.isArray(args[0]) ? args[0] : args;
  return {
    execAsync: async (sql: string) => {
      native.exec(sql);
    },
    runAsync: async (sql: string, ...args: unknown[]) => {
      const result = native.prepare(sql).run(...parameters(args));
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    },
    getAllAsync: async (sql: string, ...args: unknown[]) =>
      native.prepare(sql).all(...parameters(args)),
    getFirstAsync: async (sql: string, ...args: unknown[]) =>
      native.prepare(sql).get(...parameters(args)) ?? null,
    withTransactionAsync: async (task: () => Promise<void>) => {
      native.exec("BEGIN");
      try {
        await task();
        native.exec("COMMIT");
      } catch (error) {
        native.exec("ROLLBACK");
        throw error;
      }
    },
  } as Database;
}

test("CRUD, favorites, validation, duplicate protection and reopening a real SQLite file", async () => {
  const folder = mkdtempSync(join(tmpdir(), "tinig-test-"));
  const file = join(folder, "test.db");
  let native = new DatabaseSync(file);
  try {
    let db = adapter(native);
    await initializeDatabase(db);
    let repository = createRepository(db);
    assert.equal((await repository.list()).length, seedSingers.length);
    const id = await repository.create({
      ...emptySinger,
      name: "  Test O'Brian  ",
      bio: "An artist's story; DROP TABLE singers;",
    });
    assert.equal((await repository.get(id))?.name, "Test O'Brian");
    await repository.toggleFavorite(id);
    await repository.update(id, {
      ...emptySinger,
      name: "Updated singer",
      genre: "Rock",
      hometown: "Davao",
      song: "A song",
    });
    assert.equal((await repository.get(id))?.favorite, 1);
    assert.equal((await repository.get(id))?.hometown, "Davao");
    await assert.rejects(
      repository.create({ ...emptySinger, name: "updated SINGER" }),
      /UNIQUE/,
    );
    await assert.rejects(
      repository.create({ ...emptySinger, name: "  " }),
      /name/,
    );
    native.close();
    native = new DatabaseSync(file);
    db = adapter(native);
    await initializeDatabase(db);
    repository = createRepository(db);
    assert.equal((await repository.get(id))?.song, "A song");
    assert.equal((await repository.get(id))?.favorite, 1);
    await repository.remove(id);
    assert.equal(await repository.get(id), null);
    await assert.rejects(
      repository.update(id, { ...emptySinger, name: "Missing" }),
      /no longer exists/,
    );
    for (const singer of await repository.list())
      await repository.remove(singer.id);
    await initializeDatabase(db);
    assert.equal(
      (await repository.list()).length,
      0,
      "Deleted seeds must not reappear",
    );
  } finally {
    native.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test("invalid inputs and unsafe URLs are rejected, ordinary HTTPS links accepted", () => {
  assert.ok(validateSinger({ ...emptySinger, name: "x".repeat(81) }).name);
  assert.ok(
    validateSinger({
      ...emptySinger,
      name: "Test",
      imageUrl: "javascript:alert(1)",
    }).imageUrl,
  );
  assert.ok(
    validateSinger({
      ...emptySinger,
      name: "Test",
      sourceUrl: "https://user:pass@example.com",
    }).sourceUrl,
  );
  assert.ok(
    validateSinger({ ...emptySinger, name: "Test", bio: "x".repeat(2001) }).bio,
  );
  assert.deepEqual(
    validateSinger({
      ...emptySinger,
      name: "Test",
      sourceUrl: "https://example.com/artist",
    }),
    {},
  );
});

test("failed first-run migration rolls back completely and can be retried", async () => {
  const native = new DatabaseSync(":memory:");
  try {
    const db = adapter(native);
    const failingDb = {
      ...db,
      runAsync: async () => {
        throw new Error("simulated write failure");
      },
    };
    await assert.rejects(
      initializeDatabase(failingDb),
      /simulated write failure/,
    );
    assert.equal(native.prepare("PRAGMA user_version").get()?.user_version, 0);
    assert.equal(
      native
        .prepare(
          "SELECT count(*) as count FROM sqlite_master WHERE name='singers'",
        )
        .get()?.count,
      0,
    );
    await initializeDatabase(db);
    assert.equal(
      (await createRepository(db).list()).length,
      seedSingers.length,
    );
  } finally {
    native.close();
  }
});
