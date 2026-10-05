import { describe, expect, test } from 'claude-code/testing'

import type { Puzzle } from '../types'
import { squareIndex } from './chess'
import { boardOf, hint, play, playText, reveal, start } from './game'
import { fromLichess } from './puzzles'
import { LICHESS_SAMPLE } from './samples'

const lichess = (): Puzzle => fromLichess(LICHESS_SAMPLE)
const sq = squareIndex

describe('play', () => {
  test('the expected move is played and answered', () => {
    const result = play(start(lichess()), sq('g3'), sq('f3'))
    expect(result.outcome).toBe('correct')
    expect(result.played).toEqual(['g3f3', 'f5g4'])
    expect(result.game.step).toBe(2)
    expect(result.game.fen.split(' ')[1]).toBe('b')
  })

  test('the last move solves the puzzle', () => {
    const first = play(start(lichess()), sq('g3'), sq('f3'))
    const last = play(first.game, sq('f6'), sq('f5'))
    expect(last.outcome).toBe('solved')
    expect(last.game.isSolved).toBe(true)
    expect(last.game.isFailed).toBe(false)
  })

  test('a legal move that is not the solution fails the puzzle and leaves the board', () => {
    const game = start(lichess())
    const result = play(game, sq('b5'), sq('b4'))
    expect(result.outcome).toBe('wrong')
    expect(result.game.isFailed).toBe(true)
    expect(result.game.fen).toBe(game.fen)
  })

  test('an illegal move is refused without failing the puzzle', () => {
    const result = play(start(lichess()), sq('h6'), sq('h4'))
    expect(result.outcome).toBe('illegal')
    expect(result.game.isFailed).toBe(false)
  })

  test('a promotion follows the solution when the click gives none', () => {
    const puzzle: Puzzle = { id: 'p', source: 'lichess', fen: '8/P6k/8/8/8/8/8/K7 w - - 0 1', solution: ['a7a8q'], themes: [], url: '' }
    const result = play(start(puzzle), sq('a7'), sq('a8'))
    expect(result.outcome).toBe('solved')
    expect(result.played).toEqual(['a7a8q'])
  })

  test('another checkmate counts as solved', () => {
    const puzzle: Puzzle = { id: 'p', source: 'lichess', fen: '6k1/5ppp/8/8/8/8/8/R3R1K1 w - - 0 1', solution: ['a1a8'], themes: [], url: '' }
    const result = play(start(puzzle), sq('e1'), sq('e8'))
    expect(result.outcome).toBe('solved')
    expect(result.game.isFailed).toBe(false)
  })
})

describe('playText', () => {
  test('reads SAN and UCI', () => {
    expect(playText(start(lichess()), 'Rgf3+').outcome).toBe('correct')
    expect(playText(start(lichess()), 'g3f3').outcome).toBe('correct')
    expect(playText(start(lichess()), 'Qh5').outcome).toBe('illegal')
  })
})

describe('hint and reveal', () => {
  test('the first hint is free, the second names the piece and costs the puzzle', () => {
    const first = hint(start(lichess()))
    expect(first.square).toBeUndefined()
    expect(first.game).toMatchObject({ hints: 1, isFailed: false })
    const second = hint(first.game)
    expect(second.square).toBe('g3')
    expect(second.game).toMatchObject({ hints: 2, isFailed: true })
  })

  test('reveal plays the expected move and its answer', () => {
    const result = reveal(start(lichess()))
    expect(result.san).toBe('Rgf3+')
    expect(result.outcome).toBe('correct')
    expect(result.game.isFailed).toBe(true)
    expect(result.game.step).toBe(2)
  })
})

describe('boardOf', () => {
  test('orients the board for the solver and keeps the highlights', () => {
    const board = boardOf(start(lichess()), 'symbols', ['g4', 'f5'], 'g3')
    expect(board.orientation).toBe('b')
    expect(board.squares).toHaveLength(64)
    expect(board.squares[sq('g3')]).toEqual({ piece: 'r', color: 'b' })
    expect(board.lastMove).toEqual(['g4', 'f5'])
    expect(board.hint).toBe('g3')
  })
})
