import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FeedButtonProps {
  onFeed: () => void;
  disabled?: boolean;
  cooldownSeconds?: number;
  visible?: boolean;
}

const COOLDOWN_SECONDS = 60;

export function FeedButton({ 
  onFeed, 
  disabled = false, 
  cooldownSeconds = COOLDOWN_SECONDS,
  visible = true 
}: FeedButtonProps) {
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isOnCooldown && remainingTime > 0) {
      timer = setTimeout(() => {
        setRemainingTime(prev => prev - 1);
      }, 1000);
    } else if (isOnCooldown && remainingTime === 0) {
      setIsOnCooldown(false);
    }
    return () => clearTimeout(timer);
  }, [isOnCooldown, remainingTime]);

  const handleClick = useCallback(() => {
    if (isOnCooldown || disabled) return;
    
    onFeed();
    
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 1500);
    
    setIsOnCooldown(true);
    setRemainingTime(cooldownSeconds);
  }, [isOnCooldown, disabled, onFeed, cooldownSeconds]);

  const isDisabled = disabled || isOnCooldown;

  return (
    <div className="relative">
      <AnimatePresence>
        {visible && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleClick}
            disabled={isDisabled}
            aria-label={isOnCooldown ? `喂食冷却中 ${remainingTime}秒` : '喂食宠物'}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full
              font-semibold text-sm transition-all duration-200
              ${isDisabled 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-orange-500 text-white hover:bg-orange-600 hover:scale-105 active:scale-95'
              }
              shadow-lg
            `}
          >
            <span className="text-lg">🍖</span>
            <span>
              {isOnCooldown ? `${remainingTime}s` : '喂食'}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: -30 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2"
          >
            <span className="text-2xl font-bold text-green-500 drop-shadow-lg">
              +20 能量
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
