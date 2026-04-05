import React from 'react';
import Lottie from 'lottie-react';
import { usePetStore } from '../stores/usePetStore';
import { motion } from 'framer-motion';

// Mock imports for lottie files - you'll need these in public/pet-sprites/
// In a real implementation, you'd fetch them or import if small enough.
const getAnimationData = (mood: string) => {
  // Replace with actual imports or fetch calls
  switch(mood) {
    case 'happy': return 'happy-jump.json';
    case 'sleepy': return 'sleepy-doze.json';
    case 'knocking': return 'knock-screen.json';
    case 'excited': return 'firework-celebrate.json';
    default: return 'egg-hatch.json';
  }
};

export const PetWidget = () => {
  const { currentPet } = usePetStore();

  if (!currentPet) return null;

  return (
    <motion.div 
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="fixed bottom-4 right-4 w-32 h-32 bg-white rounded-full shadow-lg border-4 border-yellow-400 p-2 pointer-events-none"
    >
      <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-2 py-1 rounded-full transform translate-x-1/2 -translate-y-1/2">
        Lv {currentPet.level}
      </div>
      {/* Fallback visual since actual lottie files are missing */}
      <div className="w-full h-full rounded-full bg-blue-100 flex items-center justify-center text-4xl">
         {currentPet.mood === 'happy' && '😀'}
         {currentPet.mood === 'sad' && '😢'}
         {currentPet.mood === 'sleepy' && '😴'}
         {currentPet.mood === 'excited' && '🤩'}
         {currentPet.mood === 'knocking' && '✊'}
         {currentPet.mood === 'neutral' && '😐'}
      </div>
    </motion.div>
  );
};
