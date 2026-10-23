import angular, { IController, IRootElementService, IScope, ITimeoutService } from "angular"
import { throttle } from "lodash"
import { Moment } from "moment"
import { expandOperators } from "@/cqp_parser/cqp"
import { html } from "@/util"
import { getTimeCqp, Level, createTrendTableCsv } from "@/trend-diagram/util"
import "@/components/util/korp-error"
import { RootScope } from "@/root-scope.types"
import { CountTimeResponse } from "@/backend/types/count-time"
import { StoreService } from "@/services/store"
import { ExampleTask } from "@/task/example-task"
import { TrendTask } from "@/task/trend-task"
import { TrendGraph } from "@/trend-diagram/graph"
import { renderTable } from "@/trend-diagram/trend-table"
import { CsvType, downloadCsvFile } from "@/csv"
import { SlickGrid } from "slickgrid"

type ResultsTrendDiagramController = IController & {
    loading: boolean
    setProgress: (loading: boolean, progress: number) => void
    task: TrendTask
    graph?: TrendGraph
    time_grid: SlickGrid<any>
    hasEmptyIntervals?: boolean
    $result: JQLite
    error?: string
    noTimeData?: boolean
    excludedCorpora?: string[]
    resolution: "year" | "month"
    monthRangeTooWide: boolean
    refreshDates: () => void
}

type ResultsTrendDiagramScope = IScope & {
    downloadOption: CsvType | ""
    isGraph: boolean
    isInitDone: boolean
    mode: "line" | "bar" | "table"
    nontime: number
    statsRelative: boolean
}

angular.module("korpApp").component("resultsTrendDiagram", {
    template: html`
        <korp-error ng-if="$ctrl.error" message="{{$ctrl.error}}"></korp-error>

        <div class="graph_tab">
            <div class="bg-gray-100 mb-2 p-2 flex flex-wrap items-baseline justify-between gap-2">
                <div class="flex flex-wrap items-baseline gap-3">
                    <div class="btn-group form_switch">
                        <button
                            class="btn btn-default btn-sm bg-white"
                            ng-model="mode"
                            uib-btn-radio="'line'"
                            ng-disabled="!isInitDone"
                        >
                            {{'line' | loc:$root.lang}}
                        </button>
                        <button
                            class="btn btn-default btn-sm bg-white"
                            ng-model="mode"
                            uib-btn-radio="'bar'"
                            ng-disabled="!isInitDone"
                        >
                            {{'bar' | loc:$root.lang}}
                        </button>
                        <button
                            class="btn btn-default btn-sm bg-white"
                            ng-model="mode"
                            uib-btn-radio="'table'"
                            ng-disabled="!isInitDone"
                        >
                            {{'table' | loc:$root.lang}}
                        </button>
                    </div>
                    <div class="btn-group" role="group" aria-label="{{'trend_resolution' | loc:$root.lang}}">
                        <button
                            type="button"
                            class="btn btn-default btn-sm bg-white"
                            ng-model="$ctrl.resolution"
                            uib-btn-radio="'year'"
                            ng-change="$ctrl.refreshDates()"
                            ng-disabled="$ctrl.loading"
                        >
                            {{'trend_yearly' | loc:$root.lang}}
                        </button>
                        <button
                            type="button"
                            class="btn btn-default btn-sm bg-white"
                            ng-model="$ctrl.resolution"
                            uib-btn-radio="'month'"
                            ng-change="$ctrl.refreshDates()"
                            ng-disabled="$ctrl.loading || $ctrl.monthRangeTooWide"
                            uib-tooltip="{{'trend_monthly_range_help' | loc:$root.lang}}"
                            tooltip-enable="$ctrl.monthRangeTooWide"
                        >
                            {{'trend_monthly' | loc:$root.lang}}
                        </button>
                    </div>
                    <div class="flex items-baseline gap-1">
                        <label class="mb-0 font-normal">
                            <input
                                type="checkbox"
                                ng-model="$ctrl.task.includeEstimated"
                                ng-change="$ctrl.refreshDates()"
                                ng-disabled="$ctrl.loading"
                            />
                            {{'trend_include_estimates' | loc:$root.lang}}
                        </label>
                        <i
                            class="fa fa-info-circle text-gray-400 table-cell align-middle mb-0.5"
                            role="img"
                            aria-label="{{'trend_estimates_help_title' | loc:$root.lang}}"
                            uib-tooltip="{{'trend_estimates_help_brief' | loc:$root.lang}}"
                        ></i>
                    </div>
                    <label ng-show="mode == 'table'">
                        <input type="checkbox" ng-model="statsRelative" />
                        {{"num_results_relative" | loc:$root.lang}}
                        <i
                            class="fa fa-info-circle text-gray-400 table-cell align-middle mb-0.5"
                            uib-tooltip="{{'relative_help' | loc:$root.lang}}"
                        ></i>
                    </label>
                </div>

                <div ng-show="mode == 'table' && !$ctrl.noTimeData" class="flex flex-wrap items-baseline gap-4">
                    <select ng-model="downloadOption">
                        <option value="">{{ "download" | loc:$root.lang }}</option>
                        <option value="comma">{{ "csv_comma" | loc:$root.lang }}</option>
                        <option value="tab">{{ "csv_tab" | loc:$root.lang }}</option>
                    </select>
                </div>
            </div>

            <p class="trend-explanation text-sm text-gray-600 mb-2">
                {{($ctrl.task.includeEstimated ? 'trend_estimates_included' : 'trend_estimates_excluded') |
                loc:$root.lang}}
            </p>
            <p ng-if="$ctrl.noTimeData && !$ctrl.loading">{{'trend_no_dated_material' | loc:$root.lang}}</p>

            <div ng-if="nontime">
                {{ 'non_time_before' | loc:$root.lang }} {{ nontime | number:2 }}% {{ 'non_time_after' | loc:$root.lang
                }}
            </div>

            <div class="legend" ng-show="isGraph && !$ctrl.loading && !$ctrl.noTimeData && !$ctrl.error">
                <div
                    class="line"
                    ng-show="$ctrl.hasEmptyIntervals"
                    uib-tooltip="{{'graph_material_tooltip' | loc:$root.lang}}"
                >
                    <a class="action"></a>
                    <div class="swatch" style="background-color: #999"></div>
                    <span class="label"> <em>{{'graph_material' | loc:$root.lang}} </em></span>
                </div>
            </div>
            <div style="clear: both;"></div>

            <div class="chart_container" ng-show="isGraph && !$ctrl.noTimeData && !$ctrl.error">
                <div class="preloader" ng-class="{loading: $ctrl.loading}">
                    <i class="fa fa-spinner fa-spin fa-5x"></i>
                </div>
                <div class="chart" ng-show="isGraph" ng-click="$ctrl.graphClickHandler()"></div>
            </div>

            <div class="preview" ng-show="isGraph && !$ctrl.noTimeData && !$ctrl.error"></div>

            <div class="time_table mt-4 w-full" ng-show="mode == 'table' && !$ctrl.noTimeData && !$ctrl.error"></div>
        </div>
    `,
    bindings: {
        loading: "<",
        setProgress: "<",
        task: "<",
    },
    controller: [
        "$rootScope",
        "$scope",
        "$timeout",
        "$element",
        "store",
        function (
            $rootScope: RootScope,
            $scope: ResultsTrendDiagramScope,
            $timeout: ITimeoutService,
            $element: IRootElementService,
            store: StoreService,
        ) {
            const $ctrl = this as ResultsTrendDiagramController
            $ctrl.$result = $element.find(".graph_tab")
            $scope.downloadOption = ""
            $scope.isGraph = true
            $scope.mode = "line"
            $ctrl.resolution = "year"
            $ctrl.monthRangeTooWide = false
            let requestVersion = 0
            let interactionReady = false

            $ctrl.refreshDates = () => {
                const interval = $ctrl.task.corpusListing.getMomentInterval()
                if (interval) makeRequest(...interval, true)
            }

            $ctrl.$onInit = () => {
                const interval = $ctrl.task.corpusListing.getMomentInterval()
                if (!interval) throw new Error("Time interval missing")
                const [from, to] = interval
                $ctrl.monthRangeTooWide = to.diff(from, "month") + 1 > 10000
                makeRequest(from, to)

                $scope.nontime = $ctrl.task.corpusListing.getUndatedRatio() * 100
            }

            $ctrl.$onChanges = (changes) => {
                if (changes.loading && $ctrl.graph) $ctrl.graph.loading = $ctrl.loading
            }

            store.watch("statsRelative", () => {
                $scope.statsRelative = store.statsRelative
                if (!$ctrl.time_grid) return
                // Trigger reformatting
                $ctrl.time_grid.setColumns($ctrl.time_grid.getColumns())
            })

            $scope.$watch("mode", () => {
                if (!$scope.mode) return
                $scope.isGraph = ["line", "bar"].includes($scope.mode)

                if ($scope.mode === "table") {
                    if (!$ctrl.graph || $ctrl.noTimeData) return
                    const el = $(".time_table", $ctrl.$result).get(0)!
                    // Render in next tick when the container is showing.
                    $timeout(() => ($ctrl.time_grid = renderTable(store, el, $ctrl.graph!.series)))
                } else {
                    if (!$ctrl.graph) return

                    if ($scope.mode === "bar") setBarMode()

                    $ctrl.graph.graph.setRenderer($scope.mode)
                    $ctrl.graph.graph.render()
                }
            })

            $scope.$watch("statsRelative", () => (store.statsRelative = $scope.statsRelative))

            $ctrl.graphClickHandler = () => {
                const target = $(".chart", $ctrl.$result)
                const time = $(".detail .x_label > span", target).data("val")
                let cqp = $(".detail .item.active > span", target).data("cqp")
                const zoom = $ctrl.graph!.zoom

                if (!cqp) {
                    return
                }

                const timecqp = getTimeCqp(time, zoom, $ctrl.task.includeEstimated ? "spread" : "strict")
                const decodedCQP = decodeURIComponent(cqp)

                const excluded = new Set(($ctrl.excludedCorpora || []).map((id) => id.toLowerCase()))
                const corpusIds = $ctrl.task.corpusListing.getIds().filter((id) => !excluded.has(id))
                const cqps = [$ctrl.task.cqp, expandOperators(decodedCQP), timecqp]
                $rootScope.kwicTabs.push(new ExampleTask(corpusIds, cqps, $ctrl.task.defaultWithin))
            }

            // Create and download CSV file when the download selector is used
            $scope.$watch("downloadOption", () => {
                // Skip if empty (at init or if the label option is selected)
                if (!$scope.downloadOption) return

                const rows = createTrendTableCsv($ctrl.graph!.series, store.statsRelative)
                downloadCsvFile("trend-table", rows, $scope.downloadOption)

                // Reset to the label option
                $scope.downloadOption = ""
            })

            function drawPreloader(from: Moment, to: Moment): void {
                const left = $ctrl.graph ? $ctrl.graph.graph.x(from.unix()) : 0
                const width = $ctrl.graph ? $ctrl.graph.graph.x(to.unix()) - left : "100%"
                $(".preloader", $ctrl.$result).css({ left, width })
            }

            function setBarMode(): void {
                /**
                 * This code enables the first series in the legend if there are none selected (except sum)
                 * It then disables the sum data series since that data does not make sense in bar mode
                 * If the sum data series is disabled first, it will not work
                 */
                if ($(".legend .line", $ctrl.$result).length > 1) {
                    const allNonSumSeries = $(".legend li.line:not(:last-child)", $ctrl.$result)
                    if (allNonSumSeries.toArray().some((item) => $(item).is(".disabled"))) {
                        $(".legend li:first .action", $ctrl.$result).click()
                    }
                    $(".legend li:last:not(.disabled) .action", $ctrl.$result).click()
                }
            }

            function renderGraph(
                Rickshaw: any,
                data: CountTimeResponse,
                currentZoom: Level,
                reset: boolean,
                to: Moment,
            ) {
                const series = TrendGraph.makeSeries(
                    Rickshaw,
                    data,
                    currentZoom,
                    $ctrl.task.cqp,
                    $ctrl.task.subqueries,
                    $ctrl.task.includeEstimated,
                )
                $ctrl.excludedCorpora = data.time_info?.excluded_corpora || []
                $ctrl.noTimeData = !series.some((row) => row.data.some((point) => point.y != null))
                $scope.isInitDone = true
                if ($ctrl.noTimeData) {
                    $ctrl.setProgress(false, 100)
                    return
                }

                // Create or update graph
                if ($ctrl.graph) {
                    $ctrl.graph.fixedZoom = currentZoom
                    if (reset) $ctrl.graph.replaceGraphData(series, currentZoom)
                    else $ctrl.graph.spliceGraphData(series, to)
                } else {
                    $ctrl.graph = new TrendGraph(
                        Rickshaw,
                        $ctrl.$result,
                        series,
                        currentZoom,
                        makeRequest,
                        store,
                        $ctrl.task.showTotal,
                        currentZoom,
                    )
                }

                $ctrl.setProgress(false, 100)
                $ctrl.graph.refresh()
                $ctrl.hasEmptyIntervals = $ctrl.graph.hasEmptyIntervals
                if ($scope.mode === "table") {
                    $ctrl.time_grid?.destroy()
                    $ctrl.time_grid = renderTable(store, $(".time_table", $ctrl.$result).get(0)!, $ctrl.graph.series)
                }
                if (!interactionReady) {
                    setupInteraction()
                    interactionReady = true
                }

                $(window).trigger("resize")
            }

            function setupInteraction() {
                $(window).on(
                    "resize",
                    throttle(() => {
                        if ($ctrl.graph && !$ctrl.noTimeData && $ctrl.$result.is(":visible")) {
                            const width = $(".tab-pane").width()
                            $ctrl.graph!.graph.setSize()
                            $ctrl.graph!.preview.configure({ width })
                            $ctrl.graph!.preview.render()
                            return $ctrl.graph!.graph.render()
                        }
                    }, 200),
                )
            }

            async function makeRequest(from: Moment, to: Moment, reset = false) {
                const version = ++requestVersion
                // Abort any running request
                if ($ctrl.loading) $ctrl.task.abort()

                drawPreloader(from, to)
                $ctrl.setProgress(true, 0)
                $ctrl.error = undefined
                const currentZoom = $ctrl.resolution

                const reqPromise = $ctrl.task.send(currentZoom, from, to, (progress) =>
                    $timeout(() => {
                        if (version === requestVersion) $ctrl.setProgress(true, progress.percent)
                    }),
                )

                try {
                    const rickshawPromise = import(/* webpackChunkName: "rickshaw" */ "rickshaw")
                    const [Rickshaw, graphData] = await Promise.all([rickshawPromise, reqPromise])
                    $timeout(() => {
                        if (version !== requestVersion) return
                        renderGraph(Rickshaw, graphData, currentZoom, reset, to)
                    })
                } catch (error) {
                    // AbortError is expected if a new search is made before the previous one is finished
                    if (error.name == "AbortError") return
                    console.error(error)
                    $timeout(() => {
                        if (version !== requestVersion) return
                        $ctrl.error = error
                        $ctrl.setProgress(false, 0)
                    })
                }
            }
        },
    ],
})
