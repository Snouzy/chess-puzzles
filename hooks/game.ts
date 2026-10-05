import type { Board, Game, Puzzle } from '../types'
import { type Move, type PieceType, type Position, isCheckmate, legalMoves, makeMove, parseFen, parseSan, parseUci, squareName, toFen, toSan, toUci } from './chess'

export type Outcome = 'illegal' | 'wrong' | 'correct' | 'solved'
export type Played = { game: Game; outcome: Outcome; played: string[] }

export function start(puzzle: Puzzle): Game {
  return { puzzle, fen: puzzle.fen, step: 0, hints: 0, isFailed: false, isSolved: false }
}

function expectedMove(game: Game): Move | undefined {
  const uci = game.puzzle.solution[game.step]
  return uci === undefined ? undefined : parseUci(uci)
}

function sameMove(a: Move, b: Move): boolean {
  return a.from === b.from && a.to === b.to && (a.promotion ?? null) === (b.promotion ?? null)
}

function resolve(position: Position, from: number, to: number, promotion: PieceType | undefined): Move | undefined {
  const candidates = legalMoves(position).filter(move => move.from === from && move.to === to)
  if (candidates.length <= 1) return candidates[0]
  return candidates.find(move => move.promotion === (promotion ?? 'q'))
}

export function play(game: Game, from: number, to: number, promotion?: PieceType): Played {
  if (game.isSolved) return { game, outcome: 'solved', played: [] }
  const position = parseFen(game.fen)
  const expected = expectedMove(game)
  const wanted = promotion ?? (expected && expected.from === from && expected.to === to ? expected.promotion : undefined)
  const move = resolve(position, from, to, wanted)
  if (!move) return { game, outcome: 'illegal', played: [] }

  const after = makeMove(position, move)
  const isExpected = expected !== undefined && sameMove(move, expected)
  if (!isExpected && !isCheckmate(after)) return { game: { ...game, isFailed: true }, outcome: 'wrong', played: [] }

  const played = [toUci(move)]
  let next: Game = { ...game, fen: toFen(after), step: game.step + 1 }
  if (!isExpected || next.step >= game.puzzle.solution.length) return { game: { ...next, isSolved: true }, outcome: 'solved', played }

  const reply = expectedMove(next)
  if (reply) {
    next = { ...next, fen: toFen(makeMove(parseFen(next.fen), reply)), step: next.step + 1 }
    played.push(toUci(reply))
  }
  if (next.step >= game.puzzle.solution.length) return { game: { ...next, isSolved: true }, outcome: 'solved', played }

  return { game: next, outcome: 'correct', played }
}

export function playText(game: Game, text: string): Played {
  const input = text.trim()
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(input)) {
    const move = parseUci(input.toLowerCase())
    return play(game, move.from, move.to, move.promotion)
  }
  const move = parseSan(parseFen(game.fen), input)
  if (!move) return { game, outcome: 'illegal', played: [] }

  return play(game, move.from, move.to, move.promotion)
}

export function hint(game: Game): { game: Game; square: string | undefined } {
  const hints = Math.min(game.hints + 1, 2)
  const expected = expectedMove(game)
  const square = hints >= 2 && expected ? squareName(expected.from) : undefined
  return { game: { ...game, hints, isFailed: game.isFailed || hints >= 2 }, square }
}

export function reveal(game: Game): Played & { san: string | undefined } {
  const expected = expectedMove(game)
  if (!expected || game.isSolved) return { game, outcome: 'solved', played: [], san: undefined }
  const san = toSan(parseFen(game.fen), expected)
  return { ...play({ ...game, isFailed: true }, expected.from, expected.to, expected.promotion), san }
}

export function boardOf(game: Game, pieces: Board['pieces'], lastMove: string[], hintSquare: string | null): Board {
  const squares = parseFen(game.fen).board.map(square => (square ? { piece: square.type, color: square.color } : null))
  return { squares, orientation: parseFen(game.puzzle.fen).turn, lastMove, hint: hintSquare, pieces, size: 'large' }
}

export function squaresOf(uci: string): string[] {
  const move = parseUci(uci)
  return [squareName(move.from), squareName(move.to)]
}
