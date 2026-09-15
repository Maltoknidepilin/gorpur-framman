import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"
import { contextAttributes } from "../app/scripts/kwic/context-attributes.ts"

function load(path, mocks = {}, extra = {}) {
    const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    })
    const module = { exports: {} }
    vm.runInNewContext(outputText, { module, exports: module.exports, ...extra,
        require: name => { assert.ok(name in mocks, name); return mocks[name] } })
    return module.exports
}
const api = load("../app/scripts/kwic/audio-playback.ts")

class FakeAudio {
    src = "https://example.test/speech.wav"
    duration = 100
    currentTime = 0
    readyState = 1
    paused = true
    events = new Map()
    addEventListener(type, fn) {
        const list = this.events.get(type) || []
        // Count attempted duplicate listeners too, so tests detect repeated setup.
        assert.ok(!list.includes(fn), `Duplicate ${type} listener`)
        this.events.set(type, [...list, fn])
    }
    removeEventListener(type, fn) { this.events.set(type, (this.events.get(type) || []).filter(f => f !== fn)) }
    emit(type) { for (const fn of [...(this.events.get(type) || [])]) fn() }
    play() { this.paused = false; this.emit("play"); return Promise.resolve() }
    pause() { this.paused = true; this.emit("pause") }
    load() { this.emit("emptied"); this.emit("loadstart") }
    removeAttribute() { this.src = "" }
    listeners() { return [...this.events.values()].reduce((n, list) => n + list.length, 0) }
}

function setup(padding) {
    const audio = new FakeAudio(), frames = new Map()
    let id = 0
    const clock = { request: fn => { frames.set(++id, fn); return id }, cancel: key => frames.delete(key) }
    const player = new api.AudioPlayback(audio, padding, () => {}, clock)
    const tick = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()) }
    return { audio, player, frames, tick }
}

test("default animation callbacks keep Window as their receiver when scheduling and cancelling", async () => {
    const frames = new Map()
    let next = 0, cancellations = 0
    const window = {
        requestAnimationFrame(fn) {
            assert.equal(this, window, "requestAnimationFrame requires Window")
            frames.set(++next, fn)
            return next
        },
        cancelAnimationFrame(id) {
            assert.equal(this, window, "cancelAnimationFrame requires Window")
            cancellations++
            frames.delete(id)
        },
    }
    // Expose both globals, as a browser does: the old bare-function code must fail this test.
    const nativeApi = load("../app/scripts/kwic/audio-playback.ts", {}, { window, ...window })
    const audio = new FakeAudio(), player = new nativeApi.AudioPlayback(audio)
    assert.equal(await player.playSentence(1, 3), true)
    assert.equal(frames.size, 1)
    const tick = [...frames.values()][0]
    frames.clear(); tick() // recurring requests also need the correct receiver
    assert.equal(frames.size, 1)
    audio.pause()
    assert.equal(cancellations, 1); assert.equal(frames.size, 0)
    await audio.play()
    assert.equal(frames.size, 1)
    player.destroy()
    assert.equal(cancellations, 2); assert.equal(frames.size, 0)
    assert.equal(audio.listeners(), 0)
})

test("recording time labels use minutes and seconds, with hours for long recordings", () => {
    for (const [seconds, expected] of [[0.34, "0:00"], [32.59, "0:32"], [60, "1:00"],
        [3599.99, "59:59"], [3600, "1:00:00"], [3661.23, "1:01:01"]])
        assert.equal(api.formatAudioTime(seconds), expected)
})

test("sentence click seeks with pre-roll and stops at end plus post-roll using currentTime", async () => {
    const { audio, player, tick, frames } = setup()
    assert.equal(await player.playSentence(10.123456, 12.345678), true)
    assert.equal(audio.currentTime, 9.873456)
    assert.equal(player.range.end, 12.745678)
    audio.currentTime = 12.7; tick(); assert.equal(audio.paused, false)
    audio.currentTime = 12.75; tick(); assert.equal(audio.paused, true)
    assert.equal(player.range, null); assert.equal(frames.size, 0)
    player.destroy(); assert.equal(audio.listeners(), 0)
})

test("padding clamps start to zero and end to the loaded duration without modifying alignment", async () => {
    const { audio, player } = setup()
    audio.duration = 2
    await player.playSentence(0.1, 1.9)
    assert.equal(audio.currentTime, 0); assert.equal(player.range.end, 2)
    audio.currentTime = 2; audio.emit("timeupdate"); assert.equal(audio.paused, true)
    const custom = setup({ pre_roll: 0, post_roll: 0.1 })
    await custom.player.playSentence(1.123456, 2)
    assert.equal(custom.audio.currentTime, 1.123456); assert.equal(custom.player.range.end, 2.1)
})

test("B replaces A immediately, same sentence restarts, normal playback clears the boundary", async () => {
    const { audio, player } = setup({ pre_roll: 0, post_roll: 0 })
    await player.playSentence(1, 2); await player.playSentence(10, 20)
    assert.equal(audio.currentTime, 10)
    audio.currentTime = 12; audio.emit("timeupdate"); assert.equal(audio.paused, false)
    await player.playSentence(10, 20); assert.equal(audio.currentTime, 10)
    await player.playNormal(); assert.equal(player.range, null)
    audio.currentTime = 21; audio.emit("timeupdate"); assert.equal(audio.paused, false)
})

test("pause detaches boundary watchers; native resume restores the selected range", async () => {
    const { audio, player, frames } = setup()
    await player.playSentence(1, 2); audio.pause()
    assert.equal(frames.size, 0); assert.equal(audio.events.get("timeupdate").length, 0)
    await audio.play(); assert.equal(frames.size, 1)
    audio.currentTime = 2.5; audio.emit("timeupdate"); assert.equal(audio.paused, true)
})

test("manual seeking outside a sentence cancels its old boundary", async () => {
    const { audio, player } = setup()
    await player.playSentence(10, 20)
    audio.emit("seeking"); audio.emit("seeked") // programmatic initial seek
    assert.ok(player.range)
    audio.currentTime = 30; audio.emit("seeking")
    assert.equal(player.range, null)
    audio.emit("timeupdate"); assert.equal(audio.paused, false)
})

test("new sources, external source changes, errors and destruction clear pending boundaries", async () => {
    const { audio, player } = setup()
    await player.playSentence(1, 2)
    player.setSource("https://example.test/second.wav"); assert.equal(player.range, null)
    await player.playSentence(4, 5); audio.src = "third.wav"; audio.emit("emptied")
    assert.equal(player.range, null)
    await player.playSentence(4, 5); audio.emit("error"); assert.equal(player.range, null)
    player.destroy(); player.destroy(); assert.equal(audio.listeners(), 0)
    assert.equal(await player.playNormal(), false)
})

test("loading metadata later seeks only the most recently selected sentence", async () => {
    const { audio, player } = setup()
    audio.readyState = 0; audio.duration = NaN
    await player.playSentence(1, 2); await player.playSentence(6, 8)
    audio.readyState = 1; audio.duration = 8.2; audio.emit("loadedmetadata")
    assert.equal(audio.currentTime, 5.75); assert.equal(player.range.end, 8.2)
    audio.readyState = 0; await player.playSentence(1, 2); await player.playNormal()
    audio.currentTime = 5; audio.readyState = 1; audio.emit("loadedmetadata")
    assert.equal(audio.currentTime, 5)
})

test("repeated clicks never accumulate listeners or animation frames", async () => {
    const { audio, player, frames } = setup()
    const baseline = audio.listeners()
    for (let i = 0; i < 100; i++) {
        await player.playSentence(1, 2)
        assert.equal(audio.listeners(), baseline + 1); assert.equal(frames.size, 1)
    }
    player.destroy(); assert.equal(audio.listeners(), 0); assert.equal(frames.size, 0)
})

test("invalid or missing timestamps expose no playable range", async () => {
    const { player, audio } = setup()
    for (const [a, b] of [[undefined, undefined], ["", ""], [null, 1], [1, 1], [2, 1], [-1, 1], [NaN, 2], [true, 2]])
        assert.equal(api.audioRange(a, b), undefined)
    assert.equal(await player.playSentence(1, 1), false); assert.equal(audio.paused, true)
})

test("context attributes follow the clicked sentence rather than the row's matched sentence", () => {
    const names = ["s_audio_start", "s_audio_end", "text_ljod"]
    const tokens = [
        { structs: { open: [{ text: { ljod: "speech.wav" } }, { s: { audio_start: "1", audio_end: "2" } }] } },
        { structs: { close: ["s"] } },
        { structs: { open: [{ s: { audio_start: "4", audio_end: "5" } }] } },
        { structs: { close: ["s", "text"] } },
    ]
    const row = { s_audio_start: "1", s_audio_end: "2", text_ljod: "speech.wav" }
    assert.equal(contextAttributes(tokens, 2, row, names).s_audio_start, "4")
    assert.equal(contextAttributes(tokens, 3, row, names).text_ljod, "speech.wav")
    assert.equal(contextAttributes([{}], 0, row, names).s_audio_start, undefined)
})

test("existing sidebar adapter hides untimed action and distinguishes speech from meeting offsets", () => {
    const adapter = load("../../gorps-stillingar-framman/app/custom/audio.js", {
        "@/settings": { audio_playback: {} }, "@/kwic/audio-playback": api,
    }, { URL }).default
    function scopeFor(timeBase, values) {
        const definition = adapter({ sentence_start: "start", sentence_end: "end", speech_start: "second", time_base: timeBase })
        const scope = { value: "https://example.test/speech.wav", sentenceData: values, $$postDigest() {}, $on() {} }
        definition.controller.at(-1)(scope, [])
        assert.match(definition.template, /ng-if="sentenceRange"/)
        return scope
    }
    assert.equal(scopeFor("speech", { start: "0.34", end: "32.59", second: "138" }).sentenceRange.start, 0.34)
    assert.equal(scopeFor("meeting", { start: "0.34", end: "32.59", second: "138" }).sentenceRange.start, 138.34)
    assert.equal(scopeFor("speech", {}).sentenceRange, undefined)
    assert.equal(scopeFor("meeting", { start: "1", end: "2" }).sentenceRange, undefined)
})

test("the native player continues after sentence playback stops and changing hits cleans it up", async () => {
    class TestPlayback extends api.AudioPlayback {
        constructor(audio, padding, changed) {
            super(audio, padding, changed, { request: () => 1, cancel() {} })
        }
    }
    const adapter = load("../../gorps-stillingar-framman/app/custom/audio.js", {
        "@/settings": { audio_playback: {} },
        "@/kwic/audio-playback": { ...api, AudioPlayback: TestPlayback },
    }, { URL, process: { env: { ENVIRONMENT: "production" } } }).default
    function mount() {
        const audio = new FakeAudio(), afterDigest = [], events = new Map()
        const definition = adapter({ sentence_start: "start", sentence_end: "end", time_base: "speech" })
        const scope = {
            value: audio.src, sentenceData: { start: "60.123456", end: "92.59" },
            $$postDigest(fn) { afterDigest.push(fn) },
            $evalAsync(fn) { fn() },
            $on(name, fn) { events.set(name, fn) },
        }
        assert.equal(definition.block, true) // avoid the sidebar's hanging paragraph indentation
        assert.match(definition.template, /download_audio_file/)
        definition.controller.at(-1)(scope, [{ querySelector: () => audio }])
        afterDigest.forEach(fn => fn())
        return { audio, scope, destroy: () => events.get("$destroy")() }
    }
    const first = mount()
    assert.equal(first.scope.sentenceTime, "1:00–1:32") // raw timing, without player padding
    assert.equal(first.audio.paused, true)
    await first.scope.playSentence()
    assert.equal(first.audio.currentTime, 59.873456) // display rounding does not affect seeking
    first.audio.currentTime = 93; first.audio.emit("timeupdate")
    assert.equal(first.audio.paused, true)
    await first.audio.play() // the audio element's play button replaces the continuation button
    first.audio.currentTime = 95; first.audio.emit("timeupdate")
    assert.equal(first.audio.paused, false)
    first.destroy()
    assert.equal(first.audio.listeners(), 0)
    const second = mount()
    second.audio.play = () => Promise.reject(new Error("Playback blocked"))
    await second.scope.playSentence()
    assert.equal(second.scope.playbackFailed, true)
    second.destroy()
})

test("row fallback is limited to the same structural span as the match", () => {
    const row = { text_ljod: 'match.wav', s_audio_start: '4' }
    const names = Object.keys(row)
    assert.equal(contextAttributes([{}, {}, {}], 0, row, names, 1).text_ljod, 'match.wav')
    const tokens = [{}, { structs: { close: ['s', 'text'] } },
        { structs: { open: [{text: {ljod: 'match.wav'}}, {s: {audio_start: '4'}}] } }]
    assert.equal(contextAttributes(tokens, 0, row, names, 2).text_ljod, undefined)
    assert.equal(contextAttributes(tokens, 2, row, names, 2).text_ljod, 'match.wav')
})

test("actual Sparv/CWB/Korp API data drives sentence playback in all result contexts", {
    skip: !process.env.MMG_AUDIO_API_OUTPUT,
}, async () => {
    const payload = JSON.parse(readFileSync(process.env.MMG_AUDIO_API_OUTPUT, 'utf8'))
    const names = Object.keys(payload.kwic[0].structs)
    for (const sample of [payload, ...Object.values(payload.context_samples)]) {
        const row = sample.kwic[0]
        const attrs = contextAttributes(row.tokens, row.match.start, row.structs, names, row.match.start)
        assert.ok(attrs.text_ljod.endsWith('M1_S0001.wav'))
        const range = api.audioRange(attrs.s_audio_start, attrs.s_audio_end)
        assert.equal(range.start, 4.5)
        const { player, audio } = setup()
        player.setSource(attrs.text_ljod)
        await player.playSentence(range.start, range.end)
        assert.equal(audio.currentTime, 4.25) // not meeting offset 138 + 4.25
        audio.currentTime = 9.31; audio.emit('timeupdate'); assert.equal(audio.paused, true)
        player.destroy()
    }
    const row = payload.kwic[0]
    const first = contextAttributes(row.tokens, 0, row.structs, names, row.match.start)
    assert.equal(first.s_audio_start, '0.34') // neighbouring sentence, not match's 4.5
    for (const row of payload.kwic.slice(1)) {
        const attrs = contextAttributes(row.tokens, row.match.start, row.structs, names, row.match.start)
        assert.equal(api.audioRange(attrs.s_audio_start, attrs.s_audio_end), undefined)
        assert.ok(attrs.text_ljod) // normal playback remains available
    }
})
