/**
 * Housie / Tambola ticket generation + claim validation, and the
 * simpler movie-name bingo variant that reuses the same calling/claim
 * engine (see services/games.ts). Pure functions only — no I/O.
 */

export type HousiePattern = "early_five" | "top_line" | "middle_line" | "bottom_line" | "full_house";

export const HOUSIE_PATTERNS: { id: HousiePattern; label: string }[] = [
  { id: "early_five", label: "Early Five" },
  { id: "top_line", label: "Top Line" },
  { id: "middle_line", label: "Middle Line" },
  { id: "bottom_line", label: "Bottom Line" },
  { id: "full_house", label: "Full House" },
];

export type MoviePattern = "line" | "full_house";

export const MOVIE_PATTERNS: { id: MoviePattern; label: string }[] = [
  { id: "line", label: "Any Line (row, column, or diagonal)" },
  { id: "full_house", label: "Full House" },
];

/** 3 rows x 9 columns; null = blank cell. Exactly 15 numbers, 5 per row, 1-3 per column, standard Tambola column ranges. */
export type HousieTicket = (number | null)[][];

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

const COLUMN_RANGES: [number, number][] = [
  [1, 9],
  [10, 19],
  [20, 29],
  [30, 39],
  [40, 49],
  [50, 59],
  [60, 69],
  [70, 79],
  [80, 90],
];

/**
 * Randomized retry approach: pick column fill-counts (1-3 each,
 * summing to 15), then randomly choose which of the 3 rows are filled
 * in each column, retrying until every row lands on exactly 5 — the
 * search space is small enough that this converges in a handful of
 * attempts almost always.
 */
function generateLayout(): boolean[][] {
  for (let attempt = 0; attempt < 500; attempt++) {
    const colCounts = distributeColumnCounts();
    const layout: boolean[][] = [
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false, false],
    ];
    for (let c = 0; c < 9; c++) {
      const rows = shuffle([0, 1, 2]).slice(0, colCounts[c]);
      for (const r of rows) layout[r]![c] = true;
    }
    const rowSums = layout.map((row) => row.filter(Boolean).length);
    if (rowSums.every((s) => s === 5)) return layout;
  }
  throw new Error("Failed to generate a valid ticket layout — please try again.");
}

function distributeColumnCounts(): number[] {
  const counts = Array(9).fill(1);
  let remaining = 15 - 9;
  while (remaining > 0) {
    const idx = randomInt(9);
    if (counts[idx] < 3) {
      counts[idx]++;
      remaining--;
    }
  }
  return counts;
}

export function generateHousieTicket(): HousieTicket {
  const layout = generateLayout();
  const ticket: HousieTicket = [
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null, null],
  ];

  for (let c = 0; c < 9; c++) {
    const [min, max] = COLUMN_RANGES[c]!;
    const filledRows = [0, 1, 2].filter((r) => layout[r]![c]);
    if (filledRows.length === 0) continue;

    const pool = shuffle(Array.from({ length: max - min + 1 }, (_, i) => min + i)).slice(0, filledRows.length);
    pool.sort((a, b) => a - b);
    filledRows.forEach((r, i) => {
      ticket[r]![c] = pool[i]!;
    });
  }

  return ticket;
}

function ticketNumbers(ticket: HousieTicket): number[] {
  return ticket.flat().filter((n): n is number => n !== null);
}

export function validateHousieClaim(ticket: HousieTicket, calledItems: number[], pattern: HousiePattern): boolean {
  const called = new Set(calledItems);
  switch (pattern) {
    case "early_five":
      return ticketNumbers(ticket).filter((n) => called.has(n)).length >= 5;
    case "top_line":
      return ticket[0]!.filter((n): n is number => n !== null).every((n) => called.has(n));
    case "middle_line":
      return ticket[1]!.filter((n): n is number => n !== null).every((n) => called.has(n));
    case "bottom_line":
      return ticket[2]!.filter((n): n is number => n !== null).every((n) => called.has(n));
    case "full_house":
      return ticketNumbers(ticket).every((n) => called.has(n));
    default:
      return false;
  }
}

/** size x size grid of movie names drawn from the admin's pool — no "free" center, keeps validation simple. */
export type MovieTicket = string[][];

export function generateMovieTicket(pool: string[], size = 5): MovieTicket {
  const needed = size * size;
  if (pool.length < needed) {
    throw new Error(`Need at least ${needed} movie names for a ${size}x${size} card — you gave ${pool.length}.`);
  }
  const picked = shuffle(pool).slice(0, needed);
  const grid: MovieTicket = [];
  for (let r = 0; r < size; r++) {
    grid.push(picked.slice(r * size, r * size + size));
  }
  return grid;
}

export function validateMovieClaim(ticket: MovieTicket, calledItems: string[], pattern: MoviePattern): boolean {
  const called = new Set(calledItems);
  const size = ticket.length;
  const all = ticket.flat();

  if (pattern === "full_house") {
    return all.every((m) => called.has(m));
  }

  // "line": any full row, column, or either diagonal.
  for (let r = 0; r < size; r++) {
    if (ticket[r]!.every((m) => called.has(m))) return true;
  }
  for (let c = 0; c < size; c++) {
    if (ticket.every((row) => called.has(row[c]!))) return true;
  }
  if (ticket.every((row, i) => called.has(row[i]!))) return true;
  if (ticket.every((row, i) => called.has(row[size - 1 - i]!))) return true;
  return false;
}
