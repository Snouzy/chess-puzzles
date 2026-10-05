import type { Puzzle } from '../types'
import { makeMove, parseFen, parseSan, replayPgn, toFen, toUci, tokenizeMovetext } from './chess'
import type { Difficulty } from './rating'

export const CHESSCOM_RANDOM_URL = 'https://api.chess.com/pub/puzzle/random'

export function lichessUrl(difficulty: Difficulty): string {
  return `https://lichess.org/api/puzzle/next?difficulty=${difficulty}`
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

export function fromLichess(json: unknown): Puzzle {
  const pgn = field(field(json, 'game'), 'pgn')
  const puzzle = field(json, 'puzzle')
  const id = field(puzzle, 'id')
  const rating = field(puzzle, 'rating')
  const themes = field(puzzle, 'themes')
  const solution = field(puzzle, 'solution')
  if (typeof pgn !== 'string' || typeof id !== 'string' || !isStringArray(solution) || solution.length === 0) {
    throw new Error('missing game.pgn, puzzle.id or puzzle.solution')
  }

  return {
    id,
    source: 'lichess',
    fen: toFen(replayPgn(pgn)),
    solution,
    rating: typeof rating === 'number' ? rating : undefined,
    themes: isStringArray(themes) ? themes : [],
    url: `https://lichess.org/training/${id}`,
  }
}

export function fromChesscom(json: unknown): Puzzle {
  const fen = field(json, 'fen')
  const pgn = field(json, 'pgn')
  const title = field(json, 'title')
  const url = field(json, 'url')
  if (typeof fen !== 'string' || typeof pgn !== 'string') throw new Error('missing fen or pgn')

  const movetext = pgn
    .split(/\r?\n/)
    .filter(line => !line.startsWith('['))
    .join(' ')
  let position = parseFen(fen)
  const solution: string[] = []
  for (const token of tokenizeMovetext(movetext)) {
    const move = parseSan(position, token)
    if (!move) throw new Error(`solution move "${token}" is not legal`)
    solution.push(toUci(move))
    position = makeMove(position, move)
  }
  if (solution.length === 0) throw new Error('empty solution')

  const link = typeof url === 'string' ? url : 'https://www.chess.com/puzzles'
  return {
    id: link.slice(link.lastIndexOf('/') + 1) || fen,
    source: 'chesscom',
    fen,
    solution,
    themes: typeof title === 'string' && title !== '' ? [title] : [],
    url: link,
  }
}
