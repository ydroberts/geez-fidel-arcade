import { useCallback, useEffect, useRef, useState } from 'react';
import { FIDEL_FAMILIES, VOWEL_ORDERS } from '../data/geezAlphabet';
import { audioEngine } from '../audio/AudioEngine';
import './FidelTetris.css';

// Board dimensions: 7 columns (vowel orders) x 14 rows
const COLS = 7;
const ROWS = 14;
const CELL_SIZE = 52;

interface PlacedCell {
  char: string;
  familyIndex: number;
  vowelOrder: number; // 0-6
  clearing: boolean;
}

interface FallingPiece {
  char: string;
  familyIndex: number;
  vowelOrder: number;
  col: number;
  row: number; // floating point for smooth fall
}

interface GameState {
  phase: 'menu' | 'playing' | 'paused' | 'gameOver';
  board: (PlacedCell | null)[][]; // ROWS x COLS
  currentPiece: FallingPiece | null;
  nextPieces: FallingPiece[];
  score: number;
  level: number;
  linesCleared: number;
  dropInterval: number;
  // Which consonant families are in play this level
  activeFamilies: number[];
}

function getActiveFamilies(level: number): number[] {
  // Start with fewer families, add more as level increases
  const count = Math.min(6 + level * 2, FIDEL_FAMILIES.length);
  const indices: number[] = [];
  for (let i = 0; i < count; i++) indices.push(i);
  return indices;
}

function randomPiece(activeFamilies: number[]): FallingPiece {
  const familyIndex = activeFamilies[Math.floor(Math.random() * activeFamilies.length)];
  const vowelOrder = Math.floor(Math.random() * 7);
  return {
    char: FIDEL_FAMILIES[familyIndex].chars[vowelOrder],
    familyIndex,
    vowelOrder,
    col: Math.floor(Math.random() * COLS),
    row: 0,
  };
}

function createEmptyBoard(): (PlacedCell | null)[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneBoard(board: (PlacedCell | null)[][]): (PlacedCell | null)[][] {
  return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

// Check if a complete row is filled (any full horizontal line)
function checkFullRows(board: (PlacedCell | null)[][]): number[] {
  const fullRows: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every(cell => cell !== null)) {
      fullRows.push(r);
    }
  }
  return fullRows;
}

// Check if a column has a complete set of 7 same-family characters
function checkFamilyColumns(board: (PlacedCell | null)[][]): { row: number; col: number }[] {
  const matches: { row: number; col: number }[] = [];

  // For each column, scan for consecutive same-family cells
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 7; r++) {
      const cell = board[r][c];
      if (!cell) continue;
      const family = cell.familyIndex;
      let count = 1;
      for (let dr = 1; dr < 7; dr++) {
        const next = board[r + dr][c];
        if (next && next.familyIndex === family) count++;
        else break;
      }
      if (count >= 7) {
        for (let dr = 0; dr < 7; dr++) {
          matches.push({ row: r + dr, col: c });
        }
      }
    }
  }

  return matches;
}

// Check if a row has all 7 vowel orders represented (regardless of family)
function checkVowelOrderRows(board: (PlacedCell | null)[][]): number[] {
  const matchingRows: number[] = [];
  for (let r = 0; r < ROWS; r++) {
    if (!board[r].every(cell => cell !== null)) continue;
    const vowelOrders = new Set(board[r].map(cell => cell!.vowelOrder));
    if (vowelOrders.size === 7) {
      matchingRows.push(r);
    }
  }
  return matchingRows;
}

export function FidelTetris() {
  const [state, setState] = useState<GameState>({
    phase: 'menu',
    board: createEmptyBoard(),
    currentPiece: null,
    nextPieces: [],
    score: 0,
    level: 1,
    linesCleared: 0,
    dropInterval: 1000,
    activeFamilies: [],
  });

  const dropTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keysRef = useRef<Set<string>>(new Set());

  const startGame = useCallback(() => {
    const families = getActiveFamilies(1);
    const next1 = randomPiece(families);
    const next2 = randomPiece(families);
    const next3 = randomPiece(families);
    const current = randomPiece(families);

    setState({
      phase: 'playing',
      board: createEmptyBoard(),
      currentPiece: current,
      nextPieces: [next1, next2, next3],
      score: 0,
      level: 1,
      linesCleared: 0,
      dropInterval: 1000,
      activeFamilies: families,
    });
  }, []);

  // Spawn next piece
  const spawnNext = useCallback((prev: GameState): GameState => {
    const [next, ...rest] = prev.nextPieces;
    const newNext = randomPiece(prev.activeFamilies);
    const piece = { ...next, col: Math.floor(Math.random() * COLS), row: 0 };

    // Check if spawn position is blocked
    const boardRow = Math.floor(piece.row);
    if (prev.board[boardRow][piece.col] !== null) {
      audioEngine.playGameOver();
      return { ...prev, phase: 'gameOver', currentPiece: null };
    }

    return {
      ...prev,
      currentPiece: piece,
      nextPieces: [...rest, newNext],
    };
  }, []);

  // Place piece and check clears
  const placePiece = useCallback((prev: GameState): GameState => {
    if (!prev.currentPiece) return prev;
    const piece = prev.currentPiece;
    const row = Math.floor(piece.row);
    const board = cloneBoard(prev.board);

    if (row < 0 || row >= ROWS) {
      audioEngine.playGameOver();
      return { ...prev, phase: 'gameOver', currentPiece: null };
    }

    board[row][piece.col] = {
      char: piece.char,
      familyIndex: piece.familyIndex,
      vowelOrder: piece.vowelOrder,
      clearing: false,
    };

    // Play the syllable audio on placement
    audioEngine.play(piece.char, '');

    // Check clears
    const fullRows = checkFullRows(board);
    const vowelRows = checkVowelOrderRows(board);
    const familyCols = checkFamilyColumns(board);

    // Combine all unique rows to clear
    const rowsToClear = new Set([...fullRows, ...vowelRows]);
    // Also mark family column cells
    familyCols.forEach(({ row: r, col: c }) => {
      if (board[r][c]) board[r][c]!.clearing = true;
    });

    let newScore = prev.score;
    let newLinesCleared = prev.linesCleared;

    // Score for full rows
    if (rowsToClear.size > 0) {
      const bonus = rowsToClear.size > 1 ? rowsToClear.size * 200 : 100;
      newScore += bonus;
      newLinesCleared += rowsToClear.size;

      // Bonus for vowel-order complete rows
      const vowelBonus = vowelRows.length * 300;
      newScore += vowelBonus;

      audioEngine.playHit();
    }

    // Score for family columns
    if (familyCols.length > 0) {
      newScore += 500;
      audioEngine.playLevelComplete();
    }

    // Remove cleared rows
    let newBoard = board;
    if (rowsToClear.size > 0) {
      const sortedRows = Array.from(rowsToClear).sort((a, b) => a - b);
      newBoard = cloneBoard(board);
      // Remove rows from bottom to top
      for (let i = sortedRows.length - 1; i >= 0; i--) {
        newBoard.splice(sortedRows[i], 1);
      }
      // Add empty rows at top
      while (newBoard.length < ROWS) {
        newBoard.unshift(Array(COLS).fill(null));
      }
    }

    // Remove family column cells
    if (familyCols.length > 0) {
      familyCols.forEach(({ row: r, col: c }) => {
        // Adjust row index if rows were removed above
        if (newBoard[r] && newBoard[r][c]) {
          newBoard[r][c] = null;
        }
      });
      // Gravity: drop floating cells down
      for (let c = 0; c < COLS; c++) {
        let writePos = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (newBoard[r][c] !== null) {
            if (writePos !== r) {
              newBoard[writePos][c] = newBoard[r][c];
              newBoard[r][c] = null;
            }
            writePos--;
          }
        }
      }
    }

    // Level up every 5 lines
    const newLevel = Math.floor(newLinesCleared / 5) + 1;
    const newInterval = Math.max(150, 1000 - (newLevel - 1) * 80);
    const newFamilies = getActiveFamilies(newLevel);

    const updated: GameState = {
      ...prev,
      board: newBoard,
      currentPiece: null,
      score: newScore,
      level: newLevel,
      linesCleared: newLinesCleared,
      dropInterval: newInterval,
      activeFamilies: newFamilies,
    };

    return spawnNext(updated);
  }, [spawnNext]);

  // Drop tick
  useEffect(() => {
    if (state.phase !== 'playing') {
      if (dropTimerRef.current) clearInterval(dropTimerRef.current);
      return;
    }

    dropTimerRef.current = setInterval(() => {
      setState(prev => {
        if (prev.phase !== 'playing' || !prev.currentPiece) return prev;
        const piece = prev.currentPiece;
        const nextRow = piece.row + 1;
        const nextRowInt = Math.floor(nextRow);

        // Check if can drop further
        if (nextRowInt >= ROWS || prev.board[nextRowInt][piece.col] !== null) {
          return placePiece(prev);
        }

        return {
          ...prev,
          currentPiece: { ...piece, row: nextRow },
        };
      });
    }, state.dropInterval);

    return () => {
      if (dropTimerRef.current) clearInterval(dropTimerRef.current);
    };
  }, [state.phase, state.dropInterval, placePiece]);

  // Keyboard input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (state.phase !== 'playing') return;

      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'a', 'd', 's', 'w'].includes(e.key)) {
        e.preventDefault();
      }

      setState(prev => {
        if (prev.phase !== 'playing' || !prev.currentPiece) return prev;
        const piece = prev.currentPiece;

        // Move left
        if (e.key === 'ArrowLeft' || e.key === 'a') {
          const newCol = piece.col - 1;
          if (newCol >= 0 && prev.board[Math.floor(piece.row)][newCol] === null) {
            return { ...prev, currentPiece: { ...piece, col: newCol } };
          }
        }

        // Move right
        if (e.key === 'ArrowRight' || e.key === 'd') {
          const newCol = piece.col + 1;
          if (newCol < COLS && prev.board[Math.floor(piece.row)][newCol] === null) {
            return { ...prev, currentPiece: { ...piece, col: newCol } };
          }
        }

        // Soft drop
        if (e.key === 'ArrowDown' || e.key === 's') {
          const nextRow = piece.row + 1;
          const nextRowInt = Math.floor(nextRow);
          if (nextRowInt < ROWS && prev.board[nextRowInt][piece.col] === null) {
            return { ...prev, currentPiece: { ...piece, row: nextRow }, score: prev.score + 1 };
          } else {
            return placePiece(prev);
          }
        }

        // Hard drop
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
          let dropRow = Math.floor(piece.row);
          while (dropRow + 1 < ROWS && prev.board[dropRow + 1][piece.col] === null) {
            dropRow++;
          }
          const dropDist = dropRow - Math.floor(piece.row);
          const hardDropped = { ...prev, currentPiece: { ...piece, row: dropRow }, score: prev.score + dropDist * 2 };
          return placePiece(hardDropped);
        }

        return prev;
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.phase, placePiece]);

  // Color for a vowel order
  const vowelColor = (vo: number) => {
    const colors = ['#ff4444', '#ff8c00', '#ffd700', '#44ff44', '#44bbff', '#aa44ff', '#ff44aa'];
    return colors[vo];
  };

  // Color for consonant family (hue rotation)
  const familyColor = (fi: number) => {
    const hue = (fi * 23) % 360;
    return `hsl(${hue}, 60%, 45%)`;
  };

  return (
    <div className="ft-container">
      {/* Menu */}
      {state.phase === 'menu' && (
        <div className="ft-menu">
          <h1 className="ft-title">
            <span className="ft-title-geez">ፊደል ጡብ</span>
            <span className="ft-title-main">FIDEL TETRIS</span>
          </h1>
          <p className="ft-subtitle">
            Syllable blocks fall into a 7-column grid (one per vowel order).
            <br />
            Fill a row to clear it. Complete all 7 vowel orders in a row for a bonus!
            <br />
            Stack 7 of the same consonant family in a column for a mega bonus!
          </p>
          <div className="ft-controls-info">
            <div><kbd>← →</kbd> or <kbd>A D</kbd> — Move</div>
            <div><kbd>↓</kbd> or <kbd>S</kbd> — Soft drop</div>
            <div><kbd>Space</kbd> or <kbd>↑</kbd> — Hard drop</div>
          </div>
          <button className="ft-start-btn" onClick={startGame}>
            START GAME
          </button>
        </div>
      )}

      {/* Playing */}
      {(state.phase === 'playing' || state.phase === 'paused') && (
        <div className="ft-game">
          <div className="ft-sidebar ft-sidebar-left">
            <div className="ft-info-box">
              <div className="ft-info-label">SCORE</div>
              <div className="ft-info-value ft-score-value">{state.score}</div>
            </div>
            <div className="ft-info-box">
              <div className="ft-info-label">LEVEL</div>
              <div className="ft-info-value">{state.level}</div>
            </div>
            <div className="ft-info-box">
              <div className="ft-info-label">LINES</div>
              <div className="ft-info-value">{state.linesCleared}</div>
            </div>
          </div>

          <div className="ft-board-wrapper">
            {/* Column headers */}
            <div className="ft-col-headers">
              {VOWEL_ORDERS.map((vo, i) => (
                <div key={i} className="ft-col-header" style={{ color: vowelColor(i) }}>
                  {vo.vowel}
                </div>
              ))}
            </div>

            {/* Board */}
            <div className="ft-board" style={{ width: COLS * CELL_SIZE, height: ROWS * CELL_SIZE }}>
              {/* Grid lines */}
              {Array.from({ length: ROWS }).map((_, r) =>
                Array.from({ length: COLS }).map((_, c) => (
                  <div
                    key={`${r}-${c}`}
                    className="ft-grid-cell"
                    style={{
                      left: c * CELL_SIZE,
                      top: r * CELL_SIZE,
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                    }}
                  />
                ))
              )}

              {/* Placed cells */}
              {state.board.map((row, r) =>
                row.map((cell, c) => {
                  if (!cell) return null;
                  return (
                    <div
                      key={`placed-${r}-${c}`}
                      className={`ft-cell ${cell.clearing ? 'ft-cell-clearing' : ''}`}
                      style={{
                        left: c * CELL_SIZE,
                        top: r * CELL_SIZE,
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        backgroundColor: familyColor(cell.familyIndex),
                        borderColor: vowelColor(cell.vowelOrder),
                      }}
                    >
                      <span className="ft-cell-char">{cell.char}</span>
                    </div>
                  );
                })
              )}

              {/* Ghost piece (drop preview) */}
              {state.currentPiece && (() => {
                const piece = state.currentPiece!;
                let ghostRow = Math.floor(piece.row);
                while (ghostRow + 1 < ROWS && state.board[ghostRow + 1][piece.col] === null) {
                  ghostRow++;
                }
                if (ghostRow !== Math.floor(piece.row)) {
                  return (
                    <div
                      className="ft-ghost"
                      style={{
                        left: piece.col * CELL_SIZE,
                        top: ghostRow * CELL_SIZE,
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        borderColor: vowelColor(piece.vowelOrder),
                      }}
                    >
                      <span className="ft-ghost-char">{piece.char}</span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Current falling piece */}
              {state.currentPiece && (
                <div
                  className="ft-falling"
                  style={{
                    left: state.currentPiece.col * CELL_SIZE,
                    top: Math.floor(state.currentPiece.row) * CELL_SIZE,
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    backgroundColor: familyColor(state.currentPiece.familyIndex),
                    borderColor: vowelColor(state.currentPiece.vowelOrder),
                  }}
                >
                  <span className="ft-cell-char">{state.currentPiece.char}</span>
                </div>
              )}
            </div>
          </div>

          <div className="ft-sidebar ft-sidebar-right">
            <div className="ft-info-box">
              <div className="ft-info-label">NEXT</div>
              <div className="ft-next-pieces">
                {state.nextPieces.map((piece, i) => (
                  <div
                    key={i}
                    className="ft-next-piece"
                    style={{
                      backgroundColor: familyColor(piece.familyIndex),
                      borderColor: vowelColor(piece.vowelOrder),
                    }}
                  >
                    <span className="ft-next-char">{piece.char}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="ft-legend">
              <div className="ft-legend-title">BONUS</div>
              <div className="ft-legend-item">
                <span className="ft-legend-icon" style={{ color: '#44ff44' }}>━</span>
                Full row = 100
              </div>
              <div className="ft-legend-item">
                <span className="ft-legend-icon" style={{ color: '#ffd700' }}>★</span>
                7 vowels = +300
              </div>
              <div className="ft-legend-item">
                <span className="ft-legend-icon" style={{ color: '#ff44ff' }}>┃</span>
                7 family = +500
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over */}
      {state.phase === 'gameOver' && (
        <div className="ft-menu">
          <h2 className="ft-gameover-title">GAME OVER</h2>
          <div className="ft-final-stats">
            <div className="ft-stat">
              <span className="ft-stat-value">{state.score}</span>
              <span className="ft-stat-label">Score</span>
            </div>
            <div className="ft-stat">
              <span className="ft-stat-value">{state.level}</span>
              <span className="ft-stat-label">Level</span>
            </div>
            <div className="ft-stat">
              <span className="ft-stat-value">{state.linesCleared}</span>
              <span className="ft-stat-label">Lines</span>
            </div>
          </div>
          <button className="ft-start-btn" onClick={startGame}>
            PLAY AGAIN
          </button>
        </div>
      )}
    </div>
  );
}
