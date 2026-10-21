import angular, { IController, IAugmentedJQuery, IScope, ITimeoutService, IWindowService } from "angular"
import { isEqual, omitBy, pickBy } from "lodash"
import statemachine from "@/statemachine"
import settings from "@/settings"
import { auth } from "@/auth/auth"
import { html } from "@/util"
import { suffixedNumbers } from "@/i18n/util"
import {
    ChooserFolderRoot,
    ChooserFolderSub,
    filterCorporaOnCredentials,
    getAllSelected,
    initCorpusStructure,
    recalcFolderStatus,
    updateLimitedAccess,
} from "@/corpora/corpus-chooser"
import "@/components/corpus-chooser/corpus-time-graph"
import "@/components/corpus-chooser/info-box"
import "@/components/corpus-chooser/tree"
import { CorpusTransformed } from "@/settings/config-transformed.types"
import { LangString } from "@/i18n/types"
import { getTimeData } from "@/backend/timedata"
import { StoreService } from "@/services/store"

type CorpusChooserController = IController & {
    firstCorpus: LangString
    /** Traverse corpora and determine if each is available to the user */
    updateLimitedAccess: () => void
    /** Updates selectCount, selectedNumberOfTokens and selectedNumberOfSentences */
    updateSelectedCount: (ids: string[]) => void
    showChooser: boolean
    showTimeGraph: boolean
    showInfoBox: boolean
    compactInfo: boolean
    chooserStyle: { maxWidth: string; maxHeight: string }
    closeInfo: () => void
    onInfoKeydown: (event: KeyboardEvent) => void
    selectedNumberOfTokens: number
    selectedNumberOfSentences: number
    infoNode?: ChooserFolderSub | CorpusTransformed
    /** UI handler for opening selector */
    onShowChooser: () => void
    /** UI handler for collapsing selector */
    closeChooser: () => void
    root: ChooserFolderRoot
    totalCount: number
    totalNumberOfTokens: number
    /** Handle the on-select event of the cc-tree component */
    onSelect: () => void
    /** Handle clicking "Select all" */
    selectAll: () => void
    /** Handle clicking "Select none" */
    selectNone: () => void
    /** Handle the on-select-only event of the cc-tree component */
    selectOnly: (ids: string[]) => void
}

angular.module("korpApp").component("corpusChooser", {
    template: html`
        <div
            class="absolute inset-0 bg-transparent z-50"
            ng-click="$ctrl.closeChooser()"
            ng-if="$ctrl.showChooser"
        ></div>
        <div class="scroll_checkboxes shrink-0 cursor-pointer">
            <div
                ng-click="$ctrl.onShowChooser()"
                class="hp_topframe no-underline flex justify-between items-center border border-gray-400 transition-all duration-500 hover:bg-brand-50 rounded min-h-12"
            >
                <div class="min-w-0">
                    <span ng-if-start="$ctrl.selectCount != 1">{{ $ctrl.selectCount }}</span>
                    <span>{{ 'corpselector_of' | loc:$root.lang }}</span>
                    <span>{{ $ctrl.totalCount }}</span>
                    <span ng-if-end>{{'corpselector_selectedmultiple' | loc:$root.lang }}</span>

                    <span ng-if-start="$ctrl.selectCount == 1"
                        >{{ $ctrl.firstCorpus | locObj:$root.lang | maxLength}}</span
                    >
                    <span ng-if-end>{{ 'corpselector_selectedone' | loc:$root.lang }}</span>

                    <span class="text-gray-600">
                        — {{ $ctrl.suffixedNumbers($ctrl.selectedNumberOfTokens, $root.lang) }} {{ 'corpselector_of' |
                        loc:$root.lang }} {{ $ctrl.suffixedNumbers($ctrl.totalNumberOfTokens, $root.lang) }} {{
                        'corpselector_tokens' | loc:$root.lang }}
                    </span>
                </div>
                <div class="shrink-0 ml-3 transition-colors duration-500">
                    <i class="fa-solid fa-caret-up relative top-2"></i>
                    <br />
                    <i class="fa-solid fa-caret-down relative bottom-2"></i>
                </div>
            </div>
            <div ng-if="$ctrl.showChooser" class="corpus-chooser flex bg-white" ng-style="$ctrl.chooserStyle">
                <div
                    class="popupchecks shrink-0 p-4 h-full"
                    ng-attr-inert="{{ $ctrl.compactInfo && $ctrl.showInfoBox ? '' : undefined }}"
                >
                    <div class="corpus-chooser-actions flex">
                        <corpus-time-graph ng-if="$ctrl.showTimeGraph"></corpus-time-graph>
                        <div class="p-2 flex flex-wrap gap-2 items-stretch">
                            <button ng-click="$ctrl.selectAll()" class="btn btn-default btn-sm w-40 shrink">
                                <span class="fa-solid fa-check"></span>
                                <span>{{'corpselector_buttonselectall' | loc:$root.lang }}</span>
                            </button>
                            <button ng-click="$ctrl.selectNone()" class="btn btn-default btn-sm w-40 shrink">
                                <span class="fa-solid fa-times"></span>
                                <span>{{ 'corpselector_buttonselectnone' | loc:$root.lang }}</span>
                            </button>
                        </div>
                    </div>
                    <!-- this is the beginning of the recursive component -->
                    <cc-tree
                        node="$ctrl.root"
                        on-select="$ctrl.onSelect()"
                        on-select-only="$ctrl.selectOnly(corporaIds)"
                        on-show-info="$ctrl.onShowInfo(node)"
                    ></cc-tree>

                    <p class="text-sm pb-4">
                        {{ $ctrl.selectedNumberOfSentences | prettyNumber }} {{'corpselector_sentences_long' |
                        loc:$root.lang}}
                    </p>
                </div>
                <div
                    ng-if="$ctrl.showInfoBox"
                    class="corpus-info"
                    ng-class="{ 'corpus-info-overlay': $ctrl.compactInfo }"
                    ng-click="$ctrl.compactInfo && $event.target === $event.currentTarget && $ctrl.closeInfo()"
                    ng-keydown="$ctrl.onInfoKeydown($event)"
                >
                    <div
                        class="corpus-info-panel bg-gray-100"
                        ng-attr-role="{{ $ctrl.compactInfo ? 'dialog' : undefined }}"
                        ng-attr-aria-modal="{{ $ctrl.compactInfo ? 'true' : undefined }}"
                        aria-label="{{ $ctrl.infoNode.title | locObj:$root.lang }}"
                    >
                        <div class="corpus-info-toolbar bg-gray-100">
                            <button type="button" class="btn btn-default btn-sm" ng-click="$ctrl.closeInfo()">
                                <i class="fa-solid fa-times" aria-hidden="true"></i>
                                {{ 'modal_close' | loc:$root.lang }}
                            </button>
                        </div>
                        <cc-info-box object="$ctrl.infoNode"></cc-info-box>
                    </div>
                </div>
            </div>
        </div>
    `,
    bindings: {},
    controller: [
        "store",
        "$element",
        "$scope",
        "$window",
        "$timeout",
        function (
            store: StoreService,
            $element: IAugmentedJQuery,
            $scope: IScope,
            $window: IWindowService,
            $timeout: ITimeoutService,
        ) {
            const $ctrl = this as CorpusChooserController
            let previousFocus: HTMLElement | null = null
            let resizeObserver: ResizeObserver | undefined

            // Include the chooser's offset: two columns may not fit even on a wide screen.
            function updateLayout() {
                const frame = $element[0].querySelector(".hp_topframe")
                if (!frame) return
                const bounds = frame.getBoundingClientRect()
                const availableWidth = $window.document.documentElement.clientWidth - bounds.left - 16
                $ctrl.compactInfo = availableWidth < 962
                $ctrl.chooserStyle = {
                    maxWidth: `${Math.max(0, availableWidth)}px`,
                    maxHeight: `${Math.max(0, $window.innerHeight - bounds.bottom - 16)}px`,
                }
            }

            const onResize = () => $scope.$evalAsync(updateLayout)
            $ctrl.$postLink = () => {
                updateLayout()
                $window.addEventListener("resize", onResize)
                resizeObserver = new ResizeObserver(onResize)
                resizeObserver.observe($element[0])
            }
            $ctrl.$onDestroy = () => {
                $window.removeEventListener("resize", onResize)
                resizeObserver?.disconnect()
            }

            $ctrl.closeInfo = () => {
                $ctrl.showInfoBox = false
                $ctrl.infoNode = undefined
                $timeout(() => previousFocus?.focus())
            }

            $ctrl.onInfoKeydown = (event) => {
                if (event.key === "Escape") {
                    event.preventDefault()
                    event.stopPropagation()
                    $ctrl.closeInfo()
                } else if (event.key === "Tab" && $ctrl.compactInfo) {
                    const panel = $element[0].querySelector(".corpus-info-panel")!
                    const controls = Array.from(
                        panel.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [tabindex]"),
                    ).filter((control) => control.tabIndex >= 0 && control.getClientRects().length > 0)
                    const first = controls[0]
                    const last = controls[controls.length - 1]
                    if (event.shiftKey && event.target === first) {
                        event.preventDefault()
                        last?.focus()
                    } else if (!event.shiftKey && event.target === last) {
                        event.preventDefault()
                        first?.focus()
                    }
                }
            }

            $ctrl.showChooser = false

            $ctrl.$onInit = () => {
                // remove the corpora with hide=true (linked corpora)
                const ccCorpora = omitBy(settings.corpora, "hide")
                $ctrl.root = initCorpusStructure(ccCorpora)
                $ctrl.totalCount = $ctrl.root.numberOfChildren
                $ctrl.totalNumberOfTokens = $ctrl.root.tokens
                $ctrl.updateLimitedAccess()
            }

            // Sync when corpus selection is modified elsewhere.
            store.watch("corpus", () => updateSelection(store.corpus))

            statemachine.listen("login", function () {
                $ctrl.updateLimitedAccess()
            })

            statemachine.listen("logout", function () {
                // Unselect restricted corpora
                for (const corpus of Object.values(settings.corpora))
                    corpus.selected = corpus.selected && !corpus.limited_access
                // Select those, or if none remain, fall back to default selection
                const remaining = Object.keys(pickBy(settings.corpora, (corpus) => corpus.selected))
                const toSelect = remaining.length ? remaining : settings.preselected_corpora || []
                // Apply selection
                select(toSelect)
                $ctrl.updateLimitedAccess()
            })

            // Load time data before showing time graph
            getTimeData().then((data) => {
                $ctrl.showTimeGraph = Boolean(data && data[0].length)
            })

            $ctrl.onShowChooser = () => {
                updateLayout()
                $ctrl.showChooser = !$ctrl.showChooser
            }

            $ctrl.closeChooser = () => {
                $ctrl.showChooser = false
                $ctrl.showInfoBox = false
                $ctrl.infoNode = undefined
            }

            $ctrl.updateSelectedCount = (selection) => {
                $ctrl.selectCount = selection.length
                $ctrl.selectedNumberOfTokens = 0
                $ctrl.selectedNumberOfSentences = 0
                for (const corpusId of selection) {
                    const corpus = settings.corpora[corpusId]
                    $ctrl.selectedNumberOfTokens += corpus.tokens!
                    $ctrl.selectedNumberOfSentences += corpus.sentences!
                }
            }

            $ctrl.suffixedNumbers = suffixedNumbers

            $ctrl.onSelect = function () {
                const currentCorpora = getAllSelected($ctrl.root)
                select(currentCorpora)
            }

            $ctrl.selectAll = function () {
                select(Object.values(settings.corpora).map((corpus) => corpus.id))
            }

            $ctrl.selectNone = function () {
                select([])
            }

            $ctrl.selectOnly = function (corporaIds) {
                select(corporaIds)
            }

            $ctrl.updateLimitedAccess = function () {
                if ($ctrl.root) {
                    updateLimitedAccess($ctrl.root, auth.getCredentials())
                }
            }

            /** Handle selection change from GUI. */
            function select(ids: string[]) {
                const selected = updateSelection(ids)
                // Store new selection if it has actually changed
                if (!isEqual(selected, store.corpus)) {
                    store.corpus = [...selected]
                }
            }

            /** Update selected state, respecting authorization. */
            function updateSelection(ids: string[]): string[] {
                // This modifies corpus.selected
                const selection = filterCorporaOnCredentials(ids, auth.getCredentials())

                // This uses corpus.selected
                recalcFolderStatus($ctrl.root)
                $ctrl.updateSelectedCount(selection)
                // used when there is only one corpus selected to show name
                if (selection.length == 1) {
                    $ctrl.firstCorpus = settings.corpora[selection[0]].title
                }

                return selection
            }

            $ctrl.onShowInfo = (node: ChooserFolderSub | CorpusTransformed) => {
                updateLayout()
                $ctrl.showInfoBox = node.id != $ctrl.infoNode?.id
                $ctrl.infoNode = $ctrl.showInfoBox ? node : undefined
                if ($ctrl.showInfoBox) {
                    previousFocus = $window.document.activeElement as HTMLElement | null
                    $timeout(() => $element[0].querySelector<HTMLButtonElement>(".corpus-info-toolbar button")?.focus())
                }
            }
        },
    ],
})
