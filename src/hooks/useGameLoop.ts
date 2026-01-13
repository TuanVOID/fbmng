import { useState, useCallback, useRef, useEffect } from 'react';
import { GameState, Player, LogEntry, GamePhase } from '@/types/game';
import {
  createTeam,
  distance,
  moveTowards,
  getPlayerWithBall,
  getNearestPlayer,
  getOpponentGoalY,
  isInPenaltyArea,
  clamp,
} from '@/utils/gameUtils';

const PITCH_WIDTH = 400;
const PITCH_HEIGHT = 600;
const PLAYER_RADIUS = 15;
const BALL_RADIUS = 8;
const TACKLE_DISTANCE = 25;
const SHOT_DISTANCE = 120;
const BASE_SPEED = 2;

const generateId = () => Math.random().toString(36).slice(2, 9);

export const useGameLoop = () => {
  const [gameState, setGameState] = useState<GameState>(() => initializeGame());
  const gameLoopRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  function initializeGame(): GameState {
    const bluePlayers = createTeam('blue');
    const redPlayers = createTeam('red');
    
    return {
      phase: 'idle',
      players: [...bluePlayers, ...redPlayers],
      ball: { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2, ownerId: null },
      score: { blue: 0, red: 0 },
      matchLog: [],
      selectedPlayerId: null,
      isRunning: false,
      matchTime: 0,
    };
  }

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setGameState(prev => ({
      ...prev,
      matchLog: [
        { id: generateId(), time: prev.matchTime, message, type },
        ...prev.matchLog.slice(0, 49),
      ],
    }));
  }, []);

  const startMatch = useCallback(() => {
    const bluePlayers = createTeam('blue');
    const redPlayers = createTeam('red');
    
    // Give ball to blue forward
    const blueForward = bluePlayers.find(p => p.role === 'FW');
    if (blueForward) {
      blueForward.hasBall = true;
    }

    setGameState({
      phase: 'kickoff',
      players: [...bluePlayers, ...redPlayers],
      ball: {
        x: blueForward?.x || PITCH_WIDTH / 2,
        y: blueForward?.y || PITCH_HEIGHT / 2,
        ownerId: blueForward?.id || null,
      },
      score: { blue: 0, red: 0 },
      matchLog: [{ id: generateId(), time: 0, message: '🏟️ Match Started! Kickoff!', type: 'info' }],
      selectedPlayerId: null,
      isRunning: true,
      matchTime: 0,
    });
  }, []);

  const selectPlayer = useCallback((playerId: string | null) => {
    setGameState(prev => ({ ...prev, selectedPlayerId: playerId }));
  }, []);

  const performDuel = useCallback((attacker: Player, defender: Player): 'attacker' | 'defender' => {
    const attackerPower = attacker.stats.atk + (attacker.isSkillActive && attacker.skill.type === 'attack' ? 30 : 0);
    const defenderPower = defender.stats.def + (defender.isSkillActive && defender.skill.type === 'defense' ? 30 : 0);
    
    const attackerRoll = attackerPower + Math.random() * 40;
    const defenderRoll = defenderPower + Math.random() * 40;
    
    return attackerRoll > defenderRoll ? 'attacker' : 'defender';
  }, []);

  const attemptShot = useCallback((shooter: Player, goalkeeper: Player): boolean => {
    const shooterPower = shooter.stats.atk + (shooter.isSkillActive && shooter.skill.type === 'attack' ? 50 : 0);
    const gkPower = goalkeeper.stats.def + (goalkeeper.isSkillActive ? 50 : 0);
    
    const shooterRoll = shooterPower + Math.random() * 50;
    const gkRoll = gkPower + Math.random() * 30;
    
    return shooterRoll > gkRoll;
  }, []);

  const updateGame = useCallback(() => {
    setGameState(prev => {
      if (!prev.isRunning || prev.phase === 'idle') return prev;

      let newState = { ...prev };
      let players = [...prev.players];
      let ball = { ...prev.ball };
      let logs: { message: string; type: LogEntry['type'] }[] = [];

      // Update match time
      newState.matchTime = prev.matchTime + 1;

      // Update rage and stamina
      players = players.map(p => ({
        ...p,
        rage: Math.min(p.maxRage, p.rage + 0.3),
        stamina: Math.max(0, p.stamina - 0.05),
        isSkillActive: p.rage >= p.maxRage,
      }));

      const ballHolder = players.find(p => p.hasBall);
      
      if (ballHolder) {
        const opponentGoalY = getOpponentGoalY(ballHolder.team);
        const targetTeam = ballHolder.team === 'blue' ? 'red' : 'blue';
        
        // Check if in shooting range
        const distToGoal = Math.abs(ballHolder.y - opponentGoalY);
        
        if (distToGoal < SHOT_DISTANCE) {
          // Attempt shot
          const goalkeeper = players.find(p => p.team === targetTeam && p.role === 'GK');
          
          if (goalkeeper) {
            const isGoal = attemptShot(ballHolder, goalkeeper);
            
            if (ballHolder.isSkillActive) {
              logs.push({ message: `⚡ ${ballHolder.name} uses ${ballHolder.skill.emoji} ${ballHolder.skill.name}!`, type: 'skill' });
            }
            
            if (isGoal) {
              logs.push({ message: `⚽ GOAL! ${ballHolder.name} scores for Team ${ballHolder.team.toUpperCase()}!`, type: 'goal' });
              newState.score = {
                ...prev.score,
                [ballHolder.team]: prev.score[ballHolder.team] + 1,
              };
              newState.phase = 'goal';
              
              // Reset positions after goal
              setTimeout(() => {
                setGameState(s => {
                  const resetPlayers = s.players.map(p => ({
                    ...p,
                    x: p.baseX,
                    y: p.baseY,
                    hasBall: false,
                    rage: 0,
                    isSkillActive: false,
                  }));
                  const newBallHolder = resetPlayers.find(p => p.team === (targetTeam) && p.role === 'FW');
                  if (newBallHolder) newBallHolder.hasBall = true;
                  
                  return {
                    ...s,
                    phase: 'kickoff',
                    players: resetPlayers,
                    ball: { x: newBallHolder?.x || PITCH_WIDTH / 2, y: newBallHolder?.y || PITCH_HEIGHT / 2, ownerId: newBallHolder?.id || null },
                  };
                });
              }, 1500);
            } else {
              logs.push({ message: `🧤 ${goalkeeper.name} makes a SAVE!`, type: 'action' });
              // Give ball to goalkeeper
              players = players.map(p => ({ ...p, hasBall: p.id === goalkeeper.id }));
              ball = { x: goalkeeper.x, y: goalkeeper.y, ownerId: goalkeeper.id };
            }
          }
        } else {
          // Move towards goal
          const speed = (BASE_SPEED + ballHolder.stats.spd / 50) * (ballHolder.isSkillActive ? 1.5 : 1);
          const newPos = moveTowards(
            { x: ballHolder.x, y: ballHolder.y },
            { x: PITCH_WIDTH / 2, y: opponentGoalY },
            speed
          );
          
          players = players.map(p => 
            p.id === ballHolder.id 
              ? { ...p, x: clamp(newPos.x, PLAYER_RADIUS, PITCH_WIDTH - PLAYER_RADIUS), y: clamp(newPos.y, PLAYER_RADIUS, PITCH_HEIGHT - PLAYER_RADIUS) }
              : p
          );
          
          ball = { x: newPos.x, y: newPos.y, ownerId: ballHolder.id };
          
          // Check for tackles
          const opponents = players.filter(p => p.team !== ballHolder.team && p.role !== 'GK');
          for (const opponent of opponents) {
            const dist = distance(ballHolder.x, ballHolder.y, opponent.x, opponent.y);
            if (dist < TACKLE_DISTANCE) {
              const winner = performDuel(ballHolder, opponent);
              
              if (opponent.isSkillActive) {
                logs.push({ message: `🛡️ ${opponent.name} uses ${opponent.skill.emoji} ${opponent.skill.name}!`, type: 'skill' });
              }
              
              if (winner === 'defender') {
                logs.push({ message: `💪 ${opponent.name} wins the tackle against ${ballHolder.name}!`, type: 'duel' });
                players = players.map(p => ({
                  ...p,
                  hasBall: p.id === opponent.id,
                  rage: p.id === opponent.id ? 0 : p.rage,
                  isSkillActive: false,
                }));
                ball = { x: opponent.x, y: opponent.y, ownerId: opponent.id };
              } else {
                logs.push({ message: `🏃 ${ballHolder.name} dashes past ${opponent.name}!`, type: 'duel' });
                // Dash past defender
                const dashPos = moveTowards(
                  { x: ballHolder.x, y: ballHolder.y },
                  { x: PITCH_WIDTH / 2, y: opponentGoalY },
                  speed * 3
                );
                players = players.map(p =>
                  p.id === ballHolder.id
                    ? { ...p, x: dashPos.x, y: dashPos.y, rage: 0, isSkillActive: false }
                    : p
                );
                ball = { x: dashPos.x, y: dashPos.y, ownerId: ballHolder.id };
              }
              break;
            }
          }
        }
        
        // Move defenders towards ball holder
        players = players.map(p => {
          if (p.team !== ballHolder.team && !p.hasBall) {
            if (p.role === 'GK') {
              // GK stays in goal area but tracks ball horizontally
              const newX = clamp(ball.x, 150, 250);
              return { ...p, x: newX };
            }
            
            const speed = BASE_SPEED + p.stats.spd / 60;
            const targetX = ballHolder.x + (Math.random() - 0.5) * 50;
            const targetY = ballHolder.y + (Math.random() - 0.5) * 50;
            const newPos = moveTowards({ x: p.x, y: p.y }, { x: targetX, y: targetY }, speed);
            
            return {
              ...p,
              x: clamp(newPos.x, PLAYER_RADIUS, PITCH_WIDTH - PLAYER_RADIUS),
              y: clamp(newPos.y, PLAYER_RADIUS, PITCH_HEIGHT - PLAYER_RADIUS),
            };
          }
          return p;
        });
        
        // Move teammates to support
        players = players.map(p => {
          if (p.team === ballHolder.team && !p.hasBall && p.role !== 'GK') {
            const opponentGoalY = getOpponentGoalY(p.team);
            const supportY = ballHolder.y + (opponentGoalY > ballHolder.y ? 50 : -50);
            const supportX = p.baseX + (Math.random() - 0.5) * 60;
            const speed = BASE_SPEED + p.stats.spd / 80;
            const newPos = moveTowards({ x: p.x, y: p.y }, { x: supportX, y: supportY }, speed);
            
            return {
              ...p,
              x: clamp(newPos.x, PLAYER_RADIUS, PITCH_WIDTH - PLAYER_RADIUS),
              y: clamp(newPos.y, PLAYER_RADIUS, PITCH_HEIGHT - PLAYER_RADIUS),
            };
          }
          return p;
        });
      }

      // Add logs
      logs.forEach(log => {
        newState.matchLog = [
          { id: generateId(), time: newState.matchTime, message: log.message, type: log.type },
          ...newState.matchLog.slice(0, 49),
        ];
      });

      return { ...newState, players, ball };
    });
  }, [performDuel, attemptShot]);

  useEffect(() => {
    if (gameState.isRunning) {
      const interval = setInterval(updateGame, 50);
      return () => clearInterval(interval);
    }
  }, [gameState.isRunning, updateGame]);

  return {
    gameState,
    startMatch,
    selectPlayer,
  };
};
