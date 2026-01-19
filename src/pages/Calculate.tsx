import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Calculator, Play, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  runSimulation, 
  SimulationConfig, 
  SimulationResult, 
  Formation, 
  TeamStats,
  PlayerStats,
  getFormationCounts,
  createDefaultTeamStats
} from '@/utils/matchSimulator';

const formations: { value: Formation; label: string }[] = [
  { value: '2-4', label: '2-4 (2 DF, 4 FW)' },
  { value: '3-3', label: '3-3 (3 DF, 3 FW)' },
  { value: '4-2', label: '4-2 (4 DF, 2 FW)' },
];

const Calculate = () => {
  const [blueFormation, setBlueFormation] = useState<Formation>('3-3');
  const [redFormation, setRedFormation] = useState<Formation>('3-3');
  const [numMatches, setNumMatches] = useState(1000);
  const [turnsPerMatch, setTurnsPerMatch] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [progress, setProgress] = useState(0);
  
  // Custom stats - now per-player based on formation
  const [useCustomStats, setUseCustomStats] = useState(false);
  const [blueStats, setBlueStats] = useState<TeamStats>(createDefaultTeamStats('3-3'));
  const [redStats, setRedStats] = useState<TeamStats>(createDefaultTeamStats('3-3'));

  // Update stats when formation changes to match player count
  useEffect(() => {
    if (useCustomStats) {
      setBlueStats(prev => {
        const { defenders, forwards } = getFormationCounts(blueFormation);
        const newDefenders = Array(defenders).fill(null).map((_, i) => 
          prev.defenders[i] || { atk: 50, def: 75, spd: 60 }
        );
        const newForwards = Array(forwards).fill(null).map((_, i) => 
          prev.forwards[i] || { atk: 80, def: 50, spd: 70 }
        );
        return { ...prev, defenders: newDefenders, forwards: newForwards };
      });
    }
  }, [blueFormation, useCustomStats]);

  useEffect(() => {
    if (useCustomStats) {
      setRedStats(prev => {
        const { defenders, forwards } = getFormationCounts(redFormation);
        const newDefenders = Array(defenders).fill(null).map((_, i) => 
          prev.defenders[i] || { atk: 50, def: 75, spd: 60 }
        );
        const newForwards = Array(forwards).fill(null).map((_, i) => 
          prev.forwards[i] || { atk: 80, def: 50, spd: 70 }
        );
        return { ...prev, defenders: newDefenders, forwards: newForwards };
      });
    }
  }, [redFormation, useCustomStats]);

  const runCalculation = async () => {
    setIsRunning(true);
    setProgress(0);
    setResult(null);
    
    // Run simulation in batches to allow UI updates
    const batchSize = Math.max(100, Math.floor(numMatches / 10));
    let currentResult: SimulationResult = {
      blueWins: 0,
      redWins: 0,
      draws: 0,
      blueGoals: 0,
      redGoals: 0,
      totalMatches: 0,
    };
    
    const config: SimulationConfig = {
      blueFormation,
      redFormation,
      numMatches: batchSize,
      turnsPerMatch,
      blueStats: useCustomStats ? blueStats : undefined,
      redStats: useCustomStats ? redStats : undefined,
    };
    
    for (let i = 0; i < numMatches; i += batchSize) {
      const remaining = Math.min(batchSize, numMatches - i);
      config.numMatches = remaining;
      
      // Run batch synchronously (fast enough in JS)
      const batchResult = runSimulation(config);
      
      currentResult = {
        blueWins: currentResult.blueWins + batchResult.blueWins,
        redWins: currentResult.redWins + batchResult.redWins,
        draws: currentResult.draws + batchResult.draws,
        blueGoals: currentResult.blueGoals + batchResult.blueGoals,
        redGoals: currentResult.redGoals + batchResult.redGoals,
        totalMatches: currentResult.totalMatches + batchResult.totalMatches,
      };
      
      setProgress(Math.round(((i + remaining) / numMatches) * 100));
      
      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    setResult(currentResult);
    setIsRunning(false);
    setProgress(100);
  };

  const resetStats = () => {
    setBlueStats(createDefaultTeamStats(blueFormation));
    setRedStats(createDefaultTeamStats(redFormation));
  };

  const StatInput = ({ 
    label, 
    value, 
    onChange 
  }: { 
    label: string; 
    value: number; 
    onChange: (v: number) => void 
  }) => (
    <div className="flex items-center gap-1">
      <Label className="w-10 text-xs text-gray-400">{label}</Label>
      <Input
        type="number"
        min={40}
        max={99}
        value={value}
        onChange={(e) => onChange(Math.min(99, Math.max(40, parseInt(e.target.value) || 40)))}
        className="w-14 h-7 text-center bg-gray-800 border-gray-600 text-white text-xs px-1"
      />
    </div>
  );

  const PlayerStatsRow = ({
    label,
    emoji,
    stats,
    onChange,
  }: {
    label: string;
    emoji: string;
    stats: PlayerStats;
    onChange: (newStats: PlayerStats) => void;
  }) => (
    <div className="flex items-center gap-2 py-1 border-b border-gray-700/50 last:border-0">
      <span className="w-20 text-xs text-gray-300">{emoji} {label}</span>
      <div className="flex gap-1">
        <StatInput label="ATK" value={stats.atk} onChange={v => onChange({ ...stats, atk: v })} />
        <StatInput label="DEF" value={stats.def} onChange={v => onChange({ ...stats, def: v })} />
        <StatInput label="SPD" value={stats.spd} onChange={v => onChange({ ...stats, spd: v })} />
      </div>
    </div>
  );

  const TeamStatsPanel = ({ 
    team, 
    stats, 
    setStats, 
    color,
    formation
  }: { 
    team: string; 
    stats: TeamStats; 
    setStats: (s: TeamStats) => void; 
    color: string;
    formation: Formation;
  }) => {
    const { defenders, forwards } = getFormationCounts(formation);
    
    return (
      <Card className={`bg-gray-800/50 border-${color}-500/30`}>
        <CardHeader className="py-2 px-3">
          <CardTitle className={`text-sm text-${color}-400`}>{team} ({formation})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-3 py-2">
          {/* GK */}
          <PlayerStatsRow
            label="GK"
            emoji="🧤"
            stats={stats.gk}
            onChange={(newStats) => setStats({ ...stats, gk: newStats })}
          />
          
          {/* Defenders */}
          <div className="pt-1">
            <p className="text-xs text-gray-500 mb-1">🛡️ Hậu vệ ({defenders})</p>
            {stats.defenders.slice(0, defenders).map((dfStats, i) => (
              <PlayerStatsRow
                key={`df-${i}`}
                label={`DF ${i + 1}`}
                emoji=""
                stats={dfStats}
                onChange={(newStats) => {
                  const newDefenders = [...stats.defenders];
                  newDefenders[i] = newStats;
                  setStats({ ...stats, defenders: newDefenders });
                }}
              />
            ))}
          </div>
          
          {/* Forwards */}
          <div className="pt-1">
            <p className="text-xs text-gray-500 mb-1">⚽ Tiền đạo ({forwards})</p>
            {stats.forwards.slice(0, forwards).map((fwStats, i) => (
              <PlayerStatsRow
                key={`fw-${i}`}
                label={`FW ${i + 1}`}
                emoji=""
                stats={fwStats}
                onChange={(newStats) => {
                  const newForwards = [...stats.forwards];
                  newForwards[i] = newStats;
                  setStats({ ...stats, forwards: newForwards });
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          className="flex items-center gap-4 mb-6"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-red-400">
              🧮 Match Calculator
            </h1>
            <p className="text-gray-400">Mô phỏng thống kê tỉ lệ thắng giữa các đội hình</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Configuration */}
          <motion.div
            className="space-y-4"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {/* Match Settings */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="py-3">
                <CardTitle className="text-lg text-gray-200">⚙️ Cài đặt trận đấu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-400">Số trận mô phỏng</Label>
                    <Input
                      type="number"
                      min={100}
                      max={100000}
                      step={100}
                      value={numMatches}
                      onChange={(e) => setNumMatches(Math.max(100, parseInt(e.target.value) || 1000))}
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400">Số turn mỗi trận</Label>
                    <Input
                      type="number"
                      min={5}
                      max={50}
                      value={turnsPerMatch}
                      onChange={(e) => setTurnsPerMatch(Math.min(50, Math.max(5, parseInt(e.target.value) || 10)))}
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Formation Selection */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="py-3">
                <CardTitle className="text-lg text-gray-200">📋 Chọn đội hình</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-blue-400 mb-2 block">🔵 Team Blue</Label>
                  <div className="flex gap-2">
                    {formations.map(f => (
                      <Button
                        key={f.value}
                        variant={blueFormation === f.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setBlueFormation(f.value)}
                        className={blueFormation === f.value 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'border-blue-500/50 text-blue-400 hover:bg-blue-500/20'}
                      >
                        {f.value}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-red-400 mb-2 block">🔴 Team Red</Label>
                  <div className="flex gap-2">
                    {formations.map(f => (
                      <Button
                        key={f.value}
                        variant={redFormation === f.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setRedFormation(f.value)}
                        className={redFormation === f.value 
                          ? 'bg-red-600 hover:bg-red-700' 
                          : 'border-red-500/50 text-red-400 hover:bg-red-500/20'}
                      >
                        {f.value}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custom Stats Toggle */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-gray-200">📊 Chỉ số tùy chỉnh (từng cầu thủ)</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetStats}
                      className="text-gray-400 hover:text-white"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Reset
                    </Button>
                    <Button
                      variant={useCustomStats ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        if (!useCustomStats) {
                          setBlueStats(createDefaultTeamStats(blueFormation));
                          setRedStats(createDefaultTeamStats(redFormation));
                        }
                        setUseCustomStats(!useCustomStats);
                      }}
                      className={useCustomStats ? 'bg-purple-600' : 'border-gray-500'}
                    >
                      {useCustomStats ? 'ON' : 'OFF'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {useCustomStats && (
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TeamStatsPanel 
                    team="🔵 Team Blue" 
                    stats={blueStats} 
                    setStats={setBlueStats} 
                    color="blue" 
                    formation={blueFormation}
                  />
                  <TeamStatsPanel 
                    team="🔴 Team Red" 
                    stats={redStats} 
                    setStats={setRedStats} 
                    color="red" 
                    formation={redFormation}
                  />
                </CardContent>
              )}
            </Card>

            {/* Run Button */}
            <Button
              size="lg"
              onClick={runCalculation}
              disabled={isRunning}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-6 text-lg shadow-lg shadow-green-500/30"
            >
              {isRunning ? (
                <>
                  <Calculator className="w-5 h-5 mr-2 animate-spin" />
                  Đang tính toán... {progress}%
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Chạy mô phỏng
                </>
              )}
            </Button>

            {isRunning && (
              <Progress value={progress} className="h-2" />
            )}
          </motion.div>

          {/* Right Panel - Results */}
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gray-800/50 border-gray-700 h-full">
              <CardHeader className="py-3">
                <CardTitle className="text-lg text-gray-200">📈 Kết quả thống kê</CardTitle>
              </CardHeader>
              <CardContent>
                {result ? (
                  <div className="space-y-6">
                    {/* Win Rate Comparison */}
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-blue-400 font-bold">🔵 Blue thắng</span>
                          <span className="text-blue-400 font-bold">
                            {((result.blueWins / result.totalMatches) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-8 bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                            initial={{ width: 0 }}
                            animate={{ width: `${(result.blueWins / result.totalMatches) * 100}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-400 font-bold">⚖️ Hòa</span>
                          <span className="text-gray-400 font-bold">
                            {((result.draws / result.totalMatches) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-8 bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-gray-500 to-gray-600"
                            initial={{ width: 0 }}
                            animate={{ width: `${(result.draws / result.totalMatches) * 100}%` }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-red-400 font-bold">🔴 Red thắng</span>
                          <span className="text-red-400 font-bold">
                            {((result.redWins / result.totalMatches) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-8 bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-red-500 to-red-600"
                            initial={{ width: 0 }}
                            animate={{ width: `${(result.redWins / result.totalMatches) * 100}%` }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Detailed Stats */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                      <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                        <p className="text-3xl font-bold text-blue-400">{result.blueWins}</p>
                        <p className="text-sm text-gray-400">Trận thắng Blue</p>
                      </div>
                      <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                        <p className="text-3xl font-bold text-red-400">{result.redWins}</p>
                        <p className="text-sm text-gray-400">Trận thắng Red</p>
                      </div>
                      <div className="text-center p-4 bg-gray-500/10 rounded-lg border border-gray-500/30">
                        <p className="text-3xl font-bold text-gray-400">{result.draws}</p>
                        <p className="text-sm text-gray-400">Trận hòa</p>
                      </div>
                      <div className="text-center p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                        <p className="text-3xl font-bold text-purple-400">{result.totalMatches}</p>
                        <p className="text-sm text-gray-400">Tổng số trận</p>
                      </div>
                    </div>

                    {/* Goals Stats */}
                    <div className="pt-4 border-t border-gray-700">
                      <h3 className="text-gray-300 font-medium mb-3">⚽ Thống kê bàn thắng</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                          <p className="text-2xl font-bold text-blue-400">{result.blueGoals}</p>
                          <p className="text-xs text-gray-400">Tổng bàn Blue</p>
                          <p className="text-sm text-blue-300 mt-1">
                            {(result.blueGoals / result.totalMatches).toFixed(2)} bàn/trận
                          </p>
                        </div>
                        <div className="text-center p-3 bg-red-500/10 rounded-lg">
                          <p className="text-2xl font-bold text-red-400">{result.redGoals}</p>
                          <p className="text-xs text-gray-400">Tổng bàn Red</p>
                          <p className="text-sm text-red-300 mt-1">
                            {(result.redGoals / result.totalMatches).toFixed(2)} bàn/trận
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Configuration Summary */}
                    <div className="pt-4 border-t border-gray-700 text-sm text-gray-400">
                      <p>📋 Cấu hình: Blue ({blueFormation}) vs Red ({redFormation})</p>
                      <p>🔄 {turnsPerMatch} turn/trận × {result.totalMatches.toLocaleString()} trận</p>
                      <p>📊 Chỉ số: {useCustomStats ? 'Tùy chỉnh từng cầu thủ' : 'Ngẫu nhiên'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[400px] text-gray-500">
                    <Calculator className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-center">
                      Chọn đội hình và nhấn "Chạy mô phỏng"<br />
                      để xem kết quả thống kê
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Calculate;
