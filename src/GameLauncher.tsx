import { useState } from 'react';
import { AlphabetInvaders } from './game/AlphabetInvaders';
import { GridNavigator } from './game/GridNavigator';
import { SyllableBuilder } from './game/SyllableBuilder';
import { FidelTetris } from './game/FidelTetris';
import { GateRunner } from './game/GateRunner';
import { MemoryMatch } from './game/MemoryMatch';
import { DecomposeSyllable } from './game/DecomposeSyllable';
import { RowCompletion } from './game/RowCompletion';
import { FamiliesBattle } from './game/FamiliesBattle';
import { SyllableSudoku } from './game/SyllableSudoku';
import { WordSearch } from './game/WordSearch';
import './GameLauncher.css';

type GameId = 'menu' | 'alphabet-invaders' | 'grid-navigator' | 'syllable-builder' | 'fidel-tetris' | 'gate-runner' | 'memory-match' | 'decompose-syllable' | 'row-completion' | 'families-battle' | 'syllable-sudoku' | 'word-search';

const GAMES = [
  {
    id: 'alphabet-invaders' as const,
    title: 'Alphabet Invaders',
    titleGeez: 'ጠላፊ ፊደል',
    description: 'Hear a syllable, shoot all invaders matching that vowel order. Classic arcade action!',
    category: 'Arcade',
    color: '#00ccff',
  },
  {
    id: 'grid-navigator' as const,
    title: 'Grid Navigator',
    titleGeez: 'ፍለጋ',
    description: 'Listen to a syllable and find it on the fidel grid. Test your knowledge of the 2D structure!',
    category: 'Learning',
    color: '#ffd700',
  },
  {
    id: 'syllable-builder' as const,
    title: 'Syllable Builder',
    titleGeez: 'ቃል ሠሪ',
    description: 'Pick the right consonant and vowel cards to build the syllable you hear. Learn how fidel combines!',
    category: 'Learning',
    color: '#ff8844',
  },
  {
    id: 'fidel-tetris' as const,
    title: 'Fidel Tetris',
    titleGeez: 'ፊደል ጡብ',
    description: 'Syllable blocks fall into 7 columns. Fill rows to clear, match vowel orders or consonant families for bonuses!',
    category: 'Arcade',
    color: '#44ffcc',
  },
  {
    id: 'gate-runner' as const,
    title: 'Gate Runner',
    titleGeez: 'ሯጭ በር',
    description: 'Hear a syllable, switch lanes to hit the correct gate. Speed increases — how far can you go?',
    category: 'Arcade',
    color: '#ff4488',
  },
  {
    id: 'memory-match' as const,
    title: 'Memory Match',
    titleGeez: 'ማዛመድ',
    description: 'Flip cards to find pairs that share the same consonant family or vowel order. The rule changes each round!',
    category: 'Learning',
    color: '#aa44ff',
  },
  {
    id: 'decompose-syllable' as const,
    title: 'Decompose the Syllable',
    titleGeez: 'መበተን',
    description: 'See a character — identify its consonant family and vowel order. Break apart what Syllable Builder puts together!',
    category: 'Learning',
    color: '#ff6644',
  },
  {
    id: 'row-completion' as const,
    title: 'Row & Column Completion',
    titleGeez: 'መሙያ',
    description: 'A family row or vowel column has gaps — pick the right characters to fill them in!',
    category: 'Learning',
    color: '#44ddaa',
  },
  {
    id: 'families-battle' as const,
    title: 'Families Battle',
    titleGeez: 'ውጊያ',
    description: 'Pick a consonant family and battle the AI! Answer questions to deal damage and conquer territory!',
    category: 'Battle',
    color: '#ff4466',
  },
  {
    id: 'syllable-sudoku' as const,
    title: 'Syllable Sudoku',
    titleGeez: 'ሱዶኩ',
    description: 'Fill the 7×7 grid so every row and column has all 7 vowel orders. Like Sudoku but with fidel!',
    category: 'Puzzle',
    color: '#bb88ff',
  },
  {
    id: 'word-search' as const,
    title: 'Word Search',
    titleGeez: 'ቃል ፍለጋ',
    description: 'Find hidden Amharic words in a grid of Ge\'ez characters. Select start and end cells to highlight words!',
    category: 'Puzzle',
    color: '#44ddaa',
  },
];

const GAME_COMPONENTS: Record<string, React.ComponentType> = {
  'alphabet-invaders': AlphabetInvaders,
  'grid-navigator': GridNavigator,
  'syllable-builder': SyllableBuilder,
  'fidel-tetris': FidelTetris,
  'gate-runner': GateRunner,
  'memory-match': MemoryMatch,
  'decompose-syllable': DecomposeSyllable,
  'row-completion': RowCompletion,
  'families-battle': FamiliesBattle,
  'syllable-sudoku': SyllableSudoku,
  'word-search': WordSearch,
};

export function GameLauncher() {
  const [activeGame, setActiveGame] = useState<GameId>('menu');

  if (activeGame !== 'menu') {
    const GameComponent = GAME_COMPONENTS[activeGame];
    return (
      <div className="gl-game-wrapper">
        <button className="gl-back-btn" onClick={() => setActiveGame('menu')}>
          ← Back to Menu
        </button>
        <GameComponent />
      </div>
    );
  }

  return (
    <div className="gl-container">
      <div className="gl-header">
        <h1 className="gl-title">
          <span className="gl-title-geez">የፊደል ጨዋታ</span>
          <span className="gl-title-main">GEEZ FIDEL ARCADE</span>
        </h1>
        <p className="gl-subtitle">Learn the Ge'ez alphabet through games</p>
      </div>

      <div className="gl-games-grid">
        {GAMES.map(game => (
          <button
            key={game.id}
            className="gl-game-card"
            style={{ '--card-color': game.color } as React.CSSProperties}
            onClick={() => setActiveGame(game.id)}
          >
            <span className="gl-card-category">{game.category}</span>
            <span className="gl-card-geez">{game.titleGeez}</span>
            <span className="gl-card-title">{game.title}</span>
            <span className="gl-card-desc">{game.description}</span>
            <span className="gl-card-play">PLAY →</span>
          </button>
        ))}
      </div>
    </div>
  );
}
