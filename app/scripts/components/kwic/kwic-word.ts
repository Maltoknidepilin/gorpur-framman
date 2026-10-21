import angular, { IController, IScope } from "angular"
import { html } from "@/util"
import { ApiKwic, Token } from "@/backend/types"
import { tokenWhitespace } from "@/kwic/whitespace"

type KwicWordController = IController & {
    word: Token
    sentence: ApiKwic
    sentenceIndex: number
    head: string
    tail: string
}

export type KwicWordScope = IScope & {
    word: Token
    sentence: ApiKwic
    sentenceIndex: number
    class: Record<string, boolean>
}

angular.module("korpApp").component("kwicWord", {
    template: html`{{::$ctrl.head}}<span class="word" ng-class="class">{{::$ctrl.word.word}}</span>{{::$ctrl.tail}}`,
    bindings: {
        word: "<",
        sentence: "<",
        sentenceIndex: "<",
    },
    controller: [
        "$scope",
        function ($scope: KwicWordScope) {
            const $ctrl = this as KwicWordController

            $scope.class = {}

            $ctrl.$onInit = () => {
                // Add incoming values to local scope, to be used by click handlers in the Kwic component.
                $scope.word = $ctrl.word
                $scope.sentence = $ctrl.sentence
                $scope.sentenceIndex = $ctrl.sentenceIndex
            }

            $scope.$watch(
                "word",
                (word: Token) => {
                    const spacing = tokenWhitespace(word)
                    $ctrl.head = spacing.head
                    $ctrl.tail = spacing.tail
                    // Produce applicable class names depending on token data.
                    $scope.class = {
                        reading_match: word._match,
                        punct: word._punct && !spacing.fromSource,
                        match_sentence: word._matchSentence,
                        link_selected: word._link_selected,
                        open_sentence: "_open_sentence" in word,
                    }
                },
                true,
            )
        },
    ],
})
