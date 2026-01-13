import { motion } from 'framer-motion';
import { Player, Ball } from '@/types/game';
import { PlayerDot } from './PlayerDot';
import { BallComponent } from './BallComponent';

interface PitchProps {
  players: Player[];
  ball: Ball;
  selectedPlayerId: string | null;
  onSelectPlayer: (id: string | null) => void;
}

export const Pitch = ({ players, ball, selectedPlayerId, onSelectPlayer }: PitchProps) => {
  return (
    <div className="relative w-[400px] h-[600px] bg-gradient-to-b from-emerald-600 to-emerald-700 rounded-lg overflow-hidden shadow-2xl border-4 border-white/20">
      {/* Pitch markings */}
      <div className="absolute inset-0">
        {/* Center line */}
        <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/40" />
        
        {/* Center circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white/40 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white/40 rounded-full" />
        
        {/* Top penalty area */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 border-2 border-t-0 border-white/40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-12 border-2 border-t-0 border-white/40" />
        
        {/* Bottom penalty area */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-24 border-2 border-b-0 border-white/40" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-12 border-2 border-b-0 border-white/40" />
        
        {/* Goals */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-2 bg-white/60 rounded-b" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-2 bg-white/60 rounded-t" />
      </div>
      
      {/* Players */}
      {players.map(player => (
        <PlayerDot
          key={player.id}
          player={player}
          isSelected={player.id === selectedPlayerId}
          onClick={() => onSelectPlayer(player.id === selectedPlayerId ? null : player.id)}
        />
      ))}
      
      {/* Ball */}
      <BallComponent ball={ball} />
    </div>
  );
};
