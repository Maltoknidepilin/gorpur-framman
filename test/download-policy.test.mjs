// Run with Node 24+: node --test test/download-policy.test.mjs
import assert from "node:assert/strict"
import test from "node:test"
import { kwicDownloadAllowed } from "../app/scripts/kwic/download-policy.ts"

const corpora = {
    wrifa: { download_allowed: true },
    villugrunnur: { download_allowed: false },
    legacy: {},
}

test("free and legacy corpora can export; restricted and mixed searches cannot", () => {
    assert.equal(kwicDownloadAllowed(corpora, { corpus: "WRIFA" }), true)
    assert.equal(kwicDownloadAllowed(corpora, { corpus: "legacy" }), true)
    assert.equal(kwicDownloadAllowed(corpora, { corpus: "VILLUGRUNNUR" }), false)
    assert.equal(kwicDownloadAllowed(corpora, { corpus: "WRIFA,VILLUGRUNNUR" }), false)
})

test("restricted results cannot be exported under a later unrestricted selection", () => {
    assert.equal(kwicDownloadAllowed(corpora, { corpus: "WRIFA" }, [{ corpus: "VILLUGRUNNUR" }]), false)
    assert.equal(kwicDownloadAllowed(corpora, {}, [{ corpus: "WRIFA" }], ["VILLUGRUNNUR"]), false)
})

test("parallel corpora, aligned rows and word-picture sources obey the restriction", () => {
    assert.equal(kwicDownloadAllowed(corpora, { corpus: "WRIFA|VILLUGRUNNUR" }), false)
    assert.equal(kwicDownloadAllowed(corpora, {}, [{ corpus: "WRIFA", aligned: { VILLUGRUNNUR: [] } }]), false)
    assert.equal(kwicDownloadAllowed(corpora, { source: "WRIFA:123" }), true)
    assert.equal(kwicDownloadAllowed(corpora, { source: "WRIFA:123,VILLUGRUNNUR:456" }), false)
})

test("missing corpus identity or configuration cannot supply permission", () => {
    assert.equal(kwicDownloadAllowed(corpora), false)
    assert.equal(kwicDownloadAllowed(corpora, { corpus: "MISSING" }), false)
    assert.equal(kwicDownloadAllowed(corpora, {}, [{ corpus: "WRIFA", aligned: { MISSING: [] } }]), false)
})
