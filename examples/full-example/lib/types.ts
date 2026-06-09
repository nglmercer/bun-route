import type { ContextDataMap } from "../../../src/index"

declare module "router-bun" {
  interface ContextDataMap {
    user: { id: string; name: string; role: "admin" | "user" }
  }
}

export interface User {
  id: string
  name: string
  role: "admin" | "user"
}

export const users: User[] = [
  { id: "1", name: "Alice", role: "admin" },
  { id: "2", name: "Bob", role: "user" },
]
