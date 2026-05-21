import type { Session } from "./session"
import type { SioServer } from "./sio-server"
import { EIO, SIO } from "./protocol"

type AckCallback = (err: any | null, ...args: any[]) => void
type SioHandler = (...args: any[]) => void | Promise<void>

export class SioSocket {
  id: string
  data: Record<string, any> = {}
  rooms: Set<string> = new Set()
  private _handlers: Map<string, Set<SioHandler>> = new Map()
  private _ackHandlers: Map<number, AckCallback> = new Map()
  private _ackIdCounter = 0
  private _session: Session
  private _nsp: string

  constructor(session: Session, nsp: string) {
    this.id = session.id
    this._session = session
    this._nsp = nsp
  }

  on(event: string, handler: SioHandler): this {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set())
    this._handlers.get(event)!.add(handler)
    return this
  }

  off(event: string, handler?: SioHandler): this {
    const set = this._handlers.get(event)
    if (!set) return this
    if (handler) set.delete(handler)
    else set.clear()
    return this
  }

  emit(event: string, ...args: any[]): this {
    const ack = typeof args[args.length - 1] === "function" ? args.pop() as AckCallback : undefined
    const ackId = ack ? this._ackIdCounter++ : undefined
    if (ackId !== undefined) this._ackHandlers.set(ackId, ack)

    const data = JSON.stringify([event, ...args])
    const packet = ackId !== undefined
      ? `${SIO.EVENT}${ackId}${data}`
      : `${SIO.EVENT}${data}`
    this._session.send(EIO.MESSAGE, packet)
    return this
  }

  broadcast = {
    to: (room: string) => ({
      emit: (event: string, ...args: any[]) => {
        this._session.server.to(room).emit(event, ...args)
      },
    }),
  }

  join(room: string): this {
    this.rooms.add(room)
    this._session.server._roomIndex.add(room, this)
    return this
  }

  leave(room: string): this {
    this.rooms.delete(room)
    this._session.server._roomIndex.remove(room, this)
    return this
  }

  disconnect(): void {
    this._session.close()
  }

  _triggerEvent(event: string, ...args: any[]): void {
    const handlers = this._handlers.get(event)
    if (handlers) {
      for (const h of handlers) h(...args)
    }
  }

  _handleSioPacket(payload: string): void {
    const type = parseInt(payload[0], 10)
    let rest = payload.slice(1)

    let nsp = "/"
    if (rest[0] === "/") {
      const commaIdx = rest.indexOf(",")
      if (commaIdx !== -1) {
        nsp = rest.slice(0, commaIdx)
        rest = rest.slice(commaIdx + 1)
      }
    }
    if (nsp !== this._nsp) return

    switch (type) {
      case SIO.CONNECT: {
        const sidData = JSON.stringify({ sid: this.id })
        this._session.send(EIO.MESSAGE, `${SIO.CONNECT}${sidData}`)
        break
      }
      case SIO.DISCONNECT: {
        this._session.close()
        break
      }
      case SIO.EVENT:
      case SIO.BINARY_EVENT: {
        let ackId: number | undefined
        const ackMatch = rest.match(/^(\d+)/)
        if (ackMatch) {
          ackId = parseInt(ackMatch[1], 10)
          rest = rest.slice(ackMatch[0].length)
        }
        try {
          const [event, ...args] = JSON.parse(rest)
          const handlers = this._handlers.get(event)
          if (handlers) {
            let callbackCalled = false
            const ackFn = ackId !== undefined
              ? (...ackArgs: any[]) => {
                  if (callbackCalled) return
                  callbackCalled = true
                  this._session.send(EIO.MESSAGE, `${SIO.ACK}${ackId}${JSON.stringify(ackArgs)}`)
                }
              : undefined
            const finalArgs = ackFn ? [...args, ackFn] : args
            for (const handler of handlers) {
              const result = handler(...finalArgs)
              if (result instanceof Promise) result.catch(() => {})
            }
          }
        } catch { /* invalid JSON */ }
        break
      }
      case SIO.ACK:
      case SIO.BINARY_ACK: {
        const ackMatch = rest.match(/^(\d+)/)
        if (!ackMatch) break
        const ackId = parseInt(ackMatch[1], 10)
        const dataStr = rest.slice(ackMatch[0].length)
        const cb = this._ackHandlers.get(ackId)
        if (cb) {
          this._ackHandlers.delete(ackId)
          try {
            const data = JSON.parse(dataStr)
            cb(null, ...data)
          } catch {
            cb(null)
          }
        }
        break
      }
    }
  }
}
