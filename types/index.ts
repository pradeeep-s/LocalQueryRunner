export interface Client {
  id: string
  name: string
  status: "active" | "disabled"
  agentUid?: string
  createdAt: string
  lastSeen?: string
}

export interface Agent {
  uid: string
  email: string
  role: string
  clientId: string
  createdAt: string
  lastLogin?: string
}

export interface DatabaseConfig {
  clientId: string
  host: string
  port: number
  database: string
  username: string // encrypted
  password: string // encrypted
  updatedAt: string
}

export interface Query {
  query: string
  id: string
  name: string
  sql: string
  variables: string[]
  createdAt: string
}

export interface Command {
  id: string
  clientId: string
  queryId: string
  variables: Record<string, any>
  status: "pending" | "running" | "success" | "failed"
  result?: any
  error?: string
  createdAt: string
  completedAt?: string
}
