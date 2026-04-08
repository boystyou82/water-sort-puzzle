// Water Sort Puzzle — pure game logic, no DB.

export type Tube = number[]; // bottom -> top, color indices
export type GameState = {
  tubes: Tube[];
  capacity: number;
  level: number;
  moves: number;
  history: Tube[][];
};

export const PALETTE = [
  "#ef4444", // red
  "#f59e0b", // amber
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#a3e635", // lime
  "#e879f9", // fuchsia
];

export const CAPACITY = 4;

// Level config: number of color tubes + 2 empty tubes
export function levelConfig(level: number): { colors: number; empties: number } {
  // Ramp difficulty 4 → 12 colors, then loop with more empties
  const colors = Math.min(4 + Math.floor((level - 1) / 2), 12);
  const empties = level >= 10 ? 1 : 2;
  return { colors, empties };
}

// Generate a solvable puzzle by starting from solved state and doing valid reverse moves.
// Simple approach: create solved tubes, then shuffle by repeatedly swapping random top units.
export function generateLevel(level: number, seed?: number): GameState {
  const { colors, empties } = levelConfig(level);
  const rng = mulberry32(seed ?? (level * 9301 + 49297));

  // Start solved: each color tube full of one color
  const tubes: Tube[] = [];
  for (let c = 0; c < colors; c++) {
    tubes.push(Array(CAPACITY).fill(c));
  }
  for (let e = 0; e < empties; e++) tubes.push([]);

  // Shuffle: collect all units, distribute randomly into tubes of capacity 4
  const all: number[] = [];
  for (let c = 0; c < colors; c++) for (let i = 0; i < CAPACITY; i++) all.push(c);
  // Fisher-Yates
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const newTubes: Tube[] = tubes.map(() => []);
  let idx = 0;
  for (let t = 0; t < colors; t++) {
    for (let i = 0; i < CAPACITY; i++) {
      newTubes[t].push(all[idx++]);
    }
  }
  // Empty tubes stay empty
  // If accidentally already solved, retry with different seed
  if (isSolved({ tubes: newTubes, capacity: CAPACITY, level, moves: 0, history: [] })) {
    return generateLevel(level, (seed ?? 0) + 1);
  }

  return { tubes: newTubes, capacity: CAPACITY, level, moves: 0, history: [] };
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function topColor(tube: Tube): number | null {
  return tube.length === 0 ? null : tube[tube.length - 1];
}

export function topRunSize(tube: Tube): number {
  if (tube.length === 0) return 0;
  const c = tube[tube.length - 1];
  let n = 0;
  for (let i = tube.length - 1; i >= 0; i--) {
    if (tube[i] === c) n++;
    else break;
  }
  return n;
}

export function canPour(from: Tube, to: Tube, capacity: number): boolean {
  if (from.length === 0) return false;
  if (to.length >= capacity) return false;
  if (to.length === 0) return true;
  return topColor(from) === topColor(to);
}

export function pour(state: GameState, fromIdx: number, toIdx: number): GameState | null {
  if (fromIdx === toIdx) return null;
  const from = state.tubes[fromIdx];
  const to = state.tubes[toIdx];
  if (!canPour(from, to, state.capacity)) return null;

  const color = topColor(from)!;
  const space = state.capacity - to.length;
  const movable = Math.min(topRunSize(from), space);
  if (movable === 0) return null;

  const newTubes = state.tubes.map((t) => t.slice());
  for (let i = 0; i < movable; i++) {
    newTubes[fromIdx].pop();
    newTubes[toIdx].push(color);
  }

  return {
    ...state,
    tubes: newTubes,
    moves: state.moves + 1,
    history: [...state.history, state.tubes.map((t) => t.slice())],
  };
}

export function undo(state: GameState): GameState | null {
  if (state.history.length === 0) return null;
  const prev = state.history[state.history.length - 1];
  return {
    ...state,
    tubes: prev.map((t) => t.slice()),
    moves: Math.max(0, state.moves - 1),
    history: state.history.slice(0, -1),
  };
}

export function isSolved(state: GameState): boolean {
  for (const t of state.tubes) {
    if (t.length === 0) continue;
    if (t.length !== state.capacity) return false;
    const c = t[0];
    for (const x of t) if (x !== c) return false;
  }
  return true;
}
