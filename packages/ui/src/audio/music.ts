/**
 * Background music player. Streams a single looping track via an
 * HTMLAudioElement so the asset is the real production-quality recording
 * rather than a procedural synth approximation.
 *
 * Track: "Arpanauts" by Eric Skiff (Resistor Anthems), CC BY 4.0.
 * https://ericskiff.com/music/
 */

const TRACK_URL = '/music/arpanauts.mp3'
const DEFAULT_VOLUME = 0.3

/** Imperative facade returned by {@link createMusicPlayer}. */
export type MusicPlayer = {
  /** Begin playback. Idempotent if already playing. */
  readonly start: () => void
  /** Stop playback and rewind to the start. */
  readonly stop: () => void
  /** Pause without rewinding; resume continues from the same spot. */
  readonly pause: () => void
  readonly resume: () => void
  readonly setVolume: (volume: number) => void
  readonly setEnabled: (enabled: boolean) => void
}

/** Clamps a fractional volume to the valid `[0, 1]` range. */
function clampVolume(volume: number): number {
  return Math.max(0, Math.min(1, volume))
}

export function createMusicPlayer(): MusicPlayer {
  let audioElement: HTMLAudioElement | null = null
  let volume = DEFAULT_VOLUME
  let enabled = false
  let shouldBePlaying = false

  function ensureAudioElement(): HTMLAudioElement {
    if (audioElement) {
      return audioElement
    }
    const audio = new Audio(TRACK_URL)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = volume
    audioElement = audio
    return audio
  }

  function tryPlay(): void {
    if (!audioElement || !enabled || !shouldBePlaying) {
      return
    }
    const playPromise = audioElement.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      // Browsers reject if there's no recent user gesture; harmless.
      playPromise.catch(() => {})
    }
  }

  return {
    start: () => {
      shouldBePlaying = true
      if (!enabled) {
        return
      }
      const audio = ensureAudioElement()
      audio.currentTime = 0
      tryPlay()
    },
    stop: () => {
      shouldBePlaying = false
      if (audioElement) {
        audioElement.pause()
        audioElement.currentTime = 0
      }
    },
    pause: () => {
      if (audioElement && !audioElement.paused) {
        audioElement.pause()
      }
    },
    resume: () => {
      tryPlay()
    },
    setVolume: (nextVolume) => {
      volume = clampVolume(nextVolume)
      if (audioElement) {
        audioElement.volume = volume
      }
    },
    setEnabled: (nextEnabled) => {
      enabled = nextEnabled
      if (!enabled) {
        if (audioElement && !audioElement.paused) {
          audioElement.pause()
        }
        return
      }
      if (shouldBePlaying) {
        ensureAudioElement()
        tryPlay()
      }
    },
  }
}
