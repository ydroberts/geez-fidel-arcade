import { useCallback, useEffect, useRef, useState } from 'react';
import { FIDEL_FAMILIES, VOWEL_ORDERS } from '../data/geezAlphabet';
import { audioEngine } from '../audio/AudioEngine';
import './SyllableBuilder.css';

interface CardData {
  id: string;
  type: 'consonant' | 'vowel';
  label: string;
  familyIndex?: number;  // for consonant cards
  vowelIndex?: number;   // for vowel cards
}

interface RoundState {
  targetFamilyIndex: number;
  targetVowelIndex: number;
  targetChar: string;
  consonantCards: CardData[];
  vowelCards: CardData[];
}

interface GameState {
  phase: 'menu' | 'playing' | 'fusing' | 'result' | 'gameOver';
  score: number;
  streak: number;
  bestStreak: number;
  round: number;
  totalRounds: number;
  lives: number;
  selectedConsonant: CardData | null;
  selectedVowel: CardData | null;
  wasCorrect: boolean | null;
  resultChar: string;
  difficulty: 'easy' | 'medium' | 'hard';
  roundData: RoundState;
}

const DIFFICULTY_CONFIG = {
  easy:   { families: 8,  choices: 4, rounds: 10, lives: 5 },
  medium: { families: 16, choices: 5, rounds: 15, lives: 4 },
  hard:   { families: 32, choices: 7, rounds: 20, lives: 3 },
};

let idCounter = 0;
const uid = () => `sb-${++idCounter}`;

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildRound(difficulty: 'easy' | 'medium' | 'hard'): RoundState {
  const config = DIFFICULTY_CONFIG[difficulty];
  const maxFamilies = Math.min(config.families, FIDEL_FAMILIES.length);

  // Pick a random target
  const targetFamilyIndex = Math.floor(Math.random() * maxFamilies);
  const targetVowelIndex = Math.floor(Math.random() * 7);
  const targetChar = FIDEL_FAMILIES[targetFamilyIndex].chars[targetVowelIndex];

  // Build consonant choices: include the correct one + random others
  const consonantIndices = new Set<number>([targetFamilyIndex]);
  while (consonantIndices.size < config.choices) {
    consonantIndices.add(Math.floor(Math.random() * maxFamilies));
  }
  const consonantCards: CardData[] = shuffle(
    Array.from(consonantIndices).map(idx => ({
      id: uid(),
      type: 'consonant' as const,
      label: FIDEL_FAMILIES[idx].romanBase.toUpperCase(),
      familyIndex: idx,
    }))
  );

  // Build vowel choices: include the correct one + random others
  const vowelIndices = new Set<number>([targetVowelIndex]);
  while (vowelIndices.size < Math.min(config.choices, 7)) {
    vowelIndices.add(Math.floor(Math.random() * 7));
  }
  const vowelCards: CardData[] = shuffle(
    Array.from(vowelIndices).map(idx => ({
      id: uid(),
      type: 'vowel' as const,
      label: VOWEL_ORDERS[idx].vowel,
      vowelIndex: idx,
    }))
  );

  return { targetFamilyIndex, targetVowelIndex, targetChar, consonantCards, vowelCards };
}

function createInitialState(): GameState {
  return {
    phase: 'menu',
    score: 0,
    streak: 0,
    bestStreak: 0,
    round: 0,
    totalRounds: 10,
    lives: 5,
    selectedConsonant: null,
    selectedVowel: null,
    wasCorrect: null,
    resultChar: '',
    difficulty: 'easy',
    roundData: buildRound('easy'),
  };
}

export function SyllableBuilder() {
  const [state, setState] = useState<GameState>(createInitialState);
  const fuseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startGame = useCallback((difficulty: 'easy' | 'medium' | 'hard') => {
    const config = DIFFICULTY_CONFIG[difficulty];
    const roundData = buildRound(difficulty);
    setState({
      phase: 'playing',
      score: 0,
      streak: 0,
      bestStreak: 0,
      round: 1,
      totalRounds: config.rounds,
      lives: config.lives,
      selectedConsonant: null,
      selectedVowel: null,
      wasCorrect: null,
      resultChar: '',
      difficulty,
      roundData,
    });
    // Play the target syllable audio
    setTimeout(() => audioEngine.play(roundData.targetChar, ''), 400);
  }, []);

  const advanceRound = useCallback((prev: GameState) => {
    if (prev.round >= prev.totalRounds || prev.lives <= 0) {
      audioEngine.playLevelComplete();
      setState(p => ({ ...p, phase: 'gameOver' }));
      return;
    }
    const roundData = buildRound(prev.difficulty);
    setState(p => ({
      ...p,
      phase: 'playing',
      round: p.round + 1,
      selectedConsonant: null,
      selectedVowel: null,
      wasCorrect: null,
      resultChar: '',
      roundData,
    }));
    setTimeout(() => audioEngine.play(roundData.targetChar, ''), 400);
  }, []);

  // When both cards are selected, fuse them
  useEffect(() => {
    if (state.phase !== 'fusing') return;
    if (!state.selectedConsonant || !state.selectedVowel) return;

    fuseTimerRef.current = setTimeout(() => {
      setState(prev => {
        const famIdx = prev.selectedConsonant!.familyIndex!;
        const vowIdx = prev.selectedVowel!.vowelIndex!;
        const builtChar = FIDEL_FAMILIES[famIdx].chars[vowIdx];
        const correct = famIdx === prev.roundData.targetFamilyIndex &&
                        vowIdx === prev.roundData.targetVowelIndex;

        if (correct) {
          audioEngine.play(builtChar, '');
        } else {
          audioEngine.playWrong();
        }

        const newStreak = correct ? prev.streak + 1 : 0;
        const streakBonus = correct && newStreak > 1 ? newStreak * 20 : 0;

        return {
          ...prev,
          phase: 'result',
          wasCorrect: correct,
          resultChar: builtChar,
          score: prev.score + (correct ? 100 + streakBonus : 0),
          streak: newStreak,
          bestStreak: Math.max(prev.bestStreak, newStreak),
          lives: correct ? prev.lives : prev.lives - 1,
        };
      });
    }, 800);

    return () => {
      if (fuseTimerRef.current) clearTimeout(fuseTimerRef.current);
    };
  }, [state.phase]);

  // Auto-advance after result
  useEffect(() => {
    if (state.phase !== 'result') return;
    const timer = setTimeout(() => advanceRound(state), 2000);
    return () => clearTimeout(timer);
  }, [state.phase, state.round, advanceRound]);

  const selectCard = useCallback((card: CardData) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;

      let newConsonant = prev.selectedConsonant;
      let newVowel = prev.selectedVowel;

      if (card.type === 'consonant') {
        // Toggle or switch consonant selection
        newConsonant = prev.selectedConsonant?.id === card.id ? null : card;
      } else {
        newVowel = prev.selectedVowel?.id === card.id ? null : card;
      }

      // If both selected, start fusing
      const bothSelected = newConsonant && newVowel;

      return {
        ...prev,
        phase: bothSelected ? 'fusing' : 'playing',
        selectedConsonant: newConsonant,
        selectedVowel: newVowel,
      };
    });
  }, []);

  const replayAudio = useCallback(() => {
    audioEngine.play(state.roundData.targetChar, '');
  }, [state.roundData.targetChar]);

  return (
    <div className="sb-container">
      {/* Menu */}
      {state.phase === 'menu' && (
        <div className="sb-menu">
          <h1 className="sb-title">
            <span className="sb-title-geez">ቃል ሠሪ</span>
            <span className="sb-title-main">SYLLABLE BUILDER</span>
          </h1>
          <p className="sb-subtitle">
            Listen to a syllable, then pick the correct consonant and vowel cards
            <br />
            to build it. Cards fuse together to reveal the character!
          </p>
          <div className="sb-difficulty-select">
            <button className="sb-diff-btn sb-easy" onClick={() => startGame('easy')}>
              EASY
              <span>4 choices · 5 lives</span>
            </button>
            <button className="sb-diff-btn sb-medium" onClick={() => startGame('medium')}>
              MEDIUM
              <span>5 choices · 4 lives</span>
            </button>
            <button className="sb-diff-btn sb-hard" onClick={() => startGame('hard')}>
              HARD
              <span>7 choices · 3 lives</span>
            </button>
          </div>
        </div>
      )}

      {/* Playing / Fusing / Result */}
      {(state.phase === 'playing' || state.phase === 'fusing' || state.phase === 'result') && (
        <div className="sb-game">
          {/* HUD */}
          <div className="sb-hud">
            <div className="sb-hud-left">
              <span className="sb-score">SCORE: {state.score}</span>
              {state.streak > 1 && <span className="sb-streak">🔥 x{state.streak}</span>}
            </div>
            <div className="sb-hud-center">
              <span className="sb-round">Round {state.round}/{state.totalRounds}</span>
            </div>
            <div className="sb-hud-right">
              <span className="sb-lives">
                {'♥'.repeat(state.lives)}{'♡'.repeat(Math.max(0, DIFFICULTY_CONFIG[state.difficulty].lives - state.lives))}
              </span>
            </div>
          </div>

          {/* Audio prompt */}
          <div className="sb-prompt">
            <button className="sb-replay-btn" onClick={replayAudio}>
              🔊 Listen to the syllable
            </button>
            <span className="sb-hint">Pick a consonant + vowel to build it</span>
          </div>

          {/* Fusion zone */}
          <div className="sb-fusion-zone">
            <div className={`sb-slot sb-slot-consonant ${state.selectedConsonant ? 'sb-slot-filled' : ''}`}>
              {state.selectedConsonant ? (
                <span className="sb-slot-label">{state.selectedConsonant.label}</span>
              ) : (
                <span className="sb-slot-placeholder">Consonant</span>
              )}
            </div>

            <div className={`sb-plus ${state.phase === 'fusing' ? 'sb-fusing' : ''}`}>
              {state.phase === 'fusing' ? '⚡' : '+'}
            </div>

            <div className={`sb-slot sb-slot-vowel ${state.selectedVowel ? 'sb-slot-filled' : ''}`}>
              {state.selectedVowel ? (
                <span className="sb-slot-label">{state.selectedVowel.label}</span>
              ) : (
                <span className="sb-slot-placeholder">Vowel</span>
              )}
            </div>

            <div className="sb-equals">=</div>

            <div className={`sb-result-card ${
              state.phase === 'result'
                ? state.wasCorrect ? 'sb-result-correct' : 'sb-result-wrong'
                : state.phase === 'fusing' ? 'sb-result-fusing' : ''
            }`}>
              {state.phase === 'result' ? (
                <>
                  <span className="sb-result-char">{state.resultChar}</span>
                  <span className="sb-result-verdict">
                    {state.wasCorrect ? '✓' : `✗ → ${state.roundData.targetChar}`}
                  </span>
                </>
              ) : state.phase === 'fusing' ? (
                <span className="sb-result-fusing-text">...</span>
              ) : (
                <span className="sb-result-placeholder">?</span>
              )}
            </div>
          </div>

          {/* Card banks */}
          <div className="sb-cards-section">
            <div className="sb-card-bank">
              <div className="sb-bank-label">Consonant Family</div>
              <div className="sb-card-row">
                {state.roundData.consonantCards.map(card => (
                  <button
                    key={card.id}
                    className={`sb-card sb-card-consonant ${
                      state.selectedConsonant?.id === card.id ? 'sb-card-selected' : ''
                    }`}
                    onClick={() => selectCard(card)}
                    disabled={state.phase !== 'playing'}
                  >
                    <span className="sb-card-char">
                      {FIDEL_FAMILIES[card.familyIndex!].chars[0]}
                    </span>
                    <span className="sb-card-label">{card.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sb-card-bank">
              <div className="sb-bank-label">Vowel Order</div>
              <div className="sb-card-row">
                {state.roundData.vowelCards.map(card => (
                  <button
                    key={card.id}
                    className={`sb-card sb-card-vowel ${
                      state.selectedVowel?.id === card.id ? 'sb-card-selected' : ''
                    }`}
                    onClick={() => selectCard(card)}
                    disabled={state.phase !== 'playing'}
                  >
                    <span className="sb-card-order">{card.vowelIndex! + 1}</span>
                    <span className="sb-card-label">{card.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over */}
      {state.phase === 'gameOver' && (
        <div className="sb-menu">
          <h2 className="sb-gameover-title">
            {state.lives > 0 ? 'GAME COMPLETE!' : 'GAME OVER'}
          </h2>
          <div className="sb-final-stats">
            <div className="sb-stat">
              <span className="sb-stat-value">{state.score}</span>
              <span className="sb-stat-label">Final Score</span>
            </div>
            <div className="sb-stat">
              <span className="sb-stat-value">{state.bestStreak}</span>
              <span className="sb-stat-label">Best Streak</span>
            </div>
            <div className="sb-stat">
              <span className="sb-stat-value">{state.round}</span>
              <span className="sb-stat-label">Rounds</span>
            </div>
          </div>
          <div className="sb-difficulty-select">
            <button className="sb-diff-btn sb-easy" onClick={() => startGame('easy')}>PLAY AGAIN — EASY</button>
            <button className="sb-diff-btn sb-medium" onClick={() => startGame('medium')}>PLAY AGAIN — MEDIUM</button>
            <button className="sb-diff-btn sb-hard" onClick={() => startGame('hard')}>PLAY AGAIN — HARD</button>
          </div>
        </div>
      )}
    </div>
  );
}
