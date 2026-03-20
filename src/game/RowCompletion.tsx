import { useCallback, useEffect, useRef, useState } from 'react';
import { FIDEL_FAMILIES, VOWEL_ORDERS } from '../data/geezAlphabet';
import { audioEngine } from '../audio/AudioEngine';
import './RowCompletion.css';

type Mode = 'row' | 'column'; // row = fill vowel gaps in a family, column = fill consonant gaps in a vowel order

interface Slot {
  index: number;        // position in the row/column
  char: string;         // correct character
  familyIndex: number;
  vowelOrder: number;
  revealed: boolean;    // shown as given
  filledChar: string | null;  // what player placed
  correct: boolean | null;
}

interface AnswerOption {
  char: string;
  familyIndex: number;
  vowelOrder: number;
  used: boolean;
}

interface GameState {
  phase: 'menu' | 'playing' | 'checking' | 'result' | 'gameOver';
  mode: Mode;
  score: number;
  streak: number;
  bestStreak: number;
  round: number;
  totalRounds: number;
  lives: number;
  // Current round data
  familyIndex: number;       // for row mode
  vowelOrderIndex: number;   // for column mode
  slots: Slot[];
  answers: AnswerOption[];
  selectedAnswer: number | null; // index into answers
  difficulty: 'easy' | 'medium' | 'hard';
}

const DIFFICULTY_CONFIG = {
  easy:   { blanks: 2, rounds: 10, lives: 5, families: 10, extraAnswers: 1 },
  medium: { blanks: 3, rounds: 12, lives: 4, families: 20, extraAnswers: 2 },
  hard:   { blanks: 5, rounds: 15, lives: 3, families: 32, extraAnswers: 3 },
};

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildRowRound(difficulty: 'easy' | 'medium' | 'hard'): {
  familyIndex: number; slots: Slot[]; answers: AnswerOption[];
} {
  const config = DIFFICULTY_CONFIG[difficulty];
  const maxFam = Math.min(config.families, FIDEL_FAMILIES.length);
  const familyIndex = Math.floor(Math.random() * maxFam);
  const family = FIDEL_FAMILIES[familyIndex];

  // Pick which positions to blank out
  const allPositions = [0, 1, 2, 3, 4, 5, 6];
  const blanked = new Set(shuffle(allPositions).slice(0, config.blanks));

  const slots: Slot[] = allPositions.map(i => ({
    index: i,
    char: family.chars[i],
    familyIndex,
    vowelOrder: i,
    revealed: !blanked.has(i),
    filledChar: null,
    correct: null,
  }));

  // Build answer options: correct ones + distractors
  const correctAnswers: AnswerOption[] = Array.from(blanked).map(i => ({
    char: family.chars[i],
    familyIndex,
    vowelOrder: i,
    used: false,
  }));

  // Add distractors from other families at same vowel orders
  const distractors: AnswerOption[] = [];
  for (let d = 0; d < config.extraAnswers; d++) {
    let dFam: number;
    do { dFam = Math.floor(Math.random() * maxFam); } while (dFam === familyIndex);
    const dVo = Math.floor(Math.random() * 7);
    distractors.push({
      char: FIDEL_FAMILIES[dFam].chars[dVo],
      familyIndex: dFam,
      vowelOrder: dVo,
      used: false,
    });
  }

  return {
    familyIndex,
    slots,
    answers: shuffle([...correctAnswers, ...distractors]),
  };
}

function buildColumnRound(difficulty: 'easy' | 'medium' | 'hard'): {
  vowelOrderIndex: number; slots: Slot[]; answers: AnswerOption[];
} {
  const config = DIFFICULTY_CONFIG[difficulty];
  const maxFam = Math.min(config.families, FIDEL_FAMILIES.length);
  const vowelOrderIndex = Math.floor(Math.random() * 7);

  // Pick families to show in this column
  const familyIndices = shuffle(
    Array.from({ length: maxFam }, (_, i) => i)
  ).slice(0, 7);

  const blanked = new Set(shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, Math.min(config.blanks, 7)));

  const slots: Slot[] = familyIndices.map((fi, i) => ({
    index: i,
    char: FIDEL_FAMILIES[fi].chars[vowelOrderIndex],
    familyIndex: fi,
    vowelOrder: vowelOrderIndex,
    revealed: !blanked.has(i),
    filledChar: null,
    correct: null,
  }));

  const correctAnswers: AnswerOption[] = Array.from(blanked).map(i => ({
    char: slots[i].char,
    familyIndex: slots[i].familyIndex,
    vowelOrder: vowelOrderIndex,
    used: false,
  }));

  const distractors: AnswerOption[] = [];
  for (let d = 0; d < config.extraAnswers; d++) {
    const dFam = Math.floor(Math.random() * maxFam);
    const dVo = (vowelOrderIndex + 1 + Math.floor(Math.random() * 6)) % 7;
    distractors.push({
      char: FIDEL_FAMILIES[dFam].chars[dVo],
      familyIndex: dFam,
      vowelOrder: dVo,
      used: false,
    });
  }

  return {
    vowelOrderIndex,
    slots,
    answers: shuffle([...correctAnswers, ...distractors]),
  };
}

export function RowCompletion() {
  const [state, setState] = useState<GameState>({
    phase: 'menu',
    mode: 'row',
    score: 0,
    streak: 0,
    bestStreak: 0,
    round: 0,
    totalRounds: 10,
    lives: 5,
    familyIndex: 0,
    vowelOrderIndex: 0,
    slots: [],
    answers: [],
    selectedAnswer: null,
    difficulty: 'easy',
  });

  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startGame = useCallback((difficulty: 'easy' | 'medium' | 'hard') => {
    const config = DIFFICULTY_CONFIG[difficulty];
    const mode: Mode = 'row';
    const round = buildRowRound(difficulty);

    setState({
      phase: 'playing',
      mode,
      score: 0,
      streak: 0,
      bestStreak: 0,
      round: 1,
      totalRounds: config.rounds,
      lives: config.lives,
      familyIndex: round.familyIndex,
      vowelOrderIndex: 0,
      slots: round.slots,
      answers: round.answers,
      selectedAnswer: null,
      difficulty,
    });
  }, []);

  const nextRound = useCallback((prev: GameState) => {
    if (prev.round >= prev.totalRounds || prev.lives <= 0) {
      audioEngine.playLevelComplete();
      setState(p => ({ ...p, phase: 'gameOver' }));
      return;
    }

    // Alternate between row and column mode
    const newMode: Mode = prev.mode === 'row' ? 'column' : 'row';
    const roundData = newMode === 'row'
      ? buildRowRound(prev.difficulty)
      : buildColumnRound(prev.difficulty);

    setState(p => ({
      ...p,
      phase: 'playing',
      mode: newMode,
      round: p.round + 1,
      familyIndex: 'familyIndex' in roundData ? roundData.familyIndex : p.familyIndex,
      vowelOrderIndex: 'vowelOrderIndex' in roundData ? roundData.vowelOrderIndex : p.vowelOrderIndex,
      slots: roundData.slots,
      answers: roundData.answers,
      selectedAnswer: null,
    }));
  }, []);

  // Auto-advance after result
  useEffect(() => {
    if (state.phase === 'result') {
      resultTimerRef.current = setTimeout(() => nextRound(state), 2000);
      return () => { if (resultTimerRef.current) clearTimeout(resultTimerRef.current); };
    }
  }, [state.phase, state.round, nextRound]);

  const selectAnswer = useCallback((idx: number) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;
      if (prev.answers[idx].used) return prev;
      return { ...prev, selectedAnswer: idx };
    });
  }, []);

  const placeInSlot = useCallback((slotIdx: number) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;
      if (prev.selectedAnswer === null) return prev;
      const slot = prev.slots[slotIdx];
      if (slot.revealed || slot.filledChar !== null) return prev;

      const answer = prev.answers[prev.selectedAnswer];
      audioEngine.play(answer.char, '');

      const newSlots = prev.slots.map((s, i) =>
        i === slotIdx ? { ...s, filledChar: answer.char } : s
      );
      const newAnswers = prev.answers.map((a, i) =>
        i === prev.selectedAnswer ? { ...a, used: true } : a
      );

      // Check if all blanks are filled
      const allFilled = newSlots.every(s => s.revealed || s.filledChar !== null);

      if (allFilled) {
        // Check correctness
        let correctCount = 0;
        const checkedSlots = newSlots.map(s => {
          if (s.revealed) return s;
          const isCorrect = s.filledChar === s.char;
          if (isCorrect) correctCount++;
          return { ...s, correct: isCorrect };
        });

        const totalBlanks = checkedSlots.filter(s => !s.revealed).length;
        const allCorrect = correctCount === totalBlanks;

        if (allCorrect) {
          audioEngine.playHit();
        } else {
          audioEngine.playWrong();
        }

        const newStreak = allCorrect ? prev.streak + 1 : 0;
        const baseScore = correctCount * 50;
        const perfectBonus = allCorrect ? 100 : 0;
        const streakBonus = allCorrect && newStreak > 1 ? newStreak * 25 : 0;

        return {
          ...prev,
          phase: 'result',
          slots: checkedSlots,
          answers: newAnswers,
          selectedAnswer: null,
          score: prev.score + baseScore + perfectBonus + streakBonus,
          streak: newStreak,
          bestStreak: Math.max(prev.bestStreak, newStreak),
          lives: allCorrect ? prev.lives : prev.lives - 1,
        };
      }

      return { ...prev, slots: newSlots, answers: newAnswers, selectedAnswer: null };
    });
  }, []);

  // Remove a placed answer from a slot
  const removeFromSlot = useCallback((slotIdx: number) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;
      const slot = prev.slots[slotIdx];
      if (slot.revealed || slot.filledChar === null) return prev;

      // Find the answer that was placed and un-use it
      const answerIdx = prev.answers.findIndex(a => a.char === slot.filledChar && a.used);
      const newSlots = prev.slots.map((s, i) =>
        i === slotIdx ? { ...s, filledChar: null } : s
      );
      const newAnswers = answerIdx >= 0
        ? prev.answers.map((a, i) => i === answerIdx ? { ...a, used: false } : a)
        : prev.answers;

      return { ...prev, slots: newSlots, answers: newAnswers };
    });
  }, []);

  const modeLabel = state.mode === 'row' ? 'Row' : 'Column';
  const familyName = FIDEL_FAMILIES[state.familyIndex]?.romanBase || '';
  const vowelName = VOWEL_ORDERS[state.vowelOrderIndex]?.label || '';

  return (
    <div className="rc-container">
      {/* Menu */}
      {state.phase === 'menu' && (
        <div className="rc-menu">
          <h1 className="rc-title">
            <span className="rc-title-geez">መሙያ</span>
            <span className="rc-title-main">ROW & COLUMN COMPLETION</span>
          </h1>
          <p className="rc-subtitle">
            A consonant family row or vowel order column is shown with gaps.
            <br />
            Drag the right characters into the empty slots to complete it!
            <br />
            Watch out for decoy characters that don't belong!
          </p>
          <div className="rc-difficulty-select">
            <button className="rc-diff-btn rc-easy" onClick={() => startGame('easy')}>
              EASY<span>2 blanks · 5 lives</span>
            </button>
            <button className="rc-diff-btn rc-medium" onClick={() => startGame('medium')}>
              MEDIUM<span>3 blanks · 4 lives</span>
            </button>
            <button className="rc-diff-btn rc-hard" onClick={() => startGame('hard')}>
              HARD<span>5 blanks · 3 lives</span>
            </button>
          </div>
        </div>
      )}

      {/* Playing / Result */}
      {(state.phase === 'playing' || state.phase === 'checking' || state.phase === 'result') && (
        <div className="rc-game">
          {/* HUD */}
          <div className="rc-hud">
            <div className="rc-hud-left">
              <span className="rc-score">SCORE: {state.score}</span>
              {state.streak > 1 && <span className="rc-streak">🔥 x{state.streak}</span>}
            </div>
            <div className="rc-hud-center">
              <span className="rc-round">Round {state.round}/{state.totalRounds}</span>
            </div>
            <div className="rc-hud-right">
              <span className="rc-lives">
                {'♥'.repeat(state.lives)}{'♡'.repeat(Math.max(0, DIFFICULTY_CONFIG[state.difficulty].lives - state.lives))}
              </span>
            </div>
          </div>

          {/* Mode label */}
          <div className="rc-mode-bar">
            <span className={`rc-mode-badge ${state.mode === 'row' ? 'rc-mode-row' : 'rc-mode-col'}`}>
              {state.mode === 'row'
                ? `Complete the ${familyName} family row`
                : `Complete the ${vowelName} column`
              }
            </span>
          </div>

          {/* Slots */}
          <div className="rc-slots-section">
            {/* Headers */}
            <div className="rc-slot-headers">
              {state.mode === 'row'
                ? VOWEL_ORDERS.map((vo, i) => (
                    <div key={i} className="rc-slot-header">{vo.vowel}</div>
                  ))
                : state.slots.map((slot, i) => (
                    <div key={i} className="rc-slot-header">
                      {FIDEL_FAMILIES[slot.familyIndex].romanBase}
                    </div>
                  ))
              }
            </div>

            {/* Slot cells */}
            <div className="rc-slots-row">
              {state.slots.map((slot, i) => {
                let cls = 'rc-slot';
                if (slot.revealed) cls += ' rc-slot-given';
                else if (slot.filledChar) cls += ' rc-slot-filled';
                else cls += ' rc-slot-empty';

                if (state.phase === 'result' && !slot.revealed) {
                  cls += slot.correct ? ' rc-slot-correct' : ' rc-slot-wrong';
                }

                const isDropTarget = !slot.revealed && !slot.filledChar && state.selectedAnswer !== null;

                return (
                  <button
                    key={i}
                    className={`${cls} ${isDropTarget ? 'rc-slot-droptarget' : ''}`}
                    onClick={() => {
                      if (slot.filledChar && state.phase === 'playing') {
                        removeFromSlot(i);
                      } else if (isDropTarget) {
                        placeInSlot(i);
                      }
                    }}
                    disabled={slot.revealed || state.phase === 'result'}
                  >
                    <span className="rc-slot-char">
                      {slot.revealed ? slot.char : (slot.filledChar || '?')}
                    </span>
                    {state.phase === 'result' && !slot.revealed && !slot.correct && (
                      <span className="rc-slot-answer">{slot.char}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Answer bank */}
          {state.phase === 'playing' && (
            <div className="rc-answer-section">
              <div className="rc-answer-label">Choose characters to place:</div>
              <div className="rc-answer-bank">
                {state.answers.map((ans, i) => (
                  <button
                    key={i}
                    className={`rc-answer ${ans.used ? 'rc-answer-used' : ''} ${state.selectedAnswer === i ? 'rc-answer-selected' : ''}`}
                    onClick={() => selectAnswer(i)}
                    disabled={ans.used}
                  >
                    <span className="rc-answer-char">{ans.char}</span>
                  </button>
                ))}
              </div>
              {state.selectedAnswer !== null && (
                <div className="rc-hint">Now click an empty slot to place it</div>
              )}
            </div>
          )}

          {/* Result feedback */}
          {state.phase === 'result' && (
            <div className="rc-result-feedback">
              {state.slots.every(s => s.revealed || s.correct) ? (
                <span className="rc-feedback-correct">✓ Perfect! All slots correct!</span>
              ) : (
                <span className="rc-feedback-partial">
                  {state.slots.filter(s => !s.revealed && s.correct).length}/
                  {state.slots.filter(s => !s.revealed).length} correct
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Game Over */}
      {state.phase === 'gameOver' && (
        <div className="rc-menu">
          <h2 className="rc-gameover-title">
            {state.lives > 0 ? 'GAME COMPLETE!' : 'GAME OVER'}
          </h2>
          <div className="rc-final-stats">
            <div className="rc-stat">
              <span className="rc-stat-value">{state.score}</span>
              <span className="rc-stat-label">Score</span>
            </div>
            <div className="rc-stat">
              <span className="rc-stat-value">{state.bestStreak}</span>
              <span className="rc-stat-label">Best Streak</span>
            </div>
            <div className="rc-stat">
              <span className="rc-stat-value">{state.round}</span>
              <span className="rc-stat-label">Rounds</span>
            </div>
          </div>
          <div className="rc-difficulty-select">
            <button className="rc-diff-btn rc-easy" onClick={() => startGame('easy')}>EASY</button>
            <button className="rc-diff-btn rc-medium" onClick={() => startGame('medium')}>MEDIUM</button>
            <button className="rc-diff-btn rc-hard" onClick={() => startGame('hard')}>HARD</button>
          </div>
        </div>
      )}
    </div>
  );
}
