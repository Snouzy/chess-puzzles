export type Language = 'fr' | 'en'

export type Strings = {
  yourTurn: (color: 'w' | 'b') => string
  correct: string
  wrong: string
  illegal: string
  solved: (rating: number | undefined, delta: number | undefined, streak: number) => string
  hintTheme: (label: string) => string
  hintPiece: string
  solution: (san: string) => string
  loading: string
  unreachable: (source: string, reason: string) => string
  unreadable: (source: string, reason: string) => string
  opened: string
  closed: string
  sourceSet: (source: string) => string
  stats: (rating: number, solved: number, failed: number, streak: number) => string
  hint: string
  reveal: string
  next: string
  close: string
}

const FR: Strings = {
  yourTurn: color => (color === 'w' ? 'À toi, les blancs' : 'À toi, les noirs'),
  correct: 'Correct, continue.',
  wrong: 'Raté, réessaie.',
  illegal: 'Coup illégal.',
  solved: (rating, delta, streak) =>
    rating === undefined || delta === undefined
      ? `Résolu ! Série : ${streak}.`
      : `Résolu ! Cote ${rating} (${delta >= 0 ? '+' : ''}${delta}), série : ${streak}.`,
  hintTheme: label => `Indice : ${label}.`,
  hintPiece: 'Indice : joue la pièce surlignée.',
  solution: san => `Solution : ${san}.`,
  loading: 'Chargement…',
  unreachable: (source, reason) => `${source} injoignable : ${reason}`,
  unreadable: (source, reason) => `Réponse ${source} illisible : ${reason}`,
  opened: 'Puzzles ouvert.',
  closed: 'Puzzles fermé.',
  sourceSet: source => `Source : ${source}.`,
  stats: (rating, solved, failed, streak) => `Cote ${rating} · ${solved} résolu${solved > 1 ? 's' : ''} · ${failed} raté${failed > 1 ? 's' : ''} · série ${streak}`,
  hint: 'indice',
  reveal: 'solution',
  next: 'suivant',
  close: 'fermer',
}

const EN: Strings = {
  yourTurn: color => (color === 'w' ? 'Your move, white' : 'Your move, black'),
  correct: 'Correct, keep going.',
  wrong: 'Wrong, try again.',
  illegal: 'Illegal move.',
  solved: (rating, delta, streak) =>
    rating === undefined || delta === undefined
      ? `Solved! Streak: ${streak}.`
      : `Solved! Rating ${rating} (${delta >= 0 ? '+' : ''}${delta}), streak: ${streak}.`,
  hintTheme: label => `Hint: ${label}.`,
  hintPiece: 'Hint: move the highlighted piece.',
  solution: san => `Solution: ${san}.`,
  loading: 'Loading…',
  unreachable: (source, reason) => `${source} unreachable: ${reason}`,
  unreadable: (source, reason) => `Unreadable ${source} answer: ${reason}`,
  opened: 'Puzzles opened.',
  closed: 'Puzzles closed.',
  sourceSet: source => `Source: ${source}.`,
  stats: (rating, solved, failed, streak) => `Rating ${rating} · ${solved} solved · ${failed} failed · streak ${streak}`,
  hint: 'hint',
  reveal: 'solution',
  next: 'next',
  close: 'close',
}

const FRENCH_THEMES: Record<string, string> = {
  mate: 'mat',
  mateIn1: 'mat en 1',
  mateIn2: 'mat en 2',
  mateIn3: 'mat en 3',
  mateIn4: 'mat en 4',
  mateIn5: 'mat en 5 ou plus',
  fork: 'fourchette',
  pin: 'clouage',
  skewer: 'enfilade',
  discoveredAttack: 'attaque à la découverte',
  doubleCheck: 'échec double',
  sacrifice: 'sacrifice',
  deflection: 'déviation',
  attraction: 'attraction',
  clearance: 'dégagement',
  interference: 'interception',
  intermezzo: 'coup intermédiaire',
  zugzwang: 'zugzwang',
  quietMove: 'coup tranquille',
  defensiveMove: 'coup défensif',
  hangingPiece: 'pièce en prise',
  trappedPiece: 'pièce piégée',
  capturingDefender: 'capture du défenseur',
  xRayAttack: 'attaque rayon X',
  exposedKing: 'roi exposé',
  backRankMate: 'mat du couloir',
  smotheredMate: 'mat étouffé',
  arabianMate: 'mat arabe',
  anastasiaMate: "mat d'Anastasia",
  bodenMate: 'mat de Boden',
  hookMate: 'mat du crochet',
  dovetailMate: "mat de la queue d'aronde",
  operaMate: "mat de l'opéra",
  promotion: 'promotion',
  advancedPawn: 'pion avancé',
  enPassant: 'en passant',
  castling: 'roque',
  kingsideAttack: "attaque sur l'aile roi",
  queensideAttack: "attaque sur l'aile dame",
  attackingF2F7: 'attaque sur f2/f7',
  rookEndgame: 'finale de tours',
  pawnEndgame: 'finale de pions',
  queenEndgame: 'finale de dames',
  bishopEndgame: 'finale de fous',
  knightEndgame: 'finale de cavaliers',
  queenRookEndgame: 'finale dame et tour',
  endgame: 'finale',
  middlegame: 'milieu de partie',
  opening: 'ouverture',
}

const GENERIC_THEMES = new Set([
  'short',
  'long',
  'veryLong',
  'oneMove',
  'crushing',
  'advantage',
  'equality',
  'master',
  'masterVsMaster',
  'superGM',
  'middlegame',
  'endgame',
  'opening',
])

export function languageOf(option: string, lang: string | undefined): Language {
  if (option === 'fr' || option === 'en') return option
  return (lang ?? '').toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

export function stringsOf(language: Language): Strings {
  return language === 'fr' ? FR : EN
}

export function themeLabel(theme: string, language: Language): string {
  if (language === 'fr') return FRENCH_THEMES[theme] ?? theme
  return theme.replace(/([A-Z])/g, ' $1').replace(/(\d+)/g, ' $1').toLowerCase().trim()
}

export function hintTheme(themes: string[], language: Language): string | undefined {
  const telling = themes.filter(theme => !GENERIC_THEMES.has(theme))
  const mate = telling.find(theme => theme.startsWith('mate'))
  const first = mate ?? telling[0] ?? themes[0]
  return first === undefined ? undefined : themeLabel(first, language)
}
