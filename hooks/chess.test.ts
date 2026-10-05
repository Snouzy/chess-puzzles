import { describe, expect, test } from 'claude-code/testing'

import {
  START_FEN,
  isCheck,
  isCheckmate,
  isStalemate,
  legalMoves,
  makeMove,
  parseFen,
  parseSan,
  parseUci,
  replayPgn,
  squareIndex,
  squareName,
  toFen,
  toSan,
  toUci,
  tokenizeMovetext,
  type Move,
  type Position,
} from './chess'

const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'
const KNIGHTS = 'rnbqkbnr/pppppppp/8/8/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq - 0 1'
const ROOKS = '4k3/8/8/8/8/8/3R4/R3K3 w - - 0 1'
const STACKED = '4k3/8/8/R7/8/8/8/R3K3 w - - 0 1'

function perft(position: Position, depth: number): number {
  if (depth === 0) return 1
  const moves = legalMoves(position)
  if (depth === 1) return moves.length
  let nodes = 0
  for (const move of moves) nodes += perft(makeMove(position, move), depth - 1)
  return nodes
}

function uci(position: Position): string[] {
  return legalMoves(position).map(toUci).sort()
}

function play(fen: string, ...sans: string[]): Position {
  let position = parseFen(fen)
  for (const san of sans) {
    const move = parseSan(position, san)
    if (!move) throw new Error(`cannot play ${san}`)
    position = makeMove(position, move)
  }
  return position
}

describe('squares', () => {
  test('names and indexes agree, a1 = 0 and h8 = 63', () => {
    expect(squareName(0)).toBe('a1')
    expect(squareName(7)).toBe('h1')
    expect(squareName(8)).toBe('a2')
    expect(squareName(63)).toBe('h8')
    expect(squareIndex('e4')).toBe(28)
    for (let i = 0; i < 64; i++) expect(squareIndex(squareName(i))).toBe(i)
  })

  test('rejects a bad name or index', () => {
    expect(() => squareIndex('i9')).toThrow('bad square name')
    expect(() => squareIndex('e')).toThrow('bad square name')
    expect(() => squareName(64)).toThrow('bad square index')
  })
})

describe('FEN', () => {
  test('round trips the start position', () => {
    expect(toFen(parseFen(START_FEN))).toBe(START_FEN)
  })

  test('round trips Kiwipete', () => {
    expect(toFen(parseFen(KIWIPETE))).toBe(KIWIPETE)
  })

  test('reads the fields', () => {
    const position = parseFen('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 3 7')
    expect(position.turn).toBe('w')
    expect(position.castling).toBe('KQkq')
    expect(position.epSquare).toBe(squareIndex('d6'))
    expect(position.halfmove).toBe(3)
    expect(position.fullmove).toBe(7)
    expect(position.board[squareIndex('e5')]).toEqual({ type: 'p', color: 'w' })
    expect(position.board[squareIndex('e8')]).toEqual({ type: 'k', color: 'b' })
    expect(position.board[squareIndex('e4')]).toBe(null)
  })

  test('normalises castling order and an empty field', () => {
    expect(parseFen('4k3/8/8/8/8/8/8/4K3 w qkQK - 0 1').castling).toBe('KQkq')
    expect(parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1').castling).toBe('')
    expect(toFen(parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1'))).toBe('4k3/8/8/8/8/8/8/4K3 w - - 0 1')
  })

  test('throws with a clear message on a malformed FEN', () => {
    expect(() => parseFen('')).toThrow('malformed FEN')
    expect(() => parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP w KQkq - 0 1')).toThrow('expected 8 ranks')
    expect(() => parseFen('rnbqkbnr/pppppppp/7/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toThrow('does not span 8 files')
    expect(() => parseFen('rnbqkbnr/ppppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toThrow('bad rank')
    expect(() => parseFen('rnbqkbnx/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toThrow('bad rank')
    expect(() => parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1')).toThrow('bad side to move')
    expect(() => parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkqA - 0 1')).toThrow('bad castling')
    expect(() => parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e4 0 1')).toThrow('bad en passant')
    expect(() => parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - x 1')).toThrow('bad move counters')
  })
})

describe('perft', () => {
  test('start position: 20, 400, 8902', () => {
    const start = parseFen(START_FEN)
    expect(perft(start, 1)).toBe(20)
    expect(perft(start, 2)).toBe(400)
    const began = Date.now()
    expect(perft(start, 3)).toBe(8902)
    expect(Date.now() - began).toBeLessThan(1000)
  })

  test('Kiwipete: 48, 2039', () => {
    const position = parseFen(KIWIPETE)
    expect(perft(position, 1)).toBe(48)
    expect(perft(position, 2)).toBe(2039)
  })
})

describe('makeMove', () => {
  test('returns a new position and leaves the old one alone', () => {
    const start = parseFen(START_FEN)
    const next = makeMove(start, parseUci('e2e4'))
    expect(toFen(start)).toBe(START_FEN)
    expect(toFen(next)).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')
  })

  test('counts halfmoves and fullmoves', () => {
    const position = play(START_FEN, 'Nf3', 'Nf6', 'Ng1')
    expect(position.halfmove).toBe(3)
    expect(position.fullmove).toBe(2)
    expect(position.turn).toBe('b')
  })

  test('throws on an illegal move', () => {
    const start = parseFen(START_FEN)
    expect(() => makeMove(start, parseUci('e2e5'))).toThrow('illegal move e2e5')
    expect(() => makeMove(start, parseUci('e7e5'))).toThrow('illegal move e7e5')
    expect(() => makeMove(start, { from: 12, to: 28, promotion: 'q' })).toThrow('illegal move e2e4q')
  })
})

describe('castling', () => {
  const both = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'

  test('both sides are generated and applied', () => {
    const position = parseFen(both)
    const moves = uci(position)
    expect(moves).toContain('e1g1')
    expect(moves).toContain('e1c1')
    const short = makeMove(position, parseUci('e1g1'))
    expect(toFen(short)).toBe('r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1')
    const long = makeMove(position, parseUci('e1c1'))
    expect(toFen(long)).toBe('r3k2r/8/8/8/8/8/8/2KR3R b kq - 1 1')
    const black = makeMove(short, parseUci('e8c8'))
    expect(toFen(black)).toBe('2kr3r/8/8/8/8/8/8/R4RK1 w - - 2 2')
  })

  test('refuses to castle through an attacked square', () => {
    const moves = uci(parseFen('4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1'))
    expect(moves).not.toContain('e1g1')
    expect(moves).toContain('e1c1')
  })

  test('queenside ignores an attack on b1', () => {
    expect(uci(parseFen('1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1'))).toContain('e1c1')
  })

  test('refuses to castle while in check', () => {
    const moves = uci(parseFen('3kr3/8/8/8/8/8/8/R3K2R w KQ - 0 1'))
    expect(moves).not.toContain('e1g1')
    expect(moves).not.toContain('e1c1')
  })

  test('refuses to castle into check', () => {
    expect(uci(parseFen('4k1r1/8/8/8/8/8/8/R3K2R w KQ - 0 1'))).not.toContain('e1g1')
  })

  test('needs the squares between to be empty', () => {
    expect(uci(parseFen('4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1'))).not.toContain('e1c1')
  })

  test('a king move drops both rights', () => {
    expect(play(both, 'Ke2').castling).toBe('kq')
  })

  test('a rook move drops its side', () => {
    expect(play(both, 'Rg1').castling).toBe('Qkq')
    expect(play(both, 'Rb1').castling).toBe('Kkq')
  })

  test('a captured rook drops the right of its owner', () => {
    expect(play(both, 'Rxa8+').castling).toBe('Kk')
  })

  test('without the right the move is not generated', () => {
    expect(uci(parseFen('r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1'))).not.toContain('e1g1')
  })
})

describe('en passant', () => {
  test('is generated and removes the captured pawn', () => {
    const position = parseFen('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3')
    expect(uci(position)).toContain('e5d6')
    const next = makeMove(position, parseUci('e5d6'))
    expect(next.board[squareIndex('d5')]).toBe(null)
    expect(next.board[squareIndex('d6')]).toEqual({ type: 'p', color: 'w' })
    expect(next.board[squareIndex('e5')]).toBe(null)
    expect(next.epSquare).toBe(null)
  })

  test('is only there right after the double push', () => {
    const after = play(START_FEN, 'e4', 'a6', 'e5', 'd5')
    expect(after.epSquare).toBe(squareIndex('d6'))
    expect(toFen(after).split(' ')[3]).toBe('d6')
    expect(uci(after)).toContain('e5d6')
    const later = play(toFen(after), 'a3', 'a5')
    expect(later.epSquare).toBe(null)
    expect(uci(later)).not.toContain('e5d6')
  })

  test('is refused when it would expose the king', () => {
    const position = parseFen('8/8/8/K1pP3r/8/8/8/4k3 w - c6 0 1')
    expect(uci(position)).not.toContain('d5c6')
  })

  test('parses from SAN', () => {
    const position = parseFen('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3')
    expect(parseSan(position, 'exd6')).toEqual({ from: squareIndex('e5'), to: squareIndex('d6') })
    expect(toSan(position, parseUci('e5d6'))).toBe('exd6')
  })
})

describe('promotion', () => {
  const fen = 'k7/4P3/8/8/8/8/8/4K3 w - - 0 1'

  test('generates the four pieces', () => {
    const moves = legalMoves(parseFen(fen)).filter((m) => m.to === squareIndex('e8'))
    expect(moves.map((m) => m.promotion).sort()).toEqual(['b', 'n', 'q', 'r'])
    expect(moves.map(toUci).sort()).toEqual(['e7e8b', 'e7e8n', 'e7e8q', 'e7e8r'])
  })

  test('parses e8=Q and e8Q', () => {
    const position = parseFen(fen)
    const expected: Move = { from: squareIndex('e7'), to: squareIndex('e8'), promotion: 'q' }
    expect(parseSan(position, 'e8=Q')).toEqual(expected)
    expect(parseSan(position, 'e8Q')).toEqual(expected)
    expect(parseSan(position, 'e8=N')).toMatchObject({ promotion: 'n' })
    expect(parseSan(position, 'e8')).toBe(undefined)
  })

  test('applies the new piece', () => {
    const next = makeMove(parseFen(fen), parseUci('e7e8q'))
    expect(next.board[squareIndex('e8')]).toEqual({ type: 'q', color: 'w' })
    expect(next.board[squareIndex('e7')]).toBe(null)
  })

  test('captures with promotion', () => {
    const position = parseFen('3rk3/4P3/8/8/8/8/8/4K3 w - - 0 1')
    expect(parseSan(position, 'exd8=Q+')).toEqual({ from: squareIndex('e7'), to: squareIndex('d8'), promotion: 'q' })
    expect(toSan(position, parseUci('e7d8r'))).toBe('exd8=R+')
  })
})

describe('UCI', () => {
  test('toUci writes squares and the promotion piece', () => {
    expect(toUci({ from: 12, to: 28 })).toBe('e2e4')
    expect(toUci({ from: squareIndex('e7'), to: squareIndex('e8'), promotion: 'q' })).toBe('e7e8q')
  })

  test('parseUci reads them back', () => {
    expect(parseUci('e2e4')).toEqual({ from: 12, to: 28 })
    expect(parseUci('e7e8q')).toEqual({ from: 52, to: 60, promotion: 'q' })
    expect(parseUci('e7e8')).toEqual({ from: 52, to: 60 })
  })

  test('parseUci throws on a bad string', () => {
    expect(() => parseUci('e2')).toThrow('bad UCI move "e2"')
    expect(() => parseUci('e2e9')).toThrow('bad UCI move')
    expect(() => parseUci('e7e8k')).toThrow('bad UCI move')
  })
})

describe('SAN parsing', () => {
  test('plain piece and pawn moves', () => {
    const start = parseFen(START_FEN)
    expect(parseSan(start, 'Nf3')).toEqual({ from: squareIndex('g1'), to: squareIndex('f3') })
    expect(parseSan(start, 'e4')).toEqual({ from: squareIndex('e2'), to: squareIndex('e4') })
    expect(parseSan(start, 'e4!?')).toEqual({ from: squareIndex('e2'), to: squareIndex('e4') })
    expect(parseSan(start, 'e5')).toBe(undefined)
    expect(parseSan(start, 'Nf6')).toBe(undefined)
    expect(parseSan(start, 'garbage')).toBe(undefined)
  })

  test('pawn captures name the file', () => {
    const position = play(START_FEN, 'e4', 'd5')
    expect(parseSan(position, 'exd5')).toEqual({ from: squareIndex('e4'), to: squareIndex('d5') })
  })

  test('castling in every spelling', () => {
    const position = parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    expect(parseSan(position, 'O-O')).toEqual({ from: 4, to: 6 })
    expect(parseSan(position, 'O-O-O')).toEqual({ from: 4, to: 2 })
    expect(parseSan(position, '0-0')).toEqual({ from: 4, to: 6 })
    expect(parseSan(position, '0-0-0')).toEqual({ from: 4, to: 2 })
    expect(parseSan(position, 'O-O+')).toEqual({ from: 4, to: 6 })
    const black = makeMove(position, parseUci('e1g1'))
    expect(parseSan(black, 'O-O-O')).toEqual({ from: 60, to: 58 })
  })

  test('two knights on the same square need a file', () => {
    const position = parseFen(KNIGHTS)
    expect(parseSan(position, 'Nd2')).toBe(undefined)
    expect(parseSan(position, 'Nbd2')).toEqual({ from: squareIndex('b1'), to: squareIndex('d2') })
    expect(parseSan(position, 'Nfd2')).toEqual({ from: squareIndex('f3'), to: squareIndex('d2') })
  })

  test('file and rank disambiguation', () => {
    const position = parseFen(ROOKS)
    expect(parseSan(position, 'Ra2')).toBe(undefined)
    expect(parseSan(position, 'Raa2')).toEqual({ from: squareIndex('a1'), to: squareIndex('a2') })
    expect(parseSan(position, 'Rda2')).toEqual({ from: squareIndex('d2'), to: squareIndex('a2') })
    expect(parseSan(position, 'R1a2')).toEqual({ from: squareIndex('a1'), to: squareIndex('a2') })
    expect(parseSan(position, 'R2a2')).toEqual({ from: squareIndex('d2'), to: squareIndex('a2') })
    const stacked = parseFen(STACKED)
    expect(parseSan(stacked, 'Ra3')).toBe(undefined)
    expect(parseSan(stacked, 'R1a3')).toEqual({ from: squareIndex('a1'), to: squareIndex('a3') })
    expect(parseSan(stacked, 'R5a3')).toEqual({ from: squareIndex('a5'), to: squareIndex('a3') })
  })

  test('a pinned candidate does not force disambiguation', () => {
    const position = parseFen('4k3/3R4/8/8/1b6/8/3R4/4K3 w - - 0 1')
    expect(parseSan(position, 'Rd5')).toEqual({ from: squareIndex('d7'), to: squareIndex('d5') })
    expect(parseSan(position, 'R7d5')).toEqual({ from: squareIndex('d7'), to: squareIndex('d5') })
    expect(parseSan(position, 'R2d5')).toBe(undefined)
  })
})

describe('toSan', () => {
  test('plain moves, captures and castling', () => {
    const start = parseFen(START_FEN)
    expect(toSan(start, parseUci('e2e4'))).toBe('e4')
    expect(toSan(start, parseUci('g1f3'))).toBe('Nf3')
    const open = play(START_FEN, 'e4', 'd5')
    expect(toSan(open, parseUci('e4d5'))).toBe('exd5')
    const castle = parseFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    expect(toSan(castle, parseUci('e1g1'))).toBe('O-O')
    expect(toSan(castle, parseUci('e1c1'))).toBe('O-O-O')
  })

  test('writes + and #', () => {
    expect(toSan(parseFen('4k3/8/8/8/8/8/8/4K2R w - - 0 1'), parseUci('h1h8'))).toBe('Rh8+')
    const fools = parseFen('rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2')
    expect(toSan(fools, parseUci('d8h4'))).toBe('Qh4#')
  })

  test('minimal disambiguation by file, rank, then both', () => {
    const knights = parseFen(KNIGHTS)
    expect(toSan(knights, parseUci('b1d2'))).toBe('Nbd2')
    expect(toSan(knights, parseUci('f3d2'))).toBe('Nfd2')
    const rooks = parseFen(ROOKS)
    expect(toSan(rooks, parseUci('a1a2'))).toBe('Raa2')
    expect(toSan(rooks, parseUci('d2a2'))).toBe('Rda2')
    const stacked = parseFen(STACKED)
    expect(toSan(stacked, parseUci('a1a3'))).toBe('R1a3')
    expect(toSan(stacked, parseUci('a5a3'))).toBe('R5a3')
    const queens = parseFen('k7/8/8/8/8/8/8/K1Q1Q1Q1 w - - 0 1')
    expect(toSan(queens, parseUci('c1e3'))).toBe('Qce3')
    const three = parseFen('k7/8/8/8/8/2Q5/8/K1Q1Q3 w - - 0 1')
    expect(toSan(three, parseUci('c1e3'))).toBe('Qc1e3')
    expect(toSan(three, parseUci('c3e3'))).toBe('Q3e3')
    expect(toSan(three, parseUci('e1e3'))).toBe('Qee3')
  })

  test('skips disambiguation for a pinned twin', () => {
    const position = parseFen('4k3/3R4/8/8/1b6/8/3R4/4K3 w - - 0 1')
    expect(toSan(position, parseUci('d7d5'))).toBe('Rd5')
  })

  test('throws on an illegal move', () => {
    expect(() => toSan(parseFen(START_FEN), parseUci('e2e5'))).toThrow('illegal move')
  })
})

describe('check, checkmate, stalemate', () => {
  test("fool's mate is checkmate", () => {
    const position = parseFen('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')
    expect(isCheck(position)).toBe(true)
    expect(isCheckmate(position)).toBe(true)
    expect(isStalemate(position)).toBe(false)
    expect(legalMoves(position)).toHaveLength(0)
  })

  test('a bare stalemate', () => {
    const position = parseFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
    expect(isCheck(position)).toBe(false)
    expect(isCheckmate(position)).toBe(false)
    expect(isStalemate(position)).toBe(true)
  })

  test('the start position is none of them', () => {
    const start = parseFen(START_FEN)
    expect(isCheck(start)).toBe(false)
    expect(isCheckmate(start)).toBe(false)
    expect(isStalemate(start)).toBe(false)
  })

  test('a check with an escape is only a check', () => {
    const position = parseFen('4k3/8/8/8/8/8/8/4K2R b - - 0 1')
    expect(isCheck(makeMove(parseFen('4k3/8/8/8/8/8/8/4K2R w - - 0 1'), parseUci('h1h8')))).toBe(true)
    expect(isCheckmate(makeMove(parseFen('4k3/8/8/8/8/8/8/4K2R w - - 0 1'), parseUci('h1h8')))).toBe(false)
    expect(isCheck(position)).toBe(false)
  })
})

describe('replayPgn', () => {
  const LICHESS =
    'e4 e6 d4 d5 Nc3 dxe4 Bc4 Be7 Nxe4 Nf6 Nxf6+ Bxf6 c3 a6 Qf3 b5 Bd3 Ra7 Be3 Bb7 Be4 Bxe4 Qxe4 Qd5 Qxd5 exd5 Nf3 O-O O-O Nd7 Rfe1 Raa8 Bf4 Rac8 Ne5 Rfd8 Nxd7 Rxd7 Be5 Bxe5 Rxe5 f6 Re6 c6 Rae1 Kf7 f4 a5 f5 a4 a3 g6 g4 gxf5 gxf5 Rg8+ Kf2 Rg5 Rxc6 Rxf5+ Kg3 Kf8 Rc8+ Kg7 Ree8 Kh6 Rg8 Re7 h4 Re3+ Kg4 Rff3 Rgd8 Rg3+ Kf5'

  test('replays a Lichess puzzle and its solution ends in mate', () => {
    const position = replayPgn(LICHESS)
    expect(position.turn).toBe('b')
    let current = position
    for (const step of ['g3f3', 'f5g4', 'f6f5']) {
      expect(uci(current)).toContain(step)
      current = makeMove(current, parseUci(step))
    }
    expect(isCheckmate(current)).toBe(true)
  })

  test('replays chess.com movetext glued to move numbers', () => {
    const fen = '5rk1/p4pp1/4r2p/8/8/2P5/P1PQqPPP/2KRR3 b - - 0 1'
    const position = replayPgn('1...Qa6 2.Qd5 Qa3+ 3.Kd2 Rd6 4.Qxd6 Qxd6+ *', fen)
    expect(position.turn).toBe('w')
    expect(position.fullmove).toBe(5)
    expect(position.board[squareIndex('d6')]).toEqual({ type: 'q', color: 'b' })
  })

  test('drops comments, variations, NAGs and results', () => {
    const plain = replayPgn('1. e4 e5 2. Nf3')
    expect(toFen(replayPgn('1. e4 {best} e5 (1... c5 2. Nf3) 2. Nf3 *'))).toBe(toFen(plain))
    expect(toFen(replayPgn('1. e4 $1 e5 $2 (1... c5 (1... e6 2. d4 {French} (2. Nf3)) 2. Nf3) 2. Nf3 1-0'))).toBe(toFen(plain))
    expect(toFen(replayPgn('1.e4\r\n\te5 2.Nf3\r\n'))).toBe(toFen(plain))
    expect(toFen(replayPgn('1. e4 e5 ; a line comment\n2. Nf3'))).toBe(toFen(plain))
    expect(toFen(replayPgn('1. e4 e5 2. Nf3 1/2-1/2'))).toBe(toFen(plain))
    expect(toFen(replayPgn('1. e4 e5 2. Nf3 0-1'))).toBe(toFen(plain))
  })

  test('tokenizeMovetext keeps only the move tokens', () => {
    expect(tokenizeMovetext('1. e4 {best} e5 (1... c5 2. Nf3) 2.Nf3 *')).toEqual(['e4', 'e5', 'Nf3'])
    expect(tokenizeMovetext('1...Qa6 2.Qd5 Qa3+ 3.Kd2 *')).toEqual(['Qa6', 'Qd5', 'Qa3+', 'Kd2'])
    expect(tokenizeMovetext('1. e4 {best} e5 (1... c5 2. Nf3) $1 2. O-O-O 0-1')).toEqual(['e4', 'e5', 'O-O-O'])
    expect(tokenizeMovetext('e4\te6\r\nd4 0-0 1/2-1/2')).toEqual(['e4', 'e6', 'd4', '0-0'])
    expect(tokenizeMovetext('')).toEqual([])
  })

  test('an empty movetext returns the start', () => {
    expect(toFen(replayPgn(''))).toBe(START_FEN)
    expect(toFen(replayPgn(' * '))).toBe(START_FEN)
  })

  test('names the offending move and its index', () => {
    expect(() => replayPgn('1. e4 e5 2. Nf3 Nxe5')).toThrow('move 4 "Nxe5" is not legal here')
    expect(() => replayPgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Nxe4')).toThrow('move 7 "Nxe4" is not legal here')
    expect(() => replayPgn('e4 e5 Nf3 Nc6 Bb5 a6 Nd2')).toThrow('move 7 "Nd2" is not legal here')
  })
})
