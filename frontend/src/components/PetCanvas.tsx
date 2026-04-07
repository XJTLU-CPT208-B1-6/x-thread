import { useEffect, useRef, useState, useCallback } from 'react';
import { SpriteManager } from '../utils/SpriteManager';
import type { PetType, PetAnimationState } from '../types/pet';

interface PetCanvasProps {
  petType: PetType;
  state: PetAnimationState;
  scale?: number;
  className?: string;
}

const spriteManager = new SpriteManager();
const FRAME_RATE = 100;
const FRAME_COUNT = 4;

export function PetCanvas({ petType, state, scale = 1, className = '' }: PetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const frameIndexRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const animationFrameIdRef = useRef<number>();
  const isVisibleRef = useRef(true);

  const SPRITE_SIZE = 128;
  const canvasSize = SPRITE_SIZE * scale;

  const loadSprites = useCallback(async () => {
    try {
      setHasError(false);
      await spriteManager.preloadAllSprites(petType);
      setLoaded(true);
    } catch (err) {
      console.warn('Failed to load sprites:', err);
      setHasError(true);
    }
  }, [petType]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (hasError || !loaded) {
      ctx.font = `${canvasSize * 0.6}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        spriteManager.getPlaceholderEmoji(petType),
        canvas.width / 2,
        canvas.height / 2
      );
      return;
    }

    const success = spriteManager.drawFrame(
      ctx,
      petType,
      state,
      frameIndexRef.current,
      0,
      0,
      scale
    );

    if (!success) {
      ctx.font = `${canvasSize * 0.6}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        spriteManager.getPlaceholderEmoji(petType),
        canvas.width / 2,
        canvas.height / 2
      );
    }
  }, [petType, state, scale, loaded, hasError, canvasSize]);

  const animate = useCallback((timestamp: number) => {
    if (!isVisibleRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      return;
    }

    if (timestamp - lastFrameTimeRef.current >= FRAME_RATE) {
      frameIndexRef.current = (frameIndexRef.current + 1) % FRAME_COUNT;
      lastFrameTimeRef.current = timestamp;
      render();
    }

    animationFrameIdRef.current = requestAnimationFrame(animate);
  }, [render]);

  const handleVisibilityChange = useCallback(() => {
    isVisibleRef.current = !document.hidden;
  }, []);

  useEffect(() => {
    loadSprites();
  }, [loadSprites]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  useEffect(() => {
    lastFrameTimeRef.current = performance.now();
    animationFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [animate]);

  useEffect(() => {
    if (loaded) {
      render();
    }
  }, [state, render, loaded]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize}
      height={canvasSize}
      className={className}
      style={{
        imageRendering: 'pixelated' as const,
      }}
    />
  );
}
