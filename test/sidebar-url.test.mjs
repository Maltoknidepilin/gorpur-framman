import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"
import { sidebarSetValues } from "../app/scripts/kwic/sidebar-values.ts"

const { outputText } = ts.transpileModule(
    readFileSync(new URL("../app/scripts/components/kwic/sidebar-components.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
)
const mocks = {
    "@/util": { html: String.raw }, "@/i18n": {}, "@/services/stringify": {},
    lodash: {}, "@/statemachine": {}, "custom/sidebar.js": { default: {} },
    "@/kwic/sidebar-values": { sidebarSetValues },
}
const module = { exports: {} }
vm.runInNewContext(outputText, {
    module, exports: module.exports, URL,
    require: name => { assert.ok(name in mocks, name); return mocks[name] },
})
const component = module.exports.sidebarUrlComponent
function resolve(value) {
    const scope = { value }
    component.controller.at(-1)(scope)
    return scope.url
}

test("long sidebar URLs retain the complete destination and percent encoding", () => {
    const url = "https://www.logting.fo/mal/yvirlit/gerdabokur/gerdabok/?id=1&title=F%C3%B8royar"
    assert.equal(resolve(url), url)
    assert.equal(resolve("https://www.akstovan.fo/" + "long-path/".repeat(100)),
        "https://www.akstovan.fo/" + "long-path/".repeat(100))
})

test("missing, invalid and non-web URLs do not become clickable links", () => {
    for (const value of [undefined, "", "not a URL", "javascript:alert(1)", "file:///etc/passwd",
        "https://user:password@example.test/"]) assert.equal(resolve(value), undefined)
})
