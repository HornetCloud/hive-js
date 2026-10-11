import type { Storage } from './utils'

export interface HiveConfig {
  /** The app origin, without /api, e.g. https://yourdomain.com */
  apiUrl: string
  /** API key for the data APIs. Create one in the dashboard under Settings. */
  apiKey?: string
  /** Where the session token is kept. Defaults to localStorage in a browser, memory elsewhere. */
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
}

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
