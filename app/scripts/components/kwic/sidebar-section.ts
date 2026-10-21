import { html } from "@/util"
import angular from "angular"

angular.module("korpApp").component("sidebarSection", {
    template: html`
        <details ng-open="$ctrl.initialOpen !== false" class="border border-gray-300 rounded-sm">
            <summary tabindex="0" class="bg-gray-300 uppercase m-0 p-1 px-2">
                <span ng-if="$ctrl.titlePrefix">{{$ctrl.titlePrefix}} </span>
                <span ng-if="!$ctrl.titleUrl">{{$ctrl.title}}</span>
                <a ng-if="$ctrl.titleUrl" ng-href="{{$ctrl.titleUrl}}" ng-click="$event.stopPropagation()"
                    target="_blank" rel="noopener noreferrer">{{$ctrl.title}}</a>
            </summary>
            <div ng-transclude class="p-2"></div>
        </details>
    `,
    bindings: {
        title: "@",
        titlePrefix: "@?",
        titleUrl: "<?",
        initialOpen: "<",
    },
    transclude: true,
    controller: function () {},
})
