import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Board, Game, Puzzle, Source, Stats } from '../types'
import { parseFen, squareIndex } from './chess'
import { type Played, boardOf, hint, play, playText, reveal, squaresOf, start } from './game'
import { CHESSCOM_RANDOM_URL, fromChesscom, fromLichess, lichessUrl } from './puzzles'
import { EMPTY_STATS, difficultyFor, record } from './rating'
import { type Language, type Strings, hintTheme, languageOf, stringsOf } from './strings'

const PANE = 'chess-puzzles'
const TITLE = 'Puzzles'
const STORE_KEY = 'state'
const SEEN_LIMIT = 500
const FETCH_TRIES = 5
const LARGE_ROWS = 20
const USER_AGENT = 'chess-puzzles Claude Code mod (https://github.com/Snouzy/chess-puzzles)'

const board = atom({ plugin: 'chess-puzzles', key: 'board' } as const, null as Board | null)
const game = atom({ plugin: 'chess-puzzles', key: 'game' } as const, null as Game | null)
const message = atom({ plugin: 'chess-puzzles', key: 'message' } as const, '')
const status = atom({ plugin: 'chess-puzzles', key: 'status' } as const, '')
const isOpen = atom({ plugin: 'chess-puzzles', key: 'isOpen' } as const, false)

type Saved = { source: Source; stats: Stats; seen: Record<Source, string[]> }

type Mod = {
  pieces: Board['pieces']
  languageOption: string
  language: Language
  t: Strings
  defaultSource: Source
  saved: Saved
  lastMove: string[]
  hint: string | null
  isFetching: boolean
}

const mod: Mod = {
  pieces: 'symbols',
  languageOption: 'auto',
  language: 'en',
  t: stringsOf('en'),
  defaultSource: 'lichess',
  saved: { source: 'lichess', stats: EMPTY_STATS, seen: { lichess: [], chesscom: [] } },
  lastMove: [],
  hint: null,
  isFetching: false,
}

export const register: Register = (on, options) => {
  mod.pieces = String(options.pieces) === 'letters' ? 'letters' : 'symbols'
  mod.defaultSource = String(options.source) === 'chesscom' ? 'chesscom' : 'lichess'
  mod.languageOption = String(options.language)

  on('session.start', async ($, e, next) => {
    mod.language = languageOf(mod.languageOption, await $.env.get('LANG'))
    mod.t = stringsOf(mod.language)
    await $.command.register({
      name: 'puzzle',
      description: 'Chess puzzles: opens the board. "lichess" or "chesscom" picks the source, a move plays it, "stats", "off".',
    })
    await loadSaved($)

    return next(e)
  })

  on('command.run', { command: 'puzzle' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'off') {
      await close($)
      return { text: mod.t.closed }
    }
    if (arg === 'stats') return { text: statsLine() }
    if (arg === 'lichess' || arg === 'chesscom') {
      mod.saved.source = arg
      await saveSaved($)
      await open($)
      await newPuzzle($)
      return { text: mod.t.sourceSet(arg) }
    }
    if (arg !== '') {
      const current = await read($, game)
      if (current) await applyPlayed($, playText(current, arg))
      return { text: current ? await read($, message) : mod.t.opened }
    }

    await open($)
    if ((await read($, game)) === null) await newPuzzle($)

    return { text: mod.t.opened }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const current = await read($, board)
    const size = e.props.scroll.bodyRows >= LARGE_ROWS ? 'large' : 'small'
    const lines = (
      <Box flexDirection="column">
        <Text dimColor>{await read($, status)}</Text>
        <Text>{await read($, message)}</Text>
      </Box>
    )
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return lines

    const { Client } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" gap={1}>
        <Client key="board" module="./board.tsx" props={current ? { ...current, size } : null} />
        {lines}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!(await read($, isOpen)) || e.props.hasSurvey) return next(e)

    const { Box, Button } = $.ui.resolve(e)
    const current = await read($, game)
    const canPlay = current !== null && !current.isSolved

    return (
      <Box gap={2}>
        {canPlay && <Button key="hint" hotkey="1" plain label={mod.t.hint} onPress={() => void onHint($)} />}
        {canPlay && <Button key="reveal" hotkey="2" plain label={mod.t.reveal} onPress={() => void onReveal($)} />}
        <Button key="next" hotkey="3" plain label={mod.t.next} onPress={() => void newPuzzle($)} />
        <Button key="close" hotkey="0" plain label={mod.t.close} onPress={() => void close($)} />
      </Box>
    )
  })

  on('ui.message', async ($, e) => {
    if (e.element !== 'board') return {}
    const posted = e.data as { from?: unknown; to?: unknown } | null
    const from = posted?.from
    const to = posted?.to
    if (!isSquare(from) || !isSquare(to)) return {}
    const current = await read($, game)
    if (current) await applyPlayed($, play(current, squareIndex(from), squareIndex(to)))

    return {}
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      await update($, isOpen, () => false)
      await update($, game, () => null)
      await update($, board, () => null)
      await update($, status, () => '')
      await update($, message, () => '')
    }

    return next(e)
  })
}

function isSquare(value: unknown): value is string {
  return typeof value === 'string' && /^[a-h][1-8]$/.test(value)
}

function labelOf(source: Source): string {
  return source === 'lichess' ? 'Lichess' : 'Chess.com'
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function statsLine(): string {
  const { rating, solved, failed, streak } = mod.saved.stats
  return mod.t.stats(rating, solved, failed, streak)
}

function statusOf(current: Game): string {
  const rating = current.puzzle.rating === undefined ? '' : ` ${current.puzzle.rating}`
  return `${labelOf(current.puzzle.source)}${rating} · ${mod.t.yourTurn(parseFen(current.puzzle.fen).turn)}`
}

async function loadSaved($: EngineInterface) {
  const raw = (await $.store.get(STORE_KEY)) as Partial<Saved> | undefined
  const source = raw?.source
  mod.saved = {
    source: source === 'lichess' || source === 'chesscom' ? source : mod.defaultSource,
    stats: { ...EMPTY_STATS, ...(raw?.stats ?? {}) },
    seen: { lichess: raw?.seen?.lichess ?? [], chesscom: raw?.seen?.chesscom ?? [] },
  }
}

function saveSaved($: EngineInterface) {
  return $.store.set(STORE_KEY, mod.saved)
}

async function open($: EngineInterface) {
  await $.ui.open({ id: PANE, title: TITLE, rows: 22, columns: 44 })
  await update($, isOpen, () => true)
}

async function close($: EngineInterface) {
  await $.ui.close({ id: PANE })
}

async function fetchPuzzle($: EngineInterface): Promise<Puzzle> {
  const source = mod.saved.source
  const label = labelOf(source)
  let last: Puzzle | undefined
  for (let attempt = 0; attempt < FETCH_TRIES; attempt++) {
    const url = source === 'lichess' ? lichessUrl(difficultyFor(mod.saved.stats.rating)) : CHESSCOM_RANDOM_URL
    let text: string
    try {
      const response = await $.http.fetch(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      text = response.text
    } catch (error) {
      throw new Error(mod.t.unreachable(label, reasonOf(error)))
    }
    let puzzle: Puzzle
    try {
      const json: unknown = JSON.parse(text)
      puzzle = source === 'lichess' ? fromLichess(json) : fromChesscom(json)
    } catch (error) {
      throw new Error(mod.t.unreadable(label, reasonOf(error)))
    }
    if (!mod.saved.seen[source].includes(puzzle.id)) return puzzle
    last = puzzle
  }
  if (last === undefined) throw new Error(mod.t.unreachable(label, 'no puzzle'))

  return last
}

function remember(puzzle: Puzzle) {
  const seen = mod.saved.seen[puzzle.source].filter(id => id !== puzzle.id)
  seen.push(puzzle.id)
  mod.saved.seen[puzzle.source] = seen.slice(-SEEN_LIMIT)
}

async function newPuzzle($: EngineInterface) {
  if (mod.isFetching) return
  mod.isFetching = true
  await update($, message, () => mod.t.loading)
  try {
    const puzzle = await fetchPuzzle($)
    remember(puzzle)
    await saveSaved($)
    mod.lastMove = []
    mod.hint = null
    const fresh = start(puzzle)
    const drawn = boardOf(fresh, mod.pieces, [], null)
    await update($, game, () => fresh)
    await update($, board, () => drawn)
    await update($, status, () => statusOf(fresh))
    await update($, message, () => mod.t.yourTurn(drawn.orientation))
  } catch (error) {
    await update($, game, () => null)
    await update($, board, () => null)
    await update($, status, () => '')
    await update($, message, () => reasonOf(error))
  } finally {
    mod.isFetching = false
  }
}

async function applyPlayed($: EngineInterface, result: Played) {
  if (result.outcome === 'illegal') {
    await update($, message, () => mod.t.illegal)
    return
  }
  if (result.outcome === 'wrong') {
    await update($, game, () => result.game)
    await update($, message, () => mod.t.wrong)
    return
  }
  mod.hint = null
  const last = result.played[result.played.length - 1]
  mod.lastMove = last === undefined ? mod.lastMove : squaresOf(last)
  await update($, game, () => result.game)
  await update($, board, () => boardOf(result.game, mod.pieces, mod.lastMove, null))
  if (result.outcome === 'correct') {
    await update($, message, () => mod.t.correct)
    return
  }
  await finish($, result.game)
}

async function finish($: EngineInterface, finished: Game) {
  const before = mod.saved.stats
  mod.saved.stats = record(before, finished.puzzle.rating, !finished.isFailed)
  await saveSaved($)
  const isRated = finished.puzzle.rating !== undefined
  const rating = isRated ? mod.saved.stats.rating : undefined
  const delta = isRated ? mod.saved.stats.rating - before.rating : undefined
  await update($, message, () => mod.t.solved(rating, delta, mod.saved.stats.streak))
}

async function onHint($: EngineInterface) {
  const current = await read($, game)
  if (!current || current.isSolved) return
  const theme = hintTheme(current.puzzle.themes, mod.language)
  let result = hint(current)
  if (result.square === undefined && theme === undefined) result = hint(result.game)
  await update($, game, () => result.game)
  if (result.square === undefined) {
    await update($, message, () => mod.t.hintTheme(theme ?? ''))
    return
  }
  mod.hint = result.square
  await update($, board, () => boardOf(result.game, mod.pieces, mod.lastMove, mod.hint))
  await update($, message, () => mod.t.hintPiece)
}

async function onReveal($: EngineInterface) {
  const current = await read($, game)
  if (!current || current.isSolved) return
  const result = reveal(current)
  await applyPlayed($, result)
  if (result.outcome === 'correct' && result.san !== undefined) {
    const san = result.san
    await update($, message, () => mod.t.solution(san))
  }
}
