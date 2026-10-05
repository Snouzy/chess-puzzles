export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type Piece = { type: PieceType; color: Color }
export type Move = { from: number; to: number; promotion?: PieceType }
export type Position = {
  board: (Piece | null)[]
  turn: Color
  castling: string
  epSquare: number | null
  halfmove: number
  fullmove: number
}

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

type Board = readonly (Piece | null)[]
type Offset = readonly [number, number]
type CastleSide = { right: string; rook: number; empty: readonly number[]; path: readonly number[]; to: number }

const PIECE_TYPES: readonly PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k']
const PROMOTIONS: readonly PieceType[] = ['q', 'r', 'b', 'n']
const KNIGHT: readonly Offset[] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
const ORTHOGONAL: readonly Offset[] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const DIAGONAL: readonly Offset[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
const ALL: readonly Offset[] = [...ORTHOGONAL, ...DIAGONAL]
const ROOK_RIGHTS: readonly (readonly [number, string])[] = [[0, 'Q'], [7, 'K'], [56, 'q'], [63, 'k']]
const CASTLES: Record<Color, readonly CastleSide[]> = {
  w: [
    { right: 'K', rook: 7, empty: [5, 6], path: [5, 6], to: 6 },
    { right: 'Q', rook: 0, empty: [1, 2, 3], path: [3, 2], to: 2 },
  ],
  b: [
    { right: 'k', rook: 63, empty: [61, 62], path: [61, 62], to: 62 },
    { right: 'q', rook: 56, empty: [57, 58, 59], path: [59, 58], to: 58 },
  ],
}
const RESULT_RE = /^(1-0|0-1|1\/2-1\/2|\*)$/
const CASTLE_RE = /^[O0]-[O0](-[O0])?$/
const SAN_RE = /^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])=?([NBRQnbrq])?$/

function pieceType(ch: string): PieceType | undefined {
  return PIECE_TYPES.find((t) => t === ch)
}

function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w'
}

function step(square: number, df: number, dr: number): number {
  const file = (square & 7) + df
  const rank = (square >> 3) + dr
  return file < 0 || file > 7 || rank < 0 || rank > 7 ? -1 : rank * 8 + file
}

function at(board: Board, square: number): Piece | null {
  return board[square] ?? null
}

export function squareName(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 63) throw new Error(`bad square index ${index}`)
  return String.fromCharCode(97 + (index & 7)) + String((index >> 3) + 1)
}

export function squareIndex(name: string): number {
  if (!/^[a-h][1-8]$/.test(name)) throw new Error(`bad square name "${name}"`)
  return (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97)
}

export function parseFen(fen: string): Position {
  const fields = fen.trim().split(/\s+/)
  const [placement, turn = 'w', castling = '-', ep = '-', halfmove = '0', fullmove = '1'] = fields
  if (!placement || fields.length > 6) throw new Error(`malformed FEN "${fen}": expected 1 to 6 fields`)
  const ranks = placement.split('/')
  if (ranks.length !== 8) throw new Error(`malformed FEN "${fen}": expected 8 ranks, got ${ranks.length}`)
  const board: (Piece | null)[] = Array<Piece | null>(64).fill(null)
  ranks.forEach((rank, i) => {
    let file = 0
    for (const ch of rank) {
      if (ch >= '1' && ch <= '8') {
        file += ch.charCodeAt(0) - 48
        continue
      }
      const type = pieceType(ch.toLowerCase())
      if (!type || file > 7) throw new Error(`malformed FEN "${fen}": bad rank "${rank}"`)
      board[(7 - i) * 8 + file] = { type, color: ch === ch.toLowerCase() ? 'b' : 'w' }
      file++
    }
    if (file !== 8) throw new Error(`malformed FEN "${fen}": rank "${rank}" does not span 8 files`)
  })
  if (turn !== 'w' && turn !== 'b') throw new Error(`malformed FEN "${fen}": bad side to move "${turn}"`)
  if (castling !== '-' && !/^[KQkq]{1,4}$/.test(castling)) throw new Error(`malformed FEN "${fen}": bad castling "${castling}"`)
  if (ep !== '-' && !/^[a-h][36]$/.test(ep)) throw new Error(`malformed FEN "${fen}": bad en passant square "${ep}"`)
  if (!/^\d+$/.test(halfmove) || !/^\d+$/.test(fullmove)) throw new Error(`malformed FEN "${fen}": bad move counters`)
  return {
    board,
    turn,
    castling: [...'KQkq'].filter((r) => castling.includes(r)).join(''),
    epSquare: ep === '-' ? null : squareIndex(ep),
    halfmove: Number(halfmove),
    fullmove: Number(fullmove),
  }
}

export function toFen(position: Position): string {
  const ranks: string[] = []
  for (let r = 7; r >= 0; r--) {
    let line = ''
    let empty = 0
    for (let f = 0; f < 8; f++) {
      const piece = at(position.board, r * 8 + f)
      if (!piece) {
        empty++
        continue
      }
      if (empty) line += empty
      empty = 0
      line += piece.color === 'w' ? piece.type.toUpperCase() : piece.type
    }
    if (empty) line += empty
    ranks.push(line)
  }
  return [
    ranks.join('/'),
    position.turn,
    position.castling || '-',
    position.epSquare === null ? '-' : squareName(position.epSquare),
    position.halfmove,
    position.fullmove,
  ].join(' ')
}

function isAttacked(board: Board, square: number, by: Color): boolean {
  for (const [df, dr] of KNIGHT) {
    const s = step(square, df, dr)
    const p = s < 0 ? null : at(board, s)
    if (p && p.color === by && p.type === 'n') return true
  }
  for (const [df, dr] of ALL) {
    const s = step(square, df, dr)
    const p = s < 0 ? null : at(board, s)
    if (p && p.color === by && p.type === 'k') return true
  }
  for (const df of [-1, 1]) {
    const s = step(square, df, by === 'w' ? -1 : 1)
    const p = s < 0 ? null : at(board, s)
    if (p && p.color === by && p.type === 'p') return true
  }
  for (const [df, dr] of ALL) {
    const slider = df !== 0 && dr !== 0 ? 'b' : 'r'
    let s = step(square, df, dr)
    while (s >= 0) {
      const p = at(board, s)
      if (p) {
        if (p.color === by && (p.type === 'q' || p.type === slider)) return true
        break
      }
      s = step(s, df, dr)
    }
  }
  return false
}

function inCheck(board: Board, color: Color): boolean {
  const king = board.findIndex((p) => p !== null && p.type === 'k' && p.color === color)
  return king >= 0 && isAttacked(board, king, opposite(color))
}

function pseudoMoves(position: Position): Move[] {
  const { board, turn } = position
  const moves: Move[] = []
  const push = (from: number, to: number, promote: boolean): void => {
    if (promote) for (const promotion of PROMOTIONS) moves.push({ from, to, promotion })
    else moves.push({ from, to })
  }
  for (let from = 0; from < 64; from++) {
    const piece = at(board, from)
    if (!piece || piece.color !== turn) continue
    if (piece.type === 'p') {
      const dr = turn === 'w' ? 1 : -1
      const startRank = turn === 'w' ? 1 : 6
      const lastRank = turn === 'w' ? 7 : 0
      const one = step(from, 0, dr)
      if (one >= 0 && !at(board, one)) {
        push(from, one, one >> 3 === lastRank)
        const two = step(one, 0, dr)
        if (from >> 3 === startRank && two >= 0 && !at(board, two)) push(from, two, false)
      }
      for (const df of [-1, 1]) {
        const to = step(from, df, dr)
        if (to < 0) continue
        const target = at(board, to)
        if ((target && target.color !== turn) || to === position.epSquare) push(from, to, to >> 3 === lastRank)
      }
      continue
    }
    if (piece.type === 'n' || piece.type === 'k') {
      for (const [df, dr] of piece.type === 'n' ? KNIGHT : ALL) {
        const to = step(from, df, dr)
        if (to < 0) continue
        const target = at(board, to)
        if (!target || target.color !== turn) moves.push({ from, to })
      }
      continue
    }
    const dirs = piece.type === 'r' ? ORTHOGONAL : piece.type === 'b' ? DIAGONAL : ALL
    for (const [df, dr] of dirs) {
      let to = step(from, df, dr)
      while (to >= 0) {
        const target = at(board, to)
        if (!target) moves.push({ from, to })
        else {
          if (target.color !== turn) moves.push({ from, to })
          break
        }
        to = step(to, df, dr)
      }
    }
  }
  return moves
}

function castlingMoves(position: Position): Move[] {
  const { board, turn, castling } = position
  const moves: Move[] = []
  const home = turn === 'w' ? 4 : 60
  const king = at(board, home)
  const enemy = opposite(turn)
  if (!king || king.type !== 'k' || king.color !== turn || isAttacked(board, home, enemy)) return moves
  for (const side of CASTLES[turn]) {
    if (!castling.includes(side.right)) continue
    const rook = at(board, side.rook)
    if (!rook || rook.type !== 'r' || rook.color !== turn) continue
    if (side.empty.some((s) => at(board, s) !== null)) continue
    if (side.path.some((s) => isAttacked(board, s, enemy))) continue
    moves.push({ from: home, to: side.to })
  }
  return moves
}

function apply(position: Position, move: Move): Position {
  const board = position.board.slice()
  const { from, to } = move
  const piece = at(board, from)
  if (!piece) throw new Error(`no piece on ${squareName(from)}`)
  const target = at(board, to)
  let castling = position.castling
  let epSquare: number | null = null
  let halfmove = target ? 0 : position.halfmove + 1
  board[from] = null
  board[to] = move.promotion ? { type: move.promotion, color: piece.color } : piece
  if (piece.type === 'p') {
    halfmove = 0
    if (to === position.epSquare && (from & 7) !== (to & 7)) board[to + (piece.color === 'w' ? -8 : 8)] = null
    if (Math.abs(to - from) === 16) epSquare = (from + to) / 2
  }
  if (piece.type === 'k') {
    castling = castling.replace(piece.color === 'w' ? /[KQ]/g : /[kq]/g, '')
    if (to - from === 2) {
      board[from + 1] = at(board, from + 3)
      board[from + 3] = null
    } else if (from - to === 2) {
      board[from - 1] = at(board, from - 4)
      board[from - 4] = null
    }
  }
  for (const [square, right] of ROOK_RIGHTS) {
    if (from === square || to === square) castling = castling.replace(right, '')
  }
  return {
    board,
    turn: opposite(position.turn),
    castling,
    epSquare,
    halfmove,
    fullmove: position.turn === 'b' ? position.fullmove + 1 : position.fullmove,
  }
}

export function legalMoves(position: Position): Move[] {
  const moves = [...pseudoMoves(position), ...castlingMoves(position)]
  return moves.filter((move) => !inCheck(apply(position, move).board, position.turn))
}

function sameMove(a: Move, b: Move): boolean {
  return a.from === b.from && a.to === b.to && (a.promotion ?? null) === (b.promotion ?? null)
}

export function makeMove(position: Position, move: Move): Position {
  if (!legalMoves(position).some((m) => sameMove(m, move))) throw new Error(`illegal move ${toUci(move)}`)
  return apply(position, move)
}

export function toUci(move: Move): string {
  return squareName(move.from) + squareName(move.to) + (move.promotion ?? '')
}

export function parseUci(uci: string): Move {
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci)
  if (!m || m[1] === undefined || m[2] === undefined) throw new Error(`bad UCI move "${uci}"`)
  const move: Move = { from: squareIndex(m[1]), to: squareIndex(m[2]) }
  const promotion = m[3] === undefined ? undefined : pieceType(m[3])
  if (promotion) move.promotion = promotion
  return move
}

export function parseSan(position: Position, san: string): Move | undefined {
  const text = san.replace(/[+#!?]+$/, '')
  const moves = legalMoves(position)
  const castle = CASTLE_RE.exec(text)
  if (castle) {
    const home = position.turn === 'w' ? 4 : 60
    const to = castle[1] ? home - 2 : home + 2
    return moves.find((m) => m.from === home && m.to === to && at(position.board, home)?.type === 'k')
  }
  const m = SAN_RE.exec(text)
  if (!m || m[4] === undefined) return undefined
  const [, letter, fromFile, fromRank, to, promo] = m
  const type = letter === undefined ? 'p' : pieceType(letter.toLowerCase())
  const promotion = promo === undefined ? null : (pieceType(promo.toLowerCase()) ?? null)
  const target = squareIndex(to)
  const candidates = moves.filter((move) => {
    const piece = at(position.board, move.from)
    return (
      piece !== null &&
      piece.type === type &&
      move.to === target &&
      (fromFile === undefined || (move.from & 7) === fromFile.charCodeAt(0) - 97) &&
      (fromRank === undefined || move.from >> 3 === fromRank.charCodeAt(0) - 49) &&
      (move.promotion ?? null) === promotion
    )
  })
  return candidates.length === 1 ? candidates[0] : undefined
}

export function toSan(position: Position, move: Move): string {
  const piece = at(position.board, move.from)
  if (!piece) throw new Error(`no piece on ${squareName(move.from)}`)
  const next = makeMove(position, move)
  let san: string
  if (piece.type === 'k' && Math.abs(move.to - move.from) === 2) {
    san = move.to > move.from ? 'O-O' : 'O-O-O'
  } else {
    const capture = at(position.board, move.to) !== null || (piece.type === 'p' && move.to === position.epSquare)
    const fromFile = String.fromCharCode(97 + (move.from & 7))
    const fromRank = String((move.from >> 3) + 1)
    if (piece.type === 'p') {
      san = capture ? fromFile + 'x' : ''
    } else {
      const others = legalMoves(position).filter(
        (m) => m.to === move.to && m.from !== move.from && at(position.board, m.from)?.type === piece.type,
      )
      let disambiguation = ''
      if (others.length > 0) {
        const sameFile = others.some((m) => (m.from & 7) === (move.from & 7))
        const sameRank = others.some((m) => m.from >> 3 === move.from >> 3)
        disambiguation = !sameFile ? fromFile : !sameRank ? fromRank : fromFile + fromRank
      }
      san = piece.type.toUpperCase() + disambiguation + (capture ? 'x' : '')
    }
    san += squareName(move.to)
    if (move.promotion) san += '=' + move.promotion.toUpperCase()
  }
  if (isCheckmate(next)) san += '#'
  else if (isCheck(next)) san += '+'
  return san
}

export function isCheck(position: Position): boolean {
  return inCheck(position.board, position.turn)
}

export function isCheckmate(position: Position): boolean {
  return isCheck(position) && legalMoves(position).length === 0
}

export function isStalemate(position: Position): boolean {
  return !isCheck(position) && legalMoves(position).length === 0
}

export function tokenizeMovetext(movetext: string): string[] {
  const out: string[] = []
  let word = ''
  let depth = 0
  let inComment = false
  let inLineComment = false
  const flush = (): void => {
    const token = word
    word = ''
    if (token === '' || RESULT_RE.test(token) || token.startsWith('$') || /^[!?]+$/.test(token)) return
    if (/^[O0]-[O0](-[O0])?[+#!?]*$/.test(token)) {
      out.push(token)
      return
    }
    const san = token.replace(/^\d+\.*/, '')
    if (san !== '') out.push(san)
  }
  for (const ch of movetext) {
    if (inComment) {
      if (ch === '}') inComment = false
      continue
    }
    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      continue
    }
    if (ch === '{' || ch === ';' || ch === '(' || ch === ')' || /\s/.test(ch)) {
      flush()
      if (ch === '{') inComment = true
      else if (ch === ';') inLineComment = true
      else if (ch === '(') depth++
      else if (ch === ')') depth = Math.max(0, depth - 1)
      continue
    }
    if (depth === 0) word += ch
  }
  flush()
  return out
}

export function replayPgn(movetext: string, fen: string = START_FEN): Position {
  let position = parseFen(fen)
  let index = 0
  for (const token of tokenizeMovetext(movetext)) {
    index++
    const move = parseSan(position, token)
    if (!move) throw new Error(`move ${index} "${token}" is not legal here`)
    position = apply(position, move)
  }
  return position
}
