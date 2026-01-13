import { motion } from 'framer-motion';
import { Ball } from '@/types/game';

interface BallComponentProps {
  ball: Ball;
}

export const BallComponent = ({ ball }: BallComponentProps) => {
  return (
    <motion.div
      className="absolute w-4 h-4 bg-gradient-to-br from-white to-gray-200 rounded-full pointer-events-none"
      style={{
        left: ball.x - 8,
        top: ball.y - 8,
        boxShadow: '0 0 10px rgba(255,255,255,0.8), 0 2px 4px rgba(0,0,0,0.3)',
      }}
      animate={{
        left: ball.x - 8,
        top: ball.y - 8,
      }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
      }}
    />
  );
};
