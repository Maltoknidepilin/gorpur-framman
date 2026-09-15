import assert from "node:assert/strict"
import test from "node:test"
import { dateQuery, dateQueryValue } from "../app/scripts/search/date-query.ts"
import stringify from "../../gorps-stillingar-framman/app/custom/stringify.js"

const matches = (query, date) => new RegExp(`^(?:${dateQuery(query)})$`).test(date)

test("estimated periods display a hyphen while leaving other values intact", () => {
    assert.equal(stringify.foEstimatedPeriod("1998/2021"), "1998-2021")
    assert.equal(stringify.foEstimatedPeriod("2020/2026"), "2020-2026")
    assert.equal(stringify.foEstimatedPeriod("1990/2006"), "1990-2006")
    for (const value of ["1998-2021", "2026-09-15", "unknown", ""]) {
        assert.equal(stringify.foEstimatedPeriod(value), value)
    }
})

test("fetched dates hide time without converting timezone or inventing a date", () => {
    for (const value of ["2026-09-15T00:30:42+02:00", "2026-09-15 12:00:00Z", "2026-09-15"]) {
        assert.equal(stringify.foDateOnly(value), "2026-09-15")
    }
    assert.equal(stringify.foDateOnly(undefined), "")
    for (const value of ["2026", "unknown", ""]) assert.equal(stringify.foDateOnly(value), value)
})

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
