import { useCallback, useEffect, useRef, useState } from 'react';
import { FIDEL_FAMILIES, VOWEL_ORDERS } from '../data/geezAlphabet';
import { audioEngine } from '../audio/AudioEngine';
import './GridNavigator.css';

interface GameState {
  phase: 'menu' | 'playing' | 'roundResult' | 'gameOver';
  score: number;
  streak: number;
  bestStreak: number;
  round: number;
  totalRounds: number;
  targetRow: number;
  targetCol: number;
  targetChar: string;
  targetRomanized: string;
  selectedRow: number | null;
  selectedCol: number | null;
  wasCorrect: boolean | null;
  timeLeft: number;
  difficulty: 'easy' | 'medium' | 'hard';
  // Which families are active (subset for easier difficulties)
  activeFamilyIndices: number[];
}

const DIFFICULTY_CONFIG = {
  easy:   { families: 8,  rounds: 10, timePerRound: 15 },
  medium: { families: 16, rounds: 15, timePerRound: 10 },
  hard:   { families: 32, rounds: 20, timePerRound: 7  },
};

function pickTarget(activeFamilyIndices: number[]): { row: number; col: number; char: string; romanized: string } {
  const vowelSuffixes = ['ä', 'u', 'i', 'a', 'é', 'e', 'o'];
  const row = activeFamilyIndices[Math.floor(Math.random() * activeFamilyIndices.length)];
  const col = Math.floor(Math.random() * 7);
  const family = FIDEL_FAMILIES[row];
  return {
    row,
    col,
    char: family.chars[col],
    romanized: family.romanBase + vowelSuffixes[col],
  };
}

function getActiveFamilies(difficulty: 'easy' | 'medium' | 'hard'): number[] {
  const count = DIFFICULTY_CONFIG[difficulty].families;
  const indices = Array.from({ length: FIDEL_FAMILIES.length }, (_, i) => i);
  // Shuffle and take first `count`
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).sort((a, b) => a - b);
}

export function GridNavigator() {
  const [state, setState] = useState<GameState>({
    phase: 'menu',
    score: 0,
    streak: 0,
    bestStreak: 0,
    round: 0,
    totalRounds: 10,
    targetRow: 0,
    targetCol: 0,
    targetChar: '',
    targetRomanized: '',
    selectedRow: null,
    selectedCol: null,
    wasCorrect: null,
    timeLeft: 10,
    difficulty: 'easy',
    activeFamilyIndices: [],
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startGame = useCallback((difficulty: 'easy' | 'medium' | 'hard') => {
    const config = DIFFICULTY_CONFIG[difficulty];
    const activeFamilies = getActiveFamilies(difficulty);
    const target = pickTarget(activeFamilies);

    setState({
      phase: 'playing',
      score: 0,
      streak: 0,
      bestStreak: 0,
      round: 1,
      totalRounds: config.rounds,
      targetRow: target.row,
      targetCol: target.col,
      targetChar: target.char,
      targetRomanized: target.romanized,
      selectedRow: null,
      selectedCol: null,
      wasCorrect: null,
      timeLeft: config.timePerRound,
      difficulty,
      activeFamilyIndices: activeFamilies,
    });

    setTimeout(() => audioEngine.play(target.char, target.romanized), 300);
  }, []);

  const nextRound = useCallback((prev: GameState) => {
    const config = DIFFICULTY_CONFIG[prev.difficulty];
    if (prev.round >= prev.totalRounds) {
      audioEngine.playLevelComplete();
      setState(p => ({ ...p, phase: 'gameOver' }));
      return;
    }
    const target = pickTarget(prev.activeFamilyIndices);
    setState(p => ({
      ...p,
      phase: 'playing',
      round: p.round + 1,
      targetRow: target.row,
      targetCol: target.col,
      targetChar: target.char,
      targetRomanized: target.romanized,
      selectedRow: null,
      selectedCol: null,
      wasCorrect: null,
      timeLeft: config.timePerRound,
    }));
    setTimeout(() => audioEngine.play(target.char, target.romanized), 300);
  }, []);

  // Timer countdown
  useEffect(() => {
    if (state.phase !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.phase !== 'playing') return prev;
        const newTime = prev.timeLeft - 1;
        if (newTime <= 0) {
          // Time's up — wrong answer
          audioEngine.playWrong();
          return {
            ...prev,
            phase: 'roundResult',
            wasCorrect: false,
            streak: 0,
            timeLeft: 0,
          };
        }
        return { ...prev, timeLeft: newTime };
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.phase, state.round]);

  // Auto-advance after showing result
  useEffect(() => {
    if (state.phase === 'roundResult') {
      const timer = setTimeout(() => nextRound(state), 1500);
      return () => clearTimeout(timer);
    }
  }, [state.phase, state.round, nextRound]);

  const handleCellClick = useCallback((familyIndex: number, colIndex: number) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;

      const correct = familyIndex === prev.targetRow && colIndex === prev.targetCol;
      const newStreak = correct ? prev.streak + 1 : 0;
      const timeBonus = correct ? prev.timeLeft * 5 : 0;
      const streakBonus = correct && newStreak > 1 ? newStreak * 15 : 0;
      const basePoints = correct ? 100 : 0;

      if (correct) {
        audioEngine.playHit();
      } else {
        audioEngine.playWrong();
      }

      return {
        ...prev,
        phase: 'roundResult',
        selectedRow: familyIndex,
        selectedCol: colIndex,
        wasCorrect: correct,
        score: prev.score + basePoints + timeBonus + streakBonus,
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
      };
    });
  }, []);

  const replayAudio = useCallback(() => {
    audioEngine.play(state.targetChar, state.targetRomanized);
  }, [state.targetChar, state.targetRomanized]);

  return (
    <div className="gn-container">
      {/* Menu */}
      {state.phase === 'menu' && (
        <div className="gn-menu">
          <h1 className="gn-title">
            <span className="gn-title-geez">ፍለጋ</span>
            <span className="gn-title-main">GRID NAVIGATOR</span>
          </h1>
          <p className="gn-subtitle">
            Listen to the syllable. Find it on the fidel grid.
            <br />
            The faster you find it, the more points you earn!
          </p>
          <div className="gn-difficulty-select">
            <button className="gn-diff-btn gn-easy" onClick={() => startGame('easy')}>
              EASY
              <span>8 families · 15s timer</span>
            </button>
            <button className="gn-diff-btn gn-medium" onClick={() => startGame('medium')}>
              MEDIUM
              <span>16 families · 10s timer</span>
            </button>
            <button className="gn-diff-btn gn-hard" onClick={() => startGame('hard')}>
              HARD
              <span>All 32 families · 7s timer</span>
            </button>
          </div>
        </div>
      )}

      {/* Playing & Round Result */}
      {(state.phase === 'playing' || state.phase === 'roundResult') && (
        <div className="gn-game">
          {/* HUD */}
          <div className="gn-hud">
            <div className="gn-hud-left">
              <span className="gn-score">SCORE: {state.score}</span>
              {state.streak > 1 && <span className="gn-streak">🔥 x{state.streak}</span>}
            </div>
            <div className="gn-hud-center">
              <span className="gn-round">Round {state.round}/{state.totalRounds}</span>
            </div>
            <div className="gn-hud-right">
              <span className={`gn-timer ${state.timeLeft <= 3 ? 'gn-timer-low' : ''}`}>
                ⏱ {state.timeLeft}s
              </span>
            </div>
          </div>

          {/* Audio prompt */}
          <div className="gn-prompt">
            <button className="gn-replay-btn" onClick={replayAudio}>
              🔊 Listen Again
            </button>
            {state.phase === 'roundResult' && (
              <span className={`gn-result-label ${state.wasCorrect ? 'gn-correct' : 'gn-wrong'}`}>
                {state.wasCorrect ? '✓ Correct!' : `✗ It was ${state.targetChar}`}
              </span>
            )}
          </div>

          {/* Fidel Grid */}
          <div className="gn-grid-wrapper">
            {/* Column headers (vowel orders) */}
            <div className="gn-grid-row gn-header-row">
              <div className="gn-row-label" />
              {VOWEL_ORDERS.map((vo, i) => (
                <div
                  key={i}
                  className={`gn-col-header ${
                    state.phase === 'roundResult' && state.targetCol === i ? 'gn-highlight-col' : ''
                  }`}
                >
                  {vo.vowel}
                </div>
              ))}
            </div>

            {/* Grid rows */}
            {state.activeFamilyIndices.map(familyIdx => {
              const family = FIDEL_FAMILIES[familyIdx];
              const isTargetRow = state.phase === 'roundResult' && state.targetRow === familyIdx;

              return (
                <div key={familyIdx} className="gn-grid-row">
                  <div className={`gn-row-label ${isTargetRow ? 'gn-highlight-row' : ''}`}>
                    {family.romanBase}
                  </div>
                  {family.chars.map((char, colIdx) => {
                    const isTarget = familyIdx === state.targetRow && colIdx === state.targetCol;
                    const isSelected = familyIdx === state.selectedRow && colIdx === state.selectedCol;
                    const showResult = state.phase === 'roundResult';

                    let cellClass = 'gn-cell';
                    if (showResult && isTarget) cellClass += ' gn-cell-target';
                    if (showResult && isSelected && !state.wasCorrect) cellClass += ' gn-cell-wrong';
                    if (showResult && isSelected && state.wasCorrect) cellClass += ' gn-cell-correct';

                    return (
                      <button
                        key={colIdx}
                        className={cellClass}
                        onClick={() => handleCellClick(familyIdx, colIdx)}
                        disabled={state.phase !== 'playing'}
                      >
                        {char}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Game Over */}
      {state.phase === 'gameOver' && (
        <div className="gn-menu">
          <h2 className="gn-gameover-title">GAME COMPLETE!</h2>
          <div className="gn-final-stats">
            <div className="gn-stat">
              <span className="gn-stat-value">{state.score}</span>
              <span className="gn-stat-label">Final Score</span>
            </div>
            <div className="gn-stat">
              <span className="gn-stat-value">{state.bestStreak}</span>
              <span className="gn-stat-label">Best Streak</span>
            </div>
            <div className="gn-stat">
              <span className="gn-stat-value">{state.round}</span>
              <span className="gn-stat-label">Rounds</span>
            </div>
          </div>
          <div className="gn-difficulty-select">
            <button className="gn-diff-btn gn-easy" onClick={() => startGame('easy')}>PLAY AGAIN — EASY</button>
            <button className="gn-diff-btn gn-medium" onClick={() => startGame('medium')}>PLAY AGAIN — MEDIUM</button>
            <button className="gn-diff-btn gn-hard" onClick={() => startGame('hard')}>PLAY AGAIN — HARD</button>
          </div>
        </div>
      )}
    </div>
  );
}
