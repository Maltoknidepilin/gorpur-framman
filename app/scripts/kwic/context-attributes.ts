/** Resolve structural values for the clicked token, including neighbouring sentences.
 * PrintStructures (row.structs) describes the MATCH, not necessarily the clicked
 * sentence. Request show_in_context attributes in `show` as well, so /query
 * supplies real open/close boundaries. A clipped/unknown span stays unavailable.
 */
export function contextAttributes(
    tokens: { structs?: { open?: Record<string, Record<string, string>>[]; close?: string[] } }[],
    index: number,
    row: Record<string, string>,
    names: string[],
    matchIndex?: number,
): Record<string, string> {
    const result = { ...row }
    const requested = new Set(names)
    const current: Record<string, Record<string, string>> = {}
    for (const name of names) delete result[name]
    for (let i = 0; i <= index && i < tokens.length; i++) {
        const structs = tokens[i].structs
        for (const item of structs?.open || []) {
            for (const [tag, attrs] of Object.entries(item)) {
                current[tag] = Object.fromEntries(Object.entries(attrs)
                    .map(([key, value]) => [`${tag}_${key}`, value])
                    .filter(([key]) => requested.has(key)))
            }
        }
        if (i === index) Object.values(current).forEach(attrs => Object.assign(result, attrs))
        for (const tag of structs?.close || []) delete current[tag]
    }
    // CQP prints tags at their real boundaries only. In the default `1 s`
    // context, the enclosing text often starts outside the returned tokens.
    // Row values are safe only when no boundary separates click and match.
    if (index >= 0 && matchIndex != undefined && matchIndex >= 0) {
        const left = Math.min(index, matchIndex), right = Math.max(index, matchIndex)
        for (const name of names) {
            if (name in result) continue
            const tag = name.split("_")[0]
            let same = true
            for (let i = left; i <= right; i++) {
                const structs = tokens[i]?.structs
                if (i > left && structs?.open?.some(item => tag in item)) same = false
                if (i < right && structs?.close?.includes(tag)) same = false
            }
            if (same && name in row) result[name] = row[name]
        }
    }
    return result
}
