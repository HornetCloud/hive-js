import { HiveConfig, SqlResult, FilterOperator, OrderOptions, UpsertOptions, TextSearchOptions } from './types'
import { apiBase, request, requestWithHeaders } from './utils'

// Values inside in.(…) and or=(…) are double-quoted when they hold a comma,
// a parenthesis, a quote or a backslash, as the REST API reads them.
function quoteValue(v: unknown): string {
  const s = String(v)
  return /[,()"\\]/.test(s) ? `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : s
}

function operand(op: FilterOperator, value: unknown): string {
  if (op === 'in') {
    const list = Array.isArray(value) ? value : [value]
    return `in.(${list.map(quoteValue).join(',')})`
  }
  if ((op === 'cs' || op === 'cd' || op === 'ov') && Array.isArray(value)) {
    return `${op}.{${value.map(quoteValue).join(',')}}`
  }
  return `${op}.${value === null ? 'null' : String(value)}`
}

export class Database {
  private config: HiveConfig
  private dbId: string
  private apiKey: string
  private table: string = ''
  private schemaName?: string
  private selectCols = '*'
  private filters: [string, string][] = []
  private orders: string[] = []
  private limitN?: number
  private offsetN?: number

  constructor(config: HiveConfig, dbId: string, apiKey: string) {
    this.config = config
    this.dbId = dbId
    this.apiKey = apiKey
  }

  from(table: string): Database {
    this.table = table
    // Reset query state so filters/order/limit from a previous chain on a
    // reused instance (e.g. `const db = hive.from(dbId)` called once, then
    // `db.from('a')...` and `db.from('b')...` separately) never leak in.
    this.selectCols = '*'
    this.filters = []
    this.orders = []
    this.limitN = undefined
    this.offsetN = undefined
    return this
  }

  /**
   * schema returns a client for another schema than public; this one is
   * left as it was: db.schema('shop').from('orders').get().
   */
  schema(name: string): Database {
    const other = new Database(this.config, this.dbId, this.apiKey)
    other.schemaName = name
    return other
  }

  select(columns: string): Database {
    this.selectCols = columns
    return this
  }

  /** filter adds any operator: filter('price', 'gt', 10). */
  filter(column: string, op: FilterOperator, value: unknown): Database {
    this.filters.push([column, operand(op, value)])
    return this
  }

  eq(column: string, value: unknown): Database { return this.filter(column, 'eq', value) }
  neq(column: string, value: unknown): Database { return this.filter(column, 'neq', value) }
  gt(column: string, value: unknown): Database { return this.filter(column, 'gt', value) }
  gte(column: string, value: unknown): Database { return this.filter(column, 'gte', value) }
  lt(column: string, value: unknown): Database { return this.filter(column, 'lt', value) }
  lte(column: string, value: unknown): Database { return this.filter(column, 'lte', value) }
  /** like matches a pattern; `*` (or `%`) is the wildcard. */
  like(column: string, pattern: string): Database { return this.filter(column, 'like', pattern) }
  ilike(column: string, pattern: string): Database { return this.filter(column, 'ilike', pattern) }
  /** match is a regular expression; imatch ignores case. */
  match(column: string, regex: string): Database { return this.filter(column, 'match', regex) }
  imatch(column: string, regex: string): Database { return this.filter(column, 'imatch', regex) }
  in(column: string, values: unknown[]): Database { return this.filter(column, 'in', values) }
  /** is tests for null, true or false. */
  is(column: string, value: null | boolean): Database { return this.filter(column, 'is', value) }
  /** contains: an array or range column holds all of these. */
  contains(column: string, values: unknown[] | string): Database { return this.filter(column, 'cs', values) }
  containedBy(column: string, values: unknown[] | string): Database { return this.filter(column, 'cd', values) }
  overlaps(column: string, values: unknown[] | string): Database { return this.filter(column, 'ov', values) }

  /** textSearch is full-text search; type picks how the query is read. */
  textSearch(column: string, query: string, options: TextSearchOptions = {}): Database {
    const op = options.type ? { plain: 'plfts', phrase: 'phfts', websearch: 'wfts' }[options.type] : 'fts'
    const lang = options.config ? `(${options.config})` : ''
    this.filters.push([column, `${op}${lang}.${query}`])
    return this
  }

  /** not negates one filter: not('deleted_at', 'is', null). */
  not(column: string, op: FilterOperator, value: unknown): Database {
    this.filters.push([column, 'not.' + operand(op, value)])
    return this
  }

  /**
   * or matches rows that pass any of the conditions, written as the REST
   * API takes them: or('age.lt.18,age.gt.65'). Groups nest: and(…), or(…).
   */
  or(conditions: string): Database {
    this.filters.push(['or', `(${conditions})`])
    return this
  }

  /**
   * order sorts by a column; call it again to sort by more. The second
   * argument is 'asc' or 'desc', or { ascending, nullsFirst }.
   */
  order(column: string, direction: 'asc' | 'desc' | OrderOptions = 'asc'): Database {
    const opts: OrderOptions = typeof direction === 'string' ? { ascending: direction === 'asc' } : direction
    let term = `${column}.${opts.ascending === false ? 'desc' : 'asc'}`
    if (opts.nullsFirst !== undefined) term += opts.nullsFirst ? '.nullsfirst' : '.nullslast'
    this.orders.push(term)
    return this
  }

  limit(n: number): Database {
    this.limitN = n
    return this
  }

  offset(n: number): Database {
    this.offsetN = n
    return this
  }

  private url(path = ''): string {
    return `${apiBase(this.config.apiUrl)}/rest/${encodeURIComponent(this.dbId)}${path}`
  }

  private tableUrl(params?: URLSearchParams): string {
    const qs = params && params.toString() ? `?${params.toString()}` : ''
    return this.url(`/${encodeURIComponent(this.table)}${qs}`)
  }

  private headers(write: boolean, json = false, prefer: string[] = []): Record<string, string> {
    const h: Record<string, string> = { Authorization: `Bearer ${this.apiKey}` }
    if (json) h['Content-Type'] = 'application/json'
    if (this.schemaName) h[write ? 'Content-Profile' : 'Accept-Profile'] = this.schemaName
    if (prefer.length) h['Prefer'] = prefer.join(',')
    return h
  }

  private filterParams(): URLSearchParams {
    const params = new URLSearchParams()
    for (const [key, value] of this.filters) params.append(key, value)
    return params
  }

  private selectParam(params: URLSearchParams): URLSearchParams {
    if (this.selectCols && this.selectCols.trim() !== '*') {
      params.append('select', this.selectCols.split(',').map((c) => c.trim()).filter(Boolean).join(','))
    }
    return params
  }

  private listParams(): URLSearchParams {
    const params = this.selectParam(this.filterParams())
    if (this.orders.length) params.append('order', this.orders.join(','))
    if (this.limitN !== undefined) params.append('limit', String(this.limitN))
    if (this.offsetN) params.append('offset', String(this.offsetN))
    return params
  }

  // update/delete are bulk operations scoped by filters (like Supabase)
  // rather than a positional id — at least one is required, otherwise every
  // row in the table would be touched.
  private requiredFilters(): URLSearchParams {
    if (this.filters.length === 0) {
      throw new Error('at least one filter (.eq(), .in(), .or()…) is required for update()/delete()')
    }
    return this.selectParam(this.filterParams())
  }

  /**
   * get returns the matching rows. Without .limit() the API returns the
   * first 10; the most one call can return is 1000.
   */
  async get<Row = any>(): Promise<Row[]> {
    return request<Row[]>(this.tableUrl(this.listParams()), { headers: this.headers(false) }, 'Query failed')
  }

  /** getWithCount is get, and how many rows match in all, for paging. */
  async getWithCount<Row = any>(): Promise<{ rows: Row[]; count: number }> {
    const { body, headers } = await requestWithHeaders<Row[]>(this.tableUrl(this.listParams()), {
      headers: this.headers(false, false, ['count=exact']),
    }, 'Query failed')
    const total = (headers.get('Content-Range') ?? '').split('/')[1]
    return { rows: body, count: total && total !== '*' ? Number(total) : body.length }
  }

  /** insert adds one row, or an array of rows in one statement. */
  async insert<Row = any>(data: Record<string, any>): Promise<Row>
  async insert<Row = any>(data: Record<string, any>[]): Promise<Row[]>
  async insert<Row = any>(data: Record<string, any> | Record<string, any>[]): Promise<Row | Row[]> {
    return request(this.tableUrl(this.selectParam(new URLSearchParams())), {
      method: 'POST',
      headers: this.headers(true, true),
      body: JSON.stringify(data),
    }, 'Insert failed')
  }

  /**
   * upsert inserts rows, updating the ones whose key already exists (or
   * skipping them with ignoreDuplicates). The key is the primary key unless
   * onConflict names other unique columns.
   */
  async upsert<Row = any>(data: Record<string, any>, options?: UpsertOptions): Promise<Row | null>
  async upsert<Row = any>(data: Record<string, any>[], options?: UpsertOptions): Promise<Row[]>
  async upsert<Row = any>(data: Record<string, any> | Record<string, any>[], options: UpsertOptions = {}): Promise<Row | Row[] | null> {
    const params = this.selectParam(new URLSearchParams())
    if (options.onConflict) params.append('on_conflict', options.onConflict)
    const resolution = options.ignoreDuplicates ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates'
    return request(this.tableUrl(params), {
      method: 'POST',
      headers: this.headers(true, true, [resolution]),
      body: JSON.stringify(data),
    }, 'Upsert failed')
  }

  /**
   * sql runs one SQL statement with $1, $2… parameters. With a read-only key
   * it runs in a read-only transaction, so writes are refused.
   */
  async sql<Row = Record<string, any>>(query: string, params: unknown[] = []): Promise<SqlResult<Row>> {
    const result = await request<SqlResult<Row>>(this.url('/query'), {
      method: 'POST',
      headers: this.headers(true, true),
      body: JSON.stringify({ query, params }),
    }, 'Query failed')
    return { columns: result.columns ?? [], rows: result.rows ?? [] }
  }

  /**
   * rpc calls a Postgres function with named arguments. It returns rows for
   * a set-returning function, an object for a composite, the value for a
   * scalar, and null for void. A read-only key runs it read-only.
   */
  async rpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await request<T>(this.url(`/rpc/${encodeURIComponent(fn)}`), {
      method: 'POST',
      headers: this.headers(true, true),
      body: JSON.stringify(args),
    }, 'Call failed')
    return (result === undefined ? null : result) as T
  }

  async update<Row = any>(data: Record<string, any>): Promise<Row[]> {
    return request<Row[]>(this.tableUrl(this.requiredFilters()), {
      method: 'PATCH',
      headers: this.headers(true, true),
      body: JSON.stringify(data),
    }, 'Update failed')
  }

  /** delete removes the matching rows; with { returning: true } it returns them. */
  async delete(): Promise<{ deleted: number }>
  async delete<Row = any>(options: { returning: true }): Promise<Row[]>
  async delete<Row = any>(options?: { returning: true }): Promise<{ deleted: number } | Row[]> {
    return request(this.tableUrl(this.requiredFilters()), {
      method: 'DELETE',
      headers: this.headers(true, false, options?.returning ? ['return=representation'] : []),
    }, 'Delete failed')
  }

  /** openapi is this database's OpenAPI 3.1 document, built from its schema. */
  async openapi(): Promise<Record<string, any>> {
    return request(this.url('/openapi.json'), { headers: this.headers(false) }, 'Request failed')
  }
}
