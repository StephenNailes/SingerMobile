import { apiUrl, createApiRepository } from "./api";
import { connect } from "./connection";
import { createRepository } from "./repository";
import { createSyncBackend, type SyncStatus } from "./sync";
import type { Singer, SingerInput } from "./singers";

/**
 * What the screens need from a directory, wherever it lives.
 *
 * Two implementations sit behind it. With EXPO_PUBLIC_API_URL set, the
 * directory lives in MySQL on the server and the device keeps a synced copy it
 * can read and write with no signal (see sync.ts). Without it, the SQLite file
 * on the device is the whole directory and there is nothing to sync.
 */
export type DirectoryBackend = {
  list: () => Promise<Singer[]>;
  get: (id: number) => Promise<Singer | null>;
  create: (input: SingerInput) => Promise<number>;
  update: (id: number, input: SingerInput) => Promise<void>;
  remove: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  /**
   * Run a write and the list refresh that follows it as one unit. On the
   * device-only backend that is a real transaction; the synced backend already
   * serializes its own writes, so the task simply runs.
   */
  atomic: <T>(task: () => Promise<T>) => Promise<T>;
  /** Null when the directory is device-only and there is nothing to sync. */
  status: () => SyncStatus | null;
  /** Called after a background sync changes the data. Returns an unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** Sync now. Resolves when the attempt finishes, successful or not. */
  refresh: () => Promise<void>;
};

/** True when the app is pointed at the shared database rather than the device. */
export function usesRemoteDirectory() {
  return apiUrl() !== "";
}

export async function openBackend(): Promise<DirectoryBackend> {
  if (usesRemoteDirectory()) {
    // The six starter singers live on the server, so don't seed them here.
    const database = await connect({ seed: false });
    const backend = createSyncBackend(database, createApiRepository());
    await backend.open();
    return backend;
  }

  const database = await connect();
  const repository = createRepository(database);
  return {
    ...repository,
    atomic: <T>(task: () => Promise<T>) => {
      let result!: T;
      return database
        .withTransactionAsync(async () => {
          result = await task();
        })
        .then(() => result);
    },
    status: () => null,
    subscribe: () => () => {},
    refresh: async () => {},
  };
}
