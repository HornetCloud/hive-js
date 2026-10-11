import { HiveConfig, AuthResponse, SignUpOptions } from './types'
import { apiBase, defaultStorage, request, Storage } from './utils'

const TOKEN_KEY = 'hive_token'

/**
 * Auth is a Hive account session: the dashboard login of a person, not an
 * API key. Database calls use the API key, not this token.
 */
export class Auth {
  private config: HiveConfig
  private storage: Storage
  private token: string | null

  constructor(config: HiveConfig) {
    this.config = config
    this.storage = config.storage ?? defaultStorage()
    this.token = this.storage.getItem(TOKEN_KEY)
  }

  async signUp(email: string, password: string, options: SignUpOptions): Promise<AuthResponse> {
    const data = await request<AuthResponse>(`${apiBase(this.config.apiUrl)}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullname: options.fullname }),
    }, 'Sign up failed')
    this.setToken(data.token)
    return data
  }

  async signIn(email: string, password: string): Promise<AuthResponse> {
    const data = await request<AuthResponse>(`${apiBase(this.config.apiUrl)}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }, 'Sign in failed')
    this.setToken(data.token)
    return data
  }

  /** refresh swaps the session token for a new one, valid for another 24 hours. */
  async refresh(): Promise<AuthResponse> {
    const data = await request<AuthResponse>(`${apiBase(this.config.apiUrl)}/auth/refresh`, {
      method: 'POST',
      headers: this.authHeader(),
    }, 'Refresh failed')
    this.setToken(data.token)
    return data
  }

  /**
   * signOut ends the session on the server, which logs the account out on
   * every device, then forgets the token here. The local token is dropped
   * even if the server cannot be reached.
   */
  async signOut(): Promise<void> {
    try {
      if (this.token) {
        await request(`${apiBase(this.config.apiUrl)}/auth/logout`, {
          method: 'POST',
          headers: this.authHeader(),
        }, 'Sign out failed')
      }
    } finally {
      this.token = null
      this.storage.removeItem(TOKEN_KEY)
    }
  }

  getToken(): string | null {
    return this.token
  }

  setToken(token: string): void {
    this.token = token
    this.storage.setItem(TOKEN_KEY, token)
  }

  private authHeader(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {}
  }
}
