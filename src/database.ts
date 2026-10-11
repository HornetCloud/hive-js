import { HiveConfig, DatabaseQuery, SqlResult } from './types'
import { apiBase, request } from './utils'

export class Database {
  private config: HiveConfig
  private dbId: string
  private apiKey: string
  private table: string = ''
  private query: DatabaseQuery = { select: '*' }

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
    this.query = { select: '*' }
    return this
  }

  select(columns: string): Database {
    this.query.select = columns
    return this
  }

  eq(column: string, value: any): Database {
    if (!this.query.eq) {
      this.query.eq = {}
    }
    this.query.eq[column] = value
    return this
  }

  order(column: string, direction: 'asc' | 'desc' = 'asc'): Database {
    this.query.orderBy = column
    this.query.order = direction
    return this
  }

  limit(n: number): Database {
    this.query.limit = n
    return this
  }

  offset(n: number): Database {
    this.query.offset = n
    return this
  }

  private url(path = ''): string {
    return `${apiBase(this.config.apiUrl)}/rest/${encodeURIComponent(this.dbId)}${path}`
  }

  private tableUrl(params?: URLSearchParams): string {
    const qs = params && params.toString() ? `?${params.toString()}` : ''
    return this.url(`/${encodeURIComponent(this.table)}${qs}`)
  }

  private headers(json = false): Record<string, string> {
    const h: Record<string, string> = { Authorization: `Bearer ${this.apiKey}` }
    if (json) h['Content-Type'] = 'application/json'
    return h
  }

  /**
   * get returns the matching rows. Without .limit() the API returns the
   * first 10; the most one call can return is 1000.
   */
  async get(): Promise<any[]> {
    const params = new URLSearchParams()
    Object.entries(this.query.eq || {}).forEach(([key, value]) => {
      params.append(key, String(value))
    })
    if (this.query.select && this.query.select.trim() !== '*') {
      params.append('select', this.query.select.split(',').map((c) => c.trim()).filter(Boolean).join(','))
    }
    if (this.query.orderBy) params.append('orderBy', this.query.orderBy)
    if (this.query.order) params.append('order', this.query.order)
    if (this.query.limit !== undefined) params.append('limit', String(this.query.limit))
    if (this.query.offset) params.append('offset', String(this.query.offset))

    return request<any[]>(this.tableUrl(params), { headers: this.headers() }, 'Query failed')
  }

  async insert(data: Record<string, any>): Promise<any> {
    return request(this.tableUrl(), {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify(data),
    }, 'Insert failed')
  }

  /**
   * sql runs one SQL statement with $1, $2… parameters. With a read-only key
   * it runs in a read-only transaction, so writes are refused.
   */
  async sql<Row = Record<string, any>>(query: string, params: unknown[] = []): Promise<SqlResult<Row>> {
    const result = await request<SqlResult<Row>>(this.url('/query'), {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ query, params }),
    }, 'Query failed')
    return { columns: result.columns ?? [], rows: result.rows ?? [] }
  }

  // update/delete are bulk operations scoped by .eq() filters (like
  // Supabase) rather than a positional id — at least one .eq() is required,
  // otherwise every row in the table would be touched.
  private filterParams(): URLSearchParams {
    const params = new URLSearchParams()
    Object.entries(this.query.eq || {}).forEach(([key, value]) => {
      params.append(key, String(value))
    })
    if (params.toString() === '') {
      throw new Error('at least one .eq() filter is required for update()/delete()')
    }
    return params
  }

  async update(data: Record<string, any>): Promise<any[]> {
    return request<any[]>(this.tableUrl(this.filterParams()), {
      method: 'PATCH',
      headers: this.headers(true),
      body: JSON.stringify(data),
    }, 'Update failed')
  }

  async delete(): Promise<{ deleted: number }> {
    return request<{ deleted: number }>(this.tableUrl(this.filterParams()), {
      method: 'DELETE',
      headers: this.headers(),
    }, 'Delete failed')
  }
}
