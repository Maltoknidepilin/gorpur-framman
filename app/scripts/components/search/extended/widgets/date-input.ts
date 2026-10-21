import { html } from "@/util"
import { Widget, WidgetScope } from "./common"
import { dateQuery, dateQueryValue, yearRangeQuery, yearRangeQueryValue } from "@/search/date-query"

type DateInputScope = WidgetScope & {
    dateValue?: Date
    yearValue?: number
    yearFrom?: number
    yearTo?: number
    yearOnly: boolean
    allowYearRange: boolean
    yearMode: "single" | "range"
    yearRangeError: boolean
    changeYearMode: () => void
    precision: "year" | "month" | "day"
    changePrecision: () => void
    updateDate: () => void
}

const twoDigits = (value: number) => (value < 10 ? `0${value}` : `${value}`)

/** Search an ISO year, month or exact date with native date/month controls. */
export const dateInput = (options: { yearOnly?: boolean; range?: boolean } = {}): Widget => ({
    template: html`<span>
        <select
            ng-if="!yearOnly"
            ng-model="$parent.precision"
            ng-change="changePrecision()"
            aria-label="{{'date_precision' | loc:$root.lang}}"
        >
            <option value="year">{{'date_precision_year' | loc:$root.lang}}</option>
            <option value="month">{{'date_precision_month' | loc:$root.lang}}</option>
            <option value="day">{{'date_precision_day' | loc:$root.lang}}</option>
        </select>
        <select
            ng-if="allowYearRange"
            ng-model="$parent.yearMode"
            ng-change="changeYearMode()"
            aria-label="{{'date_precision' | loc:$root.lang}}"
        >
            <option value="single">{{'date_year_exact' | loc:$root.lang}}</option>
            <option value="range">{{'date_year_range' | loc:$root.lang}}</option>
        </select>
        <input
            ng-if="precision === 'year' && yearMode !== 'range'"
            type="number"
            min="1"
            max="9999"
            step="1"
            ng-model="$parent.yearValue"
            ng-model-options="{ allowInvalid: true }"
            ng-change="updateDate()"
            placeholder="YYYY"
            aria-label="{{'date_precision_year' | loc:$root.lang}}"
        />
        <span ng-if="yearMode === 'range'">
            <input
                type="number"
                min="1"
                max="9999"
                step="1"
                ng-model="$parent.yearFrom"
                ng-model-options="{ allowInvalid: true }"
                ng-change="updateDate()"
                placeholder="{{'date_year_from' | loc:$root.lang}}"
                aria-label="{{'date_year_from' | loc:$root.lang}}"
            />
            –
            <input
                type="number"
                min="1"
                max="9999"
                step="1"
                ng-model="$parent.yearTo"
                ng-model-options="{ allowInvalid: true }"
                ng-change="updateDate()"
                placeholder="{{'date_year_to' | loc:$root.lang}}"
                aria-label="{{'date_year_to' | loc:$root.lang}}"
            />
        </span>
        <span ng-if="yearRangeError" role="alert">{{'date_year_range_invalid' | loc:$root.lang}}</span>
        <input
            ng-if="precision === 'month'"
            type="month"
            ng-model="$parent.dateValue"
            ng-change="updateDate()"
            aria-label="{{'date_precision_month' | loc:$root.lang}}"
        />
        <input
            ng-if="precision === 'day'"
            type="date"
            ng-model="$parent.dateValue"
            ng-change="updateDate()"
            aria-label="{{'date_precision_day' | loc:$root.lang}}"
        />
    </span>`,
    controller: [
        "$scope",
        function ($scope: DateInputScope) {
            $scope.yearOnly = Boolean(options.yearOnly)
            $scope.allowYearRange = Boolean(options.range && options.yearOnly)
            $scope.yearMode = "single"
            $scope.yearRangeError = false
            const value = dateQueryValue($scope.input || "")
            const [year, month, day] = value.split("-")
            $scope.precision = value ? (day ? "day" : month ? "month" : "year") : "year"
            if (year) $scope.yearValue = Number(year)
            if ($scope.yearOnly) $scope.precision = "year"
            const bounds = $scope.allowYearRange ? yearRangeQueryValue($scope.input || "") : undefined
            if (bounds && bounds.from !== bounds.to) {
                $scope.yearMode = "range"
                if (bounds.from) $scope.yearFrom = Number(bounds.from)
                if (bounds.to) $scope.yearTo = Number(bounds.to)
            }
            if (month) {
                $scope.dateValue = new Date(0)
                $scope.dateValue.setFullYear(Number(year), Number(month) - 1, Number(day || 1))
                $scope.dateValue.setHours(0, 0, 0, 0)
            }

            $scope.updateDate = () => {
                const yearString = (year?: number) => (year == null ? "" : String(year).padStart(4, "0"))
                if ($scope.yearMode === "range") {
                    $scope.input = yearRangeQuery(yearString($scope.yearFrom), yearString($scope.yearTo))
                    $scope.yearRangeError = ($scope.yearFrom != null || $scope.yearTo != null) && !$scope.input
                    return
                }
                $scope.yearRangeError = false
                if ($scope.precision === "year") {
                    const year = yearString($scope.yearValue)
                    $scope.input = $scope.yearOnly ? yearRangeQuery(year, year) : dateQuery(year)
                    $scope.yearRangeError = $scope.yearValue != null && !$scope.input
                    return
                }
                if (!$scope.dateValue || !Number.isFinite($scope.dateValue.getTime())) {
                    $scope.input = ""
                    return
                }
                const year = String($scope.dateValue.getFullYear()).padStart(4, "0")
                const month = twoDigits($scope.dateValue.getMonth() + 1)
                const day = twoDigits($scope.dateValue.getDate())
                $scope.input = dateQuery(`${year}-${month}` + ($scope.precision === "day" ? `-${day}` : ""))
            }

            $scope.changeYearMode = () => {
                if ($scope.yearMode === "range") {
                    $scope.yearFrom = $scope.yearValue
                    $scope.yearTo = undefined
                } else {
                    $scope.yearValue = $scope.yearFrom ?? $scope.yearTo
                }
                $scope.updateDate()
            }

            $scope.changePrecision = () => {
                if ($scope.precision === "year" && $scope.dateValue) {
                    $scope.yearValue = $scope.dateValue.getFullYear()
                }
                // Finer precision requires a choice, not an invented month/day.
                $scope.dateValue = undefined
                $scope.updateDate()
            }
            if (value) $scope.updateDate()
        },
    ],
})
