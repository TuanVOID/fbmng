import { motion } from 'framer-motion';

interface ScoreboardProps {
  blueScore: number;
  redScore: number;
  matchTime: number;
  isRunning: boolean;
}

export const Scoreboard = ({ blueScore, redScore, matchTime, isRunning }: ScoreboardProps) => {
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 1200); // 1200 ticks = 1 minute
    const seconds = Math.floor((time % 1200) / 20);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-center gap-6 bg-gray-900/90 backdrop-blur rounded-lg px-8 py-4 border border-gray-700">
      {/* Blue Team */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <span className="text-white font-bold">🔵</span>
        </div>
        <div className="text-right">
          <p className="text-blue-400 text-sm font-medium">Team Blue</p>
          <motion.p
            key={blueScore}
            className="text-3xl font-bold text-white"
            initial={{ scale: 1.5 }}
            animate={{ scale: 1 }}
          >
            {blueScore}
          </motion.p>
        </div>
      </div>

      {/* Timer */}
      <div className="px-6 py-2 bg-gray-800 rounded-lg">
        <p className="text-2xl font-mono text-white font-bold">
          {formatTime(matchTime)}
        </p>
        {isRunning && (
          <motion.div
            className="w-2 h-2 bg-green-500 rounded-full mx-auto mt-1"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>

      {/* Red Team */}
      <div className="flex items-center gap-3">
        <div className="text-left">
          <p className="text-red-400 text-sm font-medium">Team Red</p>
          <motion.p
            key={redScore}
            className="text-3xl font-bold text-white"
            initial={{ scale: 1.5 }}
            animate={{ scale: 1 }}
          >
            {redScore}
          </motion.p>
        </div>
        <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
          <span className="text-white font-bold">🔴</span>
        </div>
      </div>
    </div>
  );
};
