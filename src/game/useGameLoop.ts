import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, Invader, Bullet, Explosion } from './types';
import {
  GAME_WIDTH, GAME_HEIGHT, PLAYER_WIDTH, INVADER_SIZE,
  INVADER_GAP_X, INVADER_GAP_Y, BULLET_SPEED, PLAYER_SPEED, INITIAL_LIVES,
} from './types';
import { getRandomFamilies, VOWEL_ORDERS } from '../data/geezAlphabet';
import { audioEngine } from '../audio/AudioEngine';

let nextId = 0;
const uid = () => String(++nextId);

function buildInvaders(level: number): { invaders: Invader[]; targetVowelOrder: number; targetChar: string; targetRomanized: string; totalCorrect: number } {
  // Pick random consonant families based on level (more families = harder)
  const familyCount = Math.min(4 + level, 10);
  const families = getRandomFamilies(familyCount);

  // Pick a random target vowel order
  const targetVowelOrder = Math.floor(Math.random() * 7) + 1;
  const vowelSuffixes = ['ä', 'u', 'i', 'a', 'é', 'e', 'o'];

  // Build invader grid
  const invaders: Invader[] = [];
  const cols = 7; // one per vowel order
  const rows = families.length;

  const gridWidth = cols * (INVADER_SIZE + INVADER_GAP_X) - INVADER_GAP_X;
  const startX = (GAME_WIDTH - gridWidth) / 2;
  const startY = 60;

  families.forEach((family, row) => {
    for (let col = 0; col < cols; col++) {
      const vowelOrder = col + 1;
      invaders.push({
        id: uid(),
        char: family.chars[col],
        romanized: family.romanBase + vowelSuffixes[col],
        consonant: family.name,
        consonantIndex: row,
        vowelOrder,
        x: startX + col * (INVADER_SIZE + INVADER_GAP_X),
        y: startY + row * (INVADER_SIZE + INVADER_GAP_Y),
        alive: true,
        hit: false,
        correct: vowelOrder === targetVowelOrder,
      });
    }
  });

  // Pick one correct invader's character for audio announcement
  const correctInvaders = invaders.filter(inv => inv.correct);
  const announcedInvader = correctInvaders[Math.floor(Math.random() * correctInvaders.length)];

  return {
    invaders,
    targetVowelOrder,
    targetChar: announcedInvader.char,
    targetRomanized: announcedInvader.romanized,
    totalCorrect: correctInvaders.length,
  };
}

function createInitialState(): GameState {
  const { invaders, targetVowelOrder, targetChar, targetRomanized, totalCorrect } = buildInvaders(1);
  return {
    phase: 'menu',
    score: 0,
    lives: INITIAL_LIVES,
    level: 1,
    invaders,
    bullets: [],
    explosions: [],
    playerX: GAME_WIDTH / 2 - PLAYER_WIDTH / 2,
    targetVowelOrder,
    targetChar,
    targetRomanized,
    correctHitsThisRound: 0,
    totalCorrectThisRound: totalCorrect,
    comboCount: 0,
    invaderSpeed: 0.3,
    invaderDirection: 1,
  };
}

export function useGameLoop() {
  const [state, setState] = useState<GameState>(createInitialState);
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const shootCooldownRef = useRef<number>(0);

  const startGame = useCallback(() => {
    const { invaders, targetVowelOrder, targetChar, targetRomanized, totalCorrect } = buildInvaders(1);
    setState({
      phase: 'playing',
      score: 0,
      lives: INITIAL_LIVES,
      level: 1,
      invaders,
      bullets: [],
      explosions: [],
      playerX: GAME_WIDTH / 2 - PLAYER_WIDTH / 2,
      targetVowelOrder,
      targetChar,
      targetRomanized,
      correctHitsThisRound: 0,
      totalCorrectThisRound: totalCorrect,
      comboCount: 0,
      invaderSpeed: 0.3,
      invaderDirection: 1,
    });
    // Play the target syllable audio
    setTimeout(() => audioEngine.play(targetChar, targetRomanized), 500);
  }, []);

  const nextLevel = useCallback((currentState: GameState) => {
    const newLevel = currentState.level + 1;
    const { invaders, targetVowelOrder, targetChar, targetRomanized, totalCorrect } = buildInvaders(newLevel);
    audioEngine.playLevelComplete();
    setState(prev => ({
      ...prev,
      phase: 'playing',
      level: newLevel,
      invaders,
      bullets: [],
      explosions: [],
      playerX: GAME_WIDTH / 2 - PLAYER_WIDTH / 2,
      targetVowelOrder,
      targetChar,
      targetRomanized,
      correctHitsThisRound: 0,
      totalCorrectThisRound: totalCorrect,
      comboCount: 0,
      invaderSpeed: 0.3 + newLevel * 0.1,
      invaderDirection: 1,
    }));
    setTimeout(() => audioEngine.play(targetChar, targetRomanized), 1000);
  }, []);

  // Input handling
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === ' ') e.preventDefault();
      if (e.key === 'r' || e.key === 'R') {
        setState(s => {
          if (s.phase === 'playing') {
            audioEngine.play(s.targetChar, s.targetRomanized);
          }
          return s;
        });
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Game loop
  useEffect(() => {
    if (state.phase !== 'playing') return;

    const tick = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const _delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      setState(prev => {
        if (prev.phase !== 'playing') return prev;

        let { playerX, bullets, invaders, explosions, score, lives, comboCount,
              invaderSpeed, invaderDirection, correctHitsThisRound, totalCorrectThisRound } = prev;

        // Clone arrays
        bullets = [...bullets];
        invaders = invaders.map(inv => ({ ...inv }));
        explosions = explosions.map(exp => ({ ...exp }));

        // Player movement
        const keys = keysRef.current;
        if (keys.has('ArrowLeft') || keys.has('a')) {
          playerX = Math.max(0, playerX - PLAYER_SPEED);
        }
        if (keys.has('ArrowRight') || keys.has('d')) {
          playerX = Math.min(GAME_WIDTH - PLAYER_WIDTH, playerX + PLAYER_SPEED);
        }

        // Shooting
        shootCooldownRef.current = Math.max(0, shootCooldownRef.current - 1);
        if ((keys.has(' ') || keys.has('ArrowUp')) && shootCooldownRef.current === 0) {
          bullets.push({
            id: uid(),
            x: playerX + PLAYER_WIDTH / 2 - 2,
            y: GAME_HEIGHT - 60,
          });
          audioEngine.playShoot();
          shootCooldownRef.current = 15;
        }

        // Move bullets
        bullets = bullets
          .map(b => ({ ...b, y: b.y - BULLET_SPEED }))
          .filter(b => b.y > -20);

        // Move invaders
        let hitEdge = false;
        const aliveInvaders = invaders.filter(inv => inv.alive);
        aliveInvaders.forEach(inv => {
          inv.x += invaderSpeed * invaderDirection;
          if (inv.x <= 0 || inv.x >= GAME_WIDTH - INVADER_SIZE) {
            hitEdge = true;
          }
        });

        if (hitEdge) {
          invaderDirection = (invaderDirection * -1) as 1 | -1;
          invaders.forEach(inv => {
            if (inv.alive) {
              inv.y += 12;
            }
          });
        }

        // Check if invaders reached the bottom
        const reachedBottom = invaders.some(inv => inv.alive && inv.y >= GAME_HEIGHT - 80);
        if (reachedBottom) {
          audioEngine.playGameOver();
          return { ...prev, phase: 'gameOver' as const, playerX, invaders, bullets, explosions };
        }

        // Collision detection: bullets vs invaders
        const bulletsToRemove = new Set<string>();
        bullets.forEach(bullet => {
          invaders.forEach(inv => {
            if (!inv.alive) return;
            if (
              bullet.x >= inv.x &&
              bullet.x <= inv.x + INVADER_SIZE &&
              bullet.y >= inv.y &&
              bullet.y <= inv.y + INVADER_SIZE
            ) {
              bulletsToRemove.add(bullet.id);
              inv.alive = false;
              inv.hit = true;

              if (inv.correct) {
                // Correct hit!
                comboCount++;
                const comboBonus = comboCount > 1 ? comboCount * 10 : 0;
                score += 100 + comboBonus;
                correctHitsThisRound++;
                audioEngine.playHit();
              } else {
                // Wrong target — penalty
                comboCount = 0;
                lives--;
                score = Math.max(0, score - 50);
                audioEngine.playWrong();
              }

              explosions.push({
                id: uid(),
                x: inv.x + INVADER_SIZE / 2,
                y: inv.y + INVADER_SIZE / 2,
                frame: 0,
                correct: inv.correct,
              });
            }
          });
        });

        bullets = bullets.filter(b => !bulletsToRemove.has(b.id));

        // Update explosions
        explosions = explosions
          .map(e => ({ ...e, frame: e.frame + 1 }))
          .filter(e => e.frame < 20);

        // Check game over
        if (lives <= 0) {
          audioEngine.playGameOver();
          return {
            ...prev,
            phase: 'gameOver' as const,
            score, lives: 0, playerX, bullets, invaders, explosions, comboCount,
            invaderDirection,
          };
        }

        // Check level complete: all correct invaders destroyed
        if (correctHitsThisRound >= totalCorrectThisRound) {
          return {
            ...prev,
            phase: 'levelComplete' as const,
            score, lives, playerX, bullets, invaders, explosions,
            comboCount, correctHitsThisRound, invaderDirection,
          };
        }

        return {
          ...prev,
          playerX, bullets, invaders, explosions, score, lives,
          comboCount, invaderSpeed, invaderDirection, correctHitsThisRound,
        };
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state.phase]);

  // Handle level complete transition
  useEffect(() => {
    if (state.phase === 'levelComplete') {
      const timer = setTimeout(() => nextLevel(state), 2000);
      return () => clearTimeout(timer);
    }
  }, [state.phase, nextLevel, state]);

  const replayAudio = useCallback(() => {
    audioEngine.play(state.targetChar, state.targetRomanized);
  }, [state.targetChar, state.targetRomanized]);

  return { state, startGame, replayAudio };
}
