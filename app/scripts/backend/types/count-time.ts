/** @see https://ws.spraakbanken.gu.se/docs/korp#tag/Statistics/paths/~1count_time/get */

import { AbsRelTuple, Granularity, Histogram, NumericString } from "./common"

export type CountTimeParams = {
    corpus: string
    cqp: string
    default_within?: string
    within?: string
    [subcqpn: `subcqp${string}`]: string
    granularity?: Granularity
    from?: NumericString
    to?: NumericString
    strategy?: 1 | 2 | 3
    /** Precision-aware counting, or allocation across the original date interval. */
    date_mode?: "strict" | "spread"
    per_corpus?: boolean
    combined?: boolean
    [cqpn: `cqp${number}`]: string
    expand_prequeries?: boolean
    incremental?: boolean
}

export type CountTimeResponse = {
    corpora: Record<string, GraphStats | (GraphStats | GraphStatsCqp)[]>
    combined: GraphStats | (GraphStats | GraphStatsCqp)[]
    time_info?: {
        date_mode: "strict" | "spread"
        estimated_corpora: string[]
        excluded_corpora: string[]
        imprecise_tokens: number
        undated_tokens: number
        finest_granularity?: Granularity | null
    }
}

export type GraphStats = {
    absolute: Histogram
    relative: Histogram
    sums: AbsRelTuple
    tokens?: Histogram
    estimated_absolute?: Histogram
    estimated_tokens?: Histogram
}

/** Stats contains subquery if graph was created with multiple rows selected in the stats table. */
export type GraphStatsCqp = GraphStats & { cqp: string }
