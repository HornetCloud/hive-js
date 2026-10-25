# HornetHive JS

JavaScript and TypeScript client for [HornetHive](https://hornethive.io): managed PostgreSQL you reach by REST, GraphQL or MCP. A Supabase-like API for database operations.

## Installation

```bash
npm install @hornetcloud/hive-js
```


## What changed

Every release, and what to do on upgrading, is in
[CHANGELOG.md](https://github.com/HornetCloud/hive-js/blob/main/CHANGELOG.md).
1.4 is the one to know: the API moved to `https://api.hornethive.io/v1`, and
the old address stops on 7 November 2026.

## Quick Start

```javascript
import { createHiveClient } from '@hornetcloud/hive-js'

const hive = createHiveClient({
  apiUrl: 'https://api.hornethive.io', // self-hosted: your app origin, without /api
  apiKey: 'your-api-key'               // Settings → API Keys in the dashboard
})
```

Since 1.4, an `apiUrl` whose host starts with `api.` is the API's own host:
`/v1` is added when the URL has no path, and a path you give (`/v1`) is kept.
Any other URL is an app origin, and `/api` is added to it. Before 1.4 the URL was
always an app origin (`https://hornethive.io`); HornetHive answers there
with a `Deprecation` header until the date in its `Sunset` header.

It runs in the browser and in Node 18+ (it uses the global `fetch`). The
session token is kept in memory, so it is gone when the page reloads or the
process ends. It signs in to the whole Hive account, which is why it is not
written to `localStorage` by default, where any script on the page can read
it. To keep it anyway, pass your own `storage` (`getItem` / `setItem` /
`removeItem`), for example `storage: localStorage` (since 1.3.0; before, the
browser default was `localStorage`).

Calling the data APIs from a browser needs your site's origin registered
under **Origins** in the dashboard.

## Authentication

### Sign Up

```javascript
try {
  const { user, token } = await hive.auth.signUp('user@example.com', 'password123', {
    fullname: 'Jane Doe',
    acceptTerms: true // they agreed to https://hornethive.io/terms and /privacy
  })
  console.log('Signed up:', user)
  // The session token is stored for you
} catch (error) {
  console.error('Sign up failed:', error.message)
}
```

### Sign In

```javascript
try {
  const { user, token } = await hive.auth.signIn('user@example.com', 'password123')
  console.log('Signed in:', user)
  // The session token is stored for you
} catch (error) {
  console.error('Sign in failed:', error.message)
}
```

### Refresh

A session token lasts 24 hours. Swap it for a fresh one before then:

```javascript
await hive.auth.refresh()
```

### Sign Out

Ends the session on the server, on every device, and forgets the token:

```javascript
await hive.auth.signOut()
```

### Check Auth Status

```javascript
const token = hive.auth.getToken()
if (token) {
  console.log('User is authenticated')
} else {
  console.log('User is not authenticated')
}
```

### Use API Key (Alternative to Auth)

```javascript
// Initialize with API key
const hive = createHiveClient({
  apiUrl: 'https://api.hornethive.io',
  apiKey: 'your-api-key'
})

// Or set it later
hive.setApiKey('your-api-key')

// Get current API key
const apiKey = hive.getApiKey()
```

## Database Operations

### Query Records

```javascript
// Get records (the first 10; use .limit() for up to 1000 per call)
try {
  const users = await hive.from('db-id').from('users').get()
  console.log('Users:', users)
} catch (error) {
  console.error('Query failed:', error.message)
}

// Select specific columns
const users = await hive.from('db-id')
  .from('users')
  .select('id, email, name')
  .get()

// Filter (multiple conditions are AND-ed)
const activeUsers = await hive.from('db-id')
  .from('users')
  .eq('active', true)
  .eq('plan', 'premium')
  .get()

// Every operator: eq, neq, gt, gte, lt, lte, like, ilike (* is the wildcard),
// match, imatch, in, is, contains, containedBy, overlaps, textSearch, not
const recent = await hive.from('db-id')
  .from('orders')
  .gte('total', 100)
  .lt('created_at', '2026-11-01')
  .in('status', ['paid', 'shipped'])
  .not('deleted_at', 'is', null)
  .textSearch('note', 'urgent & refund', { config: 'english' })
  .get()

// OR, in the REST API's syntax; groups nest with and(…) and or(…)
const either = await hive.from('db-id')
  .from('users')
  .or('age.lt.18,age.gt.65,and(member.is.true,plan.eq.pro)')
  .get()

// Order results (ASC by default); call order() again to sort by more
const users = await hive.from('db-id')
  .from('users')
  .order('plan')
  .order('created_at', { ascending: false, nullsFirst: false })
  .get()

// The rows and how many match in all, for paging
const { rows, count } = await hive.from('db-id')
  .from('users')
  .limit(20)
  .getWithCount()

// Pagination
const page = 1
const pageSize = 10
const users = await hive.from('db-id')
  .from('users')
  .limit(pageSize)
  .offset((page - 1) * pageSize)
  .get()

// Complex query with multiple filters
const users = await hive.from('db-id')
  .from('users')
  .select('id, email, name, plan')
  .eq('active', true)
  .eq('plan', 'premium')
  .order('created_at', 'desc')
  .limit(10)
  .offset(0)
  .get()
```

### Insert Record

```javascript
try {
  const newUser = await hive.from('db-id')
    .from('users')
    .insert({
      email: 'user@example.com',
      name: 'John Doe',
      age: 30,
      plan: 'free'
    })
  console.log('Created user:', newUser)
} catch (error) {
  console.error('Insert failed:', error.message)
}
```

### Insert Many, and Upsert

```javascript
// An array is inserted in one statement and returned as an array
const books = await hive.from('db-id').from('books').insert([
  { title: 'Dune', year: 1965 },
  { title: 'Ubik', year: 1969 },
])

// Update rows whose key exists, insert the rest. The key is the primary key
// unless onConflict names other unique columns; ignoreDuplicates skips them.
await hive.from('db-id').from('members').upsert(
  [{ email: 'aina@example.my', plan: 'pro' }],
  { onConflict: 'email' },
)
```

### Call a Function

Named arguments. A set-returning function gives rows, a scalar its value.
With a read-only key it runs read-only.

```javascript
const top = await hive.from('db-id').rpc('top_books', { n: 5 })
```

### Another Schema

```javascript
const orders = await hive.from('db-id').schema('shop').from('orders').get()
```

### OpenAPI

```javascript
// OpenAPI 3.1 for the database's tables and functions, built from its schema
const spec = await hive.from('db-id').openapi()
```

### Run SQL

One statement, with `$1`, `$2`… parameters. With a key that has only the
`read` scope it runs in a read-only transaction, so writes are refused.

```javascript
const { columns, rows } = await hive.from('db-id')
  .sql('SELECT plan, count(*) AS n FROM users WHERE created_at > $1 GROUP BY plan', ['2026-01-01'])
```

### Update Record

`update()`/`delete()` are bulk operations scoped by filters (like Supabase), not a positional id — at least one filter (`.eq()`, `.in()`, `.or()`…) is required, otherwise the call throws before it ever hits the network (protects against accidentally updating/deleting every row).

```javascript
try {
  const updated = await hive.from('db-id')
    .from('users')
    .eq('id', 'user-id')
    .update({
      name: 'Jane Doe',
      age: 31,
      plan: 'premium'
    })
  console.log('Updated users:', updated) // array — every row that matched
} catch (error) {
  console.error('Update failed:', error.message)
}
```

### Delete Record

```javascript
try {
  const { deleted } = await hive.from('db-id')
    .from('users')
    .eq('id', 'user-id')
    .delete()
  console.log(`${deleted} user(s) deleted`)
} catch (error) {
  console.error('Delete failed:', error.message)
}
```

## Real-World Examples

### Blog Application

```javascript
// Get published posts
const posts = await hive.from('db-id')
  .from('posts')
  .eq('published', true)
  .order('created_at', 'desc')
  .get()

// Create new post
const newPost = await hive.from('db-id')
  .from('posts')
  .insert({
    title: 'My First Post',
    content: 'Hello world!',
    author_id: 'user-id',
    published: false
  })

// Publish post
await hive.from('db-id')
  .from('posts')
  .eq('id', 'post-id')
  .update({ published: true })

// Get posts by author
const authorPosts = await hive.from('db-id')
  .from('posts')
  .eq('author_id', 'user-id')
  .order('created_at', 'desc')
  .get()
```

### E-commerce Application

```javascript
// Get active products
const products = await hive.from('db-id')
  .from('products')
  .eq('active', true)
  .eq('in_stock', true)
  .order('price', 'asc')
  .limit(20)
  .get()

// Create order
const order = await hive.from('db-id')
  .from('orders')
  .insert({
    user_id: 'user-id',
    total: 99.99,
    status: 'pending'
  })

// Get user's orders
const userOrders = await hive.from('db-id')
  .from('orders')
  .eq('user_id', 'user-id')
  .order('created_at', 'desc')
  .get()

// Update order status
await hive.from('db-id')
  .from('orders')
  .eq('id', 'order-id')
  .update({ status: 'completed' })
```

### User Management

```javascript
// Get active users
const activeUsers = await hive.from('db-id')
  .from('users')
  .eq('active', true)
  .eq('verified', true)
  .get()

// Search users by email, ignoring case
const users = await hive.from('db-id')
  .from('users')
  .ilike('email', '*@example.com')
  .get()

// Update user profile
await hive.from('db-id')
  .from('users')
  .eq('id', 'user-id')
  .update({
    name: 'New Name',
    bio: 'Updated bio',
    avatar_url: 'https://example.com/avatar.jpg'
  })
```

## Error Handling

Failed calls throw `HiveError`, with the HTTP `status` and the API's message:

```javascript
import { HiveError } from '@hornetcloud/hive-js'

try {
  const users = await hive.from('db-id').from('users').get()
} catch (error) {
  if (error instanceof HiveError) {
    switch (error.status) {
      case 401: // invalid or deactivated API key
      case 403: // missing scope, plan feature, wrong database, or suspended database
      case 404: // database not found (or not yours)
      case 429: // rate limit or monthly invocation limit
    }
  }
  console.error(error.message)
}
```

## Best Practices

### 1. Use try-catch for all async operations

```javascript
try {
  const result = await hive.from('db-id').from('users').get()
} catch (error) {
  console.error('Operation failed:', error.message)
}
```

### 2. Chain methods for cleaner code

```javascript
// Good
const users = await hive.from('db-id')
  .from('users')
  .eq('active', true)
  .order('created_at', 'desc')
  .limit(10)
  .get()

// Avoid multiple calls
const users = await hive.from('db-id').from('users').get()
// Then filter in JS (inefficient)
```

### 3. Select only needed columns

```javascript
// Good - only fetch what you need
const users = await hive.from('db-id')
  .from('users')
  .select('id, email')
  .get()

// Avoid - fetches all columns
const users = await hive.from('db-id')
  .from('users')
  .select('*')
  .get()
```

### 4. Use pagination for large datasets

```javascript
const pageSize = 50
const page = 3

const { rows, count } = await hive.from('db-id')
  .from('users')
  .order('id')
  .limit(pageSize)
  .offset((page - 1) * pageSize)
  .getWithCount()

const pages = Math.ceil(count / pageSize)
```

## Limitations

- **No joins in one call** - each query reads one table or view. Join in a
  view, a function (`.rpc()`) or `.sql()`. GraphQL does not follow foreign
  keys either.
- **No realtime subscriptions.**
- **At most 1000 rows per call** - page with `.limit()` and `.offset()`, and
  `getWithCount()` for the total.
- **`update()`/`delete()` are bulk operations** - scoped by filters, not a
  single row id. They affect every row matching the filters and need at least
  one filter (`.eq()`, `.in()`, `.or()`…): there is no "update/delete
  everything" shortcut.

## Migration from Supabase

Hive provides a similar API to Supabase for easy migration:

**Supabase:**
```javascript
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('active', true)
```

**Hive:**
```javascript
const users = await hive.from('db-id')
  .from('users')
  .select('*')
  .eq('active', true)
  .get()
```

**Key differences:**
- Hive requires database ID: `hive.from('db-id').from('table')`
- Hive uses `.get()` (or `getWithCount()`) to execute a query, and returns the
  rows themselves rather than `{ data, error }`; a failure throws `HiveError`
- The filters have the same names (`eq`, `gt`, `in`, `ilike`, `or`, `not`…),
  as do `upsert()` and `rpc()`. Embedded relations (`select('*, orders(*)')`)
  are not supported
- Hive API key instead of Supabase anon key

## License

MIT
