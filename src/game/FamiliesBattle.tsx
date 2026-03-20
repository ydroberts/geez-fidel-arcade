import { useCallback, useEffect, useRef, useState } from 'react';
import { FIDEL_FAMILIES, VOWEL_ORDERS } from '../data/geezAlphabet';
import { audioEngine } from '../audio/AudioEngine';
import './FamiliesBattle.css';

interface Fighter {
  name: string;
  familyIndex: number;
  chars: string[];
  hp: number;
  maxHp: number;
}

type QuestionType = 'identify-vowel' | 'identify-family' | 'complete-char' | 'audio-match';

interface Question {
  type: QuestionType;
  prompt: string;
  audioChar?: string;
  choices: { label: string; correct: boolean }[];
  correctIndex: number;
}

interface GameState {
  phase: 'menu' | 'picking' | 'battle' | 'answering' | 'result' | 'victory' | 'defeat';
  playerFighter: Fighter | null;
  aiFighter: Fighter | null;
  playerScore: number;
  aiScore: number;
  round: number;
  totalRounds: number;
  currentQuestion: Question | null;
  selectedAnswer: number | null;
  wasCorrect: boolean | null;
  territory: number[]; // 7 segments, -1 = AI, 0 = neutral, 1 = player
  difficulty: 'easy' | 'medium' | 'hard';
  availableFamilies: number[];
  battleLog: string[];
}

const DIFFICULTY_CONFIG = {
  easy:   { aiAccuracy: 0.4, rounds: 7, hpMultiplier: 1 },
  medium: { aiAccuracy: 0.6, rounds: 10, hpMultiplier: 1 },
  hard:   { aiAccuracy: 0.8, rounds: 12, hpMultiplier: 1 },
};

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildQuestion(playerFi: number, aiFi: number, allFamilies: number[]): Question {
  const types: QuestionType[] = ['identify-vowel', 'identify-family', 'complete-char', 'audio-match'];
  const type = types[Math.floor(Math.random() * types.length)];

  const activeFi = Math.random() > 0.5 ? playerFi : aiFi;
  const family = FIDEL_FAMILIES[activeFi];

  switch (type) {
    case 'identify-vowel': {
      const vo = Math.floor(Math.random() * 7);
      const char = family.chars[vo];
      const correctLabel = VOWEL_ORDERS[vo].label;
      const wrongVOs = shuffle([0,1,2,3,4,5,6].filter(v => v !== vo)).slice(0, 3);
      const choices = shuffle([
        { label: correctLabel, correct: true },
        ...wrongVOs.map(v => ({ label: VOWEL_ORDERS[v].label, correct: false })),
      ]);
      return {
        type,
        prompt: `What vowel order is "${char}" ?`,
        audioChar: char,
        choices,
        correctIndex: choices.findIndex(c => c.correct),
      };
    }
    case 'identify-family': {
      const vo = Math.floor(Math.random() * 7);
      const char = family.chars[vo];
      const correctLabel = family.romanBase;
      const wrongFams = shuffle(allFamilies.filter(f => f !== activeFi)).slice(0, 3);
      const choices = shuffle([
        { label: correctLabel, correct: true },
        ...wrongFams.map(f => ({ label: FIDEL_FAMILIES[f].romanBase, correct: false })),
      ]);
      return {
        type,
        prompt: `Which family does "${char}" belong to?`,
        audioChar: char,
        choices,
        correctIndex: choices.findIndex(c => c.correct),
      };
    }
    case 'complete-char': {
      const vo = Math.floor(Math.random() * 7);
      const char = family.chars[vo];
      const wrongVOs = shuffle([0,1,2,3,4,5,6].filter(v => v !== vo)).slice(0, 3);
      const choices = shuffle([
        { label: char, correct: true },
        ...wrongVOs.map(v => ({ label: family.chars[v], correct: false })),
      ]);
      return {
        type,
        prompt: `${family.romanBase} + ${VOWEL_ORDERS[vo].vowel} = ?`,
        choices,
        correctIndex: choices.findIndex(c => c.correct),
      };
    }
    case 'audio-match': {
      const vo = Math.floor(Math.random() * 7);
      const char = family.chars[vo];
      const wrongFams = shuffle(allFamilies.filter(f => f !== activeFi)).slice(0, 3);
      const choices = shuffle([
        { label: char, correct: true },
        ...wrongFams.map(f => ({ label: FIDEL_FAMILIES[f].chars[vo], correct: false })),
      ]);
      return {
        type,
        prompt: '🔊 Listen! Which character matches the sound?',
        audioChar: char,
        choices,
        correctIndex: choices.findIndex(c => c.correct),
      };
    }
  }
}

export function FamiliesBattle() {
  const [state, setState] = useState<GameState>({
    phase: 'menu',
    playerFighter: null,
    aiFighter: null,
    playerScore: 0,
    aiScore: 0,
    round: 0,
    totalRounds: 7,
    currentQuestion: null,
    selectedAnswer: null,
    wasCorrect: null,
    territory: [0, 0, 0, 0, 0, 0, 0],
    difficulty: 'easy',
    availableFamilies: [],
    battleLog: [],
  });

  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPicking = useCallback((difficulty: 'easy' | 'medium' | 'hard') => {
    const famCount = difficulty === 'easy' ? 12 : difficulty === 'medium' ? 20 : 32;
    const available = Array.from({ length: Math.min(famCount, FIDEL_FAMILIES.length) }, (_, i) => i);
    setState(prev => ({
      ...prev,
      phase: 'picking',
      difficulty,
      totalRounds: DIFFICULTY_CONFIG[difficulty].rounds,
      availableFamilies: available,
      playerFighter: null,
      aiFighter: null,
      playerScore: 0,
      aiScore: 0,
      round: 0,
      territory: [0, 0, 0, 0, 0, 0, 0],
      battleLog: [],
    }));
  }, []);

  const pickFamily = useCallback((fi: number) => {
    setState(prev => {
      if (prev.phase !== 'picking') return prev;
      const family = FIDEL_FAMILIES[fi];
      const player: Fighter = {
        name: family.romanBase.toUpperCase(),
        familyIndex: fi,
        chars: family.chars,
        hp: 100,
        maxHp: 100,
      };

      // AI picks a different family
      const aiOptions = prev.availableFamilies.filter(f => f !== fi);
      const aiFi = aiOptions[Math.floor(Math.random() * aiOptions.length)];
      const aiFamily = FIDEL_FAMILIES[aiFi];
      const ai: Fighter = {
        name: aiFamily.romanBase.toUpperCase(),
        familyIndex: aiFi,
        chars: aiFamily.chars,
        hp: 100,
        maxHp: 100,
      };

      // Build first question
      const question = buildQuestion(fi, aiFi, prev.availableFamilies);
      if (question.audioChar) {
        setTimeout(() => audioEngine.play(question.audioChar!, ''), 500);
      }

      return {
        ...prev,
        phase: 'battle',
        playerFighter: player,
        aiFighter: ai,
        round: 1,
        currentQuestion: question,
        selectedAnswer: null,
        wasCorrect: null,
        battleLog: [`⚔️ ${player.name} vs ${ai.name} — Battle begins!`],
      };
    });
  }, []);

  const answerQuestion = useCallback((ansIdx: number) => {
    setState(prev => {
      if (prev.phase !== 'battle' || !prev.currentQuestion) return prev;

      const correct = prev.currentQuestion.choices[ansIdx].correct;
      const config = DIFFICULTY_CONFIG[prev.difficulty];

      // AI answers
      const aiCorrect = Math.random() < config.aiAccuracy;

      let playerHp = prev.playerFighter!.hp;
      let aiHp = prev.aiFighter!.hp;
      let playerScore = prev.playerScore;
      let aiScore = prev.aiScore;
      const territory = [...prev.territory];
      const log = [...prev.battleLog];
      const territoryIdx = (prev.round - 1) % 7;

      if (correct && !aiCorrect) {
        // Player wins round
        aiHp = Math.max(0, aiHp - 15);
        playerScore += 100;
        territory[territoryIdx] = 1;
        log.push(`✓ Round ${prev.round}: You got it right, AI missed! -15 HP to AI`);
        audioEngine.playHit();
      } else if (!correct && aiCorrect) {
        // AI wins round
        playerHp = Math.max(0, playerHp - 15);
        aiScore += 100;
        territory[territoryIdx] = -1;
        log.push(`✗ Round ${prev.round}: AI got it right, you missed! -15 HP to you`);
        audioEngine.playWrong();
      } else if (correct && aiCorrect) {
        // Both right — small advantage to player
        aiHp = Math.max(0, aiHp - 5);
        playerScore += 50;
        territory[territoryIdx] = 1;
        log.push(`⚡ Round ${prev.round}: Both correct! Slight edge to you`);
        audioEngine.playHit();
      } else {
        // Both wrong
        log.push(`💨 Round ${prev.round}: Both missed! No damage`);
        audioEngine.playWrong();
      }

      const playerFighter = { ...prev.playerFighter!, hp: playerHp };
      const aiFighter = { ...prev.aiFighter!, hp: aiHp };

      // Check if battle ends
      if (playerHp <= 0) {
        audioEngine.playGameOver();
        return { ...prev, phase: 'defeat' as const, playerFighter, aiFighter, playerScore, aiScore, territory, battleLog: log, selectedAnswer: ansIdx, wasCorrect: correct };
      }
      if (aiHp <= 0 || prev.round >= prev.totalRounds) {
        const won = playerScore >= aiScore;
        if (won) audioEngine.playLevelComplete();
        else audioEngine.playGameOver();
        return {
          ...prev,
          phase: (won ? 'victory' : 'defeat') as 'victory' | 'defeat',
          playerFighter, aiFighter, playerScore, aiScore, territory, battleLog: log,
          selectedAnswer: ansIdx, wasCorrect: correct,
        };
      }

      return {
        ...prev,
        phase: 'result' as const,
        playerFighter, aiFighter, playerScore, aiScore, territory, battleLog: log,
        selectedAnswer: ansIdx, wasCorrect: correct,
      };
    });
  }, []);

  // Auto-advance after result
  useEffect(() => {
    if (state.phase === 'result') {
      resultTimerRef.current = setTimeout(() => {
        setState(prev => {
          const question = buildQuestion(
            prev.playerFighter!.familyIndex,
            prev.aiFighter!.familyIndex,
            prev.availableFamilies,
          );
          if (question.audioChar) {
            setTimeout(() => audioEngine.play(question.audioChar!, ''), 200);
          }
          return {
            ...prev,
            phase: 'battle',
            round: prev.round + 1,
            currentQuestion: question,
            selectedAnswer: null,
            wasCorrect: null,
          };
        });
      }, 1500);
      return () => { if (resultTimerRef.current) clearTimeout(resultTimerRef.current); };
    }
  }, [state.phase, state.round]);

  const replayAudio = useCallback(() => {
    if (state.currentQuestion?.audioChar) {
      audioEngine.play(state.currentQuestion.audioChar, '');
    }
  }, [state.currentQuestion]);

  return (
    <div className="fb-container">
      {/* Menu */}
      {state.phase === 'menu' && (
        <div className="fb-menu">
          <h1 className="fb-title">
            <span className="fb-title-geez">ውጊያ</span>
            <span className="fb-title-main">CONSONANT FAMILIES BATTLE</span>
          </h1>
          <p className="fb-subtitle">
            Pick a consonant family as your fighter and battle against the AI!
            <br />
            Answer questions about Ge'ez syllables to deal damage.
            <br />
            Conquer territory and defeat your opponent!
          </p>
          <div className="fb-difficulty-select">
            <button className="fb-diff-btn fb-easy" onClick={() => startPicking('easy')}>
              EASY<span>AI 40% accuracy</span>
            </button>
            <button className="fb-diff-btn fb-medium" onClick={() => startPicking('medium')}>
              MEDIUM<span>AI 60% accuracy</span>
            </button>
            <button className="fb-diff-btn fb-hard" onClick={() => startPicking('hard')}>
              HARD<span>AI 80% accuracy</span>
            </button>
          </div>
        </div>
      )}

      {/* Pick your fighter */}
      {state.phase === 'picking' && (
        <div className="fb-picking">
          <h2 className="fb-pick-title">Choose Your Fighter!</h2>
          <p className="fb-pick-subtitle">Pick a consonant family to battle with</p>
          <div className="fb-family-grid">
            {state.availableFamilies.map(fi => {
              const family = FIDEL_FAMILIES[fi];
              return (
                <button
                  key={fi}
                  className="fb-family-card"
                  onClick={() => pickFamily(fi)}
                >
                  <span className="fb-family-first">{family.chars[0]}</span>
                  <span className="fb-family-name">{family.romanBase}</span>
                  <span className="fb-family-row">{family.chars.join(' ')}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Battle / Result */}
      {(state.phase === 'battle' || state.phase === 'result') && state.playerFighter && state.aiFighter && (
        <div className="fb-battle">
          {/* Fighters */}
          <div className="fb-fighters">
            <div className="fb-fighter fb-fighter-player">
              <div className="fb-fighter-label">YOU</div>
              <div className="fb-fighter-char">{state.playerFighter.chars[0]}</div>
              <div className="fb-fighter-name">{state.playerFighter.name}</div>
              <div className="fb-hp-bar">
                <div className="fb-hp-fill fb-hp-player" style={{ width: `${state.playerFighter.hp}%` }} />
              </div>
              <div className="fb-hp-text">{state.playerFighter.hp} HP</div>
              <div className="fb-fighter-score">{state.playerScore} pts</div>
            </div>

            <div className="fb-vs">
              <span className="fb-vs-text">VS</span>
              <span className="fb-round-text">Round {state.round}/{state.totalRounds}</span>
            </div>

            <div className="fb-fighter fb-fighter-ai">
              <div className="fb-fighter-label">AI</div>
              <div className="fb-fighter-char">{state.aiFighter.chars[0]}</div>
              <div className="fb-fighter-name">{state.aiFighter.name}</div>
              <div className="fb-hp-bar">
                <div className="fb-hp-fill fb-hp-ai" style={{ width: `${state.aiFighter.hp}%` }} />
              </div>
              <div className="fb-hp-text">{state.aiFighter.hp} HP</div>
              <div className="fb-fighter-score">{state.aiScore} pts</div>
            </div>
          </div>

          {/* Territory bar */}
          <div className="fb-territory">
            <div className="fb-territory-label">TERRITORY</div>
            <div className="fb-territory-bar">
              {state.territory.map((t, i) => (
                <div
                  key={i}
                  className={`fb-territory-seg ${t === 1 ? 'fb-seg-player' : t === -1 ? 'fb-seg-ai' : 'fb-seg-neutral'}`}
                />
              ))}
            </div>
          </div>

          {/* Question */}
          {state.currentQuestion && (
            <div className="fb-question-area">
              <div className="fb-question-prompt">
                {state.currentQuestion.prompt}
                {state.currentQuestion.audioChar && (
                  <button className="fb-audio-btn" onClick={replayAudio}>🔊</button>
                )}
              </div>
              <div className="fb-choices">
                {state.currentQuestion.choices.map((choice, i) => {
                  let cls = 'fb-choice';
                  if (state.phase === 'result') {
                    if (choice.correct) cls += ' fb-choice-correct';
                    else if (i === state.selectedAnswer) cls += ' fb-choice-wrong';
                  } else if (state.selectedAnswer === i) {
                    cls += ' fb-choice-selected';
                  }

                  return (
                    <button
                      key={i}
                      className={cls}
                      onClick={() => answerQuestion(i)}
                      disabled={state.phase === 'result'}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>

              {state.phase === 'result' && state.battleLog.length > 0 && (
                <div className={`fb-round-result ${state.wasCorrect ? 'fb-round-win' : 'fb-round-lose'}`}>
                  {state.battleLog[state.battleLog.length - 1]}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Victory / Defeat */}
      {(state.phase === 'victory' || state.phase === 'defeat') && (
        <div className="fb-menu">
          <h2 className={`fb-end-title ${state.phase === 'victory' ? 'fb-win-title' : 'fb-lose-title'}`}>
            {state.phase === 'victory' ? 'VICTORY!' : 'DEFEAT'}
          </h2>
          <div className="fb-end-fighters">
            <span>{state.playerFighter?.chars[0]} {state.playerFighter?.name}</span>
            <span className="fb-end-vs">vs</span>
            <span>{state.aiFighter?.chars[0]} {state.aiFighter?.name}</span>
          </div>
          <div className="fb-final-stats">
            <div className="fb-stat">
              <span className="fb-stat-value">{state.playerScore}</span>
              <span className="fb-stat-label">Your Score</span>
            </div>
            <div className="fb-stat">
              <span className="fb-stat-value">{state.aiScore}</span>
              <span className="fb-stat-label">AI Score</span>
            </div>
            <div className="fb-stat">
              <span className="fb-stat-value">{state.territory.filter(t => t === 1).length}/7</span>
              <span className="fb-stat-label">Territory</span>
            </div>
          </div>
          <div className="fb-difficulty-select">
            <button className="fb-diff-btn fb-easy" onClick={() => startPicking('easy')}>REMATCH — EASY</button>
            <button className="fb-diff-btn fb-medium" onClick={() => startPicking('medium')}>REMATCH — MEDIUM</button>
            <button className="fb-diff-btn fb-hard" onClick={() => startPicking('hard')}>REMATCH — HARD</button>
          </div>
        </div>
      )}
    </div>
  );
}
