import uniq from "lodash/uniq"
import { getAttrValues } from "@/backend/attr-values"
import { corpusSelection } from "@/corpora/corpus_listing"
import { AttributeOption } from "@/corpora/corpus-set"
import { loc, locAttribute } from "@/i18n"

/** Load attribute values from backend data as selector options. */
export async function loadOptions(attr: AttributeOption, lang: string): Promise<string[][]> {
    const name = attr.name
    const split = attr.type === "set"

    // check which corpora support attributes
    const corpora = corpusSelection.corpora
        .filter((corpus) => {
            const definition = corpus.struct_attributes[name] || corpus.attributes[name]
            // Ignore internal/sidebar-only meanings of a shared attribute.
            // Fróðskapur's category must not become a Tingfundir party option.
            return definition && definition.display_type !== "hidden" && !definition.hide_extended
        })
        .map((corpus) => corpus.id)

    if (!corpora.length) return []

    const data = await getAttrValues(corpora, name, split)
    const hiddenValues = new Set(attr.filter_hide_values || [])

    return uniq(data)
        .filter((item) => !hiddenValues.has(item))
        .map((item) => (item === "" ? ["", loc("empty", lang)] : [item, locAttribute(attr, item, lang)]))
        .sort((a, b) => a[1].localeCompare(b[1], lang))
}
