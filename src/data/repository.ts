import type { SQLiteDatabase } from "expo-sqlite";
import {
  cleanSinger,
  seedSingers,
  type Singer,
  type SingerInput,
} from "./singers";
export type Database = Pick<
  SQLiteDatabase,
  | "execAsync"
  | "runAsync"
  | "getAllAsync"
  | "getFirstAsync"
  | "withTransactionAsync"
>;
const columns = "name, genre, hometown, bio, song, imageUrl, sourceUrl";
const values = (input: SingerInput) => [
  input.name,
  input.genre,
  input.hometown,
  input.bio,
  input.song,
  input.imageUrl,
  input.sourceUrl,
];
export async function initializeDatabase(db: Database) {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  await db.withTransactionAsync(async () => {
    const version = await db.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    if ((version?.user_version ?? 0) > 1)
      throw new Error(
        "This directory was created by a newer app. Update Tinig to open it.",
      );
    if (version?.user_version === 1) return;
    await db.execAsync(`CREATE TABLE singers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 80),
      genre TEXT NOT NULL CHECK(genre IN ('Pop','R&B','Rock','Folk','Theatre')),
      hometown TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '',
      song TEXT NOT NULL DEFAULT '', imageUrl TEXT NOT NULL DEFAULT '', sourceUrl TEXT NOT NULL DEFAULT '',
      favorite INTEGER NOT NULL DEFAULT 0 CHECK(favorite IN (0,1)),
      createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ); CREATE INDEX singers_genre ON singers(genre);`);
    for (const singer of seedSingers)
      await db.runAsync(
        `INSERT INTO singers (${columns}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        values(singer),
      );
    await db.execAsync("PRAGMA user_version = 1");
  });
}
export function createRepository(db: Database) {
  return {
    list: () =>
      db.getAllAsync<Singer>(
        "SELECT * FROM singers ORDER BY name COLLATE NOCASE, id",
      ),
    get: (id: number) =>
      db.getFirstAsync<Singer>("SELECT * FROM singers WHERE id = ?", id),
    async create(input: SingerInput) {
      const result = await db.runAsync(
        `INSERT INTO singers (${columns}) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        values(cleanSinger(input)),
      );
      return result.lastInsertRowId;
    },
    async update(id: number, input: SingerInput) {
      const result = await db.runAsync(
        `UPDATE singers SET name=?, genre=?, hometown=?, bio=?, song=?, imageUrl=?, sourceUrl=?, updatedAt=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`,
        [...values(cleanSinger(input)), id],
      );
      if (!result.changes)
        throw new Error(
          "This singer no longer exists. Return to the directory.",
        );
    },
    async remove(id: number) {
      await db.runAsync("DELETE FROM singers WHERE id = ?", id);
    },
    async toggleFavorite(id: number) {
      await db.runAsync(
        "UPDATE singers SET favorite = 1 - favorite WHERE id = ?",
        id,
      );
    },
  };
}
export function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint"))
    return "A singer with this name already exists. Use a different name or edit the existing profile.";
  if (/no longer exists|newer app|Update Tinig/.test(message)) return message;
  return "Your changes could not be saved. Please try again. If this continues, check available device storage.";
}
