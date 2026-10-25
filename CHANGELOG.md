# Changelog

Every release of `@hornetcloud/hive-js`. Versions follow
[semver](https://semver.org/): a minor version adds features and keeps old
code working; a major version would say what breaks.

## 1.4.1 (2026-10-25)

- This changelog, in the package and linked from the README.
- README: the Limitations section no longer says only `eq()` is supported;
  paging uses `getWithCount()`; the Supabase notes list the shared filter
  names; `setToken()` is described.
- `npm publish` first runs `check-docs`, which refuses a release whose README,
  CHANGELOG or website docs miss a method or the version.
- No change to the client's code.

## 1.4.0 (2026-10-25)

New API address: HornetHive's API moved to `https://api.hornethive.io/v1`.
`https://hornethive.io/api`, which 1.3 and earlier call, stops answering on
7 November 2026 (midnight, Malaysia time). Upgrade and change `apiUrl`:

```diff
- createHiveClient({ apiUrl: 'https://hornethive.io', apiKey })
+ createHiveClient({ apiUrl: 'https://api.hornethive.io', apiKey })
```

Added

- `apiUrl` on an `api.` host: `/v1` is added when the URL has no path, and a
  path you give (`…/v1`) is kept. Any other URL is an app origin, as before,
  and `/api` is added.
- Filters besides `eq`: `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`
  (`*` is the wildcard), `match`, `imatch`, `in`, `is`, `contains`,
  `containedBy`, `overlaps`, `textSearch`, `not`, and `filter` for any
  operator by name.
- `or('a.lt.18,b.gt.65')`, with nested `and(…)` and `or(…)`.
- `order()` can be called again to sort by more columns, and takes
  `{ ascending, nullsFirst }`.
- `getWithCount()`: the rows and how many match in all, for paging.
- `insert([rows])` inserts an array in one statement and returns an array.
- `upsert(rows, { onConflict, ignoreDuplicates })`.
- `delete({ returning: true })` returns the deleted rows.
- `rpc(fn, args)` calls a Postgres function.
- `schema(name)` returns a client for another schema than `public`.
- `openapi()` returns the database's OpenAPI 3.1 document.
- Row types: `get<Row>()`, `insert<Row>()`, `upsert<Row>()`, `update<Row>()`,
  `rpc<T>()`.
- Types `FilterOperator`, `OrderOptions`, `UpsertOptions`,
  `TextSearchOptions`.

Changed

- `eq()` sends `column=eq.value` rather than `column=value`. The API reads
  both the same way, except that a bare value starting with an operator
  (`eq.`, `gt.`…) used to be matched as text.
- `update()` and `delete()` accept any filter, not only `eq()`, and still
  refuse to run without one. The error says "at least one filter".

Deprecated

- `DatabaseQuery`, which nothing uses any more.

## 1.3.1 (2026-10-22)

- `memoryStorage` names the default token store for what it is. No change in
  behaviour.

## 1.3.0 (2026-10-22)

- The session token is kept in memory by default, in the browser too. It
  signs in to the whole HornetHive account, and in `localStorage` any script
  on the page could read it. Pass `storage: localStorage` to keep it across
  reloads.

## 1.2.0 (2026-10-22)

- `signUp(email, password, { fullname, acceptTerms: true })`: the API
  requires agreement to the Terms of Use and Privacy Policy.

## 1.1.0 (2026-10-13)

First release as `@hornetcloud/hive-js`.

- `signUp` sends `fullname`, which the API requires.
- In Node, the token falls back to memory instead of crashing on
  `localStorage`; `storage` takes a custom store.
- `select()` is sent to the API instead of being ignored.
- `signOut()` ends the session on the server.
- `auth.refresh()`, `db.sql(query, params)` and `HiveError` with the HTTP
  status.
