/**
 * 7-bag randomizer, deterministic Fisher-Yates shuffle of all seven
 * tetrominoes per bag, seeded by a mulberry32 PRNG. Each bag is consumed
 * one piece at a time and automatically refilled when fewer than 7 pieces
 * remain queued, guaranteeing the Guideline piece-distribution property.
 */

import { PIECE_KINDS } from '@engine/pieces'
import type { BagState, PieceKind } from '@engine/types'

/**
 * Small deterministic 32-bit PRNG. Chosen over Math.random so replays
 * from the same seed are bit-for-bit reproducible.
 */
function mulberry32(seedInput: number): () => number {
  let seed = seedInput >>> 0
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let mixed = seed
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

/** Produces one shuffled copy of {@link PIECE_KINDS} using the supplied PRNG. */
function shuffledBagWith(random: () => number): readonly PieceKind[] {
  const pieces: PieceKind[] = [...PIECE_KINDS]
  for (let index = pieces.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const swap = pieces[index]!
    pieces[index] = pieces[swapIndex]!
    pieces[swapIndex] = swap
  }
  return pieces
}

/** Initialises a bag from a numeric seed; the first 7 pieces are generated eagerly. */
export function createBag(seed: number): BagState {
  const random = mulberry32(seed)
  return {
    seed: Math.floor(random() * 0xffffffff) >>> 0,
    upcoming: shuffledBagWith(random),
  }
}

/**
 * Ensures at least 7 upcoming pieces are queued by appending a freshly
 * shuffled bag when needed. No-op when the queue is already full.
 */
export function refillBag(bag: BagState): BagState {
  if (bag.upcoming.length >= 7) {
    return bag
  }
  const random = mulberry32(bag.seed)
  const nextSeed = Math.floor(random() * 0xffffffff) >>> 0
  const shuffled = shuffledBagWith(random)
  return {
    seed: nextSeed,
    upcoming: [...bag.upcoming, ...shuffled],
  }
}

/** Pops the next piece, refilling first so the returned bag stays valid. */
export function takeNextPiece(bag: BagState): { readonly piece: PieceKind; readonly bag: BagState } {
  const refilled = refillBag(bag)
  // refillBag guarantees upcoming.length >= 7, so the first element is always defined.
  const [piece, ...rest] = refilled.upcoming
  return {
    piece: piece!,
    bag: { ...refilled, upcoming: rest },
  }
}
