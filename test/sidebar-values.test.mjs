import assert from "node:assert/strict"
import test from "node:test"
import { sidebarLabel, sidebarSetValues } from "../app/scripts/kwic/sidebar-values.ts"

const author = {
    type: "set", label: { fao: "Høvundur", eng: "Author" },
    label_plural: { fao: "Høvundar", eng: "Authors" }, sidebar_hide_values: ["unknown"],
}

test("one author keeps the singular label; multiple visible authors use the plural", () => {
    assert.deepEqual(sidebarSetValues("| Eivind Weyhe |", author), ["Eivind Weyhe"])
    assert.equal(sidebarLabel(author, "|Eivind Weyhe|").fao, "Høvundur")
    assert.equal(sidebarLabel(author, "|Eyðun Andreassen|Malan Marnersdóttir|").fao, "Høvundar")
    assert.equal(sidebarLabel(author, "|Eyðun Andreassen|Malan Marnersdóttir|").eng, "Authors")
})

test("empty delimiters and hidden placeholders do not count as authors", () => {
    assert.deepEqual(sidebarSetValues("||unknown| Eivind Weyhe ||", author), ["Eivind Weyhe"])
    assert.equal(sidebarLabel(author, "|unknown|Eivind Weyhe|").eng, "Author")
    assert.deepEqual(sidebarSetValues("|", author), [])
    const ordinary = { type: "set", label: { eng: "Values" } }
    assert.equal(sidebarLabel(ordinary, "|a|b|").eng, "Values")
})
