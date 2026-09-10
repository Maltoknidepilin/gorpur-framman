import { html } from "@/util"
import { Widget, WidgetScope } from "./common"
import { dateQuery, dateQueryValue } from "@/search/date-query"

type DateInputScope = WidgetScope & {
    dateValue?: Date
    yearValue?: number
    precision: "year" | "month" | "day"
    changePrecision: () => void
    updateDate: () => void
}

const twoDigits = (value: number) => (value < 10 ? `0${value}` : `${value}`)

/** Search an ISO year, month or exact date with native date/month controls. */
export const dateInput: Widget = {
    template: html`<span>
        <select ng-model="precision" ng-change="changePrecision()" aria-label="{{'date_precision' | loc:$root.lang}}">
            <option value="year">{{'date_precision_year' | loc:$root.lang}}</option>
            <option value="month">{{'date_precision_month' | loc:$root.lang}}</option>
            <option value="day">{{'date_precision_day' | loc:$root.lang}}</option>
        </select>
        <input
            ng-if="precision === 'year'"
            type="number"
            min="1"
            max="9999"
            step="1"
            ng-model="$parent.yearValue"
            ng-change="updateDate()"
            placeholder="YYYY"
            aria-label="{{'date_precision_year' | loc:$root.lang}}"
        />
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
            const value = dateQueryValue($scope.input || "")
            const [year, month, day] = value.split("-")
            $scope.precision = value ? (day ? "day" : month ? "month" : "year") : "year"
            if (year) $scope.yearValue = Number(year)
            if (month) {
                $scope.dateValue = new Date(0)
                $scope.dateValue.setFullYear(Number(year), Number(month) - 1, Number(day || 1))
                $scope.dateValue.setHours(0, 0, 0, 0)
            }

            $scope.updateDate = () => {
                if ($scope.precision === "year") {
                    $scope.input = dateQuery(String($scope.yearValue || "").padStart(4, "0"))
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
}
