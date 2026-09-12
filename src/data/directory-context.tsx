import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { createRepository, type Database } from "./repository";
import { connect } from "./connection";
import type { Singer, SingerInput } from "./singers";
import { ActionButton } from "@/components/directory-ui";
type DirectoryContextType = {
  singers: Singer[];
  create: (input: SingerInput) => Promise<number>;
  update: (id: number, input: SingerInput) => Promise<void>;
  remove: (id: number) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
};
const DirectoryContext = createContext<DirectoryContextType | null>(null);
export function DirectoryProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>();
  const [singers, setSingers] = useState<Singer[]>([]);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    connect()
      .then(async (database) => {
        const rows = await createRepository(database).list();
        if (active) {
          setSingers(rows);
          setDb(database);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  // Serialize writes and refreshes to avoid stale lists after rapid actions.
  const mutate = useCallback(
    <T,>(
      operation: (
        repository: ReturnType<typeof createRepository>,
      ) => Promise<T>,
    ): Promise<T> => {
      const pending = queue.current
        .catch(() => {})
        .then(async () => {
          if (!db) throw new Error("Directory is still opening.");
          const repository = createRepository(db);
          let result!: T;
          let rows: Singer[] = [];
          await db.withTransactionAsync(async () => {
            result = await operation(repository);
            rows = await repository.list();
          });
          setSingers(rows);
          return result;
        });
      queue.current = pending;
      return pending;
    },
    [db],
  );
  if (!db)
    return (
      <View className="flex-1 items-center justify-center bg-paper px-8 gap-4">
        {error ? (
          <>
            <Text className="text-xl font-semibold text-ink">
              Couldn’t open your directory
            </Text>
            <Text className="text-muted text-center">
              Check available storage and try again. In a browser, use a regular
              window with site storage enabled.
            </Text>
            <ActionButton
              label="Try again"
              onPress={() => {
                setError(false);
                setAttempt((n) => n + 1);
              }}
            />
          </>
        ) : (
          <>
            <ActivityIndicator color="#b83826" />
            <Text className="text-muted">Opening your directory…</Text>
          </>
        )}
      </View>
    );
  return (
    <DirectoryContext
      value={{
        singers,
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
