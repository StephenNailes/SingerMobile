import { DatabaseSync } from "node:sqlite";
import type { Database } from "../../src/data/repository";

/** Drives the app's Database interface against Node's built-in SQLite. */
export function adapter(native: DatabaseSync): Database {
  const parameters = (args: unknown[]) =>
    Array.isArray(args[0]) ? args[0] : args;
  return {
    execAsync: async (sql: string) => {
      native.exec(sql);
    },
    runAsync: async (sql: string, ...args: unknown[]) => {
      const result = native.prepare(sql).run(...(parameters(args) as never[]));
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    },
    getAllAsync: async (sql: string, ...args: unknown[]) =>
      native.prepare(sql).all(...(parameters(args) as never[])),
    getFirstAsync: async (sql: string, ...args: unknown[]) =>
      native.prepare(sql).get(...(parameters(args) as never[])) ?? null,
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
