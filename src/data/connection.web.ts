import initSqlJs, {
  type Database as SqlJsDatabase,
  type BindParams,
} from "sql.js";
import { initializeDatabase, type Database } from "./repository";

// Expo 57's SQLite web worker fails in Metro on this Windows setup. The browser
// uses the same SQL repository against SQLite WASM, durably saved in IndexedDB.
// Native platforms resolve connection.ts and use expo-sqlite directly.
let connection: Promise<Database> | undefined;
function openStorage(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("tinig-sqlite", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Close other Tinig tabs and retry."));
    request.onsuccess = () => resolve(request.result);
  });
}
function readFile(storage: IDBDatabase): Promise<Uint8Array | undefined> {
  return new Promise((resolve, reject) => {
    const tx = storage.transaction("files", "readonly");
    const request = tx.objectStore("files").get("tinig.db");
    tx.oncomplete = () => resolve(request.result);
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}
function writeFile(storage: IDBDatabase, bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = storage.transaction("files", "readwrite");
    tx.objectStore("files").put(bytes, "tinig.db");
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}
export function connect(options?: { seed?: boolean }): Promise<Database> {
  if (!connection)
    connection = (async () => {
      if (!navigator.locks)
        throw new Error("Use a current browser on localhost or HTTPS.");
      const SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
      const storage = await openStorage();
      let native: SqlJsDatabase = new SQL.Database(await readFile(storage));
      let inTransaction = false;
      const bindings = (args: unknown[]): BindParams =>
        (args.length === 1 && typeof args[0] === "object"
          ? args[0]
          : args) as BindParams;
      const query = <T>(sql: string, args: unknown[]) => {
        const statement = native.prepare(sql);
        try {
          statement.bind(bindings(args));
          const rows: T[] = [];
          while (statement.step()) rows.push(statement.getAsObject() as T);
          return rows;
        } finally {
          statement.free();
        }
      };
      const locked = <T>(
        operation: () => T | Promise<T>,
        persist: boolean,
      ): Promise<T> => {
        if (inTransaction) return Promise.resolve(operation());
        return navigator.locks.request("tinig-sqlite-file", async () => {
          const bytes = await readFile(storage);
          native.close();
          native = new SQL.Database(bytes);
          const result = await operation();
          if (persist) await writeFile(storage, native.export());
          return result;
        });
      };
      const db: Database = {
        execAsync: (sql) =>
          locked(() => {
            native.exec(sql);
          }, true),
        runAsync: (sql: string, ...args: unknown[]) =>
          locked(() => {
            native.run(sql, bindings(args));
            return {
              changes: native.getRowsModified(),
              lastInsertRowId: Number(
                query<{ id: number }>("SELECT last_insert_rowid() AS id", [])[0]
                  .id,
              ),
            };
          }, true),
        getAllAsync: <T>(sql: string, ...args: unknown[]) =>
          locked(() => query<T>(sql, args), false),
        getFirstAsync: <T>(sql: string, ...args: unknown[]) =>
          locked(() => query<T>(sql, args)[0] ?? null, false),
        withTransactionAsync: (task) =>
          locked(async () => {
            native.exec("BEGIN");
            inTransaction = true;
            try {
              await task();
              native.exec("COMMIT");
            } catch (error) {
              native.exec("ROLLBACK");
              throw error;
            } finally {
              inTransaction = false;
            }
          }, true),
      };
      try {
        await initializeDatabase(db, options);
        return db;
      } catch (error) {
        native.close();
        storage.close();
        throw error;
      }
    })().catch((error) => {
      connection = undefined;
      throw error;
    });
  return connection;
}
