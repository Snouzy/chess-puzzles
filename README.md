# chess-puzzles

Solve chess puzzles inside Claude Code while Claude works. A pane shows the board, you click the piece and the square, the mod checks your move against the solution and plays the reply. Puzzles come from Lichess or chess.com, with a local rating that drives the difficulty.

Built as a Claude Code mod: a plugin of function hooks, no Node, no npm, no account.

## What you get

- A clickable board in a pane (`/puzzle`), with the solver's side at the bottom.
- Digit shortcuts above the prompt, no focus needed: `1` hint, `2` solution, `3` next, `0` close. Type the digit in an empty prompt.
- Keyboard moves too: `/puzzle Nf3`, `/puzzle e7e8q`.
- A two-step hint: the theme first (free), then the piece to move (counts as a miss).
- Messages under the board: your turn, correct, wrong, illegal, solved with your new rating.
- Two sources, switchable at any time: `/puzzle lichess` (random puzzles with rating and themes) and `/puzzle chesscom` (the daily puzzle archive, with titles).
- A local Elo-style rating (start 1500, K=32) updated on every rated Lichess puzzle, which picks the Lichess difficulty for the next one. `/puzzle stats` prints it.
- French or English, from your `LANG` or the `language` setting.

Not included, on purpose: your chess.com or Lichess account rating. Both live on their servers behind a login. This mod never asks for one.

## Install

Pick one.

**Try it for one session**

```sh
claude --plugin-dir /path/to/chess-puzzles
```

**Load it in every session**: add the folder to `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json` (several folders separated by `:` on macOS and Linux):

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "~/path/to/chess-puzzles"
  }
}
```

**As a marketplace plugin**: `claude plugin marketplace add /path/to/parent-folder` with a marketplace entry pointing at `./chess-puzzles`, then `claude plugin install chess-puzzles`.

## Use

| Command | Effect |
|---|---|
| `/puzzle` | Opens the pane and fetches a puzzle if none is in progress |
| `/puzzle lichess`, `/puzzle chesscom` | Switches the source (remembered) and fetches a puzzle |
| `/puzzle <move>` | Plays a move from the keyboard, SAN (`Rf3+`) or UCI (`g3f3`) |
| `/puzzle stats` | Rating, solved, failed, streak |
| `/puzzle off` | Closes the pane |

On the board: click one of your pieces, then the target square. Clicking another of your pieces changes the selection, clicking the selected piece again clears it. Promotions follow the solution (queen otherwise). Any legal checkmate counts as solved, as on Lichess.

Settings (Claude Code config menu, or `userConfig` in the manifest): `source` (`lichess` or `chesscom`), `pieces` (`symbols` for ♞, `letters` for `N` when your font draws the symbols badly), `language` (`fr`, `en` or `auto`).

## How it works

- `hooks/register.tsx` wires the command, the pane, the band and the board messages.
- `hooks/board.tsx` is a surface module: it draws the squares and turns two clicks into a `{ from, to }` message.
- `hooks/chess.ts` is a minimal chess engine: FEN, legal move generation, castling, en passant, promotion, SAN and UCI, PGN replay. Needed to resolve chess.com's algebraic solutions and to tell an illegal move from a wrong one.
- `hooks/puzzles.ts` turns the Lichess and chess.com JSON into one puzzle shape.
- `hooks/game.ts` plays a puzzle: expected move, reply, hints, reveal.
- `hooks/rating.ts` is the Elo update and the difficulty mapping.

Data stays on your machine: the mod's store keeps the source, the rating and the ids of the last 500 puzzles seen per source.

## Develop

```sh
claude plugin validate .      # the manifest and what the hooks call
claude plugin test .          # every hooks/*.test.ts, on the terminal and desktop surfaces
tsc -p .                      # once the mod has loaded in a session, which lays the engine's types beside it
```

## Credits

- [Lichess puzzle API](https://lichess.org/api#tag/Puzzles), puzzles under CC0.
- [chess.com published-data API](https://www.chess.com/news/view/published-data-api), daily puzzles.

## License

MIT
