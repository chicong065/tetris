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
 * auto-resumed to satisfy browser autoplay policies.
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
 * so that held-down soft drops feel like continuous patter instead of a
 * choppy series of discrete clicks; at the engine's max soft-drop speed
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

// Internal synthesis primitives. Every helper takes the AudioContext and
// the scheduled start time so multiple primitives can stack into one SFX
// without any audible gap between them.

/**
 * Generates a short burst of white noise passed through a band-pass
 * filter. Useful for clicks and the "thud" body of impact sounds.
 */
function playNoiseBurst(
  audioContext: AudioContext,
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

  source.connect(filter).connect(gain).connect(audioContext.destination)
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

  oscillator.connect(gain).connect(audioContext.destination)
  oscillator.start(options.startAt)
  oscillator.stop(options.startAt + durationSec)
}

/**
 * Plays a steady oscillator tone with a clean amplitude envelope. Used
 * for arpeggio steps in line-clear and level-up fanfares.
 */
function playSteadyTone(
  audioContext: AudioContext,
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

  oscillator.connect(gain).connect(audioContext.destination)
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
    playSteadyTone(audioContext, {
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
 * `scale` multiplies the peak volume so the player's master-volume slider
 * has a single hook into all the envelopes.
 */
function playEffect(audioContext: AudioContext, kind: SfxKind, scale: number): void {
  const now = audioContext.currentTime
  switch (kind) {
    case 'move': {
      // Crisp key-click: very short noise burst around 2 kHz.
      playNoiseBurst(audioContext, {
        startAt: now,
        durationMs: 18,
        volume: 0.18 * scale,
        filterFrequency: 2000,
        filterQ: 4,
      })
      return
    }
    case 'softDrop': {
      // Short, low-pitched tick designed to fuse into a soft patter when
      // repeated at ~35 Hz (see MIN_INTERVAL_MS). Shorter duration + a
      // narrower band-pass filter + lower volume than `move` so held
      // soft drop doesn't overwhelm other cues (rotate, lock, line).
      playNoiseBurst(audioContext, {
        startAt: now,
        durationMs: 8,
        volume: 0.055 * scale,
        filterFrequency: 1200,
        filterQ: 5,
      })
      return
    }
    case 'rotate': {
      // Short tonal blip plus a wisp of noise for bite.
      playPitchedSweep(audioContext, {
        startAt: now,
        durationMs: 60,
        fromFrequency: 520,
        toFrequency: 380,
        type: 'triangle',
        volume: 0.22 * scale,
      })
      playNoiseBurst(audioContext, {
        startAt: now,
        durationMs: 12,
        volume: 0.06 * scale,
        filterFrequency: 3500,
        filterQ: 2,
      })
      return
    }
    case 'hold': {
      // Two-note chirp, rising, signalling a swap.
      playPitchedSweep(audioContext, {
        startAt: now,
        durationMs: 50,
        fromFrequency: 340,
        toFrequency: 520,
        type: 'triangle',
        volume: 0.22 * scale,
      })
      return
    }
    case 'lock': {
      // Piece landing: low pitched thud + short noise click on top.
      playPitchedSweep(audioContext, {
        startAt: now,
        durationMs: 80,
        fromFrequency: 180,
        toFrequency: 70,
        type: 'sine',
        volume: 0.32 * scale,
      })
      playNoiseBurst(audioContext, {
        startAt: now,
        durationMs: 22,
        volume: 0.12 * scale,
        filterFrequency: 2200,
        filterQ: 3,
      })
      return
    }
    case 'hardDrop': {
      // Heavy impact: deeper thud + broader noise burst.
      playPitchedSweep(audioContext, {
        startAt: now,
        durationMs: 140,
        fromFrequency: 260,
        toFrequency: 45,
        type: 'sine',
        volume: 0.45 * scale,
      })
      playNoiseBurst(audioContext, {
        startAt: now,
        durationMs: 35,
        volume: 0.22 * scale,
        filterFrequency: 1400,
        filterQ: 2,
      })
      return
    }
    case 'lineClear': {
      // 3-note ascending arpeggio in a major triad.
      playArpeggio(audioContext, {
        startAt: now,
        rootFrequency: 523, // C5
        semitones: [0, 4, 7],
        stepMs: 80,
        type: 'square',
        volume: 0.35 * scale,
      })
      return
    }
    case 'tetris': {
      // Fanfare: octave-wide run with the top note held longer.
      playArpeggio(audioContext, {
        startAt: now,
        rootFrequency: 523,
        semitones: [0, 4, 7, 12, 7, 12],
        stepMs: 80,
        type: 'square',
        volume: 0.4 * scale,
      })
      // Sustain the top C6 as a pad underneath.
      playSteadyTone(audioContext, {
        startAt: now + 0.3,
        durationMs: 220,
        frequency: 1046, // C6
        type: 'triangle',
        volume: 0.3 * scale,
      })
      return
    }
    case 'tspin': {
      // Distinctive bright arpeggio, higher than lineClear.
      playArpeggio(audioContext, {
        startAt: now,
        rootFrequency: 880, // A5
        semitones: [0, 7, 12, 7],
        stepMs: 70,
        type: 'square',
        volume: 0.38 * scale,
      })
      return
    }
    case 'levelUp': {
      // 4-note ascending run with a satisfying top.
      playArpeggio(audioContext, {
        startAt: now,
        rootFrequency: 523,
        semitones: [0, 4, 7, 12],
        stepMs: 80,
        type: 'triangle',
        volume: 0.38 * scale,
      })
      return
    }
    case 'gameOver': {
      // Long descending chromatic slide, dry and flat.
      playPitchedSweep(audioContext, {
        startAt: now,
        durationMs: 900,
        fromFrequency: 300,
        toFrequency: 55,
        type: 'sawtooth',
        volume: 0.4 * scale,
      })
      return
    }
  }
}

const DEFAULT_SFX_VOLUME = 0.5

/** Clamps a fractional volume into the valid `[0, 1]` range. */
function clampVolume(volume: number): number {
  return Math.max(0, Math.min(1, volume))
}

/**
 * Builds a lazy SFX player. The AudioContext is created on the first call
 * to {@link SfxPlayer.play} to avoid browser autoplay warnings; subsequent
 * calls reuse (and if necessary resume) it.
 */
export function createSfxPlayer(): SfxPlayer {
  let audioContext: AudioContext | null = null
  let enabled = false
  let volume = DEFAULT_SFX_VOLUME
  const lastPlayTimeByKind: Partial<Record<SfxKind, number>> = {}

  function ensureAudioContext(): AudioContext | null {
    if (audioContext) {
      if (audioContext.state === 'suspended') {
        // Browsers reject if there's no recent user gesture; harmless.
        void audioContext.resume()
      }
      return audioContext
    }
    try {
      const AudioContextCtor = window.AudioContext
      if (!AudioContextCtor) {
        return null
      }
      audioContext = new AudioContextCtor()
      if (audioContext.state === 'suspended') {
        // Same autoplay-gesture rejection is expected here.
        void audioContext.resume()
      }
      return audioContext
    } catch {
      return null
    }
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
      const context = ensureAudioContext()
      if (!context) {
        return
      }
      playEffect(context, kind, volume)
    },
    setVolume: (value) => {
      volume = clampVolume(value)
    },
    setEnabled: (nextEnabled) => {
      enabled = nextEnabled
    },
  }
}
