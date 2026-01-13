import { motion, AnimatePresence } from 'framer-motion';
import { Team } from '@/types/game';

interface GoalOverlayProps {
  show: boolean;
  blueScore: number;
  redScore: number;
  scoringTeam?: Team;
}

export const GoalOverlay = ({ show, blueScore, redScore, scoringTeam }: GoalOverlayProps) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Background blur */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          
          {/* Goal text */}
          <motion.div
            className="relative flex flex-col items-center"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 10, stiffness: 100 }}
          >
            {/* GOAL text */}
            <motion.h1
              className={`text-6xl font-black tracking-wider mb-4 ${
                scoringTeam === 'blue' 
                  ? 'text-blue-400 drop-shadow-[0_0_30px_rgba(59,130,246,0.8)]'
                  : 'text-red-400 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]'
              }`}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              ⚽ GOAL! ⚽
            </motion.h1>
            
            {/* Score display */}
            <motion.div
              className="flex items-center gap-6 bg-gray-900/90 px-8 py-4 rounded-2xl border-2 border-white/20"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {/* Blue score */}
              <div className="flex flex-col items-center">
                <span className="text-blue-400 text-sm font-semibold mb-1">BLUE</span>
                <motion.span
                  className="text-5xl font-black text-blue-400"
                  initial={scoringTeam === 'blue' ? { scale: 1.5 } : {}}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 8 }}
                >
                  {blueScore}
                </motion.span>
              </div>
              
              {/* Separator */}
              <span className="text-4xl font-bold text-white/50">-</span>
              
              {/* Red score */}
              <div className="flex flex-col items-center">
                <span className="text-red-400 text-sm font-semibold mb-1">RED</span>
                <motion.span
                  className="text-5xl font-black text-red-400"
                  initial={scoringTeam === 'red' ? { scale: 1.5 } : {}}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 8 }}
                >
                  {redScore}
                </motion.span>
              </div>
            </motion.div>

            {/* Confetti effect */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className={`absolute w-3 h-3 rounded-full ${
                  i % 3 === 0 ? 'bg-yellow-400' : i % 3 === 1 ? 'bg-blue-400' : 'bg-red-400'
                }`}
                initial={{ 
                  x: 0, 
                  y: 0, 
                  scale: 0,
                  opacity: 1 
                }}
                animate={{ 
                  x: (Math.random() - 0.5) * 300,
                  y: (Math.random() - 0.5) * 200,
                  scale: [0, 1, 0],
                  opacity: [1, 1, 0],
                }}
                transition={{ 
                  duration: 1.5,
                  delay: 0.1 + i * 0.05,
                  ease: 'easeOut'
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
