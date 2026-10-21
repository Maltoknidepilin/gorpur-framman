import angular from "angular"
import { html } from "@/util"
import korpFailImg from "../../../img/korp_fail.svg"
import { loc } from "@/i18n"
import { formatError, splitContactMessage } from "@/services/error-message"

angular.module("korpApp").component("korpError", {
    template: html`
        <div class="mx-auto flex flex-wrap items-center justify-center gap-8" role="alert">
            <img src="${korpFailImg}" alt="{{'fail_alt' | loc:$root.lang}}" class="w-40" />
            <div class="w-full max-w-screen-sm text-lg flex flex-col gap-2">
                <div>{{'fail_text' | loc:$root.lang}}</div>
                <pre ng-if="$ctrl.message" class="bg-zinc-100 p-2 px-4 text-base whitespace-pre-wrap break-words">
{{$ctrl.formatError($ctrl.message, $root.lang)}}</pre>
                <div>
                    <span>{{$ctrl.contact($root.lang).before}}</span
                    ><a ng-if="$ctrl.contact($root.lang).email" ng-href="mailto:{{$ctrl.contact($root.lang).email}}"
                        >{{$ctrl.contact($root.lang).email}}</a
                    ><span>{{$ctrl.contact($root.lang).after}}</span>
                </div>
            </div>
        </div>
    `,
    bindings: {
        message: "@",
    },
    controller: function () {
        this.formatError = formatError
        this.contact = (lang: string) => splitContactMessage(loc("fail_contact", lang))
    },
})
