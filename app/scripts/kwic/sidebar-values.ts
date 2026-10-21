import type { Attribute } from "@/settings/config.types"

/** XML/CWB missing-value markers are not user-facing metadata. */
export function sidebarHasValue(value: unknown, attrs: Pick<Attribute, "sidebar_hide_values"> = {}): boolean {
    if (value == null) return false
    if (typeof value !== "string") return true
    return sidebarSetValues(value, attrs).length > 0
}

/** Count only values the user can actually see, excluding CWB set delimiters. */
export function sidebarSetValues(value: string, attrs: Pick<Attribute, "sidebar_hide_values">): string[] {
    const hidden = attrs.sidebar_hide_values || []
    return (value || "")
        .split("|")
        .map((item) => item.trim())
        .filter((item) => item && !/^_+undef_+$/i.test(item) && !hidden.includes(item))
}

export function sidebarLabel(attrs: Attribute, value: string) {
    return attrs.type === "set" && attrs.label_plural && sidebarSetValues(value, attrs).length > 1
        ? attrs.label_plural
        : attrs.label
}

export function sidebarHiddenByMetadata(attrs: Attribute, sentenceData: Record<string, string>, value = ""): boolean {
    if (attrs.sidebar_hide_if_present && sidebarHasValue(sentenceData[attrs.sidebar_hide_if_present])) return true
    if (!attrs.sidebar_hide_if_equal_to) return false
    const current = [...new Set(sidebarSetValues(value, attrs))].sort()
    const other = [...new Set(sidebarSetValues(sentenceData[attrs.sidebar_hide_if_equal_to], attrs))].sort()
    return current.length > 0 && current.length === other.length && current.every((item, index) => item === other[index])
}
