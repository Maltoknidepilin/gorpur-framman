import { loc } from "@/i18n"

/** Browser fetch failures are TypeErrors; unrelated TypeErrors must retain their diagnostics. */
export function isNetworkError(error: unknown): boolean {
    const message =
        error instanceof Error
            ? error.name === "TypeError"
                ? error.message
                : ""
            : typeof error === "string" && error.startsWith("TypeError: ")
              ? error.slice("TypeError: ".length)
              : ""
    return /^(NetworkError when attempting to fetch resource\.?|Failed to fetch|Load failed)$/.test(message)
}

export function formatError(error: unknown, lang?: string): string {
    return isNetworkError(error) ? loc("fail_network", lang) : String(error)
}

/** Render translated contact text and its email as separate, escaped text/link nodes. */
export function splitContactMessage(message: string): { before: string; email: string; after: string } {
    const match = /[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/.exec(message)
    if (!match) return { before: message, email: "", after: "" }
    return {
        before: message.slice(0, match.index),
        email: match[0],
        after: message.slice(match.index + match[0].length),
    }
}
