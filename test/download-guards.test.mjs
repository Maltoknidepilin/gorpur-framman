import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"
import { kwicDownloadAllowed } from "../app/scripts/kwic/download-policy.ts"

const settings = { corpora: { wrifa: { download_allowed: true }, villugrunnur: { download_allowed: false } } }

function loadModule(path, mocks) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8")
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    })
    const module = { exports: {} }
    vm.runInNewContext(outputText, {
        module,
        exports: module.exports,
        require: (name) => {
            assert.ok(name in mocks, `Unexpected dependency ${name}`)
            return mocks[name]
        },
    })
    return module.exports
}

test("file generation itself rejects restricted CSV, TSV and annotation exports", () => {
    const { makeDownload } = loadModule("../app/scripts/kwic/kwic_download.ts", {
        lodash: {},
        moment: {},
        "comma-separated-values/csv": {},
        "@/i18n": {},
        "@/kwic/kwic": {},
        "@/settings": settings,
        "./download-policy": { kwicDownloadAllowed },
    })
    for (const format of ["csv", "tsv"]) {
        for (const type of ["kwic", "annotations"]) {
            assert.throws(
                () => makeDownload(type, format, [{ corpus: "VILLUGRUNNUR" }], { corpus: "WRIFA" }, 1),
                /disabled by corpus permissions/,
            )
        }
    }
})

test("JSON export rejects restricted data and explicit denial even when called directly", async () => {
    let component
    const downloads = []
    loadModule("../app/scripts/components/util/json_button.ts", {
        angular: { module: () => ({ component: (_name, definition) => { component = definition } }) },
        "@/util": { html: () => "", downloadFile: (...args) => downloads.push(args) },
        "@/settings": settings,
        "@/kwic/download-policy": { kwicDownloadAllowed },
    })
    const scope = {}
    const controller = { data: { kwic: [{ corpus: "VILLUGRUNNUR" }] }, endpoint: "query" }
    component.controller.at(-1).call(controller, scope)
    await scope.openJson()
    assert.equal(downloads.length, 0)

    controller.data = { kwic: [{ corpus: "WRIFA" }] }
    controller.downloadAllowed = false
    await scope.openJson()
    assert.equal(downloads.length, 0)

    controller.downloadAllowed = true
    await scope.openJson()
    assert.equal(downloads.length, 1)
    assert.match(downloads[0][0], /WRIFA/)
})
