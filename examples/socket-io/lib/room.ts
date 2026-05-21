import type { SioSocket } from "./socket"

export class RoomIndex {
  private _rooms = new Map<string, Set<SioSocket>>()

  add(room: string, socket: SioSocket): void {
    if (!this._rooms.has(room)) this._rooms.set(room, new Set())
    this._rooms.get(room)!.add(socket)
  }

  remove(room: string, socket: SioSocket): void {
    this._rooms.get(room)?.delete(socket)
  }

  get(room: string): Set<SioSocket> {
    return this._rooms.get(room) ?? new Set()
  }

  has(socket: SioSocket, room: string): boolean {
    return this._rooms.get(room)?.has(socket) ?? false
  }

  removeSocket(socket: SioSocket): void {
    for (const [room, sockets] of this._rooms) {
      sockets.delete(socket)
      if (sockets.size === 0) this._rooms.delete(room)
    }
  }
}
