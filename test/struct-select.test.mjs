import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { setImmediate } from "node:timers/promises"
import { isDeepStrictEqual } from "node:util"
import vm from "node:vm"
import ts from "typescript"
import yaml from "js-yaml"

function load(path, mocks) {
    const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    })
    const module = { exports: {} }
    vm.runInNewContext(outputText, { module, exports: module.exports,
        require: name => { assert.ok(name in mocks, name); return mocks[name] } })
    return module.exports
}

function setup(input, autocomplete = false) {
    const watches = new Map()
    let resolveOptions
    const pending = new Promise(resolve => { resolveOptions = resolve })
    const { selectController } = load("../app/scripts/components/search/extended/widgets/common.ts", {
        "@/i18n": { locAttribute: (_attr, value) => value },
        "@/util": { html: () => "" },
        "@/search/extended-search": { loadOptions: () => pending },
        lodash: { isEqual: isDeepStrictEqual },
    })
    const scope = {
        attr: {}, input, orObj: { op: "=" },
        $watch: (key, fn) => watches.set(key, fn),
        $apply: fn => fn(),
    }
    selectController(autocomplete).at(-1)(scope, { lang: "fao", watch: () => {} })
    return {
        scope,
        async options(values) { resolveOptions(values); await setImmediate() },
        operator(op) {
            const old = scope.orObj.op
            scope.orObj.op = op
            watches.get("orObj.op")(op, old)
        },
    }
}

const speakers = [["Bárður á Steig Nielsen", "Bárður á Steig Nielsen"], ["Jógvan á Lakjuni", "Jógvan á Lakjuni"]]

test("is / is not keeps the selected full name instead of choosing the first speaker", async () => {
    const widget = setup("Jógvan á Lakjuni")
    await widget.options(speakers)
    for (const op of ["!=", "=", "!="]) {
        widget.operator(op)
        assert.equal(widget.scope.input, "Jógvan á Lakjuni")
        assert.equal(widget.scope.inputOnly, false)
    }
})

test("changing the operator while loading or with no available values is safe", async () => {
    const widget = setup("Jógvan á Lakjuni")
    widget.operator("!=")
    await widget.options(speakers)
    assert.equal(widget.scope.input, "Jógvan á Lakjuni")
    const empty = setup("")
    await empty.options([])
    empty.operator("!=")
    assert.equal(empty.scope.input, "")
})

test("loading chooses an available option for a new selector but preserves autocomplete input", async () => {
    const widget = setup("")
    await widget.options(speakers)
    assert.equal(widget.scope.input, speakers[0][0])
    const autocomplete = setup("Jógvan", true)
    await autocomplete.options(speakers)
    autocomplete.operator("!=")
    assert.equal(autocomplete.scope.input, "Jógvan")
})

test("role options display Faroese labels but keep the English CWB values for both operators", async () => {
    const attr = yaml.load(readFileSync(new URL(
        "../../gorps-stillingar-aftan/attributes/structural/text_innleggsslag.yaml", import.meta.url,
    ), "utf8"))
    attr.name = "text_innleggsslag"
    const { loadOptions } = load("../app/scripts/search/extended-search.ts", {
        "lodash/uniq": values => [...new Set(values)],
        "@/backend/attr-values": { getAttrValues: async () => ["chairman", "speaker", "remark"] },
        "@/corpora/corpus_listing": { corpusSelection: { corpora: [
            { id: "tingfundir", struct_attributes: { [attr.name]: attr }, attributes: {} },
        ] } },
        "@/i18n": { locAttribute: (attribute, value, lang) => attribute.translation[value][lang] },
    })
    const options = await loadOptions(attr, "fao")
    for (const [value, label] of [["chairman", "Løgtingsforfólk"], ["speaker", "Talari"], ["remark", "Viðmerkjari"]]) {
        assert.equal(options.find(option => option[0] === value)[1], label)
        const widget = setup(value)
        await widget.options(options)
        for (const op of Object.values(attr.opts)) {
            widget.operator(op)
            assert.equal(widget.scope.input, value)
        }
    }
})
