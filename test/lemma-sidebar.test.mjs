import assert from "node:assert/strict"
import test from "node:test"
import { foLemma } from "../../gorps-stillingar-framman/app/custom/lemma.js"

function render(value, wordData) {
    const scope = { value, wordData }
    foLemma.controller.at(-1)(scope)
    return scope
}

test("the displayed lemma links to the selected bendingar entry", () => {
    const scope = render("bátur", { word: "bátar", bendingar_id: "542627" })
    assert.equal(scope.value, "bátur")
    assert.equal(scope.bendingarUrl, "https://bendingar.fo/bending/542627")
})

test("old corpora and inferred or unmatched lemmas remain plain text", () => {
    for (const id of [undefined, null, "", "_", "0", "-1", "|", "542627|123", "1/../2", '123\" onclick=\"x']) {
        const scope = render("útbúgvingarleiðari", { bendingar_id: id })
        assert.equal(scope.bendingarUrl, undefined)
        assert.equal(scope.value, "útbúgvingarleiðari")
    }
    assert.equal(render("bátur", undefined).bendingarUrl, undefined)
})

test("lemma markup is bound as text, with a plain-text fallback and a safe external link", () => {
    assert.doesNotMatch(foLemma.template, /ng-bind-html/)
    assert.match(foLemma.template, /<a[^>]*ng-if="bendingarUrl"[^>]*ng-href="\{\{bendingarUrl\}\}"[^>]*ng-bind="value"/)
    assert.match(foLemma.template, /<span ng-if="!bendingarUrl" ng-bind="value"/)
    assert.match(foLemma.template, /rel="noopener noreferrer"/)
})
