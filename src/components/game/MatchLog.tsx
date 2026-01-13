import { motion, AnimatePresence } from 'framer-motion';
import { LogEntry } from '@/types/game';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MatchLogProps {
  logs: LogEntry[];
}

const getLogColor = (type: LogEntry['type']) => {
  switch (type) {
    case 'goal':
      return 'text-yellow-400 font-bold';
    case 'skill':
      return 'text-purple-400';
    case 'duel':
      return 'text-orange-400';
    case 'action':
      return 'text-blue-400';
    default:
      return 'text-gray-300';
  }
};

export const MatchLog = ({ logs }: MatchLogProps) => {
  return (
    <div className="bg-gray-900/90 backdrop-blur rounded-lg p-4 h-full flex flex-col border border-gray-700">
      <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        📋 Match Log
      </h2>
      
      <ScrollArea className="flex-1 pr-2">
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {logs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`text-sm ${getLogColor(log.type)} ${
                  index === 0 ? 'bg-white/5 p-2 rounded' : ''
                }`}
              >
                <span className="text-gray-500 text-xs mr-2">
                  {Math.floor(log.time / 60)}:{(log.time % 60).toString().padStart(2, '0')}
                </span>
                {log.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
};
