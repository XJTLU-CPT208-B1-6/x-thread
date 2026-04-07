import { useState, useRef, useCallback, useEffect } from 'react';
import type { Position } from '../types/pet';

interface UseDraggableOptions {
  initialPosition?: Position;
  onDragEnd?: (position: Position) => void;
  minX?: number;
  minY?: number;
  maxX?: number;
  maxY?: number;
  disabled?: boolean;
}

export function useDraggable({
  initialPosition,
  onDragEnd,
  minX = 0,
  minY = 0,
  maxX,
  maxY,
  disabled = false,
}: UseDraggableOptions = {}) {
  const [position, setPosition] = useState<Position>(
    initialPosition || { x: 0, y: 0 }
  );
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const clampPosition = useCallback((pos: Position): Position => {
    const calculatedMaxX = maxX ?? (window.innerWidth - 256);
    const calculatedMaxY = maxY ?? (window.innerHeight - 256);
    
    return {
      x: Math.max(minX, Math.min(calculatedMaxX, pos.x)),
      y: Math.max(minY, Math.min(calculatedMaxY, pos.y)),
    };
  }, [minX, minY, maxX, maxY]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      
      e.preventDefault();
      setIsDragging(true);
      
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position.x,
        posY: position.y,
      };
    },
    [position, disabled]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;
      
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      
      const newPos = clampPosition({
        x: dragStartRef.current.posX + deltaX,
        y: dragStartRef.current.posY + deltaY,
      });
      
      setPosition(newPos);
    },
    [isDragging, clampPosition]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    dragStartRef.current = null;
    
    onDragEnd?.(position);
  }, [isDragging, position, onDragEnd]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mouseleave', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const setPositionClamped = useCallback(
    (newPos: Position) => {
      setPosition(clampPosition(newPos));
    },
    [clampPosition]
  );

  return {
    position,
    setPosition: setPositionClamped,
    isDragging,
    handleMouseDown,
    elementRef,
  };
}
