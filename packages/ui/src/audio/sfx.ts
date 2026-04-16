/**
 * Procedural SFX engine built on the Web Audio API.
 *
 * Rather than playing one oscillator per effect, each sound is synthesised
 * from small primitives: short filtered noise bursts for clicks, pitched
 * sweeps for impacts, and multi-step arpeggios for fanfares. The result
 * is noticeably more expressive than a plain square-wave tone while still
 * fitting the 8-bit aesthetic.
 *
 * The AudioContext is created lazily on the first play call and
 * auto-resumed to satisfy browser autoplay policies. All effects route
 * through a shared master `GainNode` (the user's SFX volume) into a soft
 * `DynamicsCompressor` that catches overlapping transients before they
 * clip — so per-effect peak volumes can sit close to unity without
 * audible crunch.
 */

/** Named effect trigger, one entry per gameplay event that produces sound. */
export type SfxKind =
  | 'move'
  | 'rotate'
  | 'softDrop'
  | 'hardDrop'
  | 'lock'
  | 'lineClear'
  | 'tetris'
  | 'tspin'
  | 'levelUp'
  | 'gameOver'
  | 'hold'

/**
 * Minimum interval between successive `play` calls per kind. Events that
 * arrive faster are silently dropped, keeping rapid-fire feedback (DAS
 * auto-shift, soft drop) from piling into a drone.
 *
 * softDrop is kept below the perceptual flutter fusion threshold (~35 Hz)
 * so that held-down soft drops feel like continuous tick-tick-tick patter
 * instead of one fused buzz; at the engine's max soft-drop speed
 * (50 rows/s) roughly 1-in-1.5 row events make it through.
 *
 * `rotate` has no limit because the player can rarely rotate faster than
 * a few times a second.
 */
const MIN_INTERVAL_MS: Partial<Record<SfxKind, number>> = {
  move: 50,
  softDrop: 28,
  rotate: 0,
}

/** Imperative facade returned by {@link createSfxPlayer}. */
export type SfxPlayer = {
  readonly play: (kind: SfxKind) => void
  readonly setVolume: (volume: number) => void
  readonly setEnabled: (enabled: boolean) => void
}

// Internal synthesis primitives. Every helper takes the AudioContext, the
// destination node (the player's master gain), and the scheduled start
// time so multiple primitives can stack into one SFX without any audible
// gap between them.

/**
 * Generates a short burst of white noise passed through a band-pass
 * filter. Useful for clicks and the "thud" body of impact sounds.
 */
function playNoiseBurst(
  audioContext: AudioContext,
  destination: AudioNode,
  options: {
    readonly startAt: number
    readonly durationMs: number
    readonly volume: number
    readonly filterFrequency: number
    readonly filterQ: number
  }
): void {
  const durationSec = options.durationMs / 1000
  const bufferSize = Math.max(1, Math.ceil(audioContext.sampleRate * durationSec))
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let sampleIndex = 0; sampleIndex < bufferSize; sampleIndex += 1) {
    samples[sampleIndex] = Math.random() * 2 - 1
  }
  const source = audioContext.createBufferSource()
  source.buffer = buffer

  const filter = audioContext.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = options.filterFrequency
  filter.Q.value = options.filterQ

  const gain = audioContext.createGain()
  gain.gain.setValueAtTime(0, options.startAt)
  gain.gain.linearRampToValueAtTime(options.volume, options.startAt + 0.0015)
  gain.gain.exponentialRampToValueAtTime(0.0001, options.startAt + durationSec)

  source.connect(filter).connect(gain).connect(destination)
  source.start(options.startAt)
  source.stop(options.startAt + durationSec)
}

/**
 * Plays a single oscillator with a pitch envelope (sweeping between two
 * frequencies) and a standard amplitude envelope. Produces impact "thuds"
 * when sweeping down, "zaps" when sweeping up.
 */
function playPitchedSweep(
  audioContext: AudioContext,
  destination: AudioNode,
  options: {
    readonly startAt: number
    readonly durationMs: number
    readonly fromFrequency: number
    readonly toFrequency: number
    readonly type: OscillatorType
    readonly volume: number
  }
): void {
  const durationSec = options.durationMs / 1000
  const oscillator = audioContext.createOscillator()
  oscillator.type = options.type
  oscillator.frequency.setValueAtTime(options.fromFrequency, options.startAt)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(0.01, options.toFrequency), options.startAt + durationSec)

  const gain = audioContext.createGain()
  gain.gain.setValueAtTime(0, options.startAt)
  gain.gain.linearRampToValueAtTime(options.volume, options.startAt + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, options.startAt + durationSec)

  oscillator.connect(gain).connect(destination)
  oscillator.start(options.startAt)
  oscillator.stop(options.startAt + durationSec)
}

/**
 * Plays a steady oscillator tone with a clean amplitude envelope. Used
 * for arpeggio steps in line-clear and level-up fanfares.
 */
function playSteadyTone(
  audioContext: AudioContext,
  destination: AudioNode,
  options: {
    readonly startAt: number
    readonly durationMs: number
    readonly frequency: number
    readonly type: OscillatorType
    readonly volume: number
  }
): void {
  const durationSec = options.durationMs / 1000
  const oscillator = audioContext.createOscillator()
  oscillator.type = options.type
  oscillator.frequency.value = options.frequency

  const gain = audioContext.createGain()
  gain.gain.setValueAtTime(0, options.startAt)
  gain.gain.linearRampToValueAtTime(options.volume, options.startAt + 0.003)
  gain.gain.exponentialRampToValueAtTime(0.0001, options.startAt + durationSec)

  oscillator.connect(gain).connect(destination)
  oscillator.start(options.startAt)
  oscillator.stop(options.startAt + durationSec)
}

/**
 * Plays an arpeggio, one note per step, using steady oscillator tones.
 * `semitones` are relative to `rootFrequency`; each step occupies
 * `stepMs` of real time.
 */
function playArpeggio(
  audioContext: AudioContext,
  destination: AudioNode,
  options: {
    readonly startAt: number
    readonly rootFrequency: number
    readonly semitones: readonly number[]
    readonly stepMs: number
    readonly type: OscillatorType
    readonly volume: number
  }
): void {
  options.semitones.forEach((semitoneOffset, stepIndex) => {
    const stepFrequency = options.rootFrequency * Math.pow(2, semitoneOffset / 12)
    playSteadyTone(audioContext, destination, {
      startAt: options.startAt + (stepIndex * options.stepMs) / 1000,
      durationMs: options.stepMs,
      frequency: stepFrequency,
      type: options.type,
      volume: options.volume,
    })
  })
}

/**
 * Dispatch table mapping each SfxKind to a composition of primitives.
 * Per-effect volumes are tuned for output through the player's master
 * gain (capped at unity) followed by a soft compressor — they sit near
 * `0.4–0.8` so a single event reaches roughly half digital scale, and
 * stacked transients (line clear arpeggios, hard drop sweep + noise)
 * are caught by the limiter rather than clipping.
 */
function playEffect(audioContext: AudioContext, destination: AudioNode, kind: SfxKind): void {
  const now = audioContext.currentTime
  switch (kind) {
    case 'move': {
      // Crisp key-click: very short noise burst around 2 kHz.
      playNoiseBurst(audioContext, destination, {
        startAt: now,
        durationMs: 18,
        volume: 0.35,
        filterFrequency: 2000,
        filterQ: 4,
      })
      return
    }
    case 'softDrop': {
      // The soft-drop tick is sample-based, not procedural — see
      // {@link createSfxPlayer} where the WAV is loaded and dispatched
      // directly. We unconditionally return here; the caller routes the
      // event before reaching this switch.
      return
    }
    case 'rotate': {
      // Short tonal blip plus a wisp of noise for bite.
      playPitchedSweep(audioContext, destination, {
        startAt: now,
        durationMs: 60,
        fromFrequency: 520,
        toFrequency: 380,
        type: 'triangle',
        volume: 0.42,
      })
      playNoiseBurst(audioContext, destination, {
        startAt: now,
        durationMs: 12,
        volume: 0.12,
        filterFrequency: 3500,
        filterQ: 2,
      })
      return
    }
    case 'hold': {
      // Two-note chirp, rising, signalling a swap.
      playPitchedSweep(audioContext, destination, {
        startAt: now,
        durationMs: 50,
        fromFrequency: 340,
        toFrequency: 520,
        type: 'triangle',
        volume: 0.42,
      })
      return
    }
    case 'lock': {
      // Piece landing: low pitched thud + short noise click on top.
      playPitchedSweep(audioContext, destination, {
        startAt: now,
        durationMs: 80,
        fromFrequency: 180,
        toFrequency: 70,
        type: 'sine',
        volume: 0.6,
      })
      playNoiseBurst(audioContext, destination, {
        startAt: now,
        durationMs: 22,
        volume: 0.24,
        filterFrequency: 2200,
        filterQ: 3,
      })
      return
    }
    case 'hardDrop': {
      // Heavy impact: deeper thud + broader noise burst.
      playPitchedSweep(audioContext, destination, {
        startAt: now,
        durationMs: 140,
        fromFrequency: 260,
        toFrequency: 45,
        type: 'sine',
        volume: 0.8,
      })
      playNoiseBurst(audioContext, destination, {
        startAt: now,
        durationMs: 35,
        volume: 0.42,
        filterFrequency: 1400,
        filterQ: 2,
      })
      return
    }
    case 'lineClear': {
      // 3-note ascending arpeggio in a major triad.
      playArpeggio(audioContext, destination, {
        startAt: now,
        rootFrequency: 523, // C5
        semitones: [0, 4, 7],
        stepMs: 80,
        type: 'square',
        volume: 0.55,
      })
      return
    }
    case 'tetris': {
      // Fanfare: octave-wide run with the top note held longer.
      playArpeggio(audioContext, destination, {
        startAt: now,
        rootFrequency: 523,
        semitones: [0, 4, 7, 12, 7, 12],
        stepMs: 80,
        type: 'square',
        volume: 0.6,
      })
      // Sustain the top C6 as a pad underneath.
      playSteadyTone(audioContext, destination, {
        startAt: now + 0.3,
        durationMs: 220,
        frequency: 1046, // C6
        type: 'triangle',
        volume: 0.45,
      })
      return
    }
    case 'tspin': {
      // Distinctive bright arpeggio, higher than lineClear.
      playArpeggio(audioContext, destination, {
        startAt: now,
        rootFrequency: 880, // A5
        semitones: [0, 7, 12, 7],
        stepMs: 70,
        type: 'square',
        volume: 0.58,
      })
      return
    }
    case 'levelUp': {
      // 4-note ascending run with a satisfying top.
      playArpeggio(audioContext, destination, {
        startAt: now,
        rootFrequency: 523,
        semitones: [0, 4, 7, 12],
        stepMs: 80,
        type: 'triangle',
        volume: 0.58,
      })
      return
    }
    case 'gameOver': {
      // Long descending chromatic slide, dry and flat.
      playPitchedSweep(audioContext, destination, {
        startAt: now,
        durationMs: 900,
        fromFrequency: 300,
        toFrequency: 55,
        type: 'sawtooth',
        volume: 0.6,
      })
      return
    }
  }
}

/** Default SFX volume on first launch (before the user touches the slider). */
const DEFAULT_SFX_VOLUME = 0.7

/**
 * Sample-based SFX dispatch table. Every event listed here plays a real
 * WAV file (loaded once on AudioContext creation) instead of the
 * procedural `playEffect` recipe. Anything not listed falls back to the
 * procedural primitives — same goes if the load fails.
 *
 * All files are CC0 from Juhani Junkala's "Essential Retro Video Game
 * Sound Effects Collection" (OpenGameArt) — chosen for tonal cohesion
 * with the soft-drop menu tick.
 */
const SAMPLE_URL_BY_KIND: Partial<Record<SfxKind, string>> = {
  move: '/sfx/move.wav',
  rotate: '/sfx/rotate.wav',
  softDrop: '/sfx/softdrop.wav',
  hardDrop: '/sfx/harddrop.wav',
  lock: '/sfx/lock.wav',
  hold: '/sfx/hold.wav',
  lineClear: '/sfx/lineclear.wav',
  tetris: '/sfx/tetris.wav',
  tspin: '/sfx/tspin.wav',
  levelUp: '/sfx/levelup.wav',
  gameOver: '/sfx/gameover.wav',
}

/**
 * Per-sample peak volume scalar (multiplied into the master gain). The
 * pack samples are recorded at varying loudnesses; these factors level
 * each event so move/rotate stay subtle, lock/hardDrop have weight, and
 * tetris/levelUp punch through.
 */
const SAMPLE_VOLUME_BY_KIND: Partial<Record<SfxKind, number>> = {
  move: 0.45,
  rotate: 0.55,
  softDrop: 0.7,
  hardDrop: 0.85,
  lock: 0.7,
  hold: 0.6,
  lineClear: 0.7,
  tetris: 0.85,
  tspin: 0.75,
  levelUp: 0.8,
  gameOver: 0.75,
}

/** Clamps a fractional volume into the valid `[0, 1]` range. */
function clampVolume(volume: number): number {
  return Math.max(0, Math.min(1, volume))
}

/**
 * Builds a lazy SFX player. The AudioContext is created on the first call
 * to {@link SfxPlayer.play} to avoid browser autoplay warnings; subsequent
 * calls reuse (and if necessary resume) it. Output graph:
 *
 *     primitives → masterGain (user volume) → limiter → context.destination
 */
export function createSfxPlayer(): SfxPlayer {
  let audioContext: AudioContext | null = null
  let masterGain: GainNode | null = null
  const sampleBuffers: Partial<Record<SfxKind, AudioBuffer>> = {}
  let enabled = false
  let volume = DEFAULT_SFX_VOLUME
  const lastPlayTimeByKind: Partial<Record<SfxKind, number>> = {}

  function ensureAudioContext(): { context: AudioContext; destination: AudioNode } | null {
    if (audioContext && masterGain) {
      if (audioContext.state === 'suspended') {
        // Browsers reject if there's no recent user gesture; harmless.
        void audioContext.resume()
      }
      return { context: audioContext, destination: masterGain }
    }
    try {
      const AudioContextCtor = window.AudioContext
      if (!AudioContextCtor) {
        return null
      }
      const context = new AudioContextCtor()
      const gain = context.createGain()
      gain.gain.value = volume
      // Soft brick-wall limiter: lets transients reach roughly -3 dBFS,
      // then aggressively compresses anything above so overlapping
      // primitives can't pop the output above unity.
      const limiter = context.createDynamicsCompressor()
      limiter.threshold.value = -3
      limiter.knee.value = 0
      limiter.ratio.value = 12
      limiter.attack.value = 0.001
      limiter.release.value = 0.05
      gain.connect(limiter).connect(context.destination)
      audioContext = context
      masterGain = gain
      // Fire-and-forget load of every mapped sample so subsequent plays
      // hit a populated buffer. Failures (404, decode error, offline)
      // leave the kind unset and play() falls back to the procedural
      // recipe rather than throwing.
      for (const [kind, url] of Object.entries(SAMPLE_URL_BY_KIND)) {
        void fetch(url)
          .then((response) => response.arrayBuffer())
          .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
          .then((decoded) => {
            sampleBuffers[kind as SfxKind] = decoded
          })
          .catch(() => {
            // Leave the buffer unset so play() falls through to procedural.
          })
      }
      if (context.state === 'suspended') {
        // Same autoplay-gesture rejection is expected here.
        void context.resume()
      }
      return { context, destination: gain }
    } catch {
      return null
    }
  }

  /**
   * Play a pre-decoded sample through a per-kind gain node into the
   * master destination. Source nodes are one-shot in Web Audio, so a
   * fresh BufferSource is created each call and discarded after
   * `start()`. Returns `true` if a sample was played, `false` if the
   * buffer wasn't loaded yet.
   */
  function playSample(context: AudioContext, destination: AudioNode, kind: SfxKind): boolean {
    const buffer = sampleBuffers[kind]
    if (!buffer) {
      return false
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    const sampleGain = context.createGain()
    sampleGain.gain.value = SAMPLE_VOLUME_BY_KIND[kind] ?? 0.7
    source.connect(sampleGain).connect(destination)
    source.start()
    return true
  }

  function shouldRateLimit(kind: SfxKind, nowMs: number): boolean {
    const minInterval = MIN_INTERVAL_MS[kind]
    if (minInterval === undefined || minInterval <= 0) {
      return false
    }
    const lastPlayMs = lastPlayTimeByKind[kind]
    if (lastPlayMs === undefined) {
      return false
    }
    return nowMs - lastPlayMs < minInterval
  }

  return {
    play: (kind) => {
      if (!enabled) {
        return
      }
      const nowMs = performance.now()
      if (shouldRateLimit(kind, nowMs)) {
        return
      }
      lastPlayTimeByKind[kind] = nowMs
      const handle = ensureAudioContext()
      if (!handle) {
        return
      }
      // Try the mapped sample first; if it isn't decoded yet (or the
      // mapping is missing for this kind) fall back to the procedural
      // recipe so the player still hears feedback during the brief
      // window after AudioContext init.
      if (playSample(handle.context, handle.destination, kind)) {
        return
      }
      playEffect(handle.context, handle.destination, kind)
    },
    setVolume: (value) => {
      volume = clampVolume(value)
      if (masterGain && audioContext) {
        masterGain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.01)
      }
    },
    setEnabled: (nextEnabled) => {
      enabled = nextEnabled
    },
  }
}
