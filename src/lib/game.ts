// Water Sort Puzzle — pure game logic, no DB.

export type Tube = number[]; // bottom -> top, color indices
export type GameState = {
  tubes: Tube[];
  capacity: number;
  level: number;
  moves: number;
  history: Tube[][];
};

// Ghibli-inspired watercolor palette: warm, natural, slightly muted
export const PALETTE: { base: string; light: string; dark: string }[] = [
  { base: "#e88b8b", light: "#f5b8b8", dark: "#b85f5f" }, // 토토로 빨간 우산
  { base: "#e8a878", light: "#f0c8a0", dark: "#b87850" }, // 가을 호박
  { base: "#e8c878", light: "#f0dca0", dark: "#b89850" }, // 노란 들꽃
  { base: "#90c890", light: "#b8e0b8", dark: "#5f9858" }, // 숲 이끼
  { base: "#88c8d8", light: "#b0dde8", dark: "#5898a8" }, // 하늘색 강물
  { base: "#88a8d8", light: "#b0c8e8", dark: "#5878a8" }, // 푸른 하늘
  { base: "#b89cd8", light: "#d4c0e8", dark: "#8870a8" }, // 라벤더 들판
  { base: "#e8a0c0", light: "#f0c0d8", dark: "#b87090" }, // 벚꽃 분홍
  { base: "#78c0b0", light: "#a8d8cc", dark: "#509080" }, // 풀빛 연못
  { base: "#d89878", light: "#e8b8a0", dark: "#a86850" }, // 흙 갈색
  { base: "#c8d878", light: "#dde8a0", dark: "#98a850" }, // 잎새 연두
  { base: "#c8a0d8", light: "#dcc0e8", dark: "#9870a8" }, // 보랏빛 새벽
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

// Find any valid move that makes progress (not pouring into a tube of same single color trivially)
export function findHint(state: GameState): [number, number] | null {
  const n = state.tubes.length;
  // Prefer moves that empty a source or complete a destination
  const candidates: { from: number; to: number; score: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (!canPour(state.tubes[i], state.tubes[j], state.capacity)) continue;
      const from = state.tubes[i];
      const to = state.tubes[j];
      // skip useless: pouring full single-color tube into empty
      if (
        to.length === 0 &&
        topRunSize(from) === from.length &&
        from.length === state.capacity
      )
        continue;
      let score = 0;
      const movable = Math.min(topRunSize(from), state.capacity - to.length);
      if (movable === topRunSize(from)) score += 2; // empties the run
      if (to.length + movable === state.capacity) score += 3; // completes
      if (to.length === 0) score -= 1;
      candidates.push({ from: i, to: j, score });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return [candidates[0].from, candidates[0].to];
}

// Add an empty tube (power-up)
export function addEmptyTube(state: GameState): GameState {
  return {
    ...state,
    tubes: [...state.tubes.map((t) => t.slice()), []],
    history: [...state.history, state.tubes.map((t) => t.slice())],
  };
}

// Star rating based on moves vs theoretical minimum
export function starsFor(state: GameState): number {
  const colors = state.tubes.filter((t) => t.length > 0).length;
  const par = colors * 2;
  if (state.moves <= par) return 3;
  if (state.moves <= par * 1.6) return 2;
  return 1;
}

// Daily challenge: deterministic seed from today's date (YYYY-MM-DD)
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dailySeed(key: string = todayKey()): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generateDaily(date: Date = new Date()): GameState {
  // Daily fixed at level 6 difficulty for fairness
  const seed = dailySeed(todayKey(date));
  const state = generateLevel(6, seed);
  return { ...state, level: 0 }; // level 0 = daily marker
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
