import { cleanSinger, type Singer, type SingerInput } from "./singers";

// Read from .env. Expo inlines these at build time, so each one has to be
// written out in full, static dot notation -- no destructuring, no brackets.
/** The singers.php endpoint, without a trailing slash. Empty when unset. */
export function apiUrl() {
  return (process.env.EXPO_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
}

function apiToken() {
  return (process.env.EXPO_PUBLIC_API_TOKEN ?? "").trim();
}

// Escape hatch for hosts that only allow GET and POST: set
// EXPO_PUBLIC_API_METHOD_OVERRIDE=1 and every PUT, PATCH and DELETE is sent as
// a POST carrying ?_method=, which singers.php unwraps.
function tunnelWrites() {
  return (process.env.EXPO_PUBLIC_API_METHOD_OVERRIDE ?? "") === "1";
}

const TIMEOUT_MS = 15000;

/**
 * An error whose message is already written for the reader -- either from the
 * server, or from a network failure we understand. friendlyError() passes these
 * through untouched instead of replacing them with the generic fallback.
 */
export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(message: string, status = 0, fields?: Record<string, string>) {
    super(message);
    this.name = "DirectoryError";
    this.status = status;
    this.fields = fields;
  }
}

type Query = Record<string, string | number | undefined>;

function endpoint(url: string, query: Query = {}) {
  const parameters = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  return parameters.length ? `${url}?${parameters.join("&")}` : url;
}

async function request<T>(
  method: string,
  query: Query,
  body?: unknown,
): Promise<T> {
  const url = apiUrl();
  if (!url)
    throw new ApiError(
      "No directory server is configured. Set EXPO_PUBLIC_API_URL in .env and restart Expo.",
    );

  const token = apiToken();
  const tunneled = tunnelWrites() && method !== "GET" && method !== "POST";

  // AbortSignal.timeout() is not in every Hermes build yet; do it by hand.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      endpoint(url, tunneled ? { ...query, _method: method } : query),
      {
        method: tunneled ? "POST" : method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(body === undefined
            ? {}
            : { "Content-Type": "application/json" as const }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
  } catch {
    throw new ApiError(
      controller.signal.aborted
        ? "The server took too long to answer. Check your connection and try again."
        : "Couldn’t reach the directory server. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // A PHP warning or a host error page arrived instead of JSON.
      throw new ApiError(
        response.ok
          ? "The server sent a reply the app couldn’t read. Open setup-check.php on the server to see why."
          : `The server reported an error (${response.status}).`,
        response.status,
      );
    }
  }

  if (!response.ok) {
    const details = (payload ?? {}) as {
      message?: string;
      errors?: Record<string, string>;
    };
    throw new ApiError(
      details.message ?? `The server reported an error (${response.status}).`,
      response.status,
      details.errors,
    );
  }

  return payload as T;
}

/**
 * The same surface createRepository() exposes over SQLite, backed by
 * singers.php instead. Every write is validated here first so a bad field is
 * caught before it costs a round trip.
 */
export function createApiRepository() {
  return {
    list: () => request<Singer[]>("GET", {}),
    get: (id: number) => request<Singer | null>("GET", { id }),
    async create(input: SingerInput) {
      const singer = await request<Singer>("POST", {}, cleanSinger(input));
      return singer.id;
    },
    async update(id: number, input: SingerInput) {
      await request<Singer>("PUT", { id }, cleanSinger(input));
    },
    async remove(id: number) {
      await request<{ status: number }>("DELETE", { id });
    },
    async toggleFavorite(id: number) {
      await request<Singer>("PATCH", { id }, {});
    },
    /**
     * Sets the flag outright rather than flipping it. A queued favourite can
     * then be retried safely -- sending it twice lands on the same answer.
     */
    async setFavorite(id: number, favorite: boolean) {
      await request<Singer>("PATCH", { id }, { favorite: favorite ? 1 : 0 });
    },
  };
}
