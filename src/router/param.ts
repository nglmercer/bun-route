/**
 * Unified typed accessor for both query and path parameters.
 * Wraps raw parameter values with safe typed getters.
 */
export class Param {
  private readonly raw: string | string[] | undefined

  constructor(raw: string | string[] | undefined) {
    this.raw = raw
  }

  string(): string | undefined {
    if (Array.isArray(this.raw) || !this.raw) return undefined
    const v = this.raw.trim()
    return v.length > 0 ? v : undefined
  }

  int(): number | undefined {
    const n = this.number()
    if (n === undefined) return undefined
    return Number.isInteger(n) ? n : Math.trunc(n)
  }

  number(): number | undefined {
    const v = this.string()
    if (!v) return undefined
    const n = Number(v)
    return isNaN(n) ? undefined : n
  }

  numberBetween(min: number, max: number): number | undefined {
    const n = this.number()
    if (n === undefined) return undefined
    return Math.min(Math.max(n, min), max)
  }

  enum<T extends string>(allowed: T[]): T | undefined {
    const v = this.string()?.toLowerCase()
    return allowed.find(a => a.toLowerCase() === v)
  }

  require(name?: string): string {
    const v = this.string()
    if (!v) throw new Error(`Missing required param${name ? `: ${name}` : ""}`)
    return v
  }

  boolean(): boolean | undefined {
    const v = this.string()?.toLowerCase()
    if (v === "true" || v === "1") return true
    if (v === "false" || v === "0") return false
    return undefined
  }

  array(): string[] {
    if (!this.raw) return []
    return Array.isArray(this.raw) ? this.raw : [this.raw]
  }

  exists(): boolean {
    return this.string() !== undefined
  }

  or(defaultValue: string): string {
    return this.string() ?? defaultValue
  }

  rawValue(): string | string[] | undefined {
    return this.raw
  }
}
