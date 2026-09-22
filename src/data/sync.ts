import { ApiError, type createApiRepository } from "./api";
import {
  columns,
  createRepository,
  friendlyError,
  values,
  type Database,
} from "./repository";
import { cleanSinger, type Singer, type SingerInput } from "./singers";

/**
 * Offline mode.
 *
 * The device keeps a full copy of the directory in SQLite and every screen
 * reads from that copy, so the app opens and works with no signal at all.
 * Writes are applied to the copy at once and appended to an outbox; the outbox
 * is pushed to the server whenever it can be reached, and once it is empty the
 * server's list is pulled back over the copy.
 *
 * The server is the source of truth. A write the server refuses for good --
 * a duplicate name, a singer someone else deleted -- is dropped from the
 * outbox, and the next pull restores whatever the server holds. A write that
 * only failed because the network did stays queued and is retried.
 *
 * Rows created offline get temporary negative ids until the server issues real
 * ones, so the UI has something stable to key off in the meantime.
 */

type Api = ReturnType<typeof createApiRepository>;

type QueuedOp = {
  seq: number;
  op: "create" | "update" | "delete" | "favorite";
  target: number;
  payload: string;
};

export type SyncStatus = {
  /** Did the last attempt to reach the server succeed? */
  online: boolean;
  /** Is a sync running right now? */
  syncing: boolean;
  /** Writes still waiting for the server. */
  pending: number;
  /** When the directory was last pulled, or null if it never has been. */
  lastSyncedAt: string | null;
  /** Why the last attempt failed, ready to show as it is. */
  lastError: string | null;
  /** Writes the server refused for good, since the app opened. */
  rejected: string[];
};

const idle: SyncStatus = {
  online: true,
  syncing: false,
  pending: 0,
  lastSyncedAt: null,
  lastError: null,
  rejected: [],
};

export function createSyncBackend(db: Database, api: Api) {
  const repository = createRepository(db);
  const listeners = new Set<() => void>();
  let status: SyncStatus = idle;

  // One lane for everything that touches the database or the outbox, so a
  // background sync can never interleave with a write from the screen.
  let lane: Promise<unknown> = Promise.resolve();
  const serialize = <T>(task: () => Promise<T>): Promise<T> => {
    const next = lane.catch(() => {}).then(task);
    lane = next.catch(() => {});
    return next;
  };

  function announce(patch: Partial<SyncStatus>) {
    status = { ...status, ...patch };
    listeners.forEach((listener) => listener());
  }

  /* ------------------------------------------------------------ outbox */

  async function pendingCount() {
    const row = await db.getFirstAsync<{ count: number }>(
      "SELECT count(*) AS count FROM outbox",
    );
    return row?.count ?? 0;
  }

  async function queued(target: number, op: QueuedOp["op"]) {
    return db.getFirstAsync<QueuedOp>(
      "SELECT seq, op, target, payload FROM outbox WHERE target = ? AND op = ? ORDER BY seq LIMIT 1",
      [target, op],
    );
  }

  async function enqueue(
    op: QueuedOp["op"],
    target: number,
    payload: unknown = null,
  ) {
    const body = payload === null ? "" : JSON.stringify(payload);

    if (op === "update" || op === "favorite" || op === "delete") {
      const create = await queued(target, "create");
      if (op === "update" && create) {
        // Still unsent: edit the create in place instead of queueing a second
        // write against an id the server has never seen.
        await db.runAsync("UPDATE outbox SET payload = ? WHERE seq = ?", [
          body,
          create.seq,
        ]);
        return;
      }
      if (op === "delete" && create) {
        // Created and deleted before either reached the server: forget it.
        await db.runAsync("DELETE FROM outbox WHERE target = ?", target);
        return;
      }
      // Each of these carries the whole new state, so an older one of the same
      // kind is dead weight.
      await db.runAsync(
        op === "delete"
          ? "DELETE FROM outbox WHERE target = ? AND op IN ('update','favorite')"
          : "DELETE FROM outbox WHERE target = ? AND op = ?",
        op === "delete" ? [target] : [target, op],
      );
    }

    await db.runAsync(
      "INSERT INTO outbox (op, target, payload) VALUES (?, ?, ?)",
      [op, target, body],
    );
  }

  /* -------------------------------------------------------- local writes */

  async function nextTempId() {
    const row = await db.getFirstAsync<{ lowest: number | null }>(
      "SELECT min(id) AS lowest FROM singers",
    );
    return Math.min(0, row?.lowest ?? 0) - 1;
  }

  async function localCreate(input: SingerInput) {
    const singer = cleanSinger(input);
    const id = await nextTempId();
    await db.runAsync(
      `INSERT INTO singers (id, ${columns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ...values(singer)],
    );
    await enqueue("create", id, singer);
    return id;
  }

  async function localUpdate(id: number, input: SingerInput) {
    const singer = cleanSinger(input);
    const result = await db.runAsync(
      `UPDATE singers SET name=?, genre=?, hometown=?, bio=?, song=?, imageUrl=?, sourceUrl=?,
       updatedAt=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`,
      [...values(singer), id],
    );
    if (!result.changes)
      throw new Error("This singer no longer exists. Return to the directory.");
    await enqueue("update", id, singer);
  }

  async function localRemove(id: number) {
    await db.runAsync("DELETE FROM singers WHERE id = ?", id);
    await enqueue("delete", id);
  }

  async function localToggleFavorite(id: number) {
    await db.runAsync(
      "UPDATE singers SET favorite = 1 - favorite WHERE id = ?",
      id,
    );
    const row = await db.getFirstAsync<{ favorite: number }>(
      "SELECT favorite FROM singers WHERE id = ?",
      id,
    );
    if (!row) return;
    await enqueue("favorite", id, { favorite: row.favorite });
  }

  /* ---------------------------------------------------------------- sync */

  async function push(op: QueuedOp) {
    switch (op.op) {
      case "create": {
        const id = await api.create(JSON.parse(op.payload) as SingerInput);
        // Adopt the server's id, here and in anything still queued for this row.
        await db.runAsync("UPDATE singers SET id = ? WHERE id = ?", [
          id,
          op.target,
        ]);
        await db.runAsync("UPDATE outbox SET target = ? WHERE target = ?", [
          id,
          op.target,
        ]);
        return;
      }
      case "update":
        return api.update(op.target, JSON.parse(op.payload) as SingerInput);
      case "favorite":
        return api.setFavorite(
          op.target,
          (JSON.parse(op.payload) as { favorite: number }).favorite === 1,
        );
      case "delete":
        return api.remove(op.target);
    }
  }

  /** Drains the outbox. Returns false if the network stopped it part-way. */
  async function flush(rejected: string[]) {
    for (;;) {
      const op = await db.getFirstAsync<QueuedOp>(
        "SELECT seq, op, target, payload FROM outbox ORDER BY seq LIMIT 1",
      );
      if (!op) return true;
      try {
        await push(op);
      } catch (error) {
        const refused =
          error instanceof ApiError && error.status >= 400 && error.status < 500;
        if (!refused) throw error;
        // The server will never accept this one. Drop it and let the pull
        // that follows put the server's version of the row back.
        rejected.push(error instanceof Error ? error.message : String(error));
        await db.runAsync("DELETE FROM outbox WHERE seq = ?", op.seq);
        continue;
      }
      await db.runAsync("DELETE FROM outbox WHERE seq = ?", op.seq);
    }
  }

  /** Replaces the local copy with the server's. Only safe once the outbox is empty. */
  async function pull() {
    const rows = await api.list();
    const stamp = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM singers");
      for (const singer of rows)
        await db.runAsync(
          `INSERT INTO singers (id, ${columns}, favorite, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            singer.id,
            ...values(singer),
            singer.favorite,
            singer.createdAt,
            singer.updatedAt,
          ],
        );
      await db.runAsync(
        "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('lastSyncedAt', ?)",
        stamp,
      );
    });
    return stamp;
  }

  let running: Promise<void> | undefined;
  function sync(): Promise<void> {
    if (!running)
      running = serialize(async () => {
        announce({ syncing: true });
        const rejected: string[] = [];
        try {
          const drained = await flush(rejected);
          const lastSyncedAt = drained ? await pull() : status.lastSyncedAt;
          announce({
            online: true,
            lastError: null,
            lastSyncedAt,
            pending: await pendingCount(),
            rejected: [...status.rejected, ...rejected],
          });
        } catch (error) {
          announce({
            online: false,
            lastError: friendlyError(error),
            pending: await pendingCount(),
            rejected: [...status.rejected, ...rejected],
          });
        } finally {
          announce({ syncing: false });
        }
      }).finally(() => {
        running = undefined;
      });
    return running;
  }

  /* ------------------------------------------------------------- opening */

  async function open() {
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM sync_meta WHERE key = 'lastSyncedAt'",
    );
    status = {
      ...idle,
      lastSyncedAt: row?.value ?? null,
      pending: await pendingCount(),
    };
    // Don't wait for it: the cached directory is shown immediately and the
    // screen updates when the sync lands.
    void sync();
  }

  /**
   * Every write takes the same path: apply it locally, republish the count of
   * writes still waiting, then try the server without making the caller wait.
   */
  function write<T>(task: () => Promise<T>): Promise<T> {
    return serialize(async () => {
      const result = await task();
      announce({ pending: await pendingCount() });
      return result;
    }).then((result) => {
      void sync();
      return result;
    });
  }

  return {
    open,
    status: () => status,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh: sync,
    list: repository.list,
    get: repository.get,
    create: (input: SingerInput) => write(() => localCreate(input)),
    update: (id: number, input: SingerInput) =>
      write(() => localUpdate(id, input)),
    remove: (id: number) => write(() => localRemove(id)),
    toggleFavorite: (id: number) => write(() => localToggleFavorite(id)),
    // Reads that follow a write are already inside the lane above; a second
    // transaction here would deadlock on the web's single connection.
    atomic: <T>(task: () => Promise<T>) => task(),
  };
}

export type SyncBackend = ReturnType<typeof createSyncBackend>;
export type { Singer };
