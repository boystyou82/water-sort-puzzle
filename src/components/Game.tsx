"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CAPACITY,
  GameState,
  PALETTE,
  generateLevel,
  isSolved,
  pour,
  undo,
} from "@/lib/game";

const STORAGE_KEY = "water-sort-progress-v1";

export default function Game() {
  const [state, setState] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [won, setWon] = useState(false);

  // Load saved level
  useEffect(() => {
    let level = 1;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.level === "number") level = parsed.level;
      }
    } catch {}
    setState(generateLevel(level));
  }, []);

  // Persist level
  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ level: state.level }));
    } catch {}
  }, [state?.level]);

  // Detect win
  useEffect(() => {
    if (state && isSolved(state)) setWon(true);
  }, [state]);

  if (!state) {
    return (
      <main style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <p>Loading…</p>
      </main>
    );
  }

  const handleTubeClick = (idx: number) => {
    if (won) return;
    if (selected === null) {
      if (state.tubes[idx].length === 0) return;
      setSelected(idx);
      return;
    }
    if (selected === idx) {
      setSelected(null);
      return;
    }
    const next = pour(state, selected, idx);
    if (next) {
      setState(next);
      setSelected(null);
    } else {
      // try selecting new source
      if (state.tubes[idx].length > 0) setSelected(idx);
      else setSelected(null);
    }
  };

  const handleUndo = () => {
    const u = undo(state);
    if (u) {
      setState(u);
      setSelected(null);
    }
  };

  const handleReset = () => {
    setState(generateLevel(state.level));
    setSelected(null);
    setWon(false);
  };

  const handleNext = () => {
    setState(generateLevel(state.level + 1));
    setSelected(null);
    setWon(false);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px 16px 40px",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: 16 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            background: "linear-gradient(90deg,#06b6d4,#8b5cf6)",
            WebkitBackgroundClip: "text",
            color: "transparent",
            letterSpacing: 0.5,
          }}
        >
          Water Sort Puzzle
        </h1>
        <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
          Tap a tube to pick water, tap another to pour
        </p>
      </header>

      <div
        style={{
          display: "flex",
          gap: 16,
          fontSize: 14,
          color: "#cbd5e1",
          marginBottom: 16,
        }}
      >
        <Stat label="Level" value={state.level} />
        <Stat label="Moves" value={state.moves} />
        <Stat label="Tubes" value={state.tubes.length} />
      </div>

      <TubesBoard
        tubes={state.tubes}
        capacity={state.capacity}
        selected={selected}
        onTubeClick={handleTubeClick}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap", justifyContent: "center" }}>
        <Button onClick={handleUndo} disabled={state.history.length === 0}>
          ↶ Undo
        </Button>
        <Button onClick={handleReset}>↻ Reset</Button>
        <Button onClick={handleNext} variant="ghost">
          Skip →
        </Button>
      </div>

      {won && (
        <div
          onClick={handleNext}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,0.7)",
            backdropFilter: "blur(6px)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            cursor: "pointer",
          }}
        >
          <div
            style={{
              background: "linear-gradient(180deg,#1e293b,#0f172a)",
              border: "1px solid #334155",
              borderRadius: 20,
              padding: "32px 40px",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 56 }}>🎉</div>
            <h2 style={{ fontSize: 26, marginTop: 8 }}>Level {state.level} Cleared!</h2>
            <p style={{ color: "#94a3b8", marginTop: 6 }}>{state.moves} moves</p>
            <button
              onClick={handleNext}
              style={{
                marginTop: 20,
                padding: "12px 28px",
                fontSize: 16,
                fontWeight: 700,
                color: "white",
                background: "linear-gradient(90deg,#06b6d4,#8b5cf6)",
                border: "none",
                borderRadius: 999,
                cursor: "pointer",
              }}
            >
              Next Level →
            </button>
          </div>
        </div>
      )}

      <footer style={{ marginTop: "auto", paddingTop: 32, fontSize: 12, color: "#64748b" }}>
        Made with ♥ — no signup, no ads, just puzzles
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        background: "rgba(30,41,59,0.6)",
        border: "1px solid #334155",
        borderRadius: 12,
        padding: "6px 14px",
        textAlign: "center",
        minWidth: 70,
      }}
    >
      <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>{value}</div>
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "ghost";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 20px",
        fontSize: 14,
        fontWeight: 600,
        color: "#e2e8f0",
        background:
          variant === "ghost"
            ? "transparent"
            : "linear-gradient(180deg,#334155,#1e293b)",
        border: "1px solid #475569",
        borderRadius: 10,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function TubesBoard({
  tubes,
  capacity,
  selected,
  onTubeClick,
}: {
  tubes: number[][];
  capacity: number;
  selected: number | null;
  onTubeClick: (i: number) => void;
}) {
  // Wrap into rows of max 7 tubes
  const perRow = useMemo(() => (tubes.length <= 7 ? tubes.length : Math.ceil(tubes.length / 2)), [tubes.length]);
  const rows: number[][] = [];
  for (let i = 0; i < tubes.length; i += perRow) {
    rows.push(Array.from({ length: Math.min(perRow, tubes.length - i) }, (_, k) => i + k));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: "flex", gap: 14 }}>
          {row.map((i) => (
            <Tube
              key={i}
              units={tubes[i]}
              capacity={capacity}
              selected={selected === i}
              onClick={() => onTubeClick(i)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Tube({
  units,
  capacity,
  selected,
  onClick,
}: {
  units: number[];
  capacity: number;
  selected: boolean;
  onClick: () => void;
}) {
  const unitH = 36;
  const tubeW = 52;
  const tubeH = unitH * capacity + 8;
  return (
    <button
      onClick={onClick}
      aria-label="tube"
      style={{
        width: tubeW + 8,
        height: tubeH + (selected ? 12 : 0),
        background: "transparent",
        border: "none",
        padding: 0,
        transform: selected ? "translateY(-12px)" : "translateY(0)",
        transition: "transform 180ms ease",
      }}
    >
      <div
        style={{
          width: tubeW,
          height: tubeH,
          margin: "0 auto",
          background: "rgba(148,163,184,0.08)",
          border: "3px solid #cbd5e1",
          borderTop: "none",
          borderRadius: "0 0 26px 26px",
          display: "flex",
          flexDirection: "column-reverse",
          overflow: "hidden",
          position: "relative",
          boxShadow: selected
            ? "0 0 0 3px #06b6d4, 0 10px 30px rgba(6,182,212,0.4)"
            : "inset 0 0 12px rgba(0,0,0,0.4)",
        }}
      >
        {units.map((c, idx) => (
          <div
            key={idx}
            style={{
              height: unitH,
              background: PALETTE[c % PALETTE.length],
              borderTop: idx === units.length - 1 ? "1px solid rgba(255,255,255,0.25)" : "none",
              transition: "all 200ms ease",
            }}
          />
        ))}
      </div>
    </button>
  );
}
