import { useEffect, useRef } from 'react';
import type { GameState } from './types';
import {
  GAME_WIDTH, GAME_HEIGHT, PLAYER_WIDTH, PLAYER_HEIGHT,
  INVADER_SIZE, BULLET_WIDTH, BULLET_HEIGHT,
} from './types';
import { VOWEL_ORDERS } from '../data/geezAlphabet';

interface Props {
  state: GameState;
}

// Color palette per vowel order for visual grouping
const VOWEL_COLORS = [
  '#ff4444', // 1st - red
  '#ff8c00', // 2nd - orange
  '#ffd700', // 3rd - gold
  '#44ff44', // 4th - green
  '#44bbff', // 5th - blue
  '#aa44ff', // 6th - purple
  '#ff44aa', // 7th - pink
];

// Consonant family row colors (neon tones)
const ROW_COLORS = [
  '#ff5555', '#ff7744', '#ffaa33', '#ffdd44',
  '#88ff44', '#44ff88', '#44ffcc', '#44ddff',
  '#4488ff', '#7744ff',
];

export function GameCanvas({ state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw starfield background
    drawStars(ctx);

    // Draw target info at top
    drawTargetInfo(ctx, state);

    // Draw invaders
    state.invaders.forEach(inv => {
      if (!inv.alive) return;

      const color = inv.correct
        ? '#00ff88'  // correct targets glow green
        : ROW_COLORS[inv.consonantIndex % ROW_COLORS.length];

      // Invader body
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.roundRect(inv.x, inv.y, INVADER_SIZE, INVADER_SIZE, 6);
      ctx.fill();

      // Glow for correct targets
      if (inv.correct) {
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = 1;

      // Character text
      ctx.fillStyle = inv.correct ? '#001a0a' : '#ffffff';
      ctx.font = 'bold 24px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(inv.char, inv.x + INVADER_SIZE / 2, inv.y + INVADER_SIZE / 2);

      // Vowel order indicator dot
      const dotColor = VOWEL_COLORS[inv.vowelOrder - 1];
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(inv.x + INVADER_SIZE / 2, inv.y + INVADER_SIZE - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw explosions
    state.explosions.forEach(exp => {
      const progress = exp.frame / 20;
      const radius = 10 + progress * 30;
      const alpha = 1 - progress;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = exp.correct ? '#00ff88' : '#ff4444';
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner spark
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Draw bullets
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    state.bullets.forEach(b => {
      ctx.fillRect(b.x, b.y, BULLET_WIDTH, BULLET_HEIGHT);
    });
    ctx.shadowBlur = 0;

    // Draw player ship
    drawPlayer(ctx, state.playerX);

    // Draw HUD
    drawHUD(ctx, state);

    // Draw vowel order legend at bottom
    drawVowelLegend(ctx, state.targetVowelOrder);

  }, [state]);

  return (
    <canvas
      ref={canvasRef}
      width={GAME_WIDTH}
      height={GAME_HEIGHT}
      style={{
        display: 'block',
        margin: '0 auto',
        border: '2px solid #333',
        borderRadius: '8px',
      }}
    />
  );
}

// --- Drawing helpers ---

const stars: { x: number; y: number; size: number; brightness: number }[] = [];
for (let i = 0; i < 80; i++) {
  stars.push({
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
    size: Math.random() * 2 + 0.5,
    brightness: Math.random() * 0.5 + 0.3,
  });
}

function drawStars(ctx: CanvasRenderingContext2D) {
  stars.forEach(s => {
    ctx.fillStyle = `rgba(255, 255, 255, ${s.brightness})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number) {
  const y = GAME_HEIGHT - 50;

  // Ship body
  ctx.fillStyle = '#00ccff';
  ctx.beginPath();
  ctx.moveTo(x + PLAYER_WIDTH / 2, y - 10);
  ctx.lineTo(x + PLAYER_WIDTH, y + PLAYER_HEIGHT);
  ctx.lineTo(x, y + PLAYER_HEIGHT);
  ctx.closePath();
  ctx.fill();

  // Engine glow
  ctx.fillStyle = '#ff6600';
  ctx.shadowColor = '#ff6600';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(x + PLAYER_WIDTH / 2 - 8, y + PLAYER_HEIGHT);
  ctx.lineTo(x + PLAYER_WIDTH / 2, y + PLAYER_HEIGHT + 8);
  ctx.lineTo(x + PLAYER_WIDTH / 2 + 8, y + PLAYER_HEIGHT);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawTargetInfo(ctx: CanvasRenderingContext2D, state: GameState) {
  // Target announcement bar
  ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
  ctx.fillRect(0, 0, GAME_WIDTH, 44);

  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const orderLabel = VOWEL_ORDERS[state.targetVowelOrder - 1].label;
  ctx.fillText(
    `🔊 TARGET: ${state.targetChar}  —  Shoot all ${orderLabel} order invaders!`,
    GAME_WIDTH / 2, 22
  );
}

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.font = 'bold 16px monospace';
  ctx.textBaseline = 'top';

  // Score
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE: ${state.score}`, 16, 52);

  // Lives
  ctx.fillStyle = '#ff4444';
  ctx.textAlign = 'right';
  ctx.fillText(`LIVES: ${'♥'.repeat(state.lives)}`, GAME_WIDTH - 16, 52);

  // Level
  ctx.fillStyle = '#00ccff';
  ctx.textAlign = 'center';
  ctx.fillText(`LEVEL ${state.level}`, GAME_WIDTH / 2, 52);

  // Combo
  if (state.comboCount > 1) {
    ctx.fillStyle = '#ff44ff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`COMBO x${state.comboCount}`, 16, 74);
  }

  // Progress
  const progress = state.totalCorrectThisRound > 0
    ? state.correctHitsThisRound / state.totalCorrectThisRound
    : 0;
  const barWidth = 120;
  const barX = GAME_WIDTH - barWidth - 16;
  const barY = 74;
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barWidth, 8);
  ctx.fillStyle = '#00ff88';
  ctx.fillRect(barX, barY, barWidth * progress, 8);
  ctx.fillStyle = '#aaa';
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${state.correctHitsThisRound}/${state.totalCorrectThisRound}`, barX - 4, barY - 1);
}

function drawVowelLegend(ctx: CanvasRenderingContext2D, targetOrder: number) {
  const y = GAME_HEIGHT - 16;
  const totalWidth = 7 * 80;
  const startX = (GAME_WIDTH - totalWidth) / 2;

  VOWEL_ORDERS.forEach((vo, i) => {
    const x = startX + i * 80;
    const isTarget = vo.order === targetOrder;

    ctx.fillStyle = isTarget ? VOWEL_COLORS[i] : '#444';
    ctx.font = isTarget ? 'bold 13px monospace' : '11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(vo.label, x + 40, y);

    if (isTarget) {
      ctx.fillStyle = VOWEL_COLORS[i];
      ctx.fillRect(x + 10, y + 8, 60, 2);
    }
  });
}
