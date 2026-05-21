let idCounter = 0

export function uid(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8) +
    (++idCounter).toString(36)
  )
}

export const EIO = {
  OPEN: 0,
  CLOSE: 1,
  PING: 2,
  PONG: 3,
  MESSAGE: 4,
  UPGRADE: 5,
  NOOP: 6,
} as const

export const SIO = {
  CONNECT: 0,
  DISCONNECT: 1,
  EVENT: 2,
  ACK: 3,
  CONNECT_ERROR: 4,
  BINARY_EVENT: 5,
  BINARY_ACK: 6,
} as const

export type PingTimers = {
  interval: number
  timeout: number
}

export const DEFAULT_PING: PingTimers = {
  interval: 25000,
  timeout: 20000,
}

export function encodeEio(eioType: number, payload: string): string {
  return `${eioType}${payload}`
}

export function parseEio(data: string): { type: number; payload: string } {
  return { type: parseInt(data[0], 10), payload: data.slice(1) }
}
