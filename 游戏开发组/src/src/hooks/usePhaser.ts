// hooks/usePhaser.ts —— 把 Phaser 挂进 React 的 hook（验证点 1：Phaser + React 共存）
// React 只负责容器 div 与 UI 面板，Phaser 独立渲染画布；StrictMode 下自动防重复创建。

import { useEffect, useRef, type RefObject } from 'react';
import Phaser from 'phaser';
import GameScene, { GRID_W, GRID_H } from '../scene/GameScene';
import { TILE } from '../scene/WorkerSprite';

export function usePhaser(containerRef: RefObject<HTMLDivElement | null>) {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || gameRef.current) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: el,
      width: GRID_W * TILE,
      height: GRID_H * TILE,
      backgroundColor: '#182418',
      scene: [GameScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });
    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, [containerRef]);

  return gameRef;
}
