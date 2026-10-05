import type { ClientModule } from 'claude-code'

import type { Board, Square } from '../types'

type State = { selected: string | null }

const LIGHT = '#f0d9b5'
const DARK = '#b58863'
const SELECTED = '#f6f669'
const LAST = '#cdd26a'
const HINT = '#9bc700'
const WHITE = '#ffffff'
const BLACK = '#1a1a1a'
const GUTTER = 2
const FILES = 'abcdefgh'
const SYMBOLS: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }

function cellOf(board: Board): { columns: number; rows: number } {
  return board.size === 'large' ? { columns: 4, rows: 2 } : { columns: 2, rows: 1 }
}

function nameOf(file: number, rank: number): string {
  return `${FILES[file] ?? '?'}${rank + 1}`
}

function squareAt(board: Board, x: number, y: number): string | null {
  const cell = cellOf(board)
  const col = Math.floor((x - GUTTER) / cell.columns)
  const row = Math.floor(y / cell.rows)
  if (x < GUTTER || col > 7 || row < 0 || row > 7) return null
  const file = board.orientation === 'w' ? col : 7 - col
  const rank = board.orientation === 'w' ? 7 - row : row
  return nameOf(file, rank)
}

function pieceAt(board: Board, name: string): Square | null {
  const file = FILES.indexOf(name.charAt(0))
  const rank = Number(name.charAt(1)) - 1
  return board.squares[rank * 8 + file] ?? null
}

function glyphOf(board: Board, square: Square | null): string {
  if (!square) return ' '
  if (board.pieces === 'letters') return square.color === 'w' ? square.piece.toUpperCase() : square.piece
  return SYMBOLS[square.piece] ?? '?'
}

function centered(text: string, width: number): string {
  const left = Math.floor((width - 1) / 2)
  return ' '.repeat(left) + text + ' '.repeat(width - 1 - left)
}

function backgroundOf(board: Board, name: string, selected: string | null, isLight: boolean): string {
  if (name === selected) return SELECTED
  if (name === board.hint) return HINT
  if (board.lastMove.includes(name)) return LAST
  return isLight ? LIGHT : DARK
}

const BoardView: ClientModule<Board | null, State> = (board, surface) => {
  const { Box, Text } = surface.elements
  const selected = surface.state?.selected ?? null

  surface.onPointer(event => {
    if (!board || event.type !== 'down' || event.button !== 'left') return
    const name = squareAt(board, event.x, event.y)
    if (!name) return
    const own = pieceAt(board, name)?.color === board.orientation
    if (selected === null) {
      if (own) surface.setState({ selected: name })
      return
    }
    if (name === selected) {
      surface.setState({ selected: null })
      return
    }
    if (own) {
      surface.setState({ selected: name })
      return
    }
    surface.post({ from: selected, to: name })
    surface.setState({ selected: null })
  })

  if (!board) return <Text dimColor> </Text>

  const cell = cellOf(board)
  const ranks = board.orientation === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]
  const files = board.orientation === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]

  return (
    <Box flexDirection="column">
      {ranks.map(rank => (
        <Box key={`rank-${rank}`}>
          <Box width={GUTTER} height={cell.rows}>
            <Text dimColor>{String(rank + 1)}</Text>
          </Box>
          {files.map(file => {
            const name = nameOf(file, rank)
            const square = pieceAt(board, name)
            const background = backgroundOf(board, name, selected, (rank + file) % 2 === 1)
            return (
              <Box key={name} flexDirection="column" width={cell.columns} height={cell.rows} backgroundColor={background}>
                <Text backgroundColor={background} color={square?.color === 'w' ? WHITE : BLACK} bold>
                  {centered(glyphOf(board, square), cell.columns)}
                </Text>
                {cell.rows > 1 && <Text backgroundColor={background}>{' '.repeat(cell.columns)}</Text>}
              </Box>
            )
          })}
        </Box>
      ))}
      <Text dimColor>{' '.repeat(GUTTER) + files.map(file => centered(FILES[file] ?? '?', cell.columns)).join('')}</Text>
    </Box>
  )
}

export default BoardView
