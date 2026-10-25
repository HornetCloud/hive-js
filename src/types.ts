import type { Storage } from './utils'

export interface HiveConfig {
  /** https://api.hornethive.io (v1 is added), or for a self-hosted Hive its app origin without /api, e.g. https://yourdomain.com */
  apiUrl: string
  /** API key for the data APIs. Create one in the dashboard under Settings. */
  apiKey?: string
  /** Where the session token is kept. Defaults to memory: pass `localStorage` to keep it across reloads. */
  storage?: Storage
}

export interface AuthResponse {
  user: User
  token: string
}

export interface User {
  id: string
  email: string
  plan: string
  is_admin?: boolean
}

export interface SignUpOptions {
  /** The account holder's name. Required by the API. */
  fullname: string
  /**
   * That the account holder agrees to the Terms of Use and Privacy Policy
   * (https://hornethive.io/terms, /privacy). Required by the API: ask them first.
   */
  acceptTerms: true
}

/** @deprecated Database keeps its own query state since 1.4; nothing uses this. */
export interface DatabaseQuery {
  select: string
  eq?: Record<string, any>
  orderBy?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface SqlResult<Row = Record<string, any>> {
  columns: string[]
  rows: Row[]
}

/** The REST API's filter operators (PostgREST's names). */
export type FilterOperator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'like' | 'ilike' | 'match' | 'imatch'
  | 'in' | 'is' | 'cs' | 'cd' | 'ov'
  | 'fts' | 'plfts' | 'phfts' | 'wfts'

export interface OrderOptions {
  /** true by default. */
  ascending?: boolean
  /** Nulls first or last; Postgres's default when left out (last when ascending). */
  nullsFirst?: boolean
}

export interface UpsertOptions {
  /** The unique columns that identify a row, comma-separated. The primary key by default. */
  onConflict?: string
  /** Skip rows that already exist instead of updating them. */
  ignoreDuplicates?: boolean
}

export interface TextSearchOptions {
  /** How the query is read: to_tsquery by default, or plain, phrase or websearch. */
  type?: 'plain' | 'phrase' | 'websearch'
  /** The text search configuration, such as english. */
  config?: string
}
