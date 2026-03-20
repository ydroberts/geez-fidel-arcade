import { useGameLoop } from './useGameLoop';
import { GameCanvas } from './GameCanvas';
import { VOWEL_ORDERS } from '../data/geezAlphabet';
import './AlphabetInvaders.css';

export function AlphabetInvaders() {
  const { state, startGame, replayAudio } = useGameLoop();

  return (
    <div className="game-container" tabIndex={0}>
      {/* Title / Menu screen */}
      {state.phase === 'menu' && (
        <div className="overlay">
          <div className="menu-content">
            <h1 className="game-title">
              <span className="title-geez">ፊደል</span>
              <span className="title-main">ALPHABET INVADERS</span>
            </h1>
            <p className="game-subtitle">
              Listen to the syllable. Shoot invaders matching that vowel order.
              <br />
              Don't hit the wrong ones — you'll lose a life!
            </p>
            <div className="controls-info">
              <div><kbd>← →</kbd> or <kbd>A D</kbd> — Move</div>
              <div><kbd>Space</kbd> or <kbd>↑</kbd> — Shoot</div>
              <div><kbd>R</kbd> — Replay audio</div>
            </div>
            <button className="start-btn" onClick={startGame}>
              START GAME
            </button>
          </div>
        </div>
      )}

      {/* Game canvas — always rendered */}
      <GameCanvas state={state} />

      {/* Audio replay button during gameplay */}
      {state.phase === 'playing' && (
        <div className="audio-bar">
          <button className="replay-btn" onClick={replayAudio}>
            🔊 Replay: <span className="target-char">{state.targetChar}</span>
            <span className="target-label">
              ({VOWEL_ORDERS[state.targetVowelOrder - 1].label})
            </span>
          </button>
        </div>
      )}

      {/* Level Complete overlay */}
      {state.phase === 'levelComplete' && (
        <div className="overlay">
          <div className="level-complete">
            <h2>LEVEL {state.level} COMPLETE!</h2>
            <p className="level-score">Score: {state.score}</p>
            <p className="level-next">Next level starting...</p>
          </div>
        </div>
      )}

      {/* Game Over overlay */}
      {state.phase === 'gameOver' && (
        <div className="overlay">
          <div className="game-over">
            <h2>GAME OVER</h2>
            <p className="final-score">Final Score: {state.score}</p>
            <p className="final-level">Reached Level {state.level}</p>
            <button className="start-btn" onClick={startGame}>
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
