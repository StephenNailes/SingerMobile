import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ActivityIndicator, AppState, Platform, Text, View } from "react-native";
import {
  openBackend,
  usesRemoteDirectory,
  type DirectoryBackend,
} from "./backend";
import type { SyncStatus } from "./sync";
import type { Singer, SingerInput } from "./singers";
import { ActionButton } from "@/components/directory-ui";
type DirectoryContextType = {
  singers: Singer[];
  /** Null when the directory is device-only and there is nothing to sync. */
  status: SyncStatus | null;
  refresh: () => Promise<void>;
  create: (input: SingerInput) => Promise<number>;
  update: (id: number, input: SingerInput) => Promise<void>;
  remove: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
};
const DirectoryContext = createContext<DirectoryContextType | null>(null);
// How long to wait before trying the server again while writes are waiting.
const RETRY_MS = 30000;
export function DirectoryProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<DirectoryBackend>();
  const [singers, setSingers] = useState<Singer[]>([]);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    openBackend()
      .then(async (opened) => {
        const rows = await opened.list();
        if (!active) return;
        setSingers(rows);
        setStatus(opened.status());
        setBackend(opened);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  // A sync that finishes in the background has to reach the screen.
  useEffect(() => {
    if (!backend) return;
    return backend.subscribe(() => {
      setStatus(backend.status());
      backend.list().then(setSingers).catch(() => {});
    });
  }, [backend]);
  // Try the server again when the app comes back to the foreground, when the
  // browser says the network is back, and on a slow timer while writes wait.
  useEffect(() => {
    if (!backend || !usesRemoteDirectory()) return;
    const retry = () => {
      backend.refresh().catch(() => {});
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") retry();
    });
    const timer = setInterval(() => {
      const current = backend.status();
      if (current && (current.pending > 0 || !current.online)) retry();
    }, RETRY_MS);
    if (Platform.OS === "web") window.addEventListener("online", retry);
    return () => {
      subscription.remove();
      clearInterval(timer);
      if (Platform.OS === "web") window.removeEventListener("online", retry);
    };
  }, [backend]);
  // Serialize writes and refreshes to avoid stale lists after rapid actions.
  const mutate = useCallback(
    <T,>(operation: (directory: DirectoryBackend) => Promise<T>): Promise<T> => {
      const pending = queue.current
        .catch(() => {})
        .then(async () => {
          if (!backend) throw new Error("Directory is still opening.");
          const { result, rows } = await backend.atomic(async () => ({
            result: await operation(backend),
            rows: await backend.list(),
          }));
          setSingers(rows);
          setStatus(backend.status());
          return result;
        });
      queue.current = pending;
      return pending;
    },
    [backend],
  );
  // Nothing cached and the server is unreachable: there is genuinely nothing to
  // show, so ask rather than pretend the directory is empty.
  const stranded =
    backend !== undefined &&
    status !== null &&
    !status.online &&
    status.lastSyncedAt === null &&
    singers.length === 0;
  if (!backend || stranded)
    return (
      <View className="flex-1 items-center justify-center bg-paper px-8 gap-4">
        {error || stranded ? (
          <>
            <Text className="text-xl font-semibold text-ink">
              {usesRemoteDirectory()
                ? "Couldn’t reach the directory"
                : "Couldn’t open your directory"}
            </Text>
            <Text className="text-muted text-center">
              {usesRemoteDirectory()
                ? "Check your internet connection and try again. Once the directory has loaded once, it stays available offline."
                : "Check available storage and try again. In a browser, use a regular window with site storage enabled."}
            </Text>
            <ActionButton
              label="Try again"
              onPress={() => {
                if (backend) {
                  backend.refresh().catch(() => {});
                  return;
                }
                setError(false);
                setAttempt((n) => n + 1);
              }}
            />
          </>
        ) : (
          <>
            <ActivityIndicator color="#b83826" />
            <Text className="text-muted">
              {usesRemoteDirectory()
                ? "Loading the directory…"
                : "Opening your directory…"}
            </Text>
          </>
        )}
      </View>
    );
  return (
    <DirectoryContext
      value={{
        singers,
        status,
        refresh: () => backend.refresh(),
        create: (input) => mutate((r) => r.create(input)),
        update: (id, input) => mutate((r) => r.update(id, input)),
        remove: (id) => mutate((r) => r.remove(id)),
        toggleFavorite: (id) => mutate((r) => r.toggleFavorite(id)),
      }}
    >
      {children}
    </DirectoryContext>
  );
}
export function useDirectory() {
  const value = useContext(DirectoryContext);
  if (!value) throw new Error("useDirectory requires DirectoryProvider");
  return value;
}
