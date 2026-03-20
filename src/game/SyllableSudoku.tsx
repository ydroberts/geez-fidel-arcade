import { useCallback, useEffect, useState } from 'react';
import { FIDEL_FAMILIES, VOWEL_ORDERS } from '../data/geezAlphabet';
import { audioEngine } from '../audio/AudioEngine';
import './SyllableSudoku.css';

const SIZE = 7;

interface Cell {
  row: number;
  col: number;
  familyIndex: number;  // which consonant family (row constraint)
  vowelOrder: number;    // which vowel order (col constraint)
  char: string;
  given: boolean;        // pre-filled clue
  playerChar: string | null;
  conflict: boolean;
}

// Generate a valid 7x7 Latin square where:
// - Each row has all 7 vowel orders (0-6)
// - Each column has all 7 vowel orders (0-6)
// - We assign 7 different consonant families to the 7 rows
function generateSolution(families: number[]): number[][] {
  // Simple Latin square via shifted rows
  // Row i, Col j -> vowel order = (i + j * shift) % 7
  // Use random valid shifts to add variety
  const shifts = [1, 2, 3, 4, 5, 6];
  const shift = shifts[Math.floor(Math.random() * shifts.length)];

  // Generate base Latin square
  const grid: number[][] = [];
  for (let r = 0; r < SIZE; r++) {
    const row: number[] = [];
    for (let c = 0; c < SIZE; c++) {
      row.push((r + c * shift) % SIZE);
    }
    grid.push(row);
  }

  // Shuffle rows
  const rowOrder = shuffle(Array.from({ length: SIZE }, (_, i) => i));
  const shuffledGrid = rowOrder.map(r => grid[r]);

  // Shuffle columns
  const colOrder = shuffle(Array.from({ length: SIZE }, (_, i) => i));
  const finalGrid = shuffledGrid.map(row => colOrder.map(c => row[c]));

  // Shuffle vowel order values (relabel)
  const voMap = shuffle(Array.from({ length: SIZE }, (_, i) => i));
  return finalGrid.map(row => row.map(v => voMap[v]));
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildPuzzle(difficulty: 'easy' | 'medium' | 'hard'): { cells: Cell[][]; families: number[] } {
  const givens = difficulty === 'easy' ? 30 : difficulty === 'medium' ? 24 : 18;
  const maxFam = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 32;

  // Pick 7 random families
  const allFams = shuffle(Array.from({ length: Math.min(maxFam, FIDEL_FAMILIES.length) }, (_, i) => i));
  const families = allFams.slice(0, 7);

  const solution = generateSolution(families);

  // Build cells
  const cells: Cell[][] = [];
  for (let r = 0; r < SIZE; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < SIZE; c++) {
      const vo = solution[r][c];
      const fi = families[r];
      row.push({
        row: r,
        col: c,
        familyIndex: fi,
        vowelOrder: vo,
        char: FIDEL_FAMILIES[fi].chars[vo],
        given: false,
        playerChar: null,
        conflict: false,
      });
    }
    cells.push(row);
  }

  // Mark givens
  const positions = shuffle(
    Array.from({ length: SIZE * SIZE }, (_, i) => ({ r: Math.floor(i / SIZE), c: i % SIZE }))
  );
  for (let i = 0; i < Math.min(givens, positions.length); i++) {
    const { r, c } = positions[i];
    cells[r][c].given = true;
    cells[r][c].playerChar = cells[r][c].char;
  }

  return { cells, families };
}

function checkConflicts(cells: Cell[][]): Cell[][] {
  // Reset conflicts
  const updated = cells.map(row => row.map(c => ({ ...c, conflict: false })));

  // Check rows: each row should have unique vowel orders among filled cells
  for (let r = 0; r < SIZE; r++) {
    const filled = updated[r].filter(c => c.playerChar);
    const seen = new Map<string, number[]>();
    filled.forEach(c => {
      const key = c.playerChar!;
      // For row check: same vowel order = conflict (same char in family is fine since each row is one family)
      // Actually check if same vowel order character appears twice
      const vo = FIDEL_FAMILIES[c.familyIndex].chars.indexOf(c.playerChar!);
      const voKey = String(vo);
      if (!seen.has(voKey)) seen.set(voKey, []);
      seen.get(voKey)!.push(c.col);
    });
    seen.forEach((cols) => {
      if (cols.length > 1) {
        cols.forEach(col => { updated[r][col].conflict = true; });
      }
    });
  }

  // Check columns: each column should have unique vowel orders
  for (let c = 0; c < SIZE; c++) {
    const filled: { vo: number; row: number }[] = [];
    for (let r = 0; r < SIZE; r++) {
      const cell = updated[r][c];
      if (cell.playerChar) {
        const vo = FIDEL_FAMILIES[cell.familyIndex].chars.indexOf(cell.playerChar);
        filled.push({ vo, row: r });
      }
    }
    const seen = new Map<number, number[]>();
    filled.forEach(f => {
      if (!seen.has(f.vo)) seen.set(f.vo, []);
      seen.get(f.vo)!.push(f.row);
    });
    seen.forEach((rows) => {
      if (rows.length > 1) {
        rows.forEach(row => { updated[row][c].conflict = true; });
      }
    });
  }

  return updated;
}

interface GameState {
  phase: 'menu' | 'playing' | 'complete';
  cells: Cell[][];
  families: number[];
  selectedCell: { r: number; c: number } | null;
  moves: number;
  startTime: number;
  elapsed: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export function SyllableSudoku() {
  const [state, setState] = useState<GameState>({
    phase: 'menu',
    cells: [],
    families: [],
    selectedCell: null,
    moves: 0,
    startTime: 0,
    elapsed: 0,
    difficulty: 'easy',
  });

  // Timer
  useEffect(() => {
    if (state.phase !== 'playing') return;
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        elapsed: Math.floor((Date.now() - prev.startTime) / 1000),
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [state.phase]);

  const startGame = useCallback((difficulty: 'easy' | 'medium' | 'hard') => {
    const { cells, families } = buildPuzzle(difficulty);
    setState({
      phase: 'playing',
      cells,
      families,
      selectedCell: null,
      moves: 0,
      startTime: Date.now(),
      elapsed: 0,
      difficulty,
    });
  }, []);

  const selectCell = useCallback((r: number, c: number) => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;
      if (prev.cells[r][c].given) return prev;
      return { ...prev, selectedCell: { r, c } };
    });
  }, []);

  const placeChar = useCallback((vo: number) => {
    setState(prev => {
      if (!prev.selectedCell || prev.phase !== 'playing') return prev;
      const { r, c } = prev.selectedCell;
      const cell = prev.cells[r][c];
      if (cell.given) return prev;

      const char = FIDEL_FAMILIES[cell.familyIndex].chars[vo];
      audioEngine.play(char, '');

      const newCells = prev.cells.map(row => row.map(cl => ({ ...cl })));
      newCells[r][c].playerChar = char;

      const checked = checkConflicts(newCells);

      // Check if complete
      const allFilled = checked.every(row => row.every(cl => cl.playerChar !== null));
      const noConflicts = checked.every(row => row.every(cl => !cl.conflict));
      const isComplete = allFilled && noConflicts;

      if (isComplete) {
        audioEngine.playLevelComplete();
      }

      return {
        ...prev,
        cells: checked,
        moves: prev.moves + 1,
        phase: isComplete ? 'complete' : 'playing',
      };
    });
  }, []);

  const clearCell = useCallback(() => {
    setState(prev => {
      if (!prev.selectedCell || prev.phase !== 'playing') return prev;
      const { r, c } = prev.selectedCell;
      if (prev.cells[r][c].given) return prev;

      const newCells = prev.cells.map(row => row.map(cl => ({ ...cl })));
      newCells[r][c].playerChar = null;
      const checked = checkConflicts(newCells);

      return { ...prev, cells: checked };
    });
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const filledCount = state.cells.flat().filter(c => c.playerChar !== null).length;
  const totalCells = SIZE * SIZE;

  return (
    <div className="ss-container">
      {/* Menu */}
      {state.phase === 'menu' && (
        <div className="ss-menu">
          <h1 className="ss-title">
            <span className="ss-title-geez">ሱዶኩ</span>
            <span className="ss-title-main">SYLLABLE SUDOKU</span>
          </h1>
          <p className="ss-subtitle">
            Fill the 7×7 grid so that every <strong>row</strong> and every <strong>column</strong>
            <br />
            contains all 7 vowel orders exactly once.
            <br />
            Each row is a consonant family — pick the right character!
          </p>
          <div className="ss-difficulty-select">
            <button className="ss-diff-btn ss-easy" onClick={() => startGame('easy')}>
              EASY<span>30 given cells</span>
            </button>
            <button className="ss-diff-btn ss-medium" onClick={() => startGame('medium')}>
              MEDIUM<span>24 given cells</span>
            </button>
            <button className="ss-diff-btn ss-hard" onClick={() => startGame('hard')}>
              HARD<span>18 given cells</span>
            </button>
          </div>
        </div>
      )}

      {/* Playing */}
      {(state.phase === 'playing' || state.phase === 'complete') && (
        <div className="ss-game">
          {/* HUD */}
          <div className="ss-hud">
            <span className="ss-moves">Moves: {state.moves}</span>
            <span className="ss-progress">{filledCount}/{totalCells}</span>
            <span className="ss-timer">⏱ {formatTime(state.elapsed)}</span>
          </div>

          <div className="ss-board-area">
            {/* Column headers (vowel orders shown as reference) */}
            <div className="ss-grid-wrapper">
              {/* Row labels + grid */}
              <table className="ss-grid">
                <thead>
                  <tr>
                    <th className="ss-corner" />
                    {Array.from({ length: SIZE }).map((_, c) => (
                      <th key={c} className="ss-col-header">
                        {c + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.cells.map((row, r) => (
                    <tr key={r}>
                      <td className="ss-row-label">
                        <span className="ss-row-family">{FIDEL_FAMILIES[state.families[r]].romanBase}</span>
                      </td>
                      {row.map((cell, c) => {
                        const isSelected = state.selectedCell?.r === r && state.selectedCell?.c === c;
                        const sameRow = state.selectedCell?.r === r;
                        const sameCol = state.selectedCell?.c === c;

                        let cls = 'ss-cell';
                        if (cell.given) cls += ' ss-cell-given';
                        else if (cell.playerChar) cls += ' ss-cell-filled';
                        else cls += ' ss-cell-empty';
                        if (isSelected) cls += ' ss-cell-selected';
                        else if (sameRow || sameCol) cls += ' ss-cell-highlight';
                        if (cell.conflict) cls += ' ss-cell-conflict';

                        return (
                          <td key={c}>
                            <button
                              className={cls}
                              onClick={() => selectCell(r, c)}
                              disabled={state.phase === 'complete'}
                            >
                              {cell.playerChar || ''}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Picker — show the 7 characters of the selected cell's family */}
            {state.selectedCell && state.phase === 'playing' && (() => {
              const { r } = state.selectedCell;
              const fi = state.families[r];
              const family = FIDEL_FAMILIES[fi];
              return (
                <div className="ss-picker">
                  <div className="ss-picker-label">
                    {family.romanBase} family — pick a vowel order:
                  </div>
                  <div className="ss-picker-row">
                    {family.chars.map((char, vo) => (
                      <button
                        key={vo}
                        className="ss-picker-btn"
                        onClick={() => placeChar(vo)}
                      >
                        <span className="ss-picker-char">{char}</span>
                        <span className="ss-picker-vo">{VOWEL_ORDERS[vo].vowel}</span>
                      </button>
                    ))}
                    <button className="ss-picker-clear" onClick={clearCell}>
                      ✕
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Vowel order legend */}
          <div className="ss-legend">
            {VOWEL_ORDERS.map((vo, i) => (
              <span key={i} className="ss-legend-item">
                <strong>{i + 1}</strong> = {vo.vowel}
              </span>
            ))}
          </div>

          {/* Complete overlay */}
          {state.phase === 'complete' && (
            <div className="ss-complete-overlay">
              <div className="ss-complete-msg">
                <h2 className="ss-complete-title">PUZZLE COMPLETE!</h2>
                <div className="ss-complete-stats">
                  <span>Time: {formatTime(state.elapsed)}</span>
                  <span>Moves: {state.moves}</span>
                </div>
                <div className="ss-difficulty-select">
                  <button className="ss-diff-btn ss-easy" onClick={() => startGame('easy')}>NEW — EASY</button>
                  <button className="ss-diff-btn ss-medium" onClick={() => startGame('medium')}>NEW — MEDIUM</button>
                  <button className="ss-diff-btn ss-hard" onClick={() => startGame('hard')}>NEW — HARD</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
