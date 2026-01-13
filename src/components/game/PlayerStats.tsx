import { motion } from 'framer-motion';
import { Player } from '@/types/game';
import { Progress } from '@/components/ui/progress';

interface PlayerStatsProps {
  player: Player | undefined;
}

export const PlayerStats = ({ player }: PlayerStatsProps) => {
  if (!player) {
    return (
      <div className="bg-gray-900/90 backdrop-blur rounded-lg p-4 h-full flex flex-col border border-gray-700">
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          👤 Player Stats
        </h2>
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Click on a player to view stats
        </div>
      </div>
    );
  }

  const teamColor = player.team === 'blue' ? 'text-blue-400' : 'text-red-400';
  const teamBg = player.team === 'blue' ? 'bg-blue-500' : 'bg-red-500';

  return (
    <motion.div
      className="bg-gray-900/90 backdrop-blur rounded-lg p-4 h-full flex flex-col border border-gray-700"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      key={player.id}
    >
      <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        👤 Player Stats
      </h2>
      
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${teamBg}`}
            style={{
              boxShadow: player.team === 'blue' 
                ? '0 0 15px rgba(59, 130, 246, 0.5)' 
                : '0 0 15px rgba(239, 68, 68, 0.5)',
            }}
          >
            {player.role}
          </div>
          <div>
            <h3 className={`font-bold text-lg ${teamColor}`}>{player.name}</h3>
            <p className="text-gray-400 text-sm capitalize">Team {player.team}</p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">⚔️ Attack</span>
              <span className="text-white font-bold">{player.stats.atk}</span>
            </div>
            <Progress value={player.stats.atk} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">🛡️ Defense</span>
              <span className="text-white font-bold">{player.stats.def}</span>
            </div>
            <Progress value={player.stats.def} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">⚡ Speed</span>
              <span className="text-white font-bold">{player.stats.spd}</span>
            </div>
            <Progress value={player.stats.spd} className="h-2" />
          </div>
        </div>
        
        {/* Status bars */}
        <div className="space-y-2 pt-2 border-t border-gray-700">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-green-400">❤️ HP</span>
              <span className="text-gray-300">{player.hp}/{player.maxHp}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all"
                style={{ width: `${(player.hp / player.maxHp) * 100}%` }}
              />
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-yellow-400">🔥 Rage</span>
              <span className="text-gray-300">{Math.floor(player.rage)}/{player.maxRage}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-yellow-500"
                animate={{ width: `${(player.rage / player.maxRage) * 100}%` }}
              />
            </div>
          </div>
        </div>
        
        {/* Skill */}
        <div className="pt-2 border-t border-gray-700">
          <h4 className="text-sm text-gray-400 mb-2">Special Skill</h4>
          <div className={`p-3 rounded-lg ${player.isSkillActive ? 'bg-purple-500/20 border border-purple-500' : 'bg-gray-800'}`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{player.skill.emoji}</span>
              <div>
                <p className="text-white font-semibold text-sm">{player.skill.name}</p>
                <p className="text-gray-400 text-xs">{player.skill.effect}</p>
              </div>
            </div>
            {player.isSkillActive && (
              <motion.p
                className="text-purple-400 text-xs mt-2 font-bold"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                ⚡ SKILL READY!
              </motion.p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
