import type { Attribute } from "@/settings/config.types"

/** Count only values the user can actually see, excluding CWB set delimiters. */
export function sidebarSetValues(value: string, attrs: Pick<Attribute, "sidebar_hide_values">): string[] {
    const hidden = attrs.sidebar_hide_values || []
    return (value || "")
        .split("|")
        .map((item) => item.trim())
        .filter((item) => item && !hidden.includes(item))
}

export function sidebarLabel(attrs: Attribute, value: string) {
    return attrs.type === "set" && attrs.label_plural && sidebarSetValues(value, attrs).length > 1
        ? attrs.label_plural
        : attrs.label
}
