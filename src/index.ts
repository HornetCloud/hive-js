import { HiveConfig } from './types'
import { Auth } from './auth'
import { Database } from './database'

export class HiveClient {
  public auth: Auth
  private config: HiveConfig
  private apiKey?: string

  constructor(config: HiveConfig) {
    this.config = config
    this.auth = new Auth(config)
    this.apiKey = config.apiKey
  }

  from(dbId: string): Database {
    if (!this.apiKey) {
      throw new Error('API key is required for database operations')
    }
    return new Database(this.config, dbId, this.apiKey)
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
  }

  getApiKey(): string | undefined {
    return this.apiKey
  }
}

export function createHiveClient(config: HiveConfig): HiveClient {
  return new HiveClient(config)
}

export * from './types'
export { Auth } from './auth'
export { Database } from './database'
export { HiveError } from './utils'
export type { Storage } from './utils'
