/** Check the corpora belonging to these results, independent of the current picker selection. */
export function kwicDownloadAllowed(
    corpora: Record<string, { download_allowed?: boolean }>,
    params: { corpus?: string; source?: string } = {},
    rows: { corpus: string; aligned?: object }[] = [],
    resultCorpora: string[] = [],
): boolean {
    const ids = [
        ...(params.corpus || "").split(","),
        // Word-picture sentence requests encode CORPUS:relation-id pairs.
        ...(params.source || "").split(",").map((source) => source.split(":")[0]),
        ...resultCorpora,
        ...rows.flatMap((row) => [row.corpus, ...Object.keys(row.aligned || {})]),
    ]
        .flatMap((id) => id.split("|"))
        .map((id) => id.trim().toLowerCase())
        .filter(Boolean)

    // An unidentified corpus cannot supply permission. Legacy corpora without
    // the flag retain their existing behavior until their config is regenerated.
    return ids.length > 0 && ids.every((id) => !!corpora[id] && corpora[id].download_allowed !== false)
}
