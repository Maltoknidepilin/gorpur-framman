import moment, { Moment } from "moment"
import {
    findOptimalLevel,
    formatTrendCount,
    formatUnixDate,
    getEmptyIntervals,
    getSeriesData,
    Level,
    PALETTE,
    Series,
} from "./util"
import { last as _last, groupBy, last, maxBy, minBy, sortedIndexOf, throttle } from "lodash"
import { CountTimeResponse, GraphStats, GraphStatsCqp } from "@/backend/types/count-time"
import { StoreService } from "@/services/store"
import { formatRelativeHits } from "@/i18n/util"
import { loc } from "@/i18n"

// Rickshaw graph
// The https://www.npmjs.com/package/@types/rickshaw lib just says `any`
export type Graph = {
    series: Series[]
    [key: string]: any
}

export class TrendGraph {
    readonly graph: Graph
    public hasEmptyIntervals?: boolean
    public loading = true
    readonly preview: any // A Rickshaw preview range slider

    constructor(
        readonly Rickshaw: any,
        protected el: JQLite,
        public series: Series[],
        public zoom: Level,
        protected makeRequest: (from: Moment, to: Moment) => void,
        store: StoreService,
        readonly showTotal = false,
        public fixedZoom?: Level,
    ) {
        const graph: Graph = new Rickshaw.Graph({
            element: $(".chart", el).empty().get(0),
            renderer: "line",
            interpolation: "linear",
            // The preview and bar renderer must not leave stacking offsets in the line data.
            preserve: true,
            series,
            padding: {
                top: 0.1,
                right: 0.01,
            },
        })
        this.graph = graph
        // Keep slider selections aligned to whole periods in the chosen view.
        const update = graph.update.bind(graph)
        graph.update = () => {
            this.alignWindow()
            update()
        }

        // Add legend and toggling
        const legendElement = $(".legend", el).get(0)
        const legend = new Rickshaw.Graph.Legend({ element: legendElement, graph })
        new Rickshaw.Graph.Behavior.Series.Toggle({ graph, legend })

        if (!showTotal && $(".legend .line", el).length > 1) {
            $(".legend .line:last .action", el).click()
        }

        new Rickshaw.Graph.HoverDetail({
            // xFormatter and yFormatter are called once for every data series per "hover detail creation"
            // formatter is only called once per per "hover detail creation"
            graph,
            xFormatter: (x: number) => `<span data-val='${x}'>${formatUnixDate(this.zoom, x)}</span>`,

            yFormatter(y: number) {
                const val = y > 0 && y < 0.1 ? formatTrendCount(y, store.lang) : formatRelativeHits(y, store.lang)
                return `<br>${loc("rel_hits_short", store.lang)} ${val}`
            },
            formatter(series: Series, x: number, y: number, formattedX: string, formattedY: string) {
                const i = sortedIndexOf(
                    series.data.map((point) => point.x),
                    x,
                )
                const rel = series.name + ":&nbsp;" + formattedY
                const point = series.data[i]
                if (!point) return ""
                const abs_y = series.abs_data[i]?.y
                const share =
                    point.tokens && point.estimatedTokens
                        ? `<br>${loc("trend_estimated_share").replace("{percent}", ((100 * point.estimatedTokens) / point.tokens).toLocaleString(store.lang, { maximumFractionDigits: 0 }))}`
                        : ""
                return `<span data-cqp="${encodeURIComponent(series.cqp)}">
                                ${rel}
                                <br>
                                ${loc(point.estimated ? "trend_allocated_hits" : "abs_hits_short")}: ${abs_y == null ? "" : formatTrendCount(abs_y, store.lang)}
                                ${share}
                            </span>`
            },
        })

        // [first, last] = corpusListing.getTimeInterval()
        // [firstVal, lastVal] = corpusListing.getMomentInterval()

        // TODO: fix decade again
        // timeunit = if last - first > 100 then "decade" else @zoom

        const time = new Rickshaw.Fixtures.Time()
        // Fix time.ceil for decades: Rickshaw.Fixtures.Time.ceil
        // returns one decade too small values for 1900 and before.
        // (The root cause may be Rickshaw's approximate handling of
        // leap years: 1900 was not a leap year.)
        const old_ceil = time.ceil
        time.ceil = (time: number, unit: any) => {
            if (unit.name === "decade") {
                const out = Math.ceil(time / unit.seconds) * unit.seconds
                const mom = moment(out * 1000)
                const monthDay = mom.date()
                // If the day of the month is not 1, it is within the
                // previous month (December), so add enough days to
                // move the date to the expected month (January).
                if (monthDay !== 1) {
                    mom.add(32 - monthDay, "day")
                }
                return mom.unix()
            } else {
                return old_ceil(time, unit)
            }
        }

        const xAxis = new Rickshaw.Graph.Axis.Time({
            graph,
            // Use the fixed .ceil for decades
            timeFixture: time,
            // timeUnit: time.unit("month") # TODO: bring back decade
        })

        this.preview = new Rickshaw.Graph.RangeSlider.Preview({
            graph,
            element: $(".preview", el).get(0),
        })

        $("body").on("mouseup", ".preview .middle_handle", () => {
            this.previewPanStop()
        })

        $("body").on("mouseup", ".preview .left_handle, .preview .right_handle", () => {
            if (!this.loading) {
                this.previewPanStop()
            }
        })

        const old_render = xAxis.render
        xAxis.render = throttle(() => {
            old_render.call(xAxis)
            this.drawIntervals()
            const [from, to] = graph.renderer.domain().x
            this.checkZoomLevel(moment.unix(from), moment.unix(to))
        }, 20)

        xAxis.render()

        const yAxis = new Rickshaw.Graph.Axis.Y({
            graph,
        })

        yAxis.render()
    }

    static makeSeries(
        Rickshaw: any,
        data: CountTimeResponse,
        zoom: Level,
        cqp: string,
        subqueries: [string, string][],
        includeEstimated = false,
    ) {
        const makeData = (stats: GraphStats) => {
            const extra = (histogram?: GraphStats["tokens"]) =>
                new Map(histogram ? getSeriesData(histogram, zoom).map((point) => [point.x, point.y]) : [])
            const tokens = extra(stats.tokens)
            const estimatedHits = extra(stats.estimated_absolute)
            const estimatedTokens = extra(stats.estimated_tokens)
            return getSeriesData(stats.relative, zoom).map((point) => ({
                ...point,
                tokens: tokens.get(point.x),
                estimatedHits: estimatedHits.get(point.x),
                estimatedTokens: estimatedTokens.get(point.x),
                estimated:
                    includeEstimated ||
                    (estimatedHits.get(point.x) || 0) > 0 ||
                    (estimatedTokens.get(point.x) || 0) > 0,
            }))
        }
        const createTotalSeries = (stats: GraphStats) => ({
            data: makeData(stats),
            color: "#586d69",
            name: "Σ",
            cqp,
            abs_data: getSeriesData(stats.absolute, zoom),
        })

        const labels = Object.fromEntries(subqueries)
        const createSubquerySeries = (stats: GraphStatsCqp, i: number) => ({
            data: makeData(stats),
            color: PALETTE[i % PALETTE.length],
            name: labels[stats.cqp],
            cqp: stats.cqp,
            abs_data: getSeriesData(stats.absolute, zoom),
        })

        const series: Series[] = Array.isArray(data.combined)
            ? data.combined.map((item, i) => ("cqp" in item ? createSubquerySeries(item, i) : createTotalSeries(item)))
            : [createTotalSeries(data.combined)]

        Rickshaw.Series.zeroFill(series)

        const emptyIntervals = getEmptyIntervals(series[0].data)
        series[0].emptyIntervals = emptyIntervals

        return series
    }

    /** Replace every period when the date policy changes; preserve legend choices. */
    replaceGraphData(series: Series[], zoom: Level) {
        this.zoom = zoom
        this.graph.series.forEach((row: Series, i: number) => Object.assign(row, series[i]))
    }

    /** Replace a part of the graph with new data (of a higher/lower resolution) */
    spliceGraphData(newSeries: Series[], to?: Moment) {
        for (let seriesIndex = 0; seriesIndex < this.graph.series.length; seriesIndex++) {
            const seriesObj = this.graph.series[seriesIndex]
            const incoming = newSeries[seriesIndex]
            // A clipped response's stop marker is outside the requested period.
            // Keep the existing overview point there until that period is fetched.
            const stop = _last(incoming.data)
            if (to && stop?.y === null && stop.x > to.unix()) {
                incoming.data = incoming.data.slice(0, -1)
                incoming.abs_data = incoming.abs_data.slice(0, -1)
            }
            const first = newSeries[seriesIndex].data[0].x
            const last = _last(newSeries[seriesIndex].data)!.x
            const end = to ? to.clone().endOf(incoming.data[0].zoom).unix() : last
            let from = seriesObj.data.findIndex((point: Series["data"][number]) => point.x >= first)
            if (from < 0) from = seriesObj.data.length
            let stopIndex = from
            while (stopIndex < seriesObj.data.length && seriesObj.data[stopIndex].x <= end) stopIndex++

            // Replace overlap with new data
            seriesObj.data.splice(from, stopIndex - from, ...incoming.data)
            seriesObj.abs_data.splice(from, stopIndex - from, ...incoming.abs_data)
            seriesObj.emptyIntervals = getEmptyIntervals(seriesObj.data)
        }
    }

    refresh() {
        this.alignWindow()
        this.drawIntervals()
        this.graph.render()
        this.preview.render()
    }

    alignWindow() {
        if (!this.fixedZoom || !this.graph.window) return
        const window = this.graph.window
        if (window.xMin != null) window.xMin = moment.unix(window.xMin).startOf(this.fixedZoom).unix()
        if (window.xMax != null) window.xMax = moment.unix(window.xMax).endOf(this.fixedZoom).unix()
    }

    /** Adds divs with .empty_area to fill spaces in graph where there is no dated material */
    drawIntervals(): void {
        const emptyIntervals = this.getEmptyBlocks()
        this.hasEmptyIntervals = !!emptyIntervals.length
        $(".empty_area", this.el).remove()
        for (const { left, width } of emptyIntervals) {
            $("<div>", { class: "empty_area" }).css({ left, width }).appendTo(this.graph.element)
        }
    }

    /** Get spaces in graph where there is no dated material */
    getEmptyBlocks(): { left: number; width: number }[] {
        const emptyIntervals = this.graph.series[0].emptyIntervals!
        const [from, to]: number[] = this.graph.renderer.domain().x

        const unitSpan = Math.max(moment.unix(to).diff(moment.unix(from), this.zoom, true), 1)
        const unitWidth = this.graph.width / unitSpan

        return emptyIntervals.map((list) => {
            const max = maxBy(list, "x")!
            const min = minBy(list, "x")!
            const from = this.graph.x(min.x)
            const to = this.graph.x(max.x)

            return {
                left: from - unitWidth / 2,
                width: to - from + unitWidth,
            }
        })
    }

    /** Change the current zoom level if needed to match a given date range. */
    checkZoomLevel(from: Moment, to: Moment) {
        if (this.fixedZoom) return
        const newZoom = findOptimalLevel(from, to)
        // Trigger search if new zoom level is different
        if (newZoom && this.zoom !== newZoom) {
            this.zoom = newZoom
            this.makeRequest(from, to)
        }
    }

    previewPanStop() {
        if (this.fixedZoom) return
        const visibleData = this.graph.stackData()
        const grouped = groupBy(visibleData[0], "zoom")

        for (let zoomLevel in grouped) {
            const points = grouped[zoomLevel]
            if (zoomLevel !== this.zoom) {
                const from = moment.unix(points[0].x)
                from.startOf(this.zoom)
                const to = moment.unix(last(points).x)
                to.endOf(this.zoom)
                this.makeRequest(from, to)
            }
        }
    }
}
