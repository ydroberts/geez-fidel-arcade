import { useCallback, useEffect, useRef, useState } from 'react';
import { FIDEL_FAMILIES, VOWEL_ORDERS } from '../data/geezAlphabet';
import { audioEngine } from '../audio/AudioEngine';
import './DecomposeSyllable.css';

interface GameState {
  phase: 'menu' | 'playing' | 'result' | 'gameOver';
  score: number;
  streak: number;
  bestStreak: number;
  round: number;
  totalRounds: number;
  lives: number;
  // Target
  targetChar: string;
  targetFamilyIndex: number;
  targetVowelOrder: number;
  // Player picks
  selectedFamily: number | null;
  selectedVowel: number | null;
  familyCorrect: boolean | null;
  vowelCorrect: boolean | null;
  // Choices
  familyChoices: number[];
  vowelChoices: number[];
  difficulty: 'easy' | 'medium' | 'hard';
}

const DIFFICULTY_CONFIG = {
  easy:   { familyChoices: 4, vowelChoices: 4, rounds: 10, lives: 5, families: 8 },
  medium: { familyChoices: 6, vowelChoices: 7, rounds: 15, lives: 4, families: 16 },
  hard:   { familyChoices: 8, vowelChoices: 7, rounds: 20, lives: 3, families: 32 },
};

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildRound(difficulty: 'easy' | 'medium' | 'hard') {
  const config = DIFFICULTY_CONFIG[difficulty];
  const maxFam = Math.min(config.families, FIDEL_FAMILIES.length);

  const targetFamilyIndex = Math.floor(Math.random() * maxFam);
  const targetVowelOrder = Math.floor(Math.random() * 7);
  const targetChar = FIDEL_FAMILIES[targetFamilyIndex].chars[targetVowelOrder];

  // Build consonant family choices (include correct)
  const famSet = new Set<number>([targetFamilyIndex]);
  while (famSet.size < config.familyChoices) {
    famSet.add(Math.floor(Math.random() * maxFam));
  }
  const familyChoices = shuffle(Array.from(famSet));

  // Build vowel order choices (include correct)
  const vowSet = new Set<number>([targetVowelOrder]);
  while (vowSet.size < Math.min(config.vowelChoices, 7)) {
    vowSet.add(Math.floor(Math.random() * 7));
  }
  const vowelChoices = shuffle(Array.from(vowSet));

  return { targetChar, targetFamilyIndex, targetVowelOrder, familyChoices, vowelChoices };
}

export function DecomposeSyllable() {
  const [state, setState] = useState<GameState>({
    phase: 'menu',
    score: 0,
    streak: 0,
    bestStreak: 0,
    round: 0,
    totalRounds: 10,
    lives: 5,
    targetChar: '',
    targetFamilyIndex: 0,
    targetVowelOrder: 0,
    selectedFamily: null,
    selectedVowel: null,
    familyCorrect: null,
    vowelCorrect: null,
    familyChoices: [],
    vowelChoices: [],
    difficulty: 'easy',
  });

  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startGame = useCallback((difficulty: 'easy' | 'medium' | 'hard') => {
    const config = DIFFICULTY_CONFIG[difficulty];
    const round = buildRound(difficulty);
    setState({
      phase: 'playing',
      score: 0,
      streak: 0,
      bestStreak: 0,
      round: 1,
      totalRounds: config.rounds,
      lives: config.lives,
      targetChar: round.targetChar,
      targetFamilyIndex: round.targetFamilyIndex,
      targetVowelOrder: round.targetVowelOrder,
      selectedFamily: null,
      selectedVowel: null,
      familyCorrect: null,
      vowelCorrect: null,
      familyChoices: round.familyChoices,
      vowelChoices: round.vowelChoices,
      difficulty,
    });
    setTimeout(() => audioEngine.play(round.targetChar, ''), 300);
  }, []);

  const nextRound = useCallback((prev: GameState) => {
    if (prev.round >= prev.totalRounds || prev.lives <= 0) {
      audioEngine.playLevelComplete();
      setState(p => ({ ...p, phase: 'gameOver' }));
      return;
    }
    const round = buildRound(prev.difficulty);
    setState(p => ({
      ...p,
      phase: 'playing',
      round: p.round + 1,
      targetChar: round.targetChar,
      targetFamilyIndex: round.targetFamilyIndex,
      targetVowelOrder: round.targetVowelOrder,
      selectedFamily: null,
      selectedVowel: null,
      familyCorrect: null,
      vowelCorrect: null,
      familyChoices: round.familyChoices,
      vowelChoices: round.vowelChoices,
    }));
    setTimeout(() => audioEngine.play(round.targetChar, ''), 300);
  }, []);

  // Auto-advance after result
  useEffect(() => {
    if (state.phase === 'result') {
      resultTimerRef.current = setTimeout(() => nextRound(state), 1800);
      return () => {
        if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      };
    }
  }, [state.phase, state.round, nextRound]);

  const selectFamily = useCallback((fi: number) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;
      return { ...prev, selectedFamily: fi };
    });
  }, []);

  const selectVowel = useCallback((vo: number) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;
      return { ...prev, selectedVowel: vo };
    });
  }, []);

  // Submit when both are selected
  const submit = useCallback(() => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;
      if (prev.selectedFamily === null || prev.selectedVowel === null) return prev;

      const famCorrect = prev.selectedFamily === prev.targetFamilyIndex;
      const vowCorrect = prev.selectedVowel === prev.targetVowelOrder;
      const bothCorrect = famCorrect && vowCorrect;

      if (bothCorrect) {
        audioEngine.playHit();
      } else {
        audioEngine.playWrong();
      }

      const newStreak = bothCorrect ? prev.streak + 1 : 0;
      const streakBonus = bothCorrect && newStreak > 1 ? newStreak * 20 : 0;
      // Partial credit: one correct = 50, both = 150
      const baseScore = bothCorrect ? 150 : (famCorrect || vowCorrect ? 50 : 0);

      return {
        ...prev,
        phase: 'result',
        familyCorrect: famCorrect,
        vowelCorrect: vowCorrect,
        score: prev.score + baseScore + streakBonus,
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        lives: bothCorrect ? prev.lives : prev.lives - 1,
      };
    });
  }, []);

  const replayAudio = useCallback(() => {
    audioEngine.play(state.targetChar, '');
  }, [state.targetChar]);

  return (
    <div className="ds-container">
      {/* Menu */}
      {state.phase === 'menu' && (
        <div className="ds-menu">
          <h1 className="ds-title">
            <span className="ds-title-geez">መበተን</span>
            <span className="ds-title-main">DECOMPOSE THE SYLLABLE</span>
          </h1>
          <p className="ds-subtitle">
            See a Ge'ez character and break it apart!
            <br />
            Identify its <strong style={{ color: '#44cc88' }}>consonant family</strong> and
            its <strong style={{ color: '#4488ff' }}>vowel order</strong> separately.
            <br />
            Get both right for full points — or partial credit for one!
          </p>
          <div className="ds-difficulty-select">
            <button className="ds-diff-btn ds-easy" onClick={() => startGame('easy')}>
              EASY<span>4 choices · 5 lives</span>
            </button>
            <button className="ds-diff-btn ds-medium" onClick={() => startGame('medium')}>
              MEDIUM<span>6-7 choices · 4 lives</span>
            </button>
            <button className="ds-diff-btn ds-hard" onClick={() => startGame('hard')}>
              HARD<span>All choices · 3 lives</span>
            </button>
          </div>
        </div>
      )}

      {/* Playing / Result */}
      {(state.phase === 'playing' || state.phase === 'result') && (
        <div className="ds-game">
          {/* HUD */}
          <div className="ds-hud">
            <div className="ds-hud-left">
              <span className="ds-score">SCORE: {state.score}</span>
              {state.streak > 1 && <span className="ds-streak">🔥 x{state.streak}</span>}
            </div>
            <div className="ds-hud-center">
              <span className="ds-round">Round {state.round}/{state.totalRounds}</span>
            </div>
            <div className="ds-hud-right">
              <span className="ds-lives">
                {'♥'.repeat(state.lives)}{'♡'.repeat(Math.max(0, DIFFICULTY_CONFIG[state.difficulty].lives - state.lives))}
              </span>
            </div>
          </div>

          {/* Mystery character */}
          <div className="ds-mystery-section">
            <div className={`ds-mystery-card ${state.phase === 'result' ? (state.familyCorrect && state.vowelCorrect ? 'ds-mystery-correct' : 'ds-mystery-wrong') : ''}`}>
              <span className="ds-mystery-char">{state.targetChar}</span>
            </div>
            <button className="ds-replay-btn" onClick={replayAudio}>
              🔊 Listen
            </button>
          </div>

          {/* Two answer panels */}
          <div className="ds-panels">
            {/* Consonant Family panel */}
            <div className="ds-panel ds-panel-consonant">
              <div className="ds-panel-header">
                <span className="ds-panel-title">Which consonant family?</span>
                {state.phase === 'result' && (
                  <span className={state.familyCorrect ? 'ds-check-correct' : 'ds-check-wrong'}>
                    {state.familyCorrect ? '✓' : '✗'}
                  </span>
                )}
              </div>
              <div className="ds-choices">
                {state.familyChoices.map(fi => {
                  const family = FIDEL_FAMILIES[fi];
                  const isSelected = state.selectedFamily === fi;
                  const isCorrect = state.phase === 'result' && fi === state.targetFamilyIndex;
                  const isWrongPick = state.phase === 'result' && isSelected && !state.familyCorrect;

                  let cls = 'ds-choice ds-choice-consonant';
                  if (isSelected && state.phase === 'playing') cls += ' ds-choice-selected';
                  if (isCorrect) cls += ' ds-choice-correct';
                  if (isWrongPick) cls += ' ds-choice-wrong';

                  return (
                    <button
                      key={fi}
                      className={cls}
                      onClick={() => selectFamily(fi)}
                      disabled={state.phase === 'result'}
                    >
                      <span className="ds-choice-char">{family.chars[0]}</span>
                      <span className="ds-choice-label">{family.romanBase}</span>
                      <span className="ds-choice-preview">
                        {family.chars.slice(0, 7).join(' ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Vowel Order panel */}
            <div className="ds-panel ds-panel-vowel">
              <div className="ds-panel-header">
                <span className="ds-panel-title">Which vowel order?</span>
                {state.phase === 'result' && (
                  <span className={state.vowelCorrect ? 'ds-check-correct' : 'ds-check-wrong'}>
                    {state.vowelCorrect ? '✓' : '✗'}
                  </span>
                )}
              </div>
              <div className="ds-choices">
                {state.vowelChoices.map(vo => {
                  const vowel = VOWEL_ORDERS[vo];
                  const isSelected = state.selectedVowel === vo;
                  const isCorrect = state.phase === 'result' && vo === state.targetVowelOrder;
                  const isWrongPick = state.phase === 'result' && isSelected && !state.vowelCorrect;

                  let cls = 'ds-choice ds-choice-vowel';
                  if (isSelected && state.phase === 'playing') cls += ' ds-choice-selected';
                  if (isCorrect) cls += ' ds-choice-correct';
                  if (isWrongPick) cls += ' ds-choice-wrong';

                  return (
                    <button
                      key={vo}
                      className={cls}
                      onClick={() => selectVowel(vo)}
                      disabled={state.phase === 'result'}
                    >
                      <span className="ds-choice-order">{vo + 1}</span>
                      <span className="ds-choice-label">{vowel.vowel}</span>
                      <span className="ds-choice-desc">{vowel.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Submit button */}
          {state.phase === 'playing' && (
            <div className="ds-submit-area">
              <button
                className="ds-submit-btn"
                onClick={submit}
                disabled={state.selectedFamily === null || state.selectedVowel === null}
              >
                {state.selectedFamily !== null && state.selectedVowel !== null
                  ? `Check: ${FIDEL_FAMILIES[state.selectedFamily].romanBase} + ${VOWEL_ORDERS[state.selectedVowel].vowel} = ?`
                  : 'Select both to check'
                }
              </button>
            </div>
          )}

          {/* Result feedback */}
          {state.phase === 'result' && (
            <div className="ds-result-feedback">
              {state.familyCorrect && state.vowelCorrect ? (
                <span className="ds-feedback-correct">
                  ✓ Perfect! {state.targetChar} = {FIDEL_FAMILIES[state.targetFamilyIndex].romanBase} + {VOWEL_ORDERS[state.targetVowelOrder].vowel}
                </span>
              ) : (
                <span className="ds-feedback-wrong">
                  {state.targetChar} = {FIDEL_FAMILIES[state.targetFamilyIndex].romanBase} + {VOWEL_ORDERS[state.targetVowelOrder].vowel}
                  {(state.familyCorrect || state.vowelCorrect) && ' (partial credit!)'}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Game Over */}
      {state.phase === 'gameOver' && (
        <div className="ds-menu">
          <h2 className="ds-gameover-title">
            {state.lives > 0 ? 'GAME COMPLETE!' : 'GAME OVER'}
          </h2>
          <div className="ds-final-stats">
            <div className="ds-stat">
              <span className="ds-stat-value">{state.score}</span>
              <span className="ds-stat-label">Score</span>
            </div>
            <div className="ds-stat">
              <span className="ds-stat-value">{state.bestStreak}</span>
              <span className="ds-stat-label">Best Streak</span>
            </div>
            <div className="ds-stat">
              <span className="ds-stat-value">{state.round}</span>
              <span className="ds-stat-label">Rounds</span>
            </div>
          </div>
          <div className="ds-difficulty-select">
            <button className="ds-diff-btn ds-easy" onClick={() => startGame('easy')}>EASY</button>
            <button className="ds-diff-btn ds-medium" onClick={() => startGame('medium')}>MEDIUM</button>
            <button className="ds-diff-btn ds-hard" onClick={() => startGame('hard')}>HARD</button>
          </div>
        </div>
      )}
    </div>
  );
}
