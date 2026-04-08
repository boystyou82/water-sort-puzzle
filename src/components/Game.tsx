"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PALETTE,
  GameState,
  addEmptyTube,
  findHint,
  generateDaily,
  generateLevel,
  isSolved,
  pour,
  starsFor,
  todayKey,
  undo,
} from "@/lib/game";
import { sounds, setMuted as setSoundMuted } from "@/lib/sound";

const STORAGE_KEY = "water-sort-save-v3";

type Mode = "endless" | "daily";

type Save = {
  level: number;
  coins: number;
  stars: Record<number, number>;
  muted: boolean;
  daily: { date: string; completed: boolean };
};

const HINT_COST = 20;
const TUBE_COST = 50;
const REWARD_BASE = 30;
const DAILY_REWARD = 100;

const defaultSave: Save = {
  level: 1,
  coins: 100,
  stars: {},
  muted: false,
  daily: { date: "", completed: false },
};

export default function Game() {
  const [mode, setMode] = useState<Mode>("endless");
  const [state, setState] = useState<GameState | null>(null);
  const [save, setSave] = useState<Save>(defaultSave);
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [won, setWon] = useState(false);
  const [confetti, setConfetti] = useState<number[]>([]);
  const [shake, setShake] = useState<number | null>(null);
  const [coinBump, setCoinBump] = useState(false);
  const [enteringIdx, setEnteringIdx] = useState<{ tube: number; layer: number } | null>(null);
  const [popText, setPopText] = useState<{ text: string; x: number; y: number; id: number } | null>(null);
  const popId = useRef(0);
  const loaded = useRef(false);

  // Load save
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const s: Save = {
          ...defaultSave,
          ...parsed,
          daily: { ...defaultSave.daily, ...(parsed.daily ?? {}) },
        };
        // Reset daily if new day
        const today = todayKey();
        if (s.daily.date !== today) {
          s.daily = { date: today, completed: false };
        }
        setSave(s);
        setSoundMuted(s.muted);
        setState(generateLevel(s.level));
      } else {
        const s = { ...defaultSave, daily: { date: todayKey(), completed: false } };
        setSave(s);
        setState(generateLevel(1));
      }
    } catch {
      setState(generateLevel(1));
    }
    loaded.current = true;
  }, []);

  // Persist save
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
      setWon(true);
      sounds.win();
      setConfetti(Array.from({ length: 80 }, (_, i) => i));

      if (mode === "daily") {
        if (!save.daily.completed) {
          setSave((s) => ({
            ...s,
            coins: s.coins + DAILY_REWARD,
            daily: { date: todayKey(), completed: true },
          }));
          setCoinBump(true);
          setTimeout(() => setCoinBump(false), 600);
        }
      } else {
        const reward = REWARD_BASE + earned * 10;
        const prev = save.stars[state.level] ?? 0;
        const bestStars = Math.max(prev, earned);
        setSave((s) => ({
          ...s,
          coins: s.coins + reward,
          stars: { ...s.stars, [state.level]: bestStars },
        }));
        setCoinBump(true);
        setTimeout(() => setCoinBump(false), 600);
      }
    }
  }, [state, won, mode]);

  // Auto-clear hint
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

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    sounds.button();
    setMode(m);
    setSelected(null);
    setHint(null);
    setWon(false);
    setConfetti([]);
    if (m === "daily") {
      setState(generateDaily());
    } else {
      setState(generateLevel(save.level));
    }
  };

  const showPop = (text: string, e: React.MouseEvent | { clientX?: number; clientY?: number }) => {
    const x = "clientX" in e && e.clientX ? e.clientX : window.innerWidth / 2;
    const y = "clientY" in e && e.clientY ? e.clientY : window.innerHeight / 2;
    const id = ++popId.current;
    setPopText({ text, x, y, id });
    setTimeout(() => setPopText((p) => (p?.id === id ? null : p)), 800);
  };

  const handleTubeClick = (idx: number, e?: React.MouseEvent) => {
    if (won) return;
    setHint(null);
    if (selected === null) {
      if (state.tubes[idx].length === 0) return;
      setSelected(idx);
      sounds.select();
      return;
    }
    if (selected === idx) {
      setSelected(null);
      sounds.deselect();
      return;
    }
    const next = pour(state, selected, idx);
    if (next) {
      sounds.pour();
      if (e) showPop("POP!", e);
      setEnteringIdx({ tube: idx, layer: next.tubes[idx].length - 1 });
      setState(next);
      setSelected(null);
      setTimeout(() => setEnteringIdx(null), 450);
    } else {
      sounds.invalid();
      if (e) showPop("NOPE!", e);
      setShake(idx);
      setTimeout(() => setShake(null), 350);
      if (state.tubes[idx].length > 0) {
        setSelected(idx);
        sounds.select();
      } else setSelected(null);
    }
  };

  const handleUndo = () => {
    sounds.button();
    const u = undo(state);
    if (u) {
      setState(u);
      setSelected(null);
    }
  };

  const handleReset = () => {
    sounds.button();
    setState(mode === "daily" ? generateDaily() : generateLevel(state.level));
    setSelected(null);
    setHint(null);
    setWon(false);
    setConfetti([]);
  };

  const handleNext = () => {
    sounds.button();
    if (mode === "daily") {
      // After daily completion, switch back to endless
      switchMode("endless");
      return;
    }
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
      sounds.hint();
      setHint(h);
      setSave((s) => ({ ...s, coins: s.coins - HINT_COST }));
    }
  };

  const handleAddTube = () => {
    if (save.coins < TUBE_COST) return;
    sounds.coin();
    setState(addEmptyTube(state));
    setSave((s) => ({ ...s, coins: s.coins - TUBE_COST }));
  };

  const toggleMute = () => {
    const m = !save.muted;
    setSave((s) => ({ ...s, muted: m }));
    setSoundMuted(m);
    if (!m) sounds.button();
  };

  const currentStars = mode === "endless" ? save.stars[state.level] ?? 0 : 0;
  const titleText = "Water Sort";

  return (
    <>
      <div className="sun" />
      <Clouds />
      <Leaves />
      <DustSprites />
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
            marginBottom: 14,
            gap: 8,
          }}
        >
          <div className="pill">
            <span style={{ fontSize: 18 }}>{mode === "daily" ? "📅" : "🏆"}</span>
            <span>{mode === "daily" ? "Daily" : `Lv ${state.level}`}</span>
          </div>
          {mode === "endless" && (
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 22,
                    filter: i <= currentStars ? "drop-shadow(0 0 6px gold)" : "grayscale(1) opacity(0.3)",
                  }}
                >
                  ⭐
                </span>
              ))}
            </div>
          )}
          {mode === "daily" && save.daily.completed && (
            <div className="pill" style={{ background: "rgba(167,250,200,0.7)", color: "#0a7a4a" }}>
              ✓ Done today
            </div>
          )}
          <div className={`pill ${coinBump ? "bump" : ""}`}>
            <span style={{ fontSize: 18 }}>🪙</span>
            <span>{save.coins}</span>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="mode-toggle" style={{ marginBottom: 12 }}>
          <button className={mode === "endless" ? "active" : ""} onClick={() => switchMode("endless")}>
            ∞ Endless
          </button>
          <button className={mode === "daily" ? "active" : ""} onClick={() => switchMode("daily")}>
            📅 Daily
          </button>
        </div>

        {/* Title */}
        <h1 className="title-glow" style={{ fontSize: 32, marginBottom: 4 }}>
          {titleText.split("").map((ch, i) => (
            <span key={i} style={{ animationDelay: `${i * 80}ms` }}>
              {ch === " " ? "\u00A0" : ch}
            </span>
          ))}
        </h1>
        <p style={{ fontSize: 12, color: "#8b6dc4", marginBottom: 22, fontWeight: 600 }}>
          {state.moves} moves
        </p>

        {/* Board */}
        <TubesBoard
          tubes={state.tubes}
          capacity={state.capacity}
          selected={selected}
          hint={hint}
          shake={shake}
          enteringIdx={enteringIdx}
          onTubeClick={(i, ev) => handleTubeClick(i, ev)}
        />

        {popText && (
          <div
            key={popText.id}
            className="pop-text"
            style={{ left: popText.x, top: popText.y }}
          >
            {popText.text}
          </div>
        )}

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
          <button className="clay-btn amber" onClick={handleHint} disabled={save.coins < HINT_COST}>
            💡 Hint
            <span style={{ fontSize: 11, opacity: 0.85 }}>-{HINT_COST}🪙</span>
          </button>
          <button className="clay-btn teal" onClick={handleAddTube} disabled={save.coins < TUBE_COST}>
            ➕ Tube
            <span style={{ fontSize: 11, opacity: 0.85 }}>-{TUBE_COST}🪙</span>
          </button>
          <button className="clay-btn rose" onClick={handleReset}>
            ↻ Reset
          </button>
        </div>

        {/* Mute */}
        <button
          className="mute-btn"
          onClick={toggleMute}
          aria-label="toggle sound"
          style={{ position: "fixed", right: 16, bottom: 16, zIndex: 50 }}
        >
          {save.muted ? "🔇" : "🔊"}
        </button>

        <p style={{ marginTop: 22, fontSize: 11, color: "#8b6dc4", fontWeight: 600 }}>
          Tap a tube to pick water · tap another to pour
        </p>
      </main>

      {confetti.length > 0 && <Confetti pieces={confetti} />}
      {won && <div className="action-burst" />}

      {won && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(255,240,250,0.6)",
            backdropFilter: "blur(10px)",
            display: "grid",
            placeItems: "center",
            zIndex: 200,
            padding: 20,
          }}
        >
          <div className="modal-card">
            <div style={{ fontSize: 64, lineHeight: 1 }}>🎉</div>
            <h2 style={{ fontSize: 26, marginTop: 12, fontWeight: 700, color: "#5b3fa3" }}>
              {mode === "daily" ? "Daily Cleared!" : `Level ${state.level} Cleared!`}
            </h2>
            {mode === "endless" && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="star-pop"
                    style={{
                      fontSize: 40,
                      filter:
                        i <= starsFor(state)
                          ? "drop-shadow(0 0 10px gold)"
                          : "grayscale(1) opacity(0.3)",
                      animationDelay: `${i * 180}ms`,
                    }}
                  >
                    ⭐
                  </span>
                ))}
              </div>
            )}
            <p style={{ color: "#8b6dc4", marginTop: 14, fontSize: 14, fontWeight: 600 }}>
              {state.moves} moves · +
              {mode === "daily" ? DAILY_REWARD : REWARD_BASE + starsFor(state) * 10} 🪙
            </p>
            <button
              className="clay-btn"
              onClick={handleNext}
              style={{ marginTop: 22, fontSize: 17, padding: "16px 36px" }}
            >
              {mode === "daily" ? "Back to Endless →" : "Next Level →"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Clouds() {
  const clouds = useMemo(
    () =>
      Array.from({ length: 6 }, () => ({
        width: 120 + Math.random() * 120,
        height: 40 + Math.random() * 30,
        top: 5 + Math.random() * 55,
        duration: 60 + Math.random() * 50,
        delay: -Math.random() * 80,
      })),
    []
  );
  return (
    <div className="clouds">
      {clouds.map((c, i) => (
        <div
          key={i}
          className="cloud"
          style={{
            width: c.width,
            height: c.height,
            top: `${c.top}%`,
            animationDuration: `${c.duration}s`,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function Leaves() {
  const leaves = useMemo(
    () =>
      Array.from({ length: 10 }, () => ({
        left: Math.random() * 100,
        duration: 12 + Math.random() * 14,
        delay: -Math.random() * 25,
        emoji: ["🍃", "🍂", "🌿"][Math.floor(Math.random() * 3)],
        size: 18 + Math.random() * 14,
      })),
    []
  );
  return (
    <>
      {leaves.map((l, i) => (
        <span
          key={i}
          className="leaf"
          style={{
            left: `${l.left}%`,
            animationDuration: `${l.duration}s`,
            animationDelay: `${l.delay}s`,
            fontSize: l.size,
          }}
        >
          {l.emoji}
        </span>
      ))}
    </>
  );
}

function DustSprites() {
  // Studio Ghibli's susuwatari-inspired floating dust motes
  const dust = useMemo(
    () =>
      Array.from({ length: 18 }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        duration: 6 + Math.random() * 8,
        delay: -Math.random() * 10,
        size: 4 + Math.random() * 6,
      })),
    []
  );
  return (
    <>
      {dust.map((d, i) => (
        <span
          key={i}
          className="dust"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size,
            animationDuration: `${d.duration}s`,
            animationDelay: `${d.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function Confetti({ pieces }: { pieces: number[] }) {
  const colors = ["#ff9eb5", "#c9a8ff", "#9eecf0", "#ffe687", "#a8e6a3", "#ffb3d9"];
  return (
    <>
      {pieces.map((i) => {
        const left = Math.random() * 100;
        const dur = 2.5 + Math.random() * 2;
        const delay = Math.random() * 0.5;
        const color = colors[i % colors.length];
        const size = 8 + Math.random() * 12;
        return (
          <div
            key={i}
            className="confetti-piece"
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              background: color,
              borderRadius: i % 3 === 0 ? "50%" : "3px",
              animationDuration: `${dur}s`,
              animationDelay: `${delay}s`,
              boxShadow: `0 0 8px ${color}`,
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
  enteringIdx,
  onTubeClick,
}: {
  tubes: number[][];
  capacity: number;
  selected: number | null;
  hint: [number, number] | null;
  shake: number | null;
  enteringIdx: { tube: number; layer: number } | null;
  onTubeClick: (i: number, e: React.MouseEvent) => void;
}) {
  const perRow = tubes.length <= 7 ? tubes.length : Math.ceil(tubes.length / 2);
  const rows: number[][] = [];
  for (let i = 0; i < tubes.length; i += perRow) {
    rows.push(Array.from({ length: Math.min(perRow, tubes.length - i) }, (_, k) => i + k));
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "center" }}>
      {rows.map((row, ri) => (
        <div
          key={ri}
          style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}
        >
          {row.map((i) => (
            <Tube
              key={i}
              index={i}
              units={tubes[i]}
              capacity={capacity}
              selected={selected === i}
              hint={hint?.[0] === i || hint?.[1] === i}
              shake={shake === i}
              enteringLayer={enteringIdx?.tube === i ? enteringIdx.layer : -1}
              onClick={(e) => onTubeClick(i, e)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Tube({
  index,
  units,
  capacity,
  selected,
  hint,
  shake,
  enteringLayer,
  onClick,
}: {
  index: number;
  units: number[];
  capacity: number;
  selected: boolean;
  hint: boolean;
  shake: boolean;
  enteringLayer: number;
  onClick: (e: React.MouseEvent) => void;
}) {
  const unitH = 40;
  const tubeW = 58;
  const tubeH = unitH * capacity + 10;
  return (
    <button
      onClick={onClick}
      aria-label="tube"
      className={`tube-wrap ${selected ? "selected" : ""} ${hint ? "hint" : ""} ${shake ? "shake" : ""}`}
      style={{
        width: tubeW + 8,
        height: tubeH + 22,
        background: "transparent",
        border: "none",
        padding: 0,
        animationDelay: `${index * 0.15}s`,
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
        <div className="tube-eyes">
          <span className="eye" />
          <span className="eye" />
        </div>
        <div className="tube-mouth" />
        {units.map((c, idx) => {
          const color = PALETTE[c % PALETTE.length];
          const isTop = idx === units.length - 1;
          const isEntering = idx === enteringLayer;
          return (
            <div
              key={idx}
              className={`water-layer ${isEntering ? "water-enter" : ""}`}
              style={{
                height: unitH,
                background: `linear-gradient(180deg, ${color.light} 0%, ${color.base} 50%, ${color.dark} 100%)`,
              }}
            >
              {isTop && <WaveSurface color={color} delay={index * 0.3} />}
            </div>
          );
        })}
      </div>
    </button>
  );
}

function WaveSurface({
  color,
  delay,
}: {
  color: { base: string; light: string; dark: string };
  delay: number;
}) {
  // Animated SVG wave on top of water surface
  return (
    <svg className="wave-svg" viewBox="0 0 100 12" preserveAspectRatio="none">
      <path fill={color.light} opacity="0.9">
        <animate
          attributeName="d"
          dur="3.5s"
          repeatCount="indefinite"
          begin={`${delay}s`}
          values="
            M0,6 Q15,2 30,6 T60,6 T100,6 L100,12 L0,12 Z;
            M0,6 Q15,10 30,6 T60,6 T100,6 L100,12 L0,12 Z;
            M0,6 Q15,2 30,6 T60,6 T100,6 L100,12 L0,12 Z
          "
        />
      </path>
      <path fill={color.base} opacity="0.6">
        <animate
          attributeName="d"
          dur="2.8s"
          repeatCount="indefinite"
          begin={`${delay + 0.4}s`}
          values="
            M0,8 Q20,4 40,8 T80,8 T100,8 L100,12 L0,12 Z;
            M0,8 Q20,12 40,8 T80,8 T100,8 L100,12 L0,12 Z;
            M0,8 Q20,4 40,8 T80,8 T100,8 L100,12 L0,12 Z
          "
        />
      </path>
    </svg>
  );
}
