import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePetStore } from '../stores/usePetStore';
import { PetStateMachine } from '../utils/PetStateMachine';
import { PositionStorage } from '../utils/PositionStorage';
import { PetCanvas } from './PetCanvas';
import { FeedButton } from './FeedButton';
import { useDraggable } from '../hooks/useDraggable';
import { useRoomActivityMonitor } from '../hooks/useRoomActivityMonitor';
import type { PetAnimationState } from '../types/pet';

interface PetWidgetProps {
  roomId?: string;
}

export function PetWidget({ roomId }: PetWidgetProps) {
  const { petData, fetchPetData, feedPet, position, setPosition } = usePetStore();
  const [showFeedButton, setShowFeedButton] = useState(false);
  const [stateMachine] = useState(() => new PetStateMachine());
  const [animationState, setAnimationState] = useState<PetAnimationState>('idle');
  const [scale, setScale] = useState(1);

  useEffect(() => {
    stateMachine.setOnStateChange(setAnimationState);
    return () => stateMachine.destroy();
  }, [stateMachine]);

  useEffect(() => {
    if (petData && petData.energy < 30 && animationState !== 'reaction') {
      stateMachine.transition({ state: 'hungry' });
    }
  }, [petData?.energy, animationState, stateMachine]);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setScale(1);
      } else if (width < 1440) {
        setScale(1.5);
      } else {
        setScale(2);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const initialPosition = useMemo(() => {
    if (roomId) {
      return PositionStorage.load(roomId);
    }
    return PositionStorage.getDefaultPosition();
  }, [roomId]);

  const { position: dragPosition, isDragging, handleMouseDown, setPosition: setDragPosition } = useDraggable({
    initialPosition,
    disabled: false,
    onDragEnd: (pos) => {
      if (roomId) {
        PositionStorage.save(roomId, pos);
      }
      setPosition(pos);
    },
  });

  useEffect(() => {
    setPosition(dragPosition);
  }, [dragPosition, setPosition]);

  useEffect(() => {
    if (roomId) {
      const saved = PositionStorage.load(roomId);
      setDragPosition(saved);
    }
  }, [roomId, setDragPosition]);

  useRoomActivityMonitor({
    roomId,
    onStateChange: (state, duration) => {
      if (petData && petData.energy >= 30) {
        stateMachine.transition({ state, duration });
      }
    },
  });

  useEffect(() => {
    if (roomId) {
      fetchPetData(roomId);
    }
  }, [roomId, fetchPetData]);

  const handlePetClick = useCallback(() => {
    stateMachine.playReaction();
  }, [stateMachine]);

  const handleFeed = useCallback(async () => {
    if (!roomId) return;
    await feedPet(roomId);
    if (petData) {
      stateMachine.transition({ state: 'happy', duration: 5000 });
    }
  }, [roomId, feedPet, petData, stateMachine]);

  const getAriaLabel = useCallback(() => {
    const stateLabels: Record<PetAnimationState, string> = {
      idle: '宠物正在休息',
      happy: '宠物正在开心地玩耍',
      busy: '宠物正在忙碌',
      hungry: '宠物饿了',
      reaction: '宠物对你的互动做出反应',
    };
    return stateLabels[animationState] || '宠物';
  }, [animationState]);

  if (!petData) {
    return null;
  }

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      style={{
        position: 'fixed',
        left: dragPosition.x,
        top: dragPosition.y,
        zIndex: 50,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseEnter={() => setShowFeedButton(true)}
      onMouseLeave={() => setShowFeedButton(false)}
      role="img"
      aria-label={getAriaLabel()}
      aria-live="polite"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handlePetClick();
        }
      }}
    >
      <div className="relative flex flex-col items-center gap-2">
        <div
          onMouseDown={handleMouseDown}
          onClick={handlePetClick}
          className="select-none"
        >
          <PetCanvas
            petType={petData.petType}
            state={animationState}
            scale={scale}
          />
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-xs text-gray-600 bg-white/80 px-2 py-1 rounded-full backdrop-blur">
            <span>Lv.{petData.level}</span>
            <span className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 transition-all duration-300"
                style={{ width: `${petData.energy}%` }}
              />
            </span>
            <span>{petData.energy}%</span>
          </div>

          <FeedButton
            onFeed={handleFeed}
            visible={showFeedButton}
          />
        </div>
      </div>
    </motion.div>
  );
}
