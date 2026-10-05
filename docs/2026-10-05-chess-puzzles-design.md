# chess-puzzles, mod Claude Code

Date : 2026-10-05. Statut : implémenté le même jour, 98 tests verts, tsc propre. Les écarts à la spec sont notés en fin de document.

## Besoin

Résoudre des puzzles d'échecs dans un panneau Claude Code pendant que Claude travaille. Plateau cliquable, indice, message. Deux sources : Lichess et chess.com. À la demande, rien ne bouge tout seul. Mod open source, sans compte ni donnée personnelle.

Ce qui est exclu, et pourquoi : l'iframe de chess.com (`X-Frame-Options: SAMEORIGIN`, et l'API des mods n'a pas d'élément web), la cote chess.com (vit sur leur serveur derrière le compte), l'affichage en pixels de la vraie page (demande un terminal au protocole kitty, pas l'app desktop).

## Décisions

| Sujet | Choix |
|---|---|
| Nom, commande, panneau | `chess-puzzles`, `/puzzle`, « Puzzles » |
| Sources | Lichess (`/api/puzzle/next`, cote, thèmes, difficulté) et chess.com (`/pub/puzzle`, `/pub/puzzle/random`, titre, pas de cote) |
| Rythme | À la demande : `/puzzle` ouvre, le puzzle reste jusqu'à résolution, « suivant » en tire un autre |
| Saisie | Clic pièce puis clic case dans le plateau ; secours `/puzzle e2e4` ou `/puzzle Nf3` |
| Boutons | Bande au-dessus du prompt, chiffres : `1: indice` `2: solution` `3: suivant` `0: fermer` |
| Cote | Locale, Elo K=32 contre la cote du puzzle Lichess, départ 1500, persistée dans le store ; pilote la difficulté Lichess |
| Licence | MIT, dépôt GitHub `Snouzy/chess-puzzles` après feu vert |

## Structure

```
chess-puzzles/
  .claude-plugin/plugin.json   nom, version, userConfig, types
  hooks/hooks.json             { "modules": ["./register.tsx"] }
  hooks/register.tsx           hooks : commande, panneau, bande, messages du plateau, réseau
  hooks/board.tsx              module de surface (Client) : dessine le plateau, gère les clics, poste les coups
  hooks/chess.ts               échecs purs : FEN, coups légaux, SAN et UCI, rejeu de PGN
  hooks/puzzles.ts             sources : JSON Lichess et chess.com vers la forme commune
  hooks/rating.ts              Elo local et choix de difficulté
  hooks/*.test.ts              un fichier de tests par module
  types/index.d.ts             contrat d'état du panneau
  docs/                        cette spec
  README.md, LICENSE
```

`register.tsx` ne fait que brancher. Tout ce qui se teste sans terminal vit dans `chess.ts`, `puzzles.ts`, `rating.ts`.

Réglages `userConfig` : `source` (chaîne, `lichess` ou `chesscom`, défaut `lichess`, écrasée par `/puzzle <source>`), `pieces` (chaîne, `symbols` ou `letters`, défaut `symbols`, pour les polices qui dessinent mal ♞).

## Forme commune d'un puzzle

```ts
type Puzzle = {
  id: string
  source: 'lichess' | 'chesscom'
  fen: string            // position de départ, au trait du joueur
  solution: string[]     // coups UCI, joueur et adversaire en alternance, le joueur d'abord
  rating?: number        // Lichess seulement
  themes: string[]       // Lichess : identifiants de thèmes ; chess.com : [titre]
  url: string
}
```

- **Lichess** : `game.pgn` rejoué depuis la position initiale donne la position ; `puzzle.solution` est déjà en UCI. Vérifié sur le puzzle `SVQOR` : tous les coups du PGN joués, noirs au trait, solution `g3f3 f5g4 f6f5`.
- **chess.com** : `fen` fourni ; le movetext du `pgn` (`1...Qa6 2.Qd5 Qa3+ 3.Kd2 … *`, parfois des commentaires `{}`) est résolu coup par coup en UCI sur la position. Numéros de coups, `...`, commentaires, variantes `()`, NAG `$n` et résultat sont retirés.

## Échecs purs (`chess.ts`)

Un moteur minimal, sans dépendance : plateau 64 cases, FEN complet (trait, roques, en passant, compteurs), génération des coups légaux (pseudo-légaux filtrés par « le roi n'est pas en prise »), roque, en passant, promotion, mat et pat. SAN résolu par la liste des coups légaux (donc la désambiguïsation par clouage marche d'elle-même). UCI vers coup et coup vers SAN pour les messages.

Pas de dépendance npm : le module tourne dans l'environnement du mod, sans Node.

## Flux

- **`/puzzle`** : ouvre le panneau (`rows: 22`, `columns: 44`), tire un puzzle de la source courante s'il n'y en a pas en cours.
- **`/puzzle lichess`**, **`/puzzle chesscom`** : change la source, la garde dans le store, tire un puzzle.
- **`/puzzle <coup>`** : joue au clavier, UCI (`e2e4`, `e7e8q`) ou SAN (`Nf3`, `O-O`).
- **`/puzzle stats`** : cote, résolus, ratés, série en cours.
- **`/puzzle off`** : ferme.
- **Clic** : le module de surface garde la case sélectionnée dans son état local, poste `{ from, to }` au second clic ; le hook `ui.message` vérifie et répond `{ props }` avec le nouveau plateau.

### Vérification d'un coup

1. Illégal : « Coup illégal », rien ne bouge.
2. Égal au coup attendu (mêmes cases ; la promotion suit la solution), ou mat légal : le coup est joué, puis la réponse adverse. « Correct, continue ». Dernier coup : « Résolu », cote mise à jour.
3. Sinon : « Raté, réessaie ». Le coup n'est pas joué. Le puzzle est compté raté une seule fois, on peut continuer.

### Indice

`1: indice`, premier appui : thèmes Lichess (identifiants traduits pour les courants : `mateIn2` → « mat en 2 », `fork` → « fourchette », les autres tels quels) ou titre chess.com. Deuxième appui : la case de la pièce à jouer est surlignée, le puzzle est compté raté. `2: solution` : joue le coup attendu, compté raté.

## Panneau

```
┌ Puzzles ─────────────────────────────────┐
│  8 ▒▒▒▒░░░░▒▒▒▒░░░░▒▒▒▒░░░░▒▒▒▒░░░░       │
│    ▒▒♜▒░░░░▒▒▒▒░░♚░▒▒▒▒░░░░▒▒▒▒░░░░       │
│  … huit rangées, cases 4 × 2 cellules …   │
│    a   b   c   d   e   f   g   h          │
│                                           │
│  Lichess 1369 · mat en 2 · À toi, noirs   │
│  Correct, continue                        │
└───────────────────────────────────────────┘
1: indice   2: solution   3: suivant   0: fermer      ← bande
```

- Cases 4 colonnes × 2 lignes (carrées à l'écran). Quand la région fait moins de 18 lignes, le module passe en 2 × 1.
- Le joueur en bas. Pièces : glyphes pleins (♚♛♜♝♞♟) colorés blanc ou noir, ou lettres (`K Q R B N P`, minuscules pour les noirs) selon `pieces`.
- Couleurs : clair `#f0d9b5`, foncé `#b58863`, sélection `#f6f669`, dernier coup `#cdd26a`, indice `#9bc700`.
- Ligne d'état : source, cote du puzzle, thème ou titre, trait. Ligne de message en dessous.
- Panneau vide (réseau KO, source injoignable) : « Lichess injoignable : <raison> », `3: suivant` retente.

## Cote locale (`rating.ts`)

- Départ 1500. Après un puzzle Lichess : Elo K=32 contre la cote du puzzle. Résolu sans indice de pièce ni solution = victoire ; sinon défaite.
- Difficulté demandée à Lichess d'après la cote : < 1200 `easiest`, < 1400 `easier`, < 1700 `normal`, < 2000 `harder`, sinon `hardest`. L'API sans compte centre sur 1500, c'est ce qui rend ce réglage utile.
- Les puzzles chess.com ne touchent pas la cote : ils n'en ont pas.

## Store

`{ source, rating, solved, failed, streak, seen: { lichess: string[], chesscom: string[] } }`. `seen` garde les 500 derniers identifiants par source : un puzzle déjà vu est retiré (chess.com `random` est mis en cache côté serveur et répète ; jusqu'à cinq tirages, puis on accepte).

## Erreurs

- `$.http.fetch` refusé ou KO : message dans le panneau avec la raison du moteur, aucun toast.
- JSON inattendu : « réponse Lichess illisible », même traitement.
- PGN que le moteur n'arrive pas à rejouer : le puzzle est sauté et noté dans le log de debug.

## Tests, via `claude plugin test`

`chess.ts` : FEN aller-retour ; perft depuis la position initiale (20, 400, 8902) ; roque, en passant, promotion ; SAN avec désambiguïsation et clouage ; rejeu du PGN du puzzle `SVQOR` et légalité de sa solution ; mat et pat.

`puzzles.ts` : les deux JSON réels de ce jour vers la forme commune ; movetext chess.com avec `1...`, commentaires et `*`.

`rating.ts` : Elo dans les deux sens, plafonds, choix de difficulté.

Hooks, sur `terminal` et `desktop` : `/puzzle` ouvre un panneau avec un `Client` ; message `{ from, to }` correct → « Correct, continue » et réponse adverse jouée ; faux → « Raté » ; illégal → « Coup illégal » ; résolu → cote et compteurs mis à jour dans le store ; indice en deux temps ; `/puzzle chesscom` change la source ; `/puzzle e2e4` joue ; réseau refusé → message.

`board.tsx` : piloté par le kit (pointeur) : clic e2 puis e4 → poste `{ from: 'e2', to: 'e4' }` ; clic sur une case vide sans sélection → rien ; région basse → cases 2 × 1.

## Open source

- `LICENSE` MIT, nom Mathias Bradiceanu.
- `README.md` en anglais : ce que fait le mod, capture, installation (`claude --plugin-dir`, `CLAUDE_CODE_PLUGIN_DIRS`, ou marketplace dossier), usage, sources et crédits (API Lichess, API publique chess.com), vie privée (aucun compte, store local), développement (`claude plugin validate`, `claude plugin test`, `tsc -p`).
- Dépôt `Snouzy/chess-puzzles`, créé et poussé seulement sur feu vert explicite.

## Points à vérifier en codant

- Les clics atteignent-ils un `Client` dans le terminal de l'app desktop (coordonnées en cellules suffisent, pas besoin de `fine`).
- `backgroundColor` en hexadécimal sur `Box` dans le terminal.
- Largeur des glyphes ♞ dans la police de l'app ; sinon `pieces: letters`.

## Écarts constatés à l'implémentation

- Les tests du kit atteignent le module de surface par `ui.pointer` et `ui.post` : les clics sont couverts sur `terminal` et `desktop`. Reste à voir à l'œil dans l'app desktop.
- La taille des cases vient du panneau (`scroll.bodyRows` ≥ 20 → 4 × 2), pas de la région du module : la région s'adapte à ce que le module dessine, donc le module ne peut pas la lire pour décider.
- Réglage `language` ajouté (`fr`, `en`, `auto` d'après `LANG`), pour que le mod publié serve aussi en anglais.
- La notation des coups suit le moteur : sur le puzzle témoin la tour à jouer s'écrit `Rgf3+`, deux tours pouvant aller en f3.
- Un `samples.ts` porte les réponses réelles des deux API pour les tests ; il n'est pas chargé par le mod.

## Vérification

- `claude plugin validate` : passé, module de surface `hooks/board.tsx` reconnu.
- `claude plugin test` : 98 tests, 54 sur `chess.ts` (perft 20/400/8902 et Kiwipete 48/2039), 7 sur `rating.ts`, 6 sur `puzzles.ts`, 11 sur `game.ts`, 22 sur les hooks (11 scénarios sur deux surfaces).
- `tsc -p` avec TypeScript 5.6 : aucune erreur.
