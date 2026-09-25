import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import yaml from "js-yaml"
import vm from "node:vm"
import ts from "typescript"
import lodash from "lodash"
import { balladEdition, foBalladSource, foBalladEdition } from "../../gorps-stillingar-framman/app/custom/fokvadi.js"
import { sidebarSetValues } from "../app/scripts/kwic/sidebar-values.ts"
import { dateQuery } from "../app/scripts/search/date-query.ts"

const configRoot = new URL("../../gorps-stillingar-aftan/", import.meta.url)
const readConfig = path => yaml.load(readFileSync(new URL(path, configRoot), "utf8"))

// Exercise the actual built-in renderer with NO custom helpers installed,
// reproducing the older frontend bundle seen on the live site.
const { outputText } = ts.transpileModule(readFileSync(new URL(
    "../app/scripts/components/kwic/sidebar-components.ts", import.meta.url,
), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
const mocks = {
    "@/util": { html: String.raw }, "@/i18n": {},
    "@/services/stringify": { getStringifier: () => String }, lodash,
    "@/statemachine": {}, "custom/sidebar.js": { default: {} },
    "@/kwic/sidebar-values": { sidebarSetValues },
}
const module = { exports: {} }
vm.runInNewContext(outputText, { module, exports: module.exports,
    require: name => { assert.ok(name in mocks, name); return mocks[name] } })
function renderDefault(preset, value) {
    const scope = { attrs: readConfig(`attributes/structural/${preset}.yaml`), value }
    module.exports.sidebarDefaultComponent.controller.at(-1)(scope, { lang: "fao" })
    return scope.renderValue(value)
}

test("built-in rendering removes prefixes even without the custom frontend helper", () => {
    for (const [preset, input, expected] of [
        ["text_ccf", "CCF 14 A", "14 A"], ["text_tsb", "TSB E 58", "E 58"],
        ["text_ccf", "CCF 1Aa I", "1Aa I"], ["text_tsb", "TSB E 51", "E 51"],
        ["text_ccf", "1Aa I", "1Aa I"], ["text_tsb", "E 51", "E 51"],
    ]) {
        assert.equal(renderDefault(preset, input), expected)
    }
    assert.equal(renderDefault("text_ccf", "CCF <b>14 A</b>"), "&lt;b&gt;14 A&lt;/b&gt;")
})

test("the edition fallback never displays a Word filename when the custom component is absent", () => {
    assert.equal(renderDefault("text_fokvadi_utgava", "Bind I.doc"), "Føroya kvæði, bind I")
    assert.equal(renderDefault("text_fokvadi_utgava", "Bind IV.docx"), "Føroya kvæði, bind IV")
    assert.equal(renderDefault("text_fokvadi_utgava", "Føroya kvæði vol I, p. 1."), "Føroya kvæði vol I, p. 1.")
})

test("edition summaries merge matching volume information but retain disagreements", () => {
    assert.equal(balladEdition("1. Onnur útgáva. | 2. Føroya kvæði vol I, p. 1.", "Bind I.doc"), "Føroya kvæði vol I, p. 1.")
    assert.equal(balladEdition("Føroya kvæði vol. I, p. 1.", "Bind I.docx"), "Føroya kvæði vol. I, p. 1.")
    assert.equal(balladEdition("FK vol. V, p. 8.", "Bind IV.doc"), "FK vol. V, p. 8.; Føroya kvæði, bind IV")
    assert.equal(balladEdition("FK vol. II, p. 8.", "Bind I.doc"), "FK vol. II, p. 8.; Føroya kvæði, bind I")
    assert.equal(balladEdition("Føroya kvæði vol I, p. 1. | Føroya kvæði vol I, p. 1.", "Bind I.doc"), "Føroya kvæði vol I, p. 1.")
    assert.equal(balladEdition("", "Bind IV.doc"), "Føroya kvæði, bind IV")
    assert.equal(balladEdition("Bind I.doc", "Bind I.doc"), "Føroya kvæði, bind I")
    assert.equal(balladEdition("Bind I.doc", undefined), "Føroya kvæði, bind I")
    assert.equal(balladEdition("", "not-a-volume.txt"), "")
})

function render(component, key, sentenceData) {
    const scope = { key, sentenceData }
    let hidden = false
    component.controller.at(-1)(scope, { hide() { hidden = true } })
    return { value: scope.displayValue, hidden }
}

test("source notes stay separate from manuscripts and only identical repeats are hidden", () => {
    const data = { text_heimild: "J.H. Schrøter, 1818.", text_handrit: "NkS 345, 8vo." }
    const original = { ...data }
    assert.deepEqual(render(foBalladSource, "text_heimild", data), { value: data.text_heimild, hidden: false })
    assert.equal(render(foBalladSource, "text_heimild", {
        text_heimild: "Savn Svabos", text_handrit: "Savn Svabos.",
    }).hidden, true)
    assert.deepEqual(render(foBalladSource, "text_heimild", {
        text_heimild: "Savn Svabos, 1801.", text_handrit: "Savn Svabos.",
    }), { value: "Savn Svabos, 1801.", hidden: false })
    assert.deepEqual(data, original)
})

test("legacy volume/edition fields produce one row and newer prepared summaries remain intact", () => {
    const data = { text_utgava: "Føroya kvæði vol I, p. 1.", text_bind: "Bind I.doc" }
    assert.deepEqual(render(foBalladEdition, "text_utgava", data), { value: data.text_utgava, hidden: false })
    assert.equal(render(foBalladEdition, "text_bind", data).hidden, true)
    assert.deepEqual(render(foBalladEdition, "text_bind", { text_bind: "Bind I.doc" }), { value: "Føroya kvæði, bind I", hidden: false })
    const prepared = { text_utgava: "Føroya kvæði, bind I", text_heimild: "MS 1; A distinct source." }
    assert.equal(render(foBalladEdition, "text_utgava", prepared).value, prepared.text_utgava)
    assert.equal(render(foBalladSource, "text_heimild", prepared).value, prepared.text_heimild)
})

test("Korp config wires legacy fallbacks when present, with adjacent CCF/TSB", () => {
    const read = readConfig
    const corpus = read("corpora/fokvadi.yaml")
    const fields = Object.assign({}, ...corpus.struct_attributes)
    assert.equal(fields.text_handrit.preset, "text_handrit")
    assert.equal(read(`attributes/structural/${fields.text_handrit.preset}.yaml`).label.fao, "Handrit")
    if (fields.text_bind) assert.equal(fields.text_utgava, fields.text_bind)
    assert.equal(fields.text_leinki, "text_lesmeir")
    assert.ok(fields.text_dagfesting)
    assert.equal(fields.text_dagfestingarslag, undefined)
    assert.equal(fields.text_dagfestingargrund, undefined)
    assert.equal(read(`attributes/structural/${fields.text_tsb}.yaml`).order,
        read(`attributes/structural/${fields.text_ccf}.yaml`).order + 1)
})

test("Dagfesting uses the normal date input and accepts year-only corpus values", () => {
    const attrs = readConfig("attributes/structural/text_kvad_ar.yaml")
    assert.equal(attrs.label.fao, "Dagfesting")
    assert.equal(attrs.label.eng, "Date")
    assert.equal(attrs.extended_component, "dateInput")
    assert.equal(attrs.escape, false)
    const regex = new RegExp(`^(?:${dateQuery("1818")})$`)
    assert.equal(regex.test("1818"), true)
    assert.equal(regex.test("1819"), false)
})
