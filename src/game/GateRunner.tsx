import { useCallback, useEffect, useRef, useState } from 'react';
import { FIDEL_FAMILIES, VOWEL_ORDERS } from '../data/geezAlphabet';
import { audioEngine } from '../audio/AudioEngine';
import './GateRunner.css';

const CANVAS_W = 800;
const CANVAS_H = 500;
const LANE_COUNT = 3;
const LANE_WIDTH = 160;
const LANES_START_X = (CANVAS_W - LANE_COUNT * LANE_WIDTH) / 2;
const PLAYER_Y = CANVAS_H - 80;
const PLAYER_SIZE = 36;
const GATE_HEIGHT = 56;
const GATE_SPAWN_Y = -60;

interface Gate {
  id: number;
  lane: number;
  y: number;
  char: string;
  familyIndex: number;
  vowelOrder: number;
  correct: boolean;
}

interface GameState {
  phase: 'menu' | 'playing' | 'hit' | 'gameOver';
  playerLane: number;
  gates: Gate[];
  score: number;
  streak: number;
  bestStreak: number;
  speed: number;
  level: number;
  // Current target
  targetChar: string;
  targetFamilyIndex: number;
  targetVowelOrder: number;
  // Game config
  activeFamilyCount: number;
  gatesCorrect: number;
  gatesTotal: number;
}

let gateId = 0;

function pickTarget(familyCount: number): { char: string; familyIndex: number; vowelOrder: number } {
  const fi = Math.floor(Math.random() * Math.min(familyCount, FIDEL_FAMILIES.length));
  const vo = Math.floor(Math.random() * 7);
  return { char: FIDEL_FAMILIES[fi].chars[vo], familyIndex: fi, vowelOrder: vo };
}

function spawnGateSet(target: { familyIndex: number; vowelOrder: number; char: string }, familyCount: number): Gate[] {
  // One gate per lane, one is correct
  const correctLane = Math.floor(Math.random() * LANE_COUNT);
  const gates: Gate[] = [];
  const usedChars = new Set<string>();

  for (let lane = 0; lane < LANE_COUNT; lane++) {
    if (lane === correctLane) {
      gates.push({
        id: ++gateId,
        lane,
        y: GATE_SPAWN_Y,
        char: target.char,
        familyIndex: target.familyIndex,
        vowelOrder: target.vowelOrder,
        correct: true,
      });
      usedChars.add(target.char);
    } else {
      // Pick a wrong character
      let fi: number, vo: number, char: string;
      do {
        fi = Math.floor(Math.random() * Math.min(familyCount, FIDEL_FAMILIES.length));
        vo = Math.floor(Math.random() * 7);
        char = FIDEL_FAMILIES[fi].chars[vo];
      } while (usedChars.has(char) || (fi === target.familyIndex && vo === target.vowelOrder));
      usedChars.add(char);

      gates.push({
        id: ++gateId,
        lane,
        y: GATE_SPAWN_Y,
        char,
        familyIndex: fi,
        vowelOrder: vo,
        correct: false,
      });
    }
  }

  return gates;
}

export function GateRunner() {
  const [state, setState] = useState<GameState>({
    phase: 'menu',
    playerLane: 1,
    gates: [],
    score: 0,
    streak: 0,
    bestStreak: 0,
    speed: 2.5,
    level: 1,
    targetChar: '',
    targetFamilyIndex: 0,
    targetVowelOrder: 0,
    activeFamilyCount: 8,
    gatesCorrect: 0,
    gatesTotal: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const nextGateTimerRef = useRef<number>(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  const startGame = useCallback(() => {
    const target = pickTarget(8);
    const gates = spawnGateSet(target, 8);
    setState({
      phase: 'playing',
      playerLane: 1,
      gates,
      score: 0,
      streak: 0,
      bestStreak: 0,
      speed: 2.5,
      level: 1,
      targetChar: target.char,
      targetFamilyIndex: target.familyIndex,
      targetVowelOrder: target.vowelOrder,
      activeFamilyCount: 8,
      gatesCorrect: 0,
      gatesTotal: 0,
    });
    setTimeout(() => audioEngine.play(target.char, ''), 300);
  }, []);

  // Keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.phase !== 'playing') return;

      if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault();
        setState(p => ({ ...p, playerLane: Math.max(0, p.playerLane - 1) }));
      }
      if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault();
        setState(p => ({ ...p, playerLane: Math.min(LANE_COUNT - 1, p.playerLane + 1) }));
      }
      if (e.key === 'r' || e.key === 'R') {
        audioEngine.play(stateRef.current.targetChar, '');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Game loop
  useEffect(() => {
    if (state.phase !== 'playing') {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      setState(prev => {
        if (prev.phase !== 'playing') return prev;

        let { gates, score, streak, bestStreak, speed, level, activeFamilyCount,
              targetChar, targetFamilyIndex, targetVowelOrder, gatesCorrect, gatesTotal } = prev;
        const playerLane = prev.playerLane;

        // Move gates down
        gates = gates.map(g => ({ ...g, y: g.y + speed }));

        // Check collision with player
        let hitGate: Gate | null = null;
        gates = gates.filter(g => {
          const gateX = LANES_START_X + g.lane * LANE_WIDTH + LANE_WIDTH / 2;
          const playerX = LANES_START_X + playerLane * LANE_WIDTH + LANE_WIDTH / 2;
          const sameColumn = Math.abs(gateX - playerX) < LANE_WIDTH / 2;
          const reachedPlayer = g.y + GATE_HEIGHT >= PLAYER_Y && g.y <= PLAYER_Y + PLAYER_SIZE;

          if (sameColumn && reachedPlayer) {
            hitGate = g;
            return false;
          }
          return true;
        });

        // Remove gates that passed off screen (missed)
        const beforeLen = gates.length;
        gates = gates.filter(g => g.y < CANVAS_H + 80);

        if (hitGate) {
          if (hitGate.correct) {
            streak++;
            bestStreak = Math.max(bestStreak, streak);
            const streakBonus = streak > 1 ? streak * 15 : 0;
            score += 100 + streakBonus;
            gatesCorrect++;
            audioEngine.playHit();
          } else {
            audioEngine.playWrong();
            // Show the hit state briefly, then game over
            return { ...prev, phase: 'hit' as const, gates, score, streak: 0, bestStreak };
          }
        }

        // Check if all 3 gates from current set have passed — spawn new set
        const activeGates = gates.length;
        if (activeGates === 0) {
          gatesTotal++;
          // Level up every 5 gate sets
          if (gatesTotal % 5 === 0) {
            level++;
            speed = Math.min(8, 2.5 + level * 0.5);
            activeFamilyCount = Math.min(8 + level * 2, FIDEL_FAMILIES.length);
          }

          // New target
          const newTarget = pickTarget(activeFamilyCount);
          targetChar = newTarget.char;
          targetFamilyIndex = newTarget.familyIndex;
          targetVowelOrder = newTarget.vowelOrder;

          gates = spawnGateSet(newTarget, activeFamilyCount);
          setTimeout(() => audioEngine.play(newTarget.char, ''), 100);
        }

        return {
          ...prev,
          gates,
          score,
          streak,
          bestStreak,
          speed,
          level,
          activeFamilyCount,
          targetChar,
          targetFamilyIndex,
          targetVowelOrder,
          gatesCorrect,
          gatesTotal,
        };
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state.phase]);

  // Hit state -> game over after brief delay
  useEffect(() => {
    if (state.phase === 'hit') {
      const timer = setTimeout(() => {
        audioEngine.playGameOver();
        setState(p => ({ ...p, phase: 'gameOver' }));
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [state.phase]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const s = stateRef.current;

      // Background
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Road / lanes
      for (let i = 0; i < LANE_COUNT; i++) {
        const x = LANES_START_X + i * LANE_WIDTH;
        ctx.fillStyle = i % 2 === 0 ? '#0e0e22' : '#0c0c1e';
        ctx.fillRect(x, 0, LANE_WIDTH, CANVAS_H);

        // Lane dividers
        if (i > 0) {
          ctx.strokeStyle = '#1a1a35';
          ctx.lineWidth = 2;
          ctx.setLineDash([20, 15]);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, CANVAS_H);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Road edges
      ctx.strokeStyle = '#2a2a50';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(LANES_START_X, 0);
      ctx.lineTo(LANES_START_X, CANVAS_H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(LANES_START_X + LANE_COUNT * LANE_WIDTH, 0);
      ctx.lineTo(LANES_START_X + LANE_COUNT * LANE_WIDTH, CANVAS_H);
      ctx.stroke();

      // Speed lines (scrolling background effect)
      const time = Date.now() / 50;
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const lx = LANES_START_X + 20 + i * 60;
        const ly = ((time * s.speed + i * 80) % (CANVAS_H + 40)) - 20;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly + 30);
        ctx.stroke();
      }

      // Gates
      s.gates.forEach(gate => {
        const gx = LANES_START_X + gate.lane * LANE_WIDTH + 10;
        const gy = gate.y;
        const gw = LANE_WIDTH - 20;

        // Gate body
        const colors = ['#ff4444', '#ff8c00', '#ffd700', '#44ff44', '#44bbff', '#aa44ff', '#ff44aa'];
        const color = colors[gate.vowelOrder];

        ctx.fillStyle = gate.correct ? '#0a2a15' : '#1a0a0a';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(gx, gy, gw, GATE_HEIGHT, 8);
        ctx.fill();
        ctx.stroke();

        // Gate glow
        if (gate.correct) {
          ctx.shadowColor = '#44ff88';
          ctx.shadowBlur = 15;
          ctx.strokeStyle = '#44ff88';
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Character
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gate.char, gx + gw / 2, gy + GATE_HEIGHT / 2);
      });

      // Player
      const px = LANES_START_X + s.playerLane * LANE_WIDTH + LANE_WIDTH / 2;
      const py = PLAYER_Y;

      // Ship body
      ctx.fillStyle = s.phase === 'hit' ? '#ff4444' : '#00ccff';
      ctx.beginPath();
      ctx.moveTo(px, py - 12);
      ctx.lineTo(px + 22, py + PLAYER_SIZE);
      ctx.lineTo(px - 22, py + PLAYER_SIZE);
      ctx.closePath();
      ctx.fill();

      // Engine glow
      ctx.fillStyle = '#ff6600';
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(px - 8, py + PLAYER_SIZE);
      ctx.lineTo(px, py + PLAYER_SIZE + 10);
      ctx.lineTo(px + 8, py + PLAYER_SIZE);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // HUD on canvas
      // Target
      ctx.fillStyle = 'rgba(0, 255, 136, 0.08)';
      ctx.fillRect(0, 0, CANVAS_W, 40);
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const voLabel = VOWEL_ORDERS[s.targetVowelOrder].label;
      ctx.fillText(`🔊 Find: ${s.targetChar}  (${voLabel})`, CANVAS_W / 2, 20);

      // Score
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`SCORE: ${s.score}`, 12, 58);

      // Level / Speed
      ctx.fillStyle = '#44bbff';
      ctx.textAlign = 'right';
      ctx.fillText(`LVL ${s.level}  SPD ${s.speed.toFixed(1)}`, CANVAS_W - 12, 58);

      // Streak
      if (s.streak > 1) {
        ctx.fillStyle = '#ff6644';
        ctx.textAlign = 'left';
        ctx.fillText(`🔥 x${s.streak}`, 12, 78);
      }

      if (s.phase === 'hit') {
        // Flash red overlay
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }
    };

    let animId: number;
    const loop = () => {
      draw();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const replayAudio = useCallback(() => {
    audioEngine.play(state.targetChar, '');
  }, [state.targetChar]);

  return (
    <div className="gr-container">
      {state.phase === 'menu' && (
        <div className="gr-menu">
          <h1 className="gr-title">
            <span className="gr-title-geez">ሯጭ በር</span>
            <span className="gr-title-main">GATE RUNNER</span>
          </h1>
          <p className="gr-subtitle">
            Listen to a syllable. Three gates approach — only one is correct!
            <br />
            Switch lanes to hit the right gate. Miss or hit wrong = game over!
          </p>
          <div className="gr-controls-info">
            <div><kbd>← →</kbd> or <kbd>A D</kbd> — Switch lanes</div>
            <div><kbd>R</kbd> — Replay audio</div>
          </div>
          <button className="gr-start-btn" onClick={startGame}>
            START GAME
          </button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          display: state.phase === 'menu' || state.phase === 'gameOver' ? 'none' : 'block',
          margin: '0 auto',
          border: '2px solid #222',
          borderRadius: '8px',
        }}
      />

      {(state.phase === 'playing' || state.phase === 'hit') && (
        <div className="gr-audio-bar">
          <button className="gr-replay-btn" onClick={replayAudio}>
            🔊 Replay: <span className="gr-target-char">{state.targetChar}</span>
          </button>
        </div>
      )}

      {state.phase === 'gameOver' && (
        <div className="gr-menu">
          <h2 className="gr-gameover-title">GAME OVER</h2>
          <div className="gr-final-stats">
            <div className="gr-stat">
              <span className="gr-stat-value">{state.score}</span>
              <span className="gr-stat-label">Score</span>
            </div>
            <div className="gr-stat">
              <span className="gr-stat-value">{state.level}</span>
              <span className="gr-stat-label">Level</span>
            </div>
            <div className="gr-stat">
              <span className="gr-stat-value">{state.bestStreak}</span>
              <span className="gr-stat-label">Best Streak</span>
            </div>
            <div className="gr-stat">
              <span className="gr-stat-value">{state.gatesCorrect}</span>
              <span className="gr-stat-label">Correct</span>
            </div>
          </div>
          <button className="gr-start-btn" onClick={startGame}>
            PLAY AGAIN
          </button>
        </div>
      )}
    </div>
  );
}
