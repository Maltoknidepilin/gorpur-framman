import { html } from "@/util"
import { Widget, WidgetScope } from "./common"

type DateInputScope = WidgetScope & {
    dateValue?: Date
    updateDate: () => void
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const twoDigits = (value: number) => (value < 10 ? `0${value}` : `${value}`)

/** Exact ISO date input backed by the browser's native calendar control. */
export const dateInput: Widget = {
    template: html`<span>
        <input type="date" ng-model="dateValue" ng-change="updateDate()" />
        <span class="text-xs text-gray-500 ml-1">YYYY-MM-DD</span>
    </span>`,
    controller: [
        "$scope",
        function ($scope: DateInputScope) {
            const match = ISO_DATE.exec($scope.input || "")
            if (match) {
                const [, year, month, day] = match
                $scope.dateValue = new Date(Number(year), Number(month) - 1, Number(day))
            }

            $scope.updateDate = () => {
                if (!$scope.dateValue) {
                    $scope.input = ""
                    return
                }
                const year = $scope.dateValue.getFullYear()
                const month = twoDigits($scope.dateValue.getMonth() + 1)
                const day = twoDigits($scope.dateValue.getDate())
                $scope.input = `${year}-${month}-${day}`
            }
        },
    ],
}
