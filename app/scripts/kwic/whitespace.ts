import type { Token } from "@/backend/types"

/** Use Sparv's source whitespace when available; retain legacy spacing otherwise. */
export function tokenWhitespace(token: Token): { head: string; tail: string; fromSource: boolean } {
    const fromSource = typeof token._head === "string" && typeof token._tail === "string"
    if (!fromSource) return { head: "", tail: " ", fromSource: false }

    const decode = (value: string): string =>
        value === "__UNDEF__" ? "" : value.replace(/\\s/g, " ").replace(/\\n/g, "\n").replace(/\\t/g, "\t")

    return { head: decode(token._head), tail: decode(token._tail), fromSource: true }
}
