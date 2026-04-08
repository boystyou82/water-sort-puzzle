"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PALETTE,
  GameState,
  addEmptyTube,
  findHint,
  generateLevel,
  isSolved,
  pour,
  starsFor,
  undo,
} from "@/lib/game";

const STORAGE_KEY = "water-sort-save-v2";

type Save = { level: number; coins: number; stars: Record<number, number> };

const HINT_COST = 20;
const TUBE_COST = 50;
const REWARD_BASE = 30;

export default function Game() {
  const [state, setState] = useState<GameState | null>(null);
  const [save, setSave] = useState<Save>({ level: 1, coins: 100, stars: {} });
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [won, setWon] = useState(false);
  const [confetti, setConfetti] = useState<number[]>([]);
  const [shake, setShake] = useState<number | null>(null);
  const loaded = useRef(false);

  // Load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const s: Save = {
          level: parsed.level ?? 1,
          coins: parsed.coins ?? 100,
          stars: parsed.stars ?? {},
        };
        setSave(s);
        setState(generateLevel(s.level));
      } else {
        setState(generateLevel(1));
      }
    } catch {
      setState(generateLevel(1));
    }
    loaded.current = true;
  }, []);

  // Persist
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch {}
  }, [save]);

  // Win detection
  useEffect(() => {
    if (state && !won && isSolved(state)) {
      const earned = starsFor(state);
      const prev = save.stars[state.level] ?? 0;
      const bestStars = Math.max(prev, earned);
      const reward = REWARD_BASE + earned * 10;
      setWon(true);
      setSave((s) => ({
        ...s,
        coins: s.coins + reward,
        stars: { ...s.stars, [state.level]: bestStars },
      }));
      // confetti pieces
      setConfetti(Array.from({ length: 60 }, (_, i) => i));
    }
  }, [state, won]);

  // Auto-clear hint after a few seconds
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 3000);
    return () => clearTimeout(t);
  }, [hint]);

  if (!state) {
    return (
      <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <p>Loading…</p>
      </main>
    );
  }

  const handleTubeClick = (idx: number) => {
    if (won) return;
    setHint(null);
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
      setShake(idx);
      setTimeout(() => setShake(null), 300);
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
    setHint(null);
    setWon(false);
    setConfetti([]);
  };

  const handleNext = () => {
    const newLevel = state.level + 1;
    setState(generateLevel(newLevel));
    setSave((s) => ({ ...s, level: newLevel }));
    setSelected(null);
    setHint(null);
    setWon(false);
    setConfetti([]);
  };

  const handleHint = () => {
    if (save.coins < HINT_COST) return;
    const h = findHint(state);
    if (h) {
      setHint(h);
      setSave((s) => ({ ...s, coins: s.coins - HINT_COST }));
    }
  };

  const handleAddTube = () => {
    if (save.coins < TUBE_COST) return;
    setState(addEmptyTube(state));
    setSave((s) => ({ ...s, coins: s.coins - TUBE_COST }));
  };

  const currentStars = save.stars[state.level] ?? 0;

  return (
    <>
      <Bubbles />
      <main
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px 12px 32px",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            width: "100%",
            maxWidth: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            gap: 8,
          }}
        >
          <div className="pill">
            <span style={{ fontSize: 18 }}>🏆</span>
            <span>Lv {state.level}</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3].map((i) => (
              <span key={i} style={{ fontSize: 22, filter: i <= currentStars ? "none" : "grayscale(1) opacity(0.3)" }}>
                ⭐
              </span>
            ))}
          </div>
          <div className="pill">
            <span style={{ fontSize: 18 }}>🪙</span>
            <span>{save.coins}</span>
          </div>
        </div>

        {/* Title */}
        <h1
          className="title-glow"
          style={{ fontSize: 32, marginBottom: 4, letterSpacing: 0.5 }}
        >
          Water Sort
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
          {state.moves} moves
        </p>

        {/* Board */}
        <TubesBoard
          tubes={state.tubes}
          capacity={state.capacity}
          selected={selected}
          hint={hint}
          shake={shake}
          onTubeClick={handleTubeClick}
        />

        {/* Controls */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 32,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button className="clay-btn" onClick={handleUndo} disabled={state.history.length === 0}>
            ↶ Undo
          </button>
          <button
            className="clay-btn amber"
            onClick={handleHint}
            disabled={save.coins < HINT_COST}
          >
            💡 Hint
            <span style={{ fontSize: 11, opacity: 0.85 }}>-{HINT_COST}🪙</span>
          </button>
          <button
            className="clay-btn teal"
            onClick={handleAddTube}
            disabled={save.coins < TUBE_COST}
          >
            ➕ Tube
            <span style={{ fontSize: 11, opacity: 0.85 }}>-{TUBE_COST}🪙</span>
          </button>
          <button className="clay-btn rose" onClick={handleReset}>
            ↻ Reset
          </button>
        </div>

        <p style={{ marginTop: 24, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          Tap a tube to pick water · tap another to pour
        </p>
      </main>

      {confetti.length > 0 && <Confetti pieces={confetti} />}

      {won && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5,5,25,0.7)",
            backdropFilter: "blur(10px)",
            display: "grid",
            placeItems: "center",
            zIndex: 200,
          }}
        >
          <div className="modal-card">
            <div style={{ fontSize: 64, lineHeight: 1 }}>🎉</div>
            <h2 style={{ fontSize: 28, marginTop: 12, fontWeight: 700 }}>
              Level {state.level} Cleared!
            </h2>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 36,
                    filter: i <= starsFor(state) ? "none" : "grayscale(1) opacity(0.3)",
                    animation: `pop-in 400ms ${i * 150}ms backwards`,
                    display: "inline-block",
                  }}
                >
                  ⭐
                </span>
              ))}
            </div>
            <p style={{ color: "#a5b4fc", marginTop: 12, fontSize: 14 }}>
              {state.moves} moves · +{REWARD_BASE + starsFor(state) * 10} 🪙
            </p>
            <button
              className="clay-btn"
              onClick={handleNext}
              style={{ marginTop: 22, fontSize: 17, padding: "16px 36px" }}
            >
              Next Level →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Bubbles() {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        size: 20 + Math.random() * 60,
        left: Math.random() * 100,
        duration: 12 + Math.random() * 18,
        delay: -Math.random() * 20,
      })),
    []
  );
  return (
    <div className="bubbles">
      {bubbles.map((b, i) => (
        <div
          key={i}
          className="bubble"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.left}%`,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function Confetti({ pieces }: { pieces: number[] }) {
  const colors = ["#5eead4", "#a78bfa", "#f472b6", "#fbbf24", "#60a5fa", "#34d399"];
  return (
    <>
      {pieces.map((i) => {
        const left = Math.random() * 100;
        const dur = 2 + Math.random() * 2;
        const delay = Math.random() * 0.5;
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 10;
        return (
          <div
            key={i}
            className="confetti-piece"
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              background: color,
              borderRadius: i % 3 === 0 ? "50%" : "2px",
              animationDuration: `${dur}s`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </>
  );
}

function TubesBoard({
  tubes,
  capacity,
  selected,
  hint,
  shake,
  onTubeClick,
}: {
  tubes: number[][];
  capacity: number;
  selected: number | null;
  hint: [number, number] | null;
  shake: number | null;
  onTubeClick: (i: number) => void;
}) {
  const perRow = tubes.length <= 7 ? tubes.length : Math.ceil(tubes.length / 2);
  const rows: number[][] = [];
  for (let i = 0; i < tubes.length; i += perRow) {
    rows.push(Array.from({ length: Math.min(perRow, tubes.length - i) }, (_, k) => i + k));
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "center" }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          {row.map((i) => (
            <Tube
              key={i}
              units={tubes[i]}
              capacity={capacity}
              selected={selected === i}
              hint={hint?.[0] === i || hint?.[1] === i}
              shake={shake === i}
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
  hint,
  shake,
  onClick,
}: {
  units: number[];
  capacity: number;
  selected: boolean;
  hint: boolean;
  shake: boolean;
  onClick: () => void;
}) {
  const unitH = 38;
  const tubeW = 56;
  const tubeH = unitH * capacity + 10;
  return (
    <button
      onClick={onClick}
      aria-label="tube"
      className={`tube-wrap ${selected ? "selected" : ""} ${hint ? "hint" : ""}`}
      style={{
        width: tubeW + 8,
        height: tubeH + 22,
        background: "transparent",
        border: "none",
        padding: 0,
        animation: shake ? "shake 300ms" : undefined,
      }}
    >
      <div
        className={`tube ${selected ? "selected" : ""}`}
        style={{
          width: tubeW,
          height: tubeH,
          margin: "10px auto 0",
          display: "flex",
          flexDirection: "column-reverse",
        }}
      >
        {units.map((c, idx) => {
          const color = PALETTE[c % PALETTE.length];
          const isTop = idx === units.length - 1;
          return (
            <div
              key={idx}
              className={`water-layer ${isTop ? "top" : ""}`}
              style={{
                height: unitH,
                background: `linear-gradient(180deg, ${color.light} 0%, ${color.base} 50%, ${color.dark} 100%)`,
              }}
            />
          );
        })}
      </div>
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
      `}</style>
    </button>
  );
}
