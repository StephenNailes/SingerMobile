import { openDatabaseAsync } from "expo-sqlite";
import { initializeDatabase, type Database } from "./repository";
let connection: Promise<Database> | undefined;
export function connect(): Promise<Database> {
  if (!connection)
    connection = (async () => {
      const db = await openDatabaseAsync("tinig.db");
      try {
        await initializeDatabase(db);
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
