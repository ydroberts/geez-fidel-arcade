import { useCallback, useEffect, useRef, useState } from 'react';
import { FIDEL_FAMILIES, VOWEL_ORDERS } from '../data/geezAlphabet';
import { audioEngine } from '../audio/AudioEngine';
import './MemoryMatch.css';

type MatchRule = 'consonant' | 'vowel';

interface Card {
  id: number;
  char: string;
  familyIndex: number;
  vowelOrder: number;
  flipped: boolean;
  matched: boolean;
}

interface GameState {
  phase: 'menu' | 'playing' | 'checking' | 'roundComplete' | 'gameOver';
  cards: Card[];
  matchRule: MatchRule;
  flippedIds: number[];
  score: number;
  moves: number;
  matchesFound: number;
  totalPairs: number;
  round: number;
  totalRounds: number;
  timeLeft: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

const DIFFICULTY_CONFIG = {
  easy:   { gridSize: 12, rounds: 3, time: 90 },   // 4x3 = 6 pairs
  medium: { gridSize: 16, rounds: 4, time: 120 },   // 4x4 = 8 pairs
  hard:   { gridSize: 24, rounds: 5, time: 150 },   // 6x4 = 12 pairs
};

let cardId = 0;

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildCards(gridSize: number, rule: MatchRule): Card[] {
  const pairCount = gridSize / 2;
  const cards: Card[] = [];

  if (rule === 'consonant') {
    // Pairs share the same consonant family (different vowel orders)
    const families = shuffle(
      Array.from({ length: FIDEL_FAMILIES.length }, (_, i) => i)
    ).slice(0, pairCount);

    families.forEach(fi => {
      // Pick 2 different vowel orders from this family
      const vos = shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, 2);
      vos.forEach(vo => {
        cards.push({
          id: ++cardId,
          char: FIDEL_FAMILIES[fi].chars[vo],
          familyIndex: fi,
          vowelOrder: vo,
          flipped: false,
          matched: false,
        });
      });
    });
  } else {
    // Pairs share the same vowel order (different consonant families)
    // Pick vowel orders, then for each pick 2 different families
    const availableVOs = shuffle([0, 1, 2, 3, 4, 5, 6]);
    let voIdx = 0;

    for (let p = 0; p < pairCount; p++) {
      const vo = availableVOs[voIdx % 7];
      voIdx++;

      const families = shuffle(
        Array.from({ length: FIDEL_FAMILIES.length }, (_, i) => i)
      ).slice(0, 2);

      families.forEach(fi => {
        cards.push({
          id: ++cardId,
          char: FIDEL_FAMILIES[fi].chars[vo],
          familyIndex: fi,
          vowelOrder: vo,
          flipped: false,
          matched: false,
        });
      });
    }
  }

  return shuffle(cards);
}

function isMatch(a: Card, b: Card, rule: MatchRule): boolean {
  if (rule === 'consonant') {
    return a.familyIndex === b.familyIndex && a.id !== b.id;
  }
  return a.vowelOrder === b.vowelOrder && a.id !== b.id;
}

export function MemoryMatch() {
  const [state, setState] = useState<GameState>({
    phase: 'menu',
    cards: [],
    matchRule: 'consonant',
    flippedIds: [],
    score: 0,
    moves: 0,
    matchesFound: 0,
    totalPairs: 0,
    round: 0,
    totalRounds: 3,
    timeLeft: 90,
    difficulty: 'easy',
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startGame = useCallback((difficulty: 'easy' | 'medium' | 'hard') => {
    const config = DIFFICULTY_CONFIG[difficulty];
    const rule: MatchRule = 'consonant'; // Start with consonant matching
    const cards = buildCards(config.gridSize, rule);

    setState({
      phase: 'playing',
      cards,
      matchRule: rule,
      flippedIds: [],
      score: 0,
      moves: 0,
      matchesFound: 0,
      totalPairs: config.gridSize / 2,
      round: 1,
      totalRounds: config.rounds,
      timeLeft: config.time,
      difficulty,
    });
  }, []);

  const nextRound = useCallback((prev: GameState) => {
    if (prev.round >= prev.totalRounds) {
      audioEngine.playLevelComplete();
      setState(p => ({ ...p, phase: 'gameOver' }));
      return;
    }

    const config = DIFFICULTY_CONFIG[prev.difficulty];
    // Alternate match rule each round
    const newRule: MatchRule = prev.matchRule === 'consonant' ? 'vowel' : 'consonant';
    const cards = buildCards(config.gridSize, newRule);

    setState(p => ({
      ...p,
      phase: 'playing',
      cards,
      matchRule: newRule,
      flippedIds: [],
      matchesFound: 0,
      totalPairs: config.gridSize / 2,
      round: p.round + 1,
    }));
  }, []);

  // Timer
  useEffect(() => {
    if (state.phase !== 'playing' && state.phase !== 'checking') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.phase !== 'playing' && prev.phase !== 'checking') return prev;
        const newTime = prev.timeLeft - 1;
        if (newTime <= 0) {
          audioEngine.playGameOver();
          return { ...prev, phase: 'gameOver', timeLeft: 0 };
        }
        return { ...prev, timeLeft: newTime };
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.phase]);

  // Auto-advance after round complete
  useEffect(() => {
    if (state.phase === 'roundComplete') {
      const timer = setTimeout(() => nextRound(state), 2000);
      return () => clearTimeout(timer);
    }
  }, [state.phase, state.round, nextRound]);

  const flipCard = useCallback((id: number) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;

      const card = prev.cards.find(c => c.id === id);
      if (!card || card.flipped || card.matched) return prev;
      if (prev.flippedIds.length >= 2) return prev;

      // Play audio for this card
      audioEngine.play(card.char, '');

      const newCards = prev.cards.map(c =>
        c.id === id ? { ...c, flipped: true } : c
      );
      const newFlipped = [...prev.flippedIds, id];

      if (newFlipped.length === 2) {
        // Check for match
        const card1 = newCards.find(c => c.id === newFlipped[0])!;
        const card2 = newCards.find(c => c.id === newFlipped[1])!;
        const matched = isMatch(card1, card2, prev.matchRule);

        if (matched) {
          audioEngine.playHit();
          const updatedCards = newCards.map(c =>
            c.id === card1.id || c.id === card2.id ? { ...c, matched: true } : c
          );
          const newMatchesFound = prev.matchesFound + 1;
          const timeBonus = Math.floor(prev.timeLeft / 10) * 5;
          const newScore = prev.score + 100 + timeBonus;

          // Check if round complete
          if (newMatchesFound >= prev.totalPairs) {
            return {
              ...prev,
              cards: updatedCards,
              flippedIds: [],
              score: newScore + 200, // round completion bonus
              moves: prev.moves + 1,
              matchesFound: newMatchesFound,
              phase: 'roundComplete',
            };
          }

          return {
            ...prev,
            cards: updatedCards,
            flippedIds: [],
            score: newScore,
            moves: prev.moves + 1,
            matchesFound: newMatchesFound,
          };
        } else {
          // No match — flip back after delay
          audioEngine.playWrong();
          setTimeout(() => {
            setState(p => ({
              ...p,
              phase: 'playing',
              cards: p.cards.map(c =>
                (c.id === card1.id || c.id === card2.id) && !c.matched
                  ? { ...c, flipped: false }
                  : c
              ),
              flippedIds: [],
            }));
          }, 800);

          return {
            ...prev,
            cards: newCards,
            flippedIds: newFlipped,
            moves: prev.moves + 1,
            phase: 'checking',
          };
        }
      }

      return { ...prev, cards: newCards, flippedIds: newFlipped };
    });
  }, []);

  // Grid columns based on difficulty
  const gridCols = state.difficulty === 'hard' ? 6 : 4;

  return (
    <div className="mm-container">
      {/* Menu */}
      {state.phase === 'menu' && (
        <div className="mm-menu">
          <h1 className="mm-title">
            <span className="mm-title-geez">ማዛመድ</span>
            <span className="mm-title-main">MEMORY MATCH</span>
          </h1>
          <p className="mm-subtitle">
            Flip cards to find matching pairs. But here's the twist —
            <br />
            pairs match by <strong>same consonant family</strong> or <strong>same vowel order</strong>,
            <br />
            and the rule changes each round!
          </p>
          <div className="mm-difficulty-select">
            <button className="mm-diff-btn mm-easy" onClick={() => startGame('easy')}>
              EASY
              <span>6 pairs · 3 rounds</span>
            </button>
            <button className="mm-diff-btn mm-medium" onClick={() => startGame('medium')}>
              MEDIUM
              <span>8 pairs · 4 rounds</span>
            </button>
            <button className="mm-diff-btn mm-hard" onClick={() => startGame('hard')}>
              HARD
              <span>12 pairs · 5 rounds</span>
            </button>
          </div>
        </div>
      )}

      {/* Playing / Checking */}
      {(state.phase === 'playing' || state.phase === 'checking' || state.phase === 'roundComplete') && (
        <div className="mm-game">
          {/* HUD */}
          <div className="mm-hud">
            <div className="mm-hud-left">
              <span className="mm-score">SCORE: {state.score}</span>
              <span className="mm-moves">Moves: {state.moves}</span>
            </div>
            <div className="mm-hud-center">
              <span className={`mm-rule-badge ${state.matchRule === 'consonant' ? 'mm-rule-consonant' : 'mm-rule-vowel'}`}>
                Match by: {state.matchRule === 'consonant' ? 'Same Consonant Family' : 'Same Vowel Order'}
              </span>
            </div>
            <div className="mm-hud-right">
              <span className="mm-round">Round {state.round}/{state.totalRounds}</span>
              <span className={`mm-timer ${state.timeLeft <= 15 ? 'mm-timer-low' : ''}`}>
                ⏱ {state.timeLeft}s
              </span>
            </div>
          </div>

          {/* Progress */}
          <div className="mm-progress">
            <div className="mm-progress-bar">
              <div
                className="mm-progress-fill"
                style={{ width: `${(state.matchesFound / state.totalPairs) * 100}%` }}
              />
            </div>
            <span className="mm-progress-label">{state.matchesFound}/{state.totalPairs} pairs</span>
          </div>

          {/* Card Grid */}
          <div
            className="mm-grid"
            style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
          >
            {state.cards.map(card => (
              <button
                key={card.id}
                className={`mm-card ${card.flipped || card.matched ? 'mm-card-flipped' : ''} ${card.matched ? 'mm-card-matched' : ''}`}
                onClick={() => flipCard(card.id)}
                disabled={state.phase === 'checking' || card.flipped || card.matched}
              >
                <div className="mm-card-inner">
                  <div className="mm-card-front">
                    <span className="mm-card-question">?</span>
                  </div>
                  <div className="mm-card-back">
                    <span className="mm-card-char">{card.char}</span>
                    <span className="mm-card-info">
                      {state.matchRule === 'consonant'
                        ? FIDEL_FAMILIES[card.familyIndex].romanBase
                        : VOWEL_ORDERS[card.vowelOrder].vowel
                      }
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Round Complete overlay */}
          {state.phase === 'roundComplete' && (
            <div className="mm-round-overlay">
              <div className="mm-round-msg">
                <h3>Round {state.round} Complete!</h3>
                <p>Next round: match by <strong>
                  {state.matchRule === 'consonant' ? 'Same Vowel Order' : 'Same Consonant Family'}
                </strong></p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Game Over */}
      {state.phase === 'gameOver' && (
        <div className="mm-menu">
          <h2 className="mm-gameover-title">
            {state.timeLeft > 0 ? 'ALL ROUNDS COMPLETE!' : 'TIME\'S UP!'}
          </h2>
          <div className="mm-final-stats">
            <div className="mm-stat">
              <span className="mm-stat-value">{state.score}</span>
              <span className="mm-stat-label">Score</span>
            </div>
            <div className="mm-stat">
              <span className="mm-stat-value">{state.moves}</span>
              <span className="mm-stat-label">Moves</span>
            </div>
            <div className="mm-stat">
              <span className="mm-stat-value">{state.round}</span>
              <span className="mm-stat-label">Rounds</span>
            </div>
          </div>
          <div className="mm-difficulty-select">
            <button className="mm-diff-btn mm-easy" onClick={() => startGame('easy')}>PLAY AGAIN — EASY</button>
            <button className="mm-diff-btn mm-medium" onClick={() => startGame('medium')}>PLAY AGAIN — MEDIUM</button>
            <button className="mm-diff-btn mm-hard" onClick={() => startGame('hard')}>PLAY AGAIN — HARD</button>
          </div>
        </div>
      )}
    </div>
  );
}
