/**
 * Wrapper for path parameters providing typed access methods.
 * Similar to QueryParam but for route path segments.
 */
export class PathParam {
    private readonly raw: string | undefined

    constructor(raw: string | undefined) {
        this.raw = raw
    }

    /** Returns the value as a string, or undefined if missing */
    string(): string | undefined {
        if (!this.raw) return undefined
        const v = this.raw.trim()
        return v.length > 0 ? v : undefined
    }

    /** Returns the value as a positive integer, or undefined */
    int(): number | undefined {
        const n = this.number()
        if (n === undefined) return undefined
        return Number.isInteger(n) ? n : Math.trunc(n)
    }

    /** Returns the value as a number, or undefined if not a valid number */
    number(): number | undefined {
        const v = this.string()
        if (!v) return undefined
        const n = Number(v)
        return isNaN(n) ? undefined : n
    }

    /** Clamps a number between min and max */
    numberBetween(min: number, max: number): number | undefined {
        const n = this.number()
        if (n === undefined) return undefined
        return Math.min(Math.max(n, min), max)
    }

    /** Returns the value only if it's one of the allowed values */
    enum<T extends string>(allowed: T[]): T | undefined {
        const v = this.string()?.toLowerCase()
        return allowed.find(a => a.toLowerCase() === v)
    }

    /** Returns the value or throws if missing */
    require(name?: string): string {
        const v = this.string()
        if (!v) throw new Error(`Missing required path param${name ? `: ${name}` : ""}`)
        return v
    }

    /** Returns the value as a boolean */
    boolean(): boolean | undefined {
        const v = this.string()?.toLowerCase()
        if (v === "true" || v === "1") return true
        if (v === "false" || v === "0") return false
        return undefined
    }

    /** Returns true if the param is present and non-empty */
    exists(): boolean {
        return this.string() !== undefined
    }

    /** Returns the value or a default */
    or(defaultValue: string): string {
        return this.string() ?? defaultValue
    }

    /** Returns the raw value */
    rawValue(): string | undefined {
        return this.raw
    }
}
