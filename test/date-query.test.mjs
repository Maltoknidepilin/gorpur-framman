import assert from "node:assert/strict"
import test from "node:test"
import { dateQuery, dateQueryValue } from "../app/scripts/search/date-query.ts"

const matches = (query, date) => new RegExp(`^(?:${dateQuery(query)})$`).test(date)

test("year searches include stored years, months and full dates in that year", () => {
    for (const date of ["2022", "2022-11", "2022-01-01", "2022-12-31"]) assert.ok(matches("2022", date))
    for (const date of ["2021", "2023-11-01", "20220", "unknown"]) assert.equal(matches("2022", date), false)
})

test("month searches include full dates but do not invent months for year-only records", () => {
    assert.ok(matches("2022-11", "2022-11"))
    assert.ok(matches("2022-11", "2022-11-30"))
    for (const date of ["2022", "2022-10", "2022-12-01"]) assert.equal(matches("2022-11", date), false)
})

test("full dates remain exact and query precision survives reopening", () => {
    assert.ok(matches("2022-11-02", "2022-11-02"))
    assert.equal(matches("2022-11-02", "2022-11-03"), false)
    for (const date of ["2016", "2022-11", "2022-11-02"]) {
        assert.equal(dateQueryValue(dateQuery(date)), date)
        assert.equal(dateQueryValue(date), date)
    }
})

test("invalid dates and arbitrary regular expressions are rejected", () => {
    for (const date of ["", "0000", "2022-00", "2022-13", "2022-02-29", "2022-11-31", "2022-11-00", "2022.*"]) {
        assert.equal(dateQuery(date), "")
    }
    assert.equal(dateQuery("2024-02-29"), "2024-02-29")
})
