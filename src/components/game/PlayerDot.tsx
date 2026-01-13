import { motion, AnimatePresence } from 'framer-motion';
import { Player } from '@/types/game';

interface PlayerDotProps {
  player: Player;
  isSelected: boolean;
  onClick: () => void;
}

export const PlayerDot = ({ player, isSelected, onClick }: PlayerDotProps) => {
  const teamColor = player.team === 'blue' ? 'rgb(59, 130, 246)' : 'rgb(239, 68, 68)';
  const glowColor = player.team === 'blue' ? 'rgba(59, 130, 246, 0.6)' : 'rgba(239, 68, 68, 0.6)';
  
  return (
    <motion.div
      className="absolute cursor-pointer"
      style={{
        left: player.x - 15,
        top: player.y - 15,
      }}
      animate={{
        left: player.x - 15,
        top: player.y - 15,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }}
      onClick={onClick}
    >
      {/* Skill activation effect */}
      <AnimatePresence>
        {player.isSkillActive && (
          <motion.div
            className="absolute -inset-4 rounded-full"
            style={{
              background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0.4, 0.8] }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </AnimatePresence>
      
      {/* Player dot */}
      <motion.div
        className={`relative w-[30px] h-[30px] rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
          isSelected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-transparent' : ''
        }`}
        style={{
          background: teamColor,
          boxShadow: `0 0 15px ${glowColor}, 0 0 30px ${glowColor}`,
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {player.role}
        
        {/* Ball indicator */}
        {player.hasBall && (
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </motion.div>
      
      {/* Stats bars */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 space-y-0.5">
        {/* HP Bar */}
        <div className="h-1 bg-gray-800/60 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-green-500"
            style={{ width: `${(player.hp / player.maxHp) * 100}%` }}
          />
        </div>
        {/* Rage Bar */}
        <div className="h-1 bg-gray-800/60 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-yellow-500"
            animate={{
              width: `${(player.rage / player.maxRage) * 100}%`,
            }}
          />
        </div>
      </div>
      
      {/* Skill emoji when active */}
      <AnimatePresence>
        {player.isSkillActive && (
          <motion.div
            className="absolute -top-6 left-1/2 -translate-x-1/2 text-xl"
            initial={{ y: 10, opacity: 0, scale: 0 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0 }}
          >
            {player.skill.emoji}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
