export type Source = 'lichess' | 'chesscom'

export type Puzzle = {
  id: string
  source: Source
  fen: string
  solution: string[]
  rating?: number
  themes: string[]
  url: string
}

export type Square = {
  piece: string
  color: 'w' | 'b'
}

export type Board = {
  squares: (Square | null)[]
  orientation: 'w' | 'b'
  lastMove: string[]
  hint: string | null
  pieces: 'symbols' | 'letters'
  size: 'large' | 'small'
}

export type Game = {
  puzzle: Puzzle
  fen: string
  step: number
  hints: number
  isFailed: boolean
  isSolved: boolean
}

export type Stats = {
  rating: number
  solved: number
  failed: number
  streak: number
}

declare module 'claude-code' {
  interface PluginState {
    'chess-puzzles': {
      board: Board | null
      game: Game | null
      message: string
      status: string
      isOpen: boolean
    }
  }
}
