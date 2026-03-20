import { useCallback, useEffect, useState } from 'react';
import { FIDEL_FAMILIES } from '../data/geezAlphabet';
import { audioEngine } from '../audio/AudioEngine';
import './WordSearch.css';

// Word bank: each word is an array of Ge'ez characters + English meaning
interface WordEntry {
  chars: string[];
  meaning: string;
  difficulty: 1 | 2 | 3; // 1=easy, 2=medium, 3=hard
}

const WORD_BANK: WordEntry[] = [
  // 2-char easy words
  { chars: ['ቤ', 'ት'], meaning: 'house', difficulty: 1 },
  { chars: ['ው', 'ሃ'], meaning: 'water', difficulty: 1 },
  { chars: ['ል', 'ብ'], meaning: 'heart', difficulty: 1 },
  { chars: ['ቀ', 'ን'], meaning: 'day', difficulty: 1 },
  { chars: ['ሰ', 'ው'], meaning: 'person', difficulty: 1 },
  { chars: ['ዛ', 'ፍ'], meaning: 'tree', difficulty: 1 },
  { chars: ['ወ', 'ር'], meaning: 'month', difficulty: 1 },
  { chars: ['ዳ', 'ቦ'], meaning: 'bread', difficulty: 1 },
  { chars: ['ደ', 'ም'], meaning: 'blood', difficulty: 1 },
  { chars: ['ሞ', 'ት'], meaning: 'death', difficulty: 1 },
  { chars: ['ቃ', 'ል'], meaning: 'word', difficulty: 1 },
  { chars: ['ሴ', 'ት'], meaning: 'woman', difficulty: 1 },
  { chars: ['ል', 'ጅ'], meaning: 'child', difficulty: 1 },
  { chars: ['ጨ', 'ው'], meaning: 'salt', difficulty: 1 },
  { chars: ['ሥ', 'ር'], meaning: 'root', difficulty: 1 },
  // 3-char medium words
  { chars: ['ሰ', 'ማ', 'ይ'], meaning: 'sky', difficulty: 2 },
  { chars: ['ድ', 'መ', 'ት'], meaning: 'cat', difficulty: 2 },
  { chars: ['አ', 'በ', 'ባ'], meaning: 'flower', difficulty: 2 },
  { chars: ['ም', 'ድ', 'ር'], meaning: 'earth', difficulty: 2 },
  { chars: ['ባ', 'ህ', 'ር'], meaning: 'sea', difficulty: 2 },
  { chars: ['ወ', 'ተ', 'ት'], meaning: 'milk', difficulty: 2 },
  { chars: ['መ', 'ል', 'ስ'], meaning: 'answer', difficulty: 2 },
  { chars: ['ሃ', 'ገ', 'ር'], meaning: 'country', difficulty: 2 },
  { chars: ['ፊ', 'ደ', 'ል'], meaning: 'alphabet', difficulty: 2 },
  { chars: ['ገ', 'በ', 'ያ'], meaning: 'market', difficulty: 2 },
  { chars: ['ሰ', 'ላ', 'ም'], meaning: 'peace', difficulty: 2 },
  { chars: ['ወ', 'ን', 'ድ'], meaning: 'male', difficulty: 2 },
  { chars: ['ነ', 'ገ', 'ር'], meaning: 'thing', difficulty: 2 },
  { chars: ['ዘ', 'መ', 'ን'], meaning: 'era', difficulty: 2 },
  { chars: ['ን', 'ጉ', 'ስ'], meaning: 'king', difficulty: 2 },
  // 3-4 char harder words
  { chars: ['መ', 'ን', 'ገ', 'ድ'], meaning: 'road', difficulty: 3 },
  { chars: ['ት', 'ም', 'ህ', 'ር', 'ት'], meaning: 'education', difficulty: 3 },
  { chars: ['ሌ', 'ሊ', 'ት'], meaning: 'night', difficulty: 3 },
  { chars: ['ም', 'ግ', 'ብ'], meaning: 'food', difficulty: 3 },
  { chars: ['ብ', 'ር', 'ሃ', 'ን'], meaning: 'light', difficulty: 3 },
  { chars: ['መ', 'ጽ', 'ሐ', 'ፍ'], meaning: 'book', difficulty: 3 },
  { chars: ['ቤ', 'ተ', 'ሰ', 'ብ'], meaning: 'family', difficulty: 3 },
  { chars: ['ታ', 'ሪ', 'ክ'], meaning: 'history', difficulty: 3 },
  { chars: ['ተ', 'ስ', 'ፋ'], meaning: 'hope', difficulty: 3 },
  { chars: ['ደ', 'ስ', 'ታ'], meaning: 'joy', difficulty: 3 },
];

// All Ge'ez characters from our families (flat)
const ALL_CHARS = FIDEL_FAMILIES.flatMap(f => f.chars);

function getRandomChar(): string {
  return ALL_CHARS[Math.floor(Math.random() * ALL_CHARS.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

interface PlacedWord {
  word: WordEntry;
  startRow: number;
  startCol: number;
  direction: 'h' | 'v'; // horizontal or vertical
  found: boolean;
}

interface GridCell {
  char: string;
  row: number;
  col: number;
}

function generateGrid(
  gridSize: number,
  wordCount: number,
  maxDifficulty: 1 | 2 | 3
): { grid: GridCell[][]; words: PlacedWord[] } {
  const eligible = WORD_BANK.filter(w => w.difficulty <= maxDifficulty && w.chars.length <= gridSize);
  const selected = shuffle(eligible).slice(0, Math.min(wordCount + 5, eligible.length));

  // Initialize empty grid
  const grid: (string | null)[][] = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => null)
  );

  const placed: PlacedWord[] = [];

  // Try to place each word
  for (const word of selected) {
    if (placed.length >= wordCount) break;

    const directions: ('h' | 'v')[] = shuffle(['h', 'v']);
    let didPlace = false;

    for (const dir of directions) {
      if (didPlace) break;

      const maxRow = dir === 'v' ? gridSize - word.chars.length : gridSize - 1;
      const maxCol = dir === 'h' ? gridSize - word.chars.length : gridSize - 1;

      // Try random positions
      const positions = shuffle(
        Array.from({ length: (maxRow + 1) * (maxCol + 1) }, (_, i) => ({
          r: Math.floor(i / (maxCol + 1)),
          c: i % (maxCol + 1),
        }))
      );

      for (const { r, c } of positions) {
        let canPlace = true;
        for (let k = 0; k < word.chars.length; k++) {
          const pr = dir === 'v' ? r + k : r;
          const pc = dir === 'h' ? c + k : c;
          const existing = grid[pr][pc];
          if (existing !== null && existing !== word.chars[k]) {
            canPlace = false;
            break;
          }
        }
        if (canPlace) {
          for (let k = 0; k < word.chars.length; k++) {
            const pr = dir === 'v' ? r + k : r;
            const pc = dir === 'h' ? c + k : c;
            grid[pr][pc] = word.chars[k];
          }
          placed.push({
            word,
            startRow: r,
            startCol: c,
            direction: dir,
            found: false,
          });
          didPlace = true;
          break;
        }
      }
    }
  }

  // Fill remaining with random chars
  const finalGrid: GridCell[][] = grid.map((row, r) =>
    row.map((ch, c) => ({
      char: ch ?? getRandomChar(),
      row: r,
      col: c,
    }))
  );

  return { grid: finalGrid, words: placed };
}

type Difficulty = 'easy' | 'medium' | 'hard';

interface GameState {
  phase: 'menu' | 'playing' | 'complete';
  grid: GridCell[][];
  words: PlacedWord[];
  selecting: { r: number; c: number } | null; // start cell of current selection
  highlighted: Set<string>; // "r,c" keys of found word cells
  selectingCells: Set<string>; // cells in current drag/selection
  foundCount: number;
  moves: number;
  startTime: number;
  elapsed: number;
  difficulty: Difficulty;
  message: string;
}

const DIFFICULTY_CONFIG: Record<Difficulty, { gridSize: number; wordCount: number; maxDiff: 1 | 2 | 3 }> = {
  easy: { gridSize: 8, wordCount: 5, maxDiff: 1 },
  medium: { gridSize: 10, wordCount: 7, maxDiff: 2 },
  hard: { gridSize: 12, wordCount: 10, maxDiff: 3 },
};

export function WordSearch() {
  const [state, setState] = useState<GameState>({
    phase: 'menu',
    grid: [],
    words: [],
    selecting: null,
    highlighted: new Set(),
    selectingCells: new Set(),
    foundCount: 0,
    moves: 0,
    startTime: 0,
    elapsed: 0,
    difficulty: 'easy',
    message: '',
  });

  // Timer
  useEffect(() => {
    if (state.phase !== 'playing') return;
    const interval = setInterval(() => {
      setState(prev => ({ ...prev, elapsed: Math.floor((Date.now() - prev.startTime) / 1000) }));
    }, 1000);
    return () => clearInterval(interval);
  }, [state.phase]);

  const startGame = useCallback((difficulty: Difficulty) => {
    const config = DIFFICULTY_CONFIG[difficulty];
    const { grid, words } = generateGrid(config.gridSize, config.wordCount, config.maxDiff);
    setState({
      phase: 'playing',
      grid,
      words,
      selecting: null,
      highlighted: new Set(),
      selectingCells: new Set(),
      foundCount: 0,
      moves: 0,
      startTime: Date.now(),
      elapsed: 0,
      difficulty,
      message: '',
    });
  }, []);

  const handleCellClick = useCallback((r: number, c: number) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;

      if (!prev.selecting) {
        // Start selection
        return {
          ...prev,
          selecting: { r, c },
          selectingCells: new Set([`${r},${c}`]),
          message: '',
        };
      }

      // End selection — check if it forms a valid line
      const start = prev.selecting;
      const sameRow = start.r === r;
      const sameCol = start.c === c;

      if (!sameRow && !sameCol) {
        // Not a straight line, reset
        return { ...prev, selecting: null, selectingCells: new Set(), message: 'Select in a straight line!' };
      }

      if (start.r === r && start.c === c) {
        // Clicked same cell, deselect
        return { ...prev, selecting: null, selectingCells: new Set() };
      }

      // Build the selected characters
      const selectedChars: string[] = [];
      const selectedPositions: string[] = [];

      if (sameRow) {
        const minC = Math.min(start.c, c);
        const maxC = Math.max(start.c, c);
        for (let col = minC; col <= maxC; col++) {
          selectedChars.push(prev.grid[r][col].char);
          selectedPositions.push(`${r},${col}`);
        }
      } else {
        const minR = Math.min(start.r, r);
        const maxR = Math.max(start.r, r);
        for (let row = minR; row <= maxR; row++) {
          selectedChars.push(prev.grid[row][c].char);
          selectedPositions.push(`${row},${c}`);
        }
      }

      // Check against unfound words (forward and reverse)
      const selectedStr = selectedChars.join('');
      const reversedStr = [...selectedChars].reverse().join('');

      let foundWord: PlacedWord | null = null;
      const newWords = prev.words.map(w => {
        if (w.found) return w;
        const wordStr = w.word.chars.join('');
        if (selectedStr === wordStr || reversedStr === wordStr) {
          foundWord = { ...w, found: true };
          return foundWord;
        }
        return w;
      });

      if (foundWord) {
        const fw = foundWord as PlacedWord;
        const newHighlighted = new Set(prev.highlighted);
        selectedPositions.forEach(p => newHighlighted.add(p));

        const newFoundCount = prev.foundCount + 1;
        const allFound = newFoundCount >= prev.words.length;

        // Play audio for each char in the word
        fw.word.chars.forEach((ch, i) => {
          setTimeout(() => audioEngine.play(ch, ''), i * 300);
        });

        if (allFound) {
          audioEngine.playLevelComplete();
        }

        return {
          ...prev,
          words: newWords,
          selecting: null,
          selectingCells: new Set(),
          highlighted: newHighlighted,
          foundCount: newFoundCount,
          moves: prev.moves + 1,
          phase: allFound ? 'complete' : 'playing',
          message: `Found: ${fw.word.chars.join('')} (${fw.word.meaning})`,
        };
      }

      // Wrong selection
      audioEngine.playWrong();
      return {
        ...prev,
        selecting: null,
        selectingCells: new Set(),
        moves: prev.moves + 1,
        message: 'No word there — try again!',
      };
    });
  }, []);

  const handleCellHover = useCallback((r: number, c: number) => {
    setState(prev => {
      if (!prev.selecting || prev.phase !== 'playing') return prev;
      const start = prev.selecting;
      const cells = new Set<string>();

      if (start.r === r) {
        // Horizontal
        const minC = Math.min(start.c, c);
        const maxC = Math.max(start.c, c);
        for (let col = minC; col <= maxC; col++) cells.add(`${r},${col}`);
      } else if (start.c === c) {
        // Vertical
        const minR = Math.min(start.r, r);
        const maxR = Math.max(start.r, r);
        for (let row = minR; row <= maxR; row++) cells.add(`${row},${c}`);
      } else {
        // Diagonal — just show start
        cells.add(`${start.r},${start.c}`);
      }

      return { ...prev, selectingCells: cells };
    });
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="ws-container">
      {/* Menu */}
      {state.phase === 'menu' && (
        <div className="ws-menu">
          <h1 className="ws-title">
            <span className="ws-title-geez">ቃል ፍለጋ</span>
            <span className="ws-title-main">WORD SEARCH</span>
          </h1>
          <p className="ws-subtitle">
            Find hidden <strong>Amharic words</strong> in the grid of Ge'ez characters.
            <br />
            Click a <strong>start cell</strong>, then click an <strong>end cell</strong> in the same row or column.
            <br />
            Words can go left-to-right, right-to-left, top-to-bottom, or bottom-to-top!
          </p>
          <div className="ws-difficulty-select">
            <button className="ws-diff-btn ws-easy" onClick={() => startGame('easy')}>
              EASY<span>8×8 grid · 5 words</span>
            </button>
            <button className="ws-diff-btn ws-medium" onClick={() => startGame('medium')}>
              MEDIUM<span>10×10 grid · 7 words</span>
            </button>
            <button className="ws-diff-btn ws-hard" onClick={() => startGame('hard')}>
              HARD<span>12×12 grid · 10 words</span>
            </button>
          </div>
        </div>
      )}

      {/* Playing / Complete */}
      {(state.phase === 'playing' || state.phase === 'complete') && (
        <div className="ws-game">
          {/* HUD */}
          <div className="ws-hud">
            <span className="ws-found">Found: {state.foundCount}/{state.words.length}</span>
            <span className="ws-moves">Moves: {state.moves}</span>
            <span className="ws-timer">⏱ {formatTime(state.elapsed)}</span>
          </div>

          {state.message && (
            <div className={`ws-message ${state.message.startsWith('Found') ? 'ws-msg-good' : 'ws-msg-bad'}`}>
              {state.message}
            </div>
          )}

          <div className="ws-board-area">
            {/* Grid */}
            <div className="ws-grid-wrapper">
              <div
                className="ws-grid"
                style={{
                  gridTemplateColumns: `repeat(${state.grid.length}, 1fr)`,
                }}
              >
                {state.grid.flat().map((cell) => {
                  const key = `${cell.row},${cell.col}`;
                  const isHighlighted = state.highlighted.has(key);
                  const isSelecting = state.selectingCells.has(key);
                  const isStart = state.selecting?.r === cell.row && state.selecting?.c === cell.col;

                  let cls = 'ws-cell';
                  if (isHighlighted) cls += ' ws-cell-found';
                  if (isSelecting) cls += ' ws-cell-selecting';
                  if (isStart) cls += ' ws-cell-start';

                  return (
                    <button
                      key={key}
                      className={cls}
                      onClick={() => handleCellClick(cell.row, cell.col)}
                      onMouseEnter={() => handleCellHover(cell.row, cell.col)}
                      disabled={state.phase === 'complete'}
                    >
                      {cell.char}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Word list */}
            <div className="ws-word-list">
              <div className="ws-word-list-title">WORDS TO FIND</div>
              {state.words.map((w, i) => (
                <div key={i} className={`ws-word-item ${w.found ? 'ws-word-found' : ''}`}>
                  <span className="ws-word-meaning">{w.meaning}</span>
                  {w.found && <span className="ws-word-chars">{w.word.chars.join('')}</span>}
                  {!w.found && <span className="ws-word-hint">{w.word.chars.length} chars</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Selection hint */}
          {state.phase === 'playing' && (
            <div className="ws-hint">
              {state.selecting
                ? 'Click the end cell to complete your selection'
                : 'Click a cell to start selecting a word'}
            </div>
          )}

          {/* Complete overlay */}
          {state.phase === 'complete' && (
            <div className="ws-complete-overlay">
              <div className="ws-complete-msg">
                <h2 className="ws-complete-title">ALL WORDS FOUND!</h2>
                <div className="ws-complete-stats">
                  <span>Time: {formatTime(state.elapsed)}</span>
                  <span>Moves: {state.moves}</span>
                </div>
                <div className="ws-difficulty-select">
                  <button className="ws-diff-btn ws-easy" onClick={() => startGame('easy')}>NEW — EASY</button>
                  <button className="ws-diff-btn ws-medium" onClick={() => startGame('medium')}>NEW — MEDIUM</button>
                  <button className="ws-diff-btn ws-hard" onClick={() => startGame('hard')}>NEW — HARD</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
