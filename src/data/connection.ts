import { openDatabaseAsync } from "expo-sqlite";
import { initializeDatabase, type Database } from "./repository";
let connection: Promise<Database> | undefined;
export function connect(options?: { seed?: boolean }): Promise<Database> {
  if (!connection)
    connection = (async () => {
      const db = await openDatabaseAsync("tinig.db");
      try {
        await initializeDatabase(db, options);
        return db;
      } catch (error) {
        await db.closeAsync();
        throw error;
      }
    })().catch((error) => {
      connection = undefined;
      throw error;
    });
  return connection;
}
