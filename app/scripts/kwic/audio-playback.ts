/** Optional bounded playback for an existing HTML audio element. No corpus-specific fields. */
export type AudioRange = { start: number; end: number }
export type AudioPadding = { pre_roll?: number; post_roll?: number }
export const DEFAULT_AUDIO_PADDING = { pre_roll: 0.25, post_roll: 0.4 }

export function audioNumber(value: unknown): number | undefined {
    if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return undefined
    const result = Number(value)
    return Number.isFinite(result) ? result : undefined
}

export function audioRange(start: unknown, end: unknown): AudioRange | undefined {
    const a = audioNumber(start), b = audioNumber(end)
    return a != undefined && b != undefined && a >= 0 && b > a ? { start: a, end: b } : undefined
}

export function paddedRange(range: AudioRange, padding: AudioPadding, duration?: number): AudioRange {
    const pre = audioNumber(padding.pre_roll), post = audioNumber(padding.post_roll)
    return {
        start: Math.max(0, range.start - (pre != undefined && pre >= 0 ? pre : DEFAULT_AUDIO_PADDING.pre_roll)),
        end: Math.min(
            range.end + (post != undefined && post >= 0 ? post : DEFAULT_AUDIO_PADDING.post_roll),
            duration != undefined && Number.isFinite(duration) && duration > 0 ? duration : Infinity,
        ),
    }
}

type FrameClock = { request: (callback: FrameRequestCallback) => number; cancel: (id: number) => void }

export class AudioPlayback {
    range: AudioRange | null = null
    private raw: AudioRange | null = null
    private frame: number | null = null
    private watching = false
    private pendingSeek = false
    private seekTarget: number | null = null
    private source = ""
    private generation = 0
    private destroyed = false
    private clock: FrameClock
    private listeners: Record<string, () => void>

    constructor(
        private audio: HTMLAudioElement,
        private padding: AudioPadding = DEFAULT_AUDIO_PADDING,
        private changed: () => void = () => {},
        clock?: FrameClock,
    ) {
        this.clock = clock || { request: requestAnimationFrame, cancel: cancelAnimationFrame }
        this.source = audio.src
        this.listeners = {
            play: () => this.watch(),
            pause: () => { this.unwatch(); this.changed() },
            ended: () => this.cancel(),
            error: () => this.cancel(),
            seeking: () => {
                if (this.seekTarget != null && Math.abs(this.audio.currentTime - this.seekTarget) < 0.05) return
                if (this.range && (this.audio.currentTime < this.range.start || this.audio.currentTime >= this.range.end))
                    this.cancel()
            },
            seeked: () => { this.seekTarget = null },
            loadedmetadata: () => this.ready(),
            durationchange: () => this.ready(),
            // An external source change must invalidate pending seeks too.
            emptied: () => this.sourceChanged(),
            loadstart: () => this.sourceChanged(),
        }
        for (const [event, listener] of Object.entries(this.listeners)) audio.addEventListener(event, listener)
    }

    setSource(source: string) {
        if (this.destroyed || this.source === source) return
        this.cancel()
        this.audio.pause()
        this.source = source
        this.audio.src = source
        this.audio.load()
    }

    playSentence(start: number, end: number): Promise<boolean> {
        const range = audioRange(start, end)
        this.cancel()
        if (!range || this.destroyed) return Promise.resolve(false)
        this.raw = range
        this.range = paddedRange(range, this.padding, this.audio.duration)
        this.pendingSeek = true
        this.ready()
        if (!this.range) return Promise.resolve(false)
        return this.play()
    }

    playNormal(): Promise<boolean> {
        this.cancel()
        return this.play()
    }

    cancel() {
        this.generation++
        this.range = null
        this.raw = null
        this.pendingSeek = false
        this.seekTarget = null
        this.unwatch()
        this.changed()
    }

    destroy() {
        if (this.destroyed) return
        this.destroyed = true
        this.cancel()
        for (const [event, listener] of Object.entries(this.listeners)) this.audio.removeEventListener(event, listener)
        this.audio.pause()
        this.audio.removeAttribute("src")
        this.audio.load()
    }

    private sourceChanged() {
        if (this.audio.src !== this.source) {
            this.source = this.audio.src
            this.cancel()
        }
    }

    private ready() {
        this.sourceChanged()
        if (!this.raw) return
        this.range = paddedRange(this.raw, this.padding, this.audio.duration)
        if (this.range.start >= this.range.end) { this.cancel(); this.audio.pause(); return }
        if (this.pendingSeek && this.audio.readyState >= 1) {
            this.seekTarget = this.range.start
            try {
                this.audio.currentTime = this.range.start
                this.pendingSeek = false
            } catch (_) { /* Retry on loadedmetadata; some browsers cannot seek before that. */ }
        }
        if (!this.audio.paused) this.watch()
        this.changed()
    }

    private async play(): Promise<boolean> {
        if (this.destroyed) return false
        const generation = this.generation
        try {
            await this.audio.play()
            if (generation !== this.generation || this.destroyed) return false
            this.watch()
            this.changed()
            return true
        } catch (_) {
            if (generation === this.generation) this.cancel()
            return false
        }
    }

    private check = () => {
        if (this.range && !this.pendingSeek && this.audio.currentTime >= this.range.end) {
            this.cancel()
            this.audio.pause()
        }
    }

    private tick = () => {
        this.frame = null
        this.check()
        if (this.watching) this.frame = this.clock.request(this.tick)
    }

    private watch() {
        if (!this.range || this.audio.paused || this.watching || this.destroyed) return
        this.watching = true
        this.audio.addEventListener("timeupdate", this.check)
        this.frame = this.clock.request(this.tick)
    }

    private unwatch() {
        this.watching = false
        this.audio.removeEventListener("timeupdate", this.check)
        if (this.frame != null) this.clock.cancel(this.frame)
        this.frame = null
    }
}
