import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import lodash from "lodash"
import ts from "typescript"

function setup(corpora, response) {
    const calls = []
    const settings = { has_timespan: true, corpora: Object.fromEntries(corpora.map((corpus) => [corpus.id, corpus])) }
    const corpusSelection = {
        corpora,
        map(fn) { return this.corpora.map(fn) },
        updateAttributes() {},
    }
    const mocks = {
        lodash,
        "@/settings": { __esModule: true, default: settings },
        "./common": { korpRequest: async (endpoint, params) => {
            calls.push({ endpoint, params })
            return structuredClone(response)
        } },
        "@/corpora/corpus_listing": {
            corpusListing: { corpora, stringify: () => corpora.map((corpus) => corpus.id.toUpperCase()).join() },
            corpusSelection,
        },
    }
    const { outputText } = ts.transpileModule(
        readFileSync(new URL("../app/scripts/backend/timedata.ts", import.meta.url), "utf8"),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } },
    )
    const module = { exports: {} }
    vm.runInNewContext(outputText, {
        module, exports: module.exports,
        require: (name) => { assert.ok(name in mocks, name); return mocks[name] },
    })
    return { api: module.exports, calls, settings, corpusSelection }
}

const corpus = (id, estimated = false, tokens = 0) => ({
    id, struct_attributes: estimated ? { text_tidarskeid: {} } : { text_date: {} }, info: { Size: tokens },
})
const plain = (value) => JSON.parse(JSON.stringify(value))

test("only manually estimated corpora are requested with spread_corpora", async () => {
    const { api, calls, settings, corpusSelection } = setup([
        corpus("blark", true, 2400), corpus("teldni", true, 1707), corpus("wikipedia", false, 50),
        corpus("biblian", false, 40),
    ], {
        corpora: {
            BLARK: { 1998: 100, 2022: 0 },
            TELDNI: { 1990: 100, 2007: 0, "": 7 },
            WIKIPEDIA: { 2026: 50, 2027: 0 },
            BIBLIAN: { 2000: 40, 2001: 0 },
        },
        combined: { 1990: 100, 1998: 200, 2000: 240, 2001: 200, 2007: 100, 2022: 0, 2026: 50, 2027: 0, "": 7 },
    })
    await api.getTimeData()
    assert.deepEqual(plain(calls), [{ endpoint: "timespan", params: {
        granularity: "y", corpus: "BLARK,TELDNI,WIKIPEDIA,BIBLIAN", spread_corpora: "BLARK,TELDNI",
    } }])
    assert.deepEqual(plain(api.getSeriesSelected()), plain(api.getSeries()))
    assert.equal(api.getCountUndated(), 7)
    assert.equal(api.getCountUndatedSelected(), 7)
    assert.equal(settings.corpora.blark.info.Size, 2400)
    assert.equal(settings.corpora.teldni.info.Size, 1707)

    corpusSelection.corpora = [settings.corpora.blark, settings.corpora.teldni]
    const selected = api.getSeriesSelected()
    assert.equal(selected[1990], 100)
    assert.equal(selected[2000], 200)
    assert.equal(selected[2021], 100)
    assert.equal(selected[2026], undefined)
    assert.equal(Object.values(selected).reduce((sum, count) => sum + count, 0), 4100)

    corpusSelection.corpora = [settings.corpora.wikipedia]
    assert.deepEqual(plain(api.getSeriesSelected()), { 2026: 50 })
    assert.equal(api.getCountUndatedSelected(), 0)
})

test("publication-dated corpora keep the original request and yearly values", async () => {
    const { api, calls } = setup([corpus("published")], {
        corpora: { PUBLISHED: { 2000: 300, 2003: 0, "": 9 } },
        combined: { 2000: 300, 2003: 0, "": 9 },
    })
    await api.getTimeData()
    assert.deepEqual(plain(calls[0].params), { granularity: "y", corpus: "PUBLISHED" })
    assert.deepEqual(plain(api.getSeriesSelected()), { 2000: 300, 2001: 300, 2002: 300 })
    assert.equal(api.getCountUndated(), 9)
})

test("disabled or empty timelines do not request estimates", async () => {
    const empty = setup([], {})
    assert.equal(await empty.api.getTimeData(), undefined)
    assert.equal(empty.calls.length, 0)
    const disabled = setup([corpus("blark", true)], {})
    disabled.settings.has_timespan = false
    assert.equal(await disabled.api.getTimeData(), undefined)
    assert.equal(disabled.calls.length, 0)
})
