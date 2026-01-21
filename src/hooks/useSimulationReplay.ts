import { useState, useCallback, useRef, useEffect } from 'react';
import { SimEvent, SimPlayer, SimMatchState, ParsedMatch } from '@/types/simulation';
import { parseFormation, parsePlayerId, parseStaminaRage } from '@/utils/simulationParser';

const PITCH_WIDTH = 400;
const PITCH_HEIGHT = 600;

function getPlayerPosition(
  team: 'T1' | 'T2',
  role: 'G' | 'D' | 'F',
  index: number,
  formation: { defenders: number; forwards: number }
): { x: number; y: number } {
  const isTeam1 = team === 'T1';
  
  if (role === 'G') {
    return { x: PITCH_WIDTH / 2, y: isTeam1 ? PITCH_HEIGHT - 40 : 40 };
  }
  
  if (role === 'D') {
    const count = formation.defenders;
    const spacing = PITCH_WIDTH / (count + 1);
    const y = isTeam1 ? PITCH_HEIGHT - 120 : 120;
    return { x: spacing * index, y };
  }
  
  if (role === 'F') {
    const count = formation.forwards;
    const spacing = PITCH_WIDTH / (count + 1);
    const y = isTeam1 ? PITCH_HEIGHT / 2 + 80 : PITCH_HEIGHT / 2 - 80;
    return { x: spacing * index, y };
  }
  
  return { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2 };
}

function createInitialPlayers(formation: { t1: string; t2: string }): SimPlayer[] {
  const players: SimPlayer[] = [];
  const f1 = parseFormation(formation.t1);
  const f2 = parseFormation(formation.t2);
  
  // Team 1 (bottom - blue)
  const gk1Pos = getPlayerPosition('T1', 'G', 0, f1);
  players.push({
    id: 'T1-G',
    team: 'T1',
    role: 'G',
    index: 0,
    stamina: 100,
    maxStamina: 100,
    rage: 0,
    maxRage: 100,
    hasBall: false,
    ...gk1Pos
  });
  
  for (let i = 1; i <= f1.defenders; i++) {
    const pos = getPlayerPosition('T1', 'D', i, f1);
    players.push({
      id: `T1-D${i}`,
      team: 'T1',
      role: 'D',
      index: i,
      stamina: 100,
      maxStamina: 100,
      rage: 0,
      maxRage: 100,
      hasBall: false,
      ...pos
    });
  }
  
  for (let i = 1; i <= f1.forwards; i++) {
    const pos = getPlayerPosition('T1', 'F', i, f1);
    players.push({
      id: `T1-F${i}`,
      team: 'T1',
      role: 'F',
      index: i,
      stamina: 100,
      maxStamina: 100,
      rage: 0,
      maxRage: 100,
      hasBall: false,
      ...pos
    });
  }
  
  // Team 2 (top - red)
  const gk2Pos = getPlayerPosition('T2', 'G', 0, f2);
  players.push({
    id: 'T2-G',
    team: 'T2',
    role: 'G',
    index: 0,
    stamina: 100,
    maxStamina: 100,
    rage: 0,
    maxRage: 100,
    hasBall: false,
    ...gk2Pos
  });
  
  for (let i = 1; i <= f2.defenders; i++) {
    const pos = getPlayerPosition('T2', 'D', i, f2);
    players.push({
      id: `T2-D${i}`,
      team: 'T2',
      role: 'D',
      index: i,
      stamina: 100,
      maxStamina: 100,
      rage: 0,
      maxRage: 100,
      hasBall: false,
      ...pos
    });
  }
  
  for (let i = 1; i <= f2.forwards; i++) {
    const pos = getPlayerPosition('T2', 'F', i, f2);
    players.push({
      id: `T2-F${i}`,
      team: 'T2',
      role: 'F',
      index: i,
      stamina: 100,
      maxStamina: 100,
      rage: 0,
      maxRage: 100,
      hasBall: false,
      ...pos
    });
  }
  
  return players;
}

export function useSimulationReplay() {
  const [parsedMatch, setParsedMatch] = useState<ParsedMatch | null>(null);
  const [matchState, setMatchState] = useState<SimMatchState | null>(null);
  const [eventIndex, setEventIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(500); // ms per event
  const [eventLog, setEventLog] = useState<string[]>([]);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadMatch = useCallback((match: ParsedMatch) => {
    setParsedMatch(match);
    setEventIndex(0);
    setIsPlaying(false);
    setEventLog([]);
    
    const players = createInitialPlayers(match.formation);
    setMatchState({
      formation: match.formation,
      half: 1,
      turn: 0,
      score: { t1: 0, t2: 0 },
      players,
      ballOwnerId: null,
      isEnded: false
    });
  }, []);

  const processEvent = useCallback((event: SimEvent, state: SimMatchState): SimMatchState => {
    const newState = { ...state, players: state.players.map(p => ({ ...p })) };
    
    const findPlayer = (id: string) => newState.players.find(p => p.id === id);
    const clearBall = () => {
      newState.players.forEach(p => p.hasBall = false);
      newState.ballOwnerId = null;
    };
    const giveBall = (id: string) => {
      clearBall();
      const player = findPlayer(id);
      if (player) {
        player.hasBall = true;
        newState.ballOwnerId = id;
      }
    };

    switch (event.type) {
      case 'startHalf':
        newState.half = parseInt(event.params[0]) || 1;
        break;
        
      case 'startTurn':
        newState.turn = parseInt(event.params[0]) || 0;
        break;
        
      case 'endMatch':
        newState.isEnded = true;
        break;
        
      case 'wonKickoff':
        giveBall(event.params[0]);
        break;
        
      case 'passBall':
        giveBall(event.params[1]); // receiver gets ball
        break;
        
      case 'lostBall':
        giveBall(event.params[1]); // stealer gets ball
        break;
        
      case 'shotGoal':
        // Scorer's team gets a point
        const scorerId = event.params[0];
        const scorer = findPlayer(scorerId);
        if (scorer?.team === 'T1') {
          newState.score.t2++; // T1 attacks T2's goal
        } else if (scorer?.team === 'T2') {
          newState.score.t1++; // T2 attacks T1's goal
        }
        clearBall();
        break;
        
      case 'shotFailed':
        // GK saves, GK gets ball
        giveBall(event.params[1]);
        break;
        
      case 'fwDfDuelSuccess':
        // Forward wins, keeps ball
        giveBall(event.params[0]);
        break;
        
      case 'fwDfDuelFailed':
        // Defender wins, gets ball
        giveBall(event.params[1]);
        break;
        
      case 'decrementStamina': {
        const player = findPlayer(event.params[0]);
        if (player && event.params[1]) {
          const { current } = parseStaminaRage(event.params[1]);
          player.stamina = current;
        }
        break;
      }
        
      case 'incrementRage': {
        const player = findPlayer(event.params[0]);
        if (player && event.params[1]) {
          const { current } = parseStaminaRage(event.params[1]);
          player.rage = current;
        }
        break;
      }
    }
    
    return newState;
  }, []);

  const stepForward = useCallback(() => {
    if (!parsedMatch || !matchState || eventIndex >= parsedMatch.events.length) {
      setIsPlaying(false);
      return;
    }

    const event = parsedMatch.events[eventIndex];
    const newState = processEvent(event, matchState);
    setMatchState(newState);
    setEventLog(prev => [...prev, event.raw]);
    setEventIndex(prev => prev + 1);
  }, [parsedMatch, matchState, eventIndex, processEvent]);

  const play = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    if (!parsedMatch) return;
    setIsPlaying(false);
    setEventIndex(0);
    setEventLog([]);
    
    const players = createInitialPlayers(parsedMatch.formation);
    setMatchState({
      formation: parsedMatch.formation,
      half: 1,
      turn: 0,
      score: { t1: 0, t2: 0 },
      players,
      ballOwnerId: null,
      isEnded: false
    });
  }, [parsedMatch]);

  // Auto-play interval
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        stepForward();
      }, playbackSpeed);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, stepForward]);

  // Stop when match ends
  useEffect(() => {
    if (matchState?.isEnded || (parsedMatch && eventIndex >= parsedMatch.events.length)) {
      setIsPlaying(false);
    }
  }, [matchState?.isEnded, parsedMatch, eventIndex]);

  return {
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
    totalEvents: parsedMatch?.events.length || 0
  };
}
