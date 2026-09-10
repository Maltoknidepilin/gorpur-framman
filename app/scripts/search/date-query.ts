/** CQP matches the entire metadata value; suffixes include finer known precision. */
const YEAR_SUFFIX = "(-[0-9]{2}(-[0-9]{2})?)?"
const MONTH_SUFFIX = "(-[0-9]{2})?"

export function dateQuery(value: string): string {
    const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value)
    if (!match) return ""
    const [, year, month, day] = match
    if (Number(year) < 1) return ""
    if (month && (Number(month) < 1 || Number(month) > 12)) return ""
    if (day) {
        const date = new Date(0)
        date.setUTCFullYear(Number(year), Number(month) - 1, Number(day))
        if (date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return ""
    }
    return value + (day ? "" : month ? MONTH_SUFFIX : YEAR_SUFFIX)
}

/** Restore the readable date from a saved query, including legacy exact dates. */
export function dateQueryValue(query: string): string {
    let value = query
    for (const suffix of [YEAR_SUFFIX, MONTH_SUFFIX]) {
        if (value.endsWith(suffix)) {
            value = value.slice(0, -suffix.length)
            break
        }
    }
    return dateQuery(value) ? value : ""
}
