import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Play, Pause, SkipForward, RotateCcw, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSimulationReplay } from '@/hooks/useSimulationReplay';
import { parseSimulationFile } from '@/utils/simulationParser';
import { SimulationPitch } from '@/components/simulation/SimulationPitch';

const Simulation = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  
  const {
    parsedMatch,
    matchState,
    eventIndex,
    isPlaying,
    playbackSpeed,
    eventLog,
    loadMatch,
    play,
    pause,
    stepForward,
    reset,
    setPlaybackSpeed,
    totalEvents
  } = useSimulationReplay();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseSimulationFile(content);
      loadMatch(parsed);
    };
    reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-6"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                🎬 Match Simulation
              </h1>
              <p className="text-gray-400 text-sm">Import and replay server match data</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px_280px] gap-6">
          {/* Controls Panel */}
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Import Match Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* File Upload */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    onClick={triggerFileInput}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {fileName || 'Select .txt file'}
                  </Button>
                </div>

                {/* Match Info */}
                {parsedMatch && matchState && (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <span className="text-gray-400">Formation:</span>
                        <div className="text-lg font-bold text-white">
                          <span className="text-blue-400">{parsedMatch.formation.t1}</span>
                          <span className="text-gray-500 mx-2">vs</span>
                          <span className="text-red-400">{parsedMatch.formation.t2}</span>
                        </div>
                      </div>
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <span className="text-gray-400">Total Events:</span>
                        <div className="text-lg font-bold text-white">{totalEvents}</div>
                      </div>
                    </div>

                    {/* Score Display */}
                    <div className="bg-gray-700/30 p-4 rounded-lg">
                      <div className="flex items-center justify-center gap-6">
                        <div className="text-center">
                          <div className="text-sm text-blue-400 font-semibold">Team 1</div>
                          <div className="text-4xl font-bold text-blue-400">{matchState.score.t1}</div>
                        </div>
                        <div className="text-2xl text-gray-500">:</div>
                        <div className="text-center">
                          <div className="text-sm text-red-400 font-semibold">Team 2</div>
                          <div className="text-4xl font-bold text-red-400">{matchState.score.t2}</div>
                        </div>
                      </div>
                      <div className="text-center mt-2 text-sm text-gray-400">
                        Half {matchState.half} • Turn {matchState.turn}
                      </div>
                    </div>

                    {/* Progress */}
                    <div>
                      <div className="flex justify-between text-sm text-gray-400 mb-2">
                        <span>Progress</span>
                        <span>{eventIndex} / {totalEvents}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                          animate={{ width: `${(eventIndex / totalEvents) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Playback Speed */}
                    <div>
                      <div className="flex justify-between text-sm text-gray-400 mb-2">
                        <span>Speed</span>
                        <span>{playbackSpeed}ms/event</span>
                      </div>
                      <Slider
                        value={[playbackSpeed]}
                        onValueChange={(v) => setPlaybackSpeed(v[0])}
                        min={100}
                        max={1000}
                        step={50}
                        className="w-full"
                      />
                    </div>

                    {/* Playback Controls */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 border-gray-600"
                        onClick={reset}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                      </Button>
                      
                      {isPlaying ? (
                        <Button
                          className="flex-1 bg-yellow-500 hover:bg-yellow-600"
                          onClick={pause}
                        >
                          <Pause className="w-4 h-4 mr-2" />
                          Pause
                        </Button>
                      ) : (
                        <Button
                          className="flex-1 bg-green-500 hover:bg-green-600"
                          onClick={play}
                          disabled={eventIndex >= totalEvents}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Play
                        </Button>
                      )}
                      
                      <Button
                        variant="outline"
                        className="flex-1 border-gray-600"
                        onClick={stepForward}
                        disabled={eventIndex >= totalEvents}
                      >
                        <SkipForward className="w-4 h-4 mr-2" />
                        Step
                      </Button>
                    </div>
                  </>
                )}

                {!parsedMatch && (
                  <div className="text-center py-8 text-gray-500">
                    <Upload className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Upload a match log file to begin</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Pitch */}
          <motion.div
            className="flex justify-center"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {matchState ? (
              <SimulationPitch 
                players={matchState.players} 
                ballOwnerId={matchState.ballOwnerId} 
              />
            ) : (
              <div className="w-[400px] h-[600px] bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700 flex items-center justify-center">
                <p className="text-gray-500">Pitch will appear here</p>
              </div>
            )}
          </motion.div>

          {/* Event Log */}
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gray-800/50 border-gray-700 h-[600px]">
              <CardHeader>
                <CardTitle className="text-white text-sm">Event Log</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[520px] pr-4">
                  {eventLog.length > 0 ? (
                    <div className="space-y-1">
                      {eventLog.map((log, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`text-xs font-mono p-2 rounded ${getEventColor(log)}`}
                        >
                          {log}
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      Events will appear here
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Legend */}
        <motion.div
          className="mt-6 flex justify-center gap-8 text-sm text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
            <span>Team 1 (Blue)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
            <span>Team 2 (Red)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-white" />
            <span>Ball</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">█</span>
            <span>Stamina</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-500">█</span>
            <span>Rage</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

function getEventColor(log: string): string {
  if (log.includes('shotGoal')) return 'bg-green-500/20 text-green-400';
  if (log.includes('shotFailed')) return 'bg-red-500/20 text-red-400';
  if (log.includes('passBall')) return 'bg-blue-500/20 text-blue-400';
  if (log.includes('lostBall')) return 'bg-yellow-500/20 text-yellow-400';
  if (log.includes('wonKickoff')) return 'bg-purple-500/20 text-purple-400';
  if (log.includes('Duel')) return 'bg-orange-500/20 text-orange-400';
  if (log.includes('startTurn') || log.includes('endTurn')) return 'bg-gray-600/50 text-gray-300';
  if (log.includes('startHalf') || log.includes('endHalf')) return 'bg-cyan-500/20 text-cyan-400';
  return 'bg-gray-700/50 text-gray-400';
}

export default Simulation;
