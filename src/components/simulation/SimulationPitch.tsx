import { motion } from 'framer-motion';
import { SimPlayer } from '@/types/simulation';

interface SimulationPitchProps {
  players: SimPlayer[];
  ballOwnerId: string | null;
  ballPosition?: { x: number; y: number } | null;
  ballTarget?: { x: number; y: number } | null;
  isBallAnimating?: boolean;
}

export const SimulationPitch = ({ 
  players, 
  ballOwnerId,
  ballPosition,
  ballTarget,
  isBallAnimating
}: SimulationPitchProps) => {
  const ballOwner = ballOwnerId ? players.find(p => p.id === ballOwnerId) : null;
  
  return (
    <div className="relative w-[400px] h-[600px] bg-gradient-to-b from-green-600 to-green-700 rounded-lg overflow-hidden shadow-2xl border-4 border-white/20">
      {/* Pitch markings */}
      <div className="absolute inset-0">
        {/* Center line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/40" />
        
        {/* Center circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white/40 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/60 rounded-full" />
        
        {/* Bottom goal area (Team 1 - Blue) */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-12 border-t-2 border-l-2 border-r-2 border-white/40" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-24 border-t-2 border-l-2 border-r-2 border-white/30" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-white/20 rounded-t-sm" />
        
        {/* Top goal area (Team 2 - Red) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-12 border-b-2 border-l-2 border-r-2 border-white/40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 border-b-2 border-l-2 border-r-2 border-white/30" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-white/20 rounded-b-sm" />
      </div>
      
      {/* Players */}
      {players.map(player => (
        <SimulationPlayerDot 
          key={player.id} 
          player={player} 
          hasBall={player.id === ballOwnerId && !isBallAnimating}
        />
      ))}
      
      {/* Animated ball during pass/shot */}
      {isBallAnimating && ballPosition && ballTarget && (
        <motion.div
          className="absolute w-4 h-4 bg-gradient-to-br from-white to-gray-200 rounded-full pointer-events-none z-20"
          style={{
            boxShadow: '0 0 15px rgba(255,255,255,0.9), 0 2px 6px rgba(0,0,0,0.4)',
          }}
          initial={{
            left: ballPosition.x,
            top: ballPosition.y,
            x: '-50%',
            y: '-50%',
            scale: 1,
          }}
          animate={{
            left: ballTarget.x,
            top: ballTarget.y,
            x: '-50%',
            y: '-50%',
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 0.5,
            ease: 'easeOut',
          }}
        />
      )}
      
      {/* Static ball on player when not animating */}
      {!isBallAnimating && ballOwner && (
        <motion.div
          className="absolute pointer-events-none z-10"
          animate={{
            left: ballOwner.x,
            top: ballOwner.y - 20,
            x: '-50%',
            y: '-50%',
          }}
          transition={{ type: 'spring', stiffness: 120, damping: 15 }}
        >
          <motion.div 
            className="w-4 h-4 bg-gradient-to-br from-white to-gray-200 rounded-full"
            style={{
              boxShadow: '0 0 10px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.3)',
            }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </motion.div>
      )}
    </div>
  );
};

interface SimulationPlayerDotProps {
  player: SimPlayer;
  hasBall: boolean;
}

const SimulationPlayerDot = ({ player, hasBall }: SimulationPlayerDotProps) => {
  const teamColor = player.team === 'T1' ? 'bg-blue-500' : 'bg-red-500';
  const teamShadow = player.team === 'T1' ? 'shadow-blue-500/50' : 'shadow-red-500/50';
  
  // Format label: GK, DF1, DF2, FW1, FW2, etc.
  const getPlayerLabel = () => {
    if (player.role === 'G') return 'GK';
    if (player.role === 'D') return `DF${player.index}`;
    return `FW${player.index}`;
  };
  
  return (
    <motion.div
      className="absolute flex flex-col items-center"
      style={{
        left: 0,
        top: 0,
      }}
      initial={false}
      animate={{ 
        x: player.x,
        y: player.y,
        scale: hasBall ? 1.15 : 1
      }}
      transition={{ 
        type: 'tween',
        duration: 1.5,
        ease: 'easeInOut'
      }}
    >
      {/* Centering wrapper */}
      <div className="flex flex-col items-center" style={{ transform: 'translate(-50%, -50%)' }}>
        {/* Player dot with label inside */}
        <div className={`relative w-8 h-8 rounded-full ${teamColor} shadow-lg ${teamShadow} flex items-center justify-center`}>
          <span className="text-[7px] font-bold text-white">{getPlayerLabel()}</span>
          
          {/* Ball indicator on player */}
          {hasBall && (
            <motion.div
              className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full shadow-lg"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          )}
        </div>
        
        {/* Stamina bar */}
        <div className="mt-1 w-10 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-yellow-400"
            initial={false}
            animate={{ width: `${player.stamina}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        
        {/* Rage bar */}
        <div className="mt-0.5 w-10 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-orange-500"
            initial={false}
            animate={{ width: `${player.rage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>
    </motion.div>
  );
};
