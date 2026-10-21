export type SourceCitation = { text: string; url: string }

/** Shared sources should appear once even when several subcorpora use them. */
export function sourceCitations(corpora: Iterable<{ source_citations?: SourceCitation[] }>): SourceCitation[] {
    const references = new Map<string, SourceCitation>()
    for (const corpus of corpora) {
        for (const reference of corpus.source_citations || []) {
            if (reference.text && /^https?:\/\//.test(reference.url)) references.set(reference.url, reference)
        }
    }
    return [...references.values()]
}
