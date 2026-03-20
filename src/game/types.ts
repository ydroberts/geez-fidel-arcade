export interface Invader {
  id: string;
  char: string;
  romanized: string;
  consonant: string;
  consonantIndex: number;
  vowelOrder: number;
  x: number;
  y: number;
  alive: boolean;
  hit: boolean;       // briefly true for hit animation
  correct: boolean;   // true if this invader matches the target vowel order
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
}

export interface Explosion {
  id: string;
  x: number;
  y: number;
  frame: number;
  correct: boolean;
}

export interface GameState {
  phase: 'menu' | 'playing' | 'levelComplete' | 'gameOver';
  score: number;
  lives: number;
  level: number;
  invaders: Invader[];
  bullets: Bullet[];
  explosions: Explosion[];
  playerX: number;
  targetVowelOrder: number;       // 1-7: which vowel order to shoot
  targetChar: string;             // the specific character announced via audio
  targetRomanized: string;        // romanized label for the target
  correctHitsThisRound: number;   // how many correct invaders hit this round
  totalCorrectThisRound: number;  // how many correct invaders exist this round
  comboCount: number;
  invaderSpeed: number;
  invaderDirection: 1 | -1;
}

// Game constants
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const PLAYER_WIDTH = 60;
export const PLAYER_HEIGHT = 20;
export const INVADER_SIZE = 48;
export const INVADER_GAP_X = 16;
export const INVADER_GAP_Y = 14;
export const BULLET_WIDTH = 4;
export const BULLET_HEIGHT = 12;
export const BULLET_SPEED = 8;
export const PLAYER_SPEED = 6;
export const INITIAL_LIVES = 3;
