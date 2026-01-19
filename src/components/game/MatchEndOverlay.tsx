import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal } from 'lucide-react';

interface MatchEndOverlayProps {
  show: boolean;
  blueScore: number;
  redScore: number;
  onClose: () => void;
}

export const MatchEndOverlay = ({ show, blueScore, redScore, onClose }: MatchEndOverlayProps) => {
  const winner = blueScore > redScore ? 'blue' : redScore > blueScore ? 'red' : 'draw';
  
  const getResultText = () => {
    if (winner === 'draw') return 'HÒA!';
    return winner === 'blue' ? 'ĐỘI XANH THẮNG!' : 'ĐỘI ĐỎ THẮNG!';
  };

  const getResultColor = () => {
    if (winner === 'draw') return 'from-yellow-400 to-amber-500';
    return winner === 'blue' ? 'from-blue-400 to-cyan-500' : 'from-red-400 to-rose-500';
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-8 shadow-2xl border border-gray-600 text-center max-w-md"
            initial={{ scale: 0.5, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.5, y: 50 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            {/* Trophy Icon */}
            <motion.div
              initial={{ rotate: -10, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="mb-4"
            >
              {winner === 'draw' ? (
                <Medal className="w-20 h-20 mx-auto text-yellow-400" />
              ) : (
                <Trophy className={`w-20 h-20 mx-auto ${winner === 'blue' ? 'text-blue-400' : 'text-red-400'}`} />
              )}
            </motion.div>

            {/* Match Ended Text */}
            <motion.h2
              className="text-2xl font-bold text-gray-400 mb-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              KẾT THÚC TRẬN ĐẤU
            </motion.h2>

            {/* Winner Text */}
            <motion.h1
              className={`text-4xl font-black bg-gradient-to-r ${getResultColor()} bg-clip-text text-transparent mb-6`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {getResultText()}
            </motion.h1>

            {/* Score */}
            <motion.div
              className="flex items-center justify-center gap-8 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-1">ĐỘI XANH</div>
                <div className="text-5xl font-black text-blue-400">{blueScore}</div>
              </div>
              <div className="text-3xl font-bold text-gray-500">-</div>
              <div className="text-center">
                <div className="text-sm text-gray-400 mb-1">ĐỘI ĐỎ</div>
                <div className="text-5xl font-black text-red-400">{redScore}</div>
              </div>
            </motion.div>

            {/* Close Button */}
            <motion.button
              className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 transition-all"
              onClick={onClose}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Đóng
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
