/**
 * Word search grid generator — pure, no I/O, shared by the admin
 * creation form (features/admin/games) and, indirectly, whatever
 * renders the puzzle for guests (features/games/word-search-game.tsx).
 * Placement coordinates aren't persisted: once the grid is built, the
 * client validates a guess purely by reading the letters along a
 * straight line and checking them against the word list (forward or
 * reversed) — the same rule real word-search puzzles use, and it means
 * a word appearing anywhere in a valid straight line legitimately
 * counts, not just at its original placement.
 */

const DIRECTIONS: [number, number][] = [
  [0, 1], // right
  [1, 0], // down
  [1, 1], // down-right
  [-1, 1], // up-right
  [0, -1], // left
  [-1, 0], // up
  [-1, -1], // up-left
  [1, -1], // down-left
];

const FILLER_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

export interface WordSearchPuzzle {
  size: number;
  grid: string[][];
  words: string[];
}

/**
 * Picks a grid size that comfortably fits every word, then tries to
 * place each one (longest first, so the tightest-fitting words claim
 * space before short ones) in a random direction/position, retrying on
 * overlap conflicts. A word that can't be placed after many attempts is
 * silently dropped — callers should check `puzzle.words` against the
 * input list if they need to warn the admin some words didn't fit
 * (e.g. a very long word in a small grid).
 */
export function generateWordSearch(inputWords: string[], sizeOverride?: number): WordSearchPuzzle {
  const words = Array.from(
    new Set(
      inputWords
        .map((w) => w.trim().toUpperCase().replace(/[^A-Z]/g, ""))
        .filter((w) => w.length >= 2 && w.length <= 15),
    ),
  ).sort((a, b) => b.length - a.length);

  const longest = words.reduce((max, w) => Math.max(max, w.length), 0);
  const totalLetters = words.reduce((sum, w) => sum + w.length, 0);
  const size = sizeOverride ?? Math.max(longest + 1, Math.ceil(Math.sqrt(totalLetters * 3)), 8);

  const grid: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const placed: string[] = [];

  function canPlace(word: string, row: number, col: number, dRow: number, dCol: number): boolean {
    for (let i = 0; i < word.length; i++) {
      const r = row + dRow * i;
      const c = col + dCol * i;
      if (r < 0 || r >= size || c < 0 || c >= size) return false;
      const existing = grid[r]![c];
      if (existing !== null && existing !== word[i]) return false;
    }
    return true;
  }

  function place(word: string, row: number, col: number, dRow: number, dCol: number): void {
    for (let i = 0; i < word.length; i++) {
      grid[row + dRow * i]![col + dCol * i] = word[i]!;
    }
  }

  for (const word of words) {
    let didPlace = false;
    for (let attempt = 0; attempt < 200 && !didPlace; attempt++) {
      const [dRow, dCol] = DIRECTIONS[randomInt(DIRECTIONS.length)]!;
      const row = randomInt(size);
      const col = randomInt(size);
      if (canPlace(word, row, col, dRow, dCol)) {
        place(word, row, col, dRow, dCol);
        didPlace = true;
      }
    }
    if (didPlace) placed.push(word);
  }

  const filledGrid: string[][] = grid.map((row) =>
    row.map((cell) => cell ?? FILLER_ALPHABET[randomInt(FILLER_ALPHABET.length)]!),
  );

  return { size, grid: filledGrid, words: placed };
}

/** Reads the letters in a straight line between two grid positions (inclusive), or null if they don't form a valid straight/diagonal line. */
export function readLine(
  grid: string[][],
  from: { row: number; col: number },
  to: { row: number; col: number },
): string | null {
  const dRowRaw = to.row - from.row;
  const dColRaw = to.col - from.col;
  if (dRowRaw === 0 && dColRaw === 0) return grid[from.row]?.[from.col] ?? null;

  const steps = Math.max(Math.abs(dRowRaw), Math.abs(dColRaw));
  const dRow = Math.sign(dRowRaw);
  const dCol = Math.sign(dColRaw);
  // Must be a straight horizontal/vertical/diagonal line, not an arbitrary knight-ish jump.
  if (dRowRaw !== 0 && dColRaw !== 0 && Math.abs(dRowRaw) !== Math.abs(dColRaw)) return null;

  let result = "";
  for (let i = 0; i <= steps; i++) {
    const r = from.row + dRow * i;
    const c = from.col + dCol * i;
    const letter = grid[r]?.[c];
    if (letter === undefined) return null;
    result += letter;
  }
  return result;
}

/** All cell coordinates on the straight line between two positions (inclusive) — used to highlight a selection. */
export function lineCells(
  from: { row: number; col: number },
  to: { row: number; col: number },
): { row: number; col: number }[] {
  const dRowRaw = to.row - from.row;
  const dColRaw = to.col - from.col;
  if (dRowRaw !== 0 && dColRaw !== 0 && Math.abs(dRowRaw) !== Math.abs(dColRaw)) return [{ ...from }];

  const steps = Math.max(Math.abs(dRowRaw), Math.abs(dColRaw));
  const dRow = Math.sign(dRowRaw);
  const dCol = Math.sign(dColRaw);
  const cells: { row: number; col: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    cells.push({ row: from.row + dRow * i, col: from.col + dCol * i });
  }
  return cells;
}
