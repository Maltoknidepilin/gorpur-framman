import angular, { IController, IScope } from "angular"
import { downloadFile, html } from "@/util"
import settings from "@/settings"
import { kwicDownloadAllowed } from "@/kwic/download-policy"

type JsonButtonController = IController & {
    data: any
    endpoint: string
    downloadAllowed?: boolean
}

type JsonButtonScope = IScope & {
    openJson: () => Promise<void>
}

angular.module("korpApp").component("jsonButton", {
    template: html`
        <button ng-click="openJson()" class="btn btn-default btn-sm">
            <i class="fa-solid fa-download mr-1"></i>
            JSON
        </button>
    `,
    bindings: {
        data: "<",
        endpoint: "@",
        downloadAllowed: "<?",
    },
    controller: [
        "$scope",
        function ($scope: JsonButtonScope) {
            const $ctrl = this as JsonButtonController

            $scope.openJson = async function () {
                if ($ctrl.downloadAllowed === false) return
                if (
                    Array.isArray($ctrl.data?.kwic) &&
                    !kwicDownloadAllowed(settings.corpora, {}, $ctrl.data.kwic, [
                        ...($ctrl.data.corpus_order || []),
                        ...Object.keys($ctrl.data.corpus_hits || {}),
                    ])
                )
                    return
                // TODO Check that we don't get $$hashKey etc
                const json = JSON.stringify($ctrl.data, null, 2)
                downloadFile(json, `korp-${$ctrl.endpoint}.json`, "application/json")
            }
        },
    ],
})
