import type { Corpus } from "@/settings/config.types"
import type { ChooserFolder } from "./corpus-chooser"

type DownloadInfo = {
    restricted: boolean
    mixed: boolean
    url?: string
}

export function corpusDownloadInfo(
    corpus: Pick<Corpus, "availability_status" | "download_allowed" | "download_url">,
): DownloadInfo {
    const status = corpus.availability_status
    const restricted = corpus.download_allowed === false || (status != null && status !== "free")
    return {
        restricted,
        mixed: false,
        url: restricted ? undefined : corpus.download_url,
    }
}

/** Link to the shared parent directory of the corpus folders, using the stable branch. */
function sharedFolderUrl(urls: (string | undefined)[]): string | undefined {
    const paths: string[][] = []
    for (const value of urls) {
        if (!value) return undefined
        let url: URL
        try {
            url = new URL(value)
        } catch {
            return undefined
        }
        const parts = url.pathname.slice(1).split("/")
        if (
            url.origin !== "https://huggingface.co" || url.username || url.password ||
            parts[0] !== "datasets" || parts[3] !== "tree" || parts.length < 6
        ) return undefined
        parts[4] = "main"
        parts.pop()
        paths.push(parts)
    }
    const common = paths[0]?.slice()
    if (!common) return undefined
    for (const path of paths.slice(1)) {
        while (common.length && !common.every((part, i) => part === path[i])) common.pop()
    }
    // Never link above the dataset's tree/main directory.
    return common.length >= 5 ? `https://huggingface.co/${common.join("/")}` : undefined
}

/** Use every descendant corpus, regardless of its current selection state. */
export function folderDownloadInfo(folder: ChooserFolder): DownloadInfo {
    const collect = (current: ChooserFolder): DownloadInfo[] => [
        ...current.corpora.map(corpusDownloadInfo),
        ...current.subFolders.flatMap(collect),
    ]
    const children = collect(folder)
    const allowed = children.filter((child) => !child.restricted)
    return {
        restricted: allowed.length === 0,
        mixed: allowed.length > 0 && allowed.length < children.length,
        url: allowed.length === children.length ? sharedFolderUrl(allowed.map((child) => child.url)) : undefined,
    }
}
