import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { CHESSCOM_RANDOM, LICHESS_SAMPLE } from './samples'

const PLUGIN = 'chess-puzzles'
const PANE = 'chess-puzzles'
const OPTIONS = { source: 'lichess', pieces: 'symbols', language: 'auto' }
const SURFACES = ['terminal', 'desktop'] as const

type Saved = { source?: string; stats?: { rating: number; solved: number; failed: number; streak: number }; seen?: Record<string, string[]> }
type Answer = { ok: boolean; status: number; text: string }
type World = { urls: string[]; closed: string[]; store: Record<string, unknown>; answers: Answer[]; deny?: string }

function json(body: unknown): Answer {
  return { ok: true, status: 200, text: JSON.stringify(body) }
}

function world(on: On, saved: Saved = {}, answers: Answer[] = [json(LICHESS_SAMPLE)]): World {
  const seen: World = { urls: [], closed: [], store: { state: saved }, answers: [...answers] }
  const panes: string[] = []
  mock.env(on, { LANG: 'fr_FR.UTF-8' })
  on('store.get', (_, e) => ({ value: seen.store[e.key] }))
  on('store.set', (_, e) => {
    seen.store[e.key] = e.value
    return { value: undefined }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', (_, e) => {
    if (!panes.includes(e.id)) panes.push(e.id)
    return { value: { isPlaced: true as const } }
  })
  on('ui.panes', () => ({ value: panes.map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })) }))
  on('ui.close', (_, e) => {
    seen.closed.push(e.id)
    panes.splice(panes.indexOf(e.id), 1)
    return { value: undefined }
  })
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [] }))
  on('ui.message', () => ({}))
  on('http.fetch', (_, e) => {
    seen.urls.push(e.url)
    if (seen.deny !== undefined) return { deny: seen.deny }
    const answer = seen.answers.length > 1 ? seen.answers.shift() : seen.answers[0]
    return { value: { ...(answer ?? json(LICHESS_SAMPLE)), headers: {} } }
  })

  return seen
}

const paneProps = {
  title: 'Puzzles',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
}
const bandProps = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 9 }, view: {} }
const composer = { origin: { kind: 'composer' as const }, presentation: { isFullscreen: true, columns: 200 } }

// Black at the bottom, large squares: column = 2 + (7 - file) * 4 + 1, row = (rank - 1) * 2.
function cell(square: string): { x: number; y: number } {
  const file = 'abcdefgh'.indexOf(square.charAt(0))
  const rank = Number(square.charAt(1)) - 1
  return { x: 2 + (7 - file) * 4 + 1, y: rank * 2 }
}

for (const surface of SURFACES) {
  describe(`on ${surface}`, () => {
    test('/puzzle fetches a Lichess puzzle and draws the board, the status and the band', { options: OPTIONS }, async ($, on) => {
      const seen = world(on)
      await $.session.start({ cwd: '/p', surface, isInteractive: true })
      const answer = await $.command.run({ command: 'puzzle', args: '', ...composer })
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', props: paneProps, requestId: PANE })
      const band = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: bandProps })

      expect(answer).toMatchObject({ text: 'Puzzles ouvert.' })
      expect(seen.urls).toEqual(['https://lichess.org/api/puzzle/next?difficulty=normal'])
      expect(await ui.find({ type: 'Client', key: 'board' })).toMatchObject({ props: { props: { orientation: 'b' } } })
      expect(await ui.find({ in: 'board', key: 'g3' })).toMatchObject({ props: { backgroundColor: '#b58863' } })
      expect(await ui.find({ in: 'board', key: 'g3', text: /♜/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Lichess 1369 · À toi, les noirs' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'À toi, les noirs' })).toBeDefined()
      expect(await band.find({ key: 'hint' })).toMatchObject({ props: { hotkey: '1', plain: true, label: 'indice' } })
      expect(await band.find({ key: 'reveal' })).toMatchObject({ props: { hotkey: '2' } })
      expect(await band.find({ key: 'next' })).toMatchObject({ props: { hotkey: '3' } })
      expect(await band.find({ key: 'close' })).toMatchObject({ props: { hotkey: '0' } })
      expect((seen.store.state as Saved).seen?.lichess).toEqual(['SVQOR'])
    })

    test('two clicks play the move, the reply follows, the last click solves and records', { options: OPTIONS }, async ($, on) => {
      const seen = world(on)
      await $.session.start({ cwd: '/p', surface, isInteractive: true })
      await $.command.run({ command: 'puzzle', args: '', ...composer })
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', props: paneProps, requestId: PANE })

      await ui.pointer({ type: 'down', ...cell('g3'), button: 'left', in: 'board' })
      expect(await ui.find({ in: 'board', key: 'g3' })).toMatchObject({ props: { backgroundColor: '#f6f669' } })
      await ui.pointer({ type: 'down', ...cell('f3'), button: 'left', in: 'board' })

      expect(await ui.find({ type: 'Text', text: 'Correct, continue.' })).toBeDefined()
      expect(await ui.find({ in: 'board', key: 'f3', text: /♜/ })).toBeDefined()
      expect(await ui.find({ in: 'board', key: 'g4', text: /♚/ })).toBeDefined()
      expect(await ui.find({ in: 'board', key: 'g4' })).toMatchObject({ props: { backgroundColor: '#cdd26a' } })

      await ui.pointer({ type: 'down', ...cell('f6'), button: 'left', in: 'board' })
      await ui.pointer({ type: 'down', ...cell('f5'), button: 'left', in: 'board' })

      expect(await ui.find({ type: 'Text', text: 'Résolu ! Cote 1510 (+10), série : 1.' })).toBeDefined()
      expect((seen.store.state as Saved).stats).toMatchObject({ rating: 1510, solved: 1, failed: 0, streak: 1 })
    })

    test('a wrong move says so and costs the puzzle, an illegal one is refused', { options: OPTIONS }, async ($, on) => {
      const seen = world(on)
      await $.session.start({ cwd: '/p', surface, isInteractive: true })
      await $.command.run({ command: 'puzzle', args: '', ...composer })
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', props: paneProps, requestId: PANE })

      await ui.post({ from: 'h6', to: 'h4' }, { in: 'board' })
      expect(await ui.find({ type: 'Text', text: 'Coup illégal.' })).toBeDefined()
      await ui.post({ from: 'b5', to: 'b4' }, { in: 'board' })
      expect(await ui.find({ type: 'Text', text: 'Raté, réessaie.' })).toBeDefined()
      expect(await ui.find({ in: 'board', key: 'b5', text: /♟/ })).toBeDefined()

      await ui.post({ from: 'g3', to: 'f3' }, { in: 'board' })
      await ui.post({ from: 'f6', to: 'f5' }, { in: 'board' })
      expect(await ui.find({ type: 'Text', text: 'Résolu ! Cote 1478 (-22), série : 0.' })).toBeDefined()
      expect((seen.store.state as Saved).stats).toMatchObject({ solved: 0, failed: 1, streak: 0 })
    })

    test('/puzzle <move> plays from the keyboard, SAN or UCI', { options: OPTIONS }, async ($, on) => {
      world(on)
      await $.session.start({ cwd: '/p', surface, isInteractive: true })
      await $.command.run({ command: 'puzzle', args: '', ...composer })

      expect(await $.command.run({ command: 'puzzle', args: 'Rgf3+', ...composer })).toMatchObject({ text: 'Correct, continue.' })
      const solved = await $.command.run({ command: 'puzzle', args: 'f6f5', ...composer })
      expect(solved?.text?.startsWith('Résolu')).toBe(true)
    })

    test('the hint names the theme, then the piece; the solution plays the move', { options: OPTIONS }, async ($, on) => {
      const seen = world(on)
      await $.session.start({ cwd: '/p', surface, isInteractive: true })
      await $.command.run({ command: 'puzzle', args: '', ...composer })
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', props: paneProps, requestId: PANE })
      const band = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: bandProps })

      await band.press({ key: 'hint' })
      expect(await ui.find({ type: 'Text', text: 'Indice : mat en 2.' })).toBeDefined()
      await band.press({ key: 'hint' })
      expect(await ui.find({ type: 'Text', text: 'Indice : joue la pièce surlignée.' })).toBeDefined()
      expect(await ui.find({ in: 'board', key: 'g3' })).toMatchObject({ props: { backgroundColor: '#9bc700' } })

      await band.press({ key: 'reveal' })
      expect(await ui.find({ type: 'Text', text: 'Solution : Rgf3+.' })).toBeDefined()
      expect(await ui.find({ in: 'board', key: 'f3', text: /♜/ })).toBeDefined()

      await ui.post({ from: 'f6', to: 'f5' }, { in: 'board' })
      expect((seen.store.state as Saved).stats).toMatchObject({ solved: 0, failed: 1 })
      expect(await band.find({ key: 'hint' })).toBeUndefined()
      expect(await band.find({ key: 'next' })).toBeDefined()
    })

    test('/puzzle chesscom switches the source and reads the chess.com format', { options: OPTIONS }, async ($, on) => {
      const seen = world(on, {}, [json(CHESSCOM_RANDOM)])
      await $.session.start({ cwd: '/p', surface, isInteractive: true })
      const answer = await $.command.run({ command: 'puzzle', args: 'chesscom', ...composer })
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', props: paneProps, requestId: PANE })

      expect(answer).toMatchObject({ text: 'Source : chesscom.' })
      expect(seen.urls).toEqual(['https://api.chess.com/pub/puzzle/random'])
      expect(await ui.find({ type: 'Text', text: 'Chess.com · À toi, les noirs' })).toBeDefined()
      expect((seen.store.state as Saved).source).toBe('chesscom')

      await ui.post({ from: 'e2', to: 'a6' }, { in: 'board' })
      expect(await ui.find({ type: 'Text', text: 'Correct, continue.' })).toBeDefined()
      expect(await $.command.run({ command: 'puzzle', args: 'stats', ...composer })).toMatchObject({ text: 'Cote 1500 · 0 résolu · 0 raté · série 0' })
    })

    test('a puzzle already seen is fetched again', { options: OPTIONS }, async ($, on) => {
      const other = { ...LICHESS_SAMPLE, puzzle: { ...LICHESS_SAMPLE.puzzle, id: 'OTHER' } }
      const seen = world(on, { seen: { lichess: ['SVQOR'], chesscom: [] } }, [json(LICHESS_SAMPLE), json(other)])
      await $.session.start({ cwd: '/p', surface, isInteractive: true })
      await $.command.run({ command: 'puzzle', args: '', ...composer })

      expect(seen.urls).toHaveLength(2)
      expect((seen.store.state as Saved).seen?.lichess).toEqual(['SVQOR', 'OTHER'])
    })

    test('the difficulty follows the local rating', { options: OPTIONS }, async ($, on) => {
      const seen = world(on, { stats: { rating: 1850, solved: 9, failed: 2, streak: 4 } })
      await $.session.start({ cwd: '/p', surface, isInteractive: true })
      await $.command.run({ command: 'puzzle', args: '', ...composer })

      expect(seen.urls).toEqual(['https://lichess.org/api/puzzle/next?difficulty=harder'])
    })

    test('a refused fetch shows the reason in the pane and keeps the next button', { options: OPTIONS }, async ($, on) => {
      const seen = world(on)
      seen.deny = 'pas de réseau'
      await $.session.start({ cwd: '/p', surface, isInteractive: true })
      await $.command.run({ command: 'puzzle', args: '', ...composer })
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', props: paneProps, requestId: PANE })
      const band = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: bandProps })

      expect(await ui.find({ type: 'Text', text: /Lichess injoignable : .*pas de réseau/ })).toBeDefined()
      expect(await band.find({ key: 'hint' })).toBeUndefined()
      expect(await band.find({ key: 'next' })).toBeDefined()
    })

    test('/puzzle off closes the pane and hides the band', { options: OPTIONS }, async ($, on) => {
      const seen = world(on)
      await $.session.start({ cwd: '/p', surface, isInteractive: true })
      await $.command.run({ command: 'puzzle', args: '', ...composer })
      const answer = await $.command.run({ command: 'puzzle', args: 'off', ...composer })
      const band = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: bandProps })

      expect(answer).toMatchObject({ text: 'Puzzles fermé.' })
      expect(seen.closed).toEqual([PANE])
      expect(await band.find({ type: 'Button' })).toBeUndefined()
    })

    test('a low pane draws small squares and the letters setting draws letters', { options: { ...OPTIONS, pieces: 'letters', language: 'en' } }, async ($, on) => {
      world(on)
      await $.session.start({ cwd: '/p', surface, isInteractive: true })
      await $.command.run({ command: 'puzzle', args: '', ...composer })
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', props: { ...paneProps, scroll: { offset: 0, bodyRows: 12 } }, requestId: PANE })

      expect(await ui.find({ in: 'board', key: 'g3', text: 'r ' })).toBeDefined()
      expect(await ui.find({ in: 'board', key: 'g3' })).toMatchObject({ props: { width: 2, height: 1 } })
      expect(await ui.find({ type: 'Text', text: 'Your move, black' })).toBeDefined()
    })
  })
}
