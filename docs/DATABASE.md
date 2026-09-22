# Connecting Tinig to the FreeHostia database

Written for: whoever sets this up on the hosting account.

The app talks to MySQL through one PHP file, `singers.php`. Nothing else on the
server changes — `students.php`, `pinoysingers.php` and `auth.php` keep working.

## 1. Create the table

FreeHostia control panel → **MySQL** → **phpMyAdmin**. Pick the database
`stenai4_nailes_db` in the left sidebar *first*, then open the **SQL** tab and
paste all of [server/schema.sql](../server/schema.sql). It creates the `singers`
table and inserts the six seed singers.

(Or skip this and use the `?install=1` button in step 3.)

## 2. Upload the PHP files

Upload these next to your existing `students.php`, using the File Manager or FTP:

| File | What it does |
| --- | --- |
| `singers.php` | The API the app calls. |
| `connection.php` | Same credentials as yours, plus `utf8mb4` so "Bamboo Mañalac" stores correctly. Overwrite yours, or keep yours — either works. |
| `setup-check.php` | The test page from step 3. Delete it when you're done. |
| `.htaccess` | Optional. Adds `/singers` and `/singers/12` as pretty URLs, keeps your `/students` rules. |

## 3. Prove the server side works

Open this in a browser:

```
https://YOUR-SITE.freehostia.com/setup-check.php
```

It checks PHP, the connection, the charset, the table, the columns, the engine
and the indexes — then runs a real create → read → update → favourite → delete
cycle and cleans up after itself. Every row must be green. It also prints the
exact `EXPO_PUBLIC_API_URL` line for the next step.

Buttons on the page: **Create table + seed** (`?install=1`) builds the table if
you skipped step 1. `?reset=1` drops it first — that deletes everything.

**Delete `setup-check.php` once the app is running.** It reveals your schema.

## 4. Point the app at it

```bash
cp .env.example .env
```

Put the URL `setup-check.php` printed into `.env`:

```
EXPO_PUBLIC_API_URL=https://YOUR-SITE.freehostia.com/singers.php
```

Then restart Expo with the cache cleared — Expo inlines this value at build
time, so a plain restart is not enough:

```bash
npx expo start -c
```

Remove or blank that line and the app goes back to the offline SQLite directory
on the device. Nothing else needs changing.

## The API

| Request | Result |
| --- | --- |
| `GET singers.php` | Every singer, A–Z |
| `GET singers.php?id=5` | One singer |
| `GET singers.php?q=lea` | Search name, hometown, song |
| `GET singers.php?genre=Pop` | One genre |
| `GET singers.php?favorite=1` | Saved only |
| `POST singers.php` | Create, JSON body → `201` + the new row |
| `PUT singers.php?id=5` | Update → the updated row |
| `PATCH singers.php?id=5` | Toggle favourite, or send `{"favorite":1}` |
| `DELETE singers.php?id=5` | Delete |

Errors come back as `{"status":0,"message":"...","errors":{"name":"..."}}` with
a real HTTP status: `422` for a bad field, `409` for a duplicate name, `404` for
a missing singer. The app shows `message` to the reader as it is.

## Turning on the API token

`auth.php` is already on the server. To require it:

1. In `singers.php`, change `define('REQUIRE_AUTH', false)` to `true`.
2. In `.env`, uncomment `EXPO_PUBLIC_API_TOKEN` and set it to the token in
   `auth.php`.
3. `npx expo start -c`.

The token ships inside the app, so it keeps casual traffic out — it is not a
secret. Anything stronger needs real accounts.

## When something goes wrong

**"Couldn't reach the directory"** — the URL in `.env` is wrong, or you didn't
restart with `-c`. Open the URL in a browser: it should print JSON.

**Works on the phone, fails in the browser** — CORS. `singers.php` sends the
headers itself; if the host also sends its own `Access-Control-Allow-Origin`,
the duplicate breaks it. Remove any CORS lines from `.htaccess`.

**Accented names come back mangled** — you're on the old `connection.php`
without `set_charset('utf8mb4')`. Upload the one from `server/`.

**Saving fails with a 405, or PUT/DELETE never arrive** — the host is blocking
them. Add `EXPO_PUBLIC_API_METHOD_OVERRIDE=1` to `.env`; writes then go out as
POST with `?_method=PUT`, which `singers.php` already understands.

**`CREATE TABLE` fails mentioning `CURRENT_TIMESTAMP`** — MySQL older than 5.6.
The fallback is at the bottom of `schema.sql`.

## Offline

The app keeps a full copy of the directory in SQLite on the device and reads
every screen from that copy, so it opens and works with no signal. Writes are
applied to the copy immediately and queued; the queue is pushed whenever the
server can be reached, and once it's empty the server's list is pulled back
over the copy. A line under the masthead says when you're offline or how many
changes are waiting — tap it to retry now.

Retries also happen on their own: when the app returns to the foreground, when
the browser reports the network is back, and every 30 seconds while anything is
waiting.

**The server is the source of truth.** Rules when the two disagree:

- A singer added offline gets a temporary negative id until the server issues a
  real one. Editing it again before it's sent changes the queued write rather
  than adding a second.
- Adding then deleting a singer offline sends nothing at all.
- Repeated edits or favourite taps on the same singer collapse to the last one.
- A write the server refuses for good — a name someone else already used, a
  singer someone else deleted — is dropped, the reason is shown in that same
  line, and the next pull restores the server's version of the row. A write
  that failed only because the network did stays queued.
- Two people editing the same singer is last-write-wins. There's no field-level
  merge.

To watch it work: load the directory once, turn on airplane mode, add and edit
a few singers, then turn it off again.

Offline mode is only active when `EXPO_PUBLIC_API_URL` is set. Without it there
is no server, so the SQLite file *is* the directory and nothing syncs.
