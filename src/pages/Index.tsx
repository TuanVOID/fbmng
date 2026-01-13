import { motion } from 'framer-motion';
import { Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGameLoop } from '@/hooks/useGameLoop';
import { Pitch } from '@/components/game/Pitch';
import { MatchLog } from '@/components/game/MatchLog';
import { PlayerStats } from '@/components/game/PlayerStats';
import { Scoreboard } from '@/components/game/Scoreboard';
import { GoalOverlay } from '@/components/game/GoalOverlay';
import { FormationSelector } from '@/components/game/FormationSelector';

const Index = () => {
  const { 
    gameState, 
    startMatch, 
    stopMatch, 
    selectPlayer, 
    blueFormation, 
    setBlueFormation,
    redFormation,
    setRedFormation,
  } = useGameLoop();
  
  const selectedPlayer = gameState.players.find(p => p.id === gameState.selectedPlayerId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-6"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-red-400 mb-2">
            🐾 Pet Football Manager
          </h1>
          <p className="text-gray-400">7v7 Tactical Simulation</p>
        </motion.div>

        {/* Scoreboard */}
        <motion.div
          className="flex justify-center mb-6"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Scoreboard
            blueScore={gameState.score.blue}
            redScore={gameState.score.red}
            matchTime={gameState.matchTime}
            isRunning={gameState.isRunning}
          />
        </motion.div>

        {/* Formation Selector + Buttons */}
        <motion.div
          className="flex flex-col items-center gap-4 mb-6"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {!gameState.isRunning && (
            <FormationSelector
              blueFormation={blueFormation}
              redFormation={redFormation}
              onSelectBlueFormation={setBlueFormation}
              onSelectRedFormation={setRedFormation}
            />
          )}
          
          <div className="flex gap-3">
            {!gameState.isRunning ? (
              <Button
                size="lg"
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-8 py-6 text-lg shadow-lg shadow-green-500/30"
                onClick={startMatch}
              >
                <Play className="w-6 h-6 mr-2" />
                Start Match
              </Button>
            ) : (
              <Button
                size="lg"
                variant="destructive"
                className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold px-8 py-6 text-lg shadow-lg shadow-red-500/30"
                onClick={stopMatch}
              >
                <Square className="w-6 h-6 mr-2" />
                Stop Match
              </Button>
            )}
          </div>
        </motion.div>

        {/* Main Game Area */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-4">
          {/* Left Panel - Match Log */}
          <motion.div
            className="h-[650px]"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <MatchLog logs={gameState.matchLog} />
          </motion.div>

          {/* Center - Pitch */}
          <motion.div
            className="flex justify-center relative"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Pitch
              players={gameState.players}
              ball={gameState.ball}
              selectedPlayerId={gameState.selectedPlayerId}
              onSelectPlayer={selectPlayer}
            />
            <GoalOverlay
              show={gameState.showGoalOverlay || false}
              blueScore={gameState.score.blue}
              redScore={gameState.score.red}
              scoringTeam={gameState.lastScoringTeam}
            />
          </motion.div>

          {/* Right Panel - Player Stats */}
          <motion.div
            className="h-[650px]"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <PlayerStats player={selectedPlayer} />
          </motion.div>
        </div>

        {/* Legend */}
        <motion.div
          className="mt-6 flex justify-center gap-8 text-sm text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
            <span>Team Blue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
            <span>Team Red</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-white" />
            <span>Ball</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">█</span>
            <span>HP</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">█</span>
            <span>Rage</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Index;