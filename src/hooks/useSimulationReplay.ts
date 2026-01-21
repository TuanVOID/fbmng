import { useState, useCallback, useRef, useEffect } from 'react';
import { SimEvent, SimPlayer, SimMatchState, ParsedMatch, SimEventType } from '@/types/simulation';
import { parseFormation, parseStaminaRage } from '@/utils/simulationParser';

const PITCH_WIDTH = 400;
const PITCH_HEIGHT = 600;

// Events that should be processed instantly (no delay)
const INSTANT_EVENTS: SimEventType[] = ['decrementStamina', 'incrementRage'];

// Events that require repositioning delay
const REPOSITION_EVENTS: SimEventType[] = ['shotFailed', 'shotGoal', 'endTurn'];

function getBasePosition(
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
    // Forwards positioned in opponent's half
    const y = isTeam1 ? PITCH_HEIGHT / 2 - 80 : PITCH_HEIGHT / 2 + 80;
    return { x: spacing * index, y };
  }
  
  return { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2 };
}

function getTacticalPosition(
  player: SimPlayer,
  allPlayers: SimPlayer[],
  ballOwnerId: string | null,
  formation: { t1: { defenders: number; forwards: number }; t2: { defenders: number; forwards: number } }
): { x: number; y: number } {
  const isTeam1 = player.team === 'T1';
  const teamFormation = isTeam1 ? formation.t1 : formation.t2;
  const basePos = getBasePosition(player.team, player.role, player.index, teamFormation);
  
  // GK stays at goal
  if (player.role === 'G') {
    return basePos;
  }
  
  // Get ball owner info
  const ballOwner = ballOwnerId ? allPlayers.find(p => p.id === ballOwnerId) : null;
  const teamHasBall = ballOwner?.team === player.team;
  
  if (player.role === 'F') {
    // Forwards: stay in opponent's half when attacking
    if (teamHasBall) {
      // Attack position - push further into opponent half
      const attackY = isTeam1 ? 150 : PITCH_HEIGHT - 150;
      return { x: basePos.x, y: attackY };
    } else {
      // Defensive position - retreat slightly
      const defenseY = isTeam1 ? PITCH_HEIGHT / 2 - 50 : PITCH_HEIGHT / 2 + 50;
      return { x: basePos.x, y: defenseY };
    }
  }
  
  if (player.role === 'D') {
    // Defenders: mark opposing forwards when defending
    const opponentForwards = allPlayers.filter(
      p => p.team !== player.team && p.role === 'F'
    );
    
    if (!teamHasBall && opponentForwards.length > 0) {
      // Find the forward this defender should mark
      const dfIndex = player.index - 1; // 0-based
      const assignedFw = opponentForwards[dfIndex % opponentForwards.length];
      
      if (assignedFw) {
        // Position between forward and own goal
        const goalY = isTeam1 ? PITCH_HEIGHT : 0;
        const markY = assignedFw.y + (goalY > assignedFw.y ? 30 : -30);
        return { 
          x: assignedFw.x, 
          y: Math.max(80, Math.min(PITCH_HEIGHT - 80, markY))
        };
      }
    }
    
    // When team has ball, push up to support
    if (teamHasBall) {
      const supportY = isTeam1 ? PITCH_HEIGHT / 2 + 50 : PITCH_HEIGHT / 2 - 50;
      return { x: basePos.x, y: supportY };
    }
    
    return basePos;
  }
  
  return basePos;
}

function createInitialPlayers(formation: { t1: string; t2: string }): SimPlayer[] {
  const players: SimPlayer[] = [];
  const f1 = parseFormation(formation.t1);
  const f2 = parseFormation(formation.t2);
  
  // Team 1 (bottom - blue)
  const gk1Pos = getBasePosition('T1', 'G', 0, f1);
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
    const pos = getBasePosition('T1', 'D', i, f1);
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
    const pos = getBasePosition('T1', 'F', i, f1);
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
  const gk2Pos = getBasePosition('T2', 'G', 0, f2);
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
    const pos = getBasePosition('T2', 'D', i, f2);
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
    const pos = getBasePosition('T2', 'F', i, f2);
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

function updatePlayerPositions(
  players: SimPlayer[],
  ballOwnerId: string | null,
  formation: { t1: string; t2: string }
): SimPlayer[] {
  const f1 = parseFormation(formation.t1);
  const f2 = parseFormation(formation.t2);
  const formationData = { t1: f1, t2: f2 };
  
  return players.map(player => {
    const tacticalPos = getTacticalPosition(player, players, ballOwnerId, formationData);
    return { ...player, x: tacticalPos.x, y: tacticalPos.y };
  });
}

export function useSimulationReplay() {
  const [parsedMatch, setParsedMatch] = useState<ParsedMatch | null>(null);
  const [matchState, setMatchState] = useState<SimMatchState | null>(null);
  const [eventIndex, setEventIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(500);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [isRepositioning, setIsRepositioning] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const repositionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadMatch = useCallback((match: ParsedMatch) => {
    setParsedMatch(match);
    setEventIndex(0);
    setIsPlaying(false);
    setEventLog([]);
    setIsRepositioning(false);
    
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
        giveBall(event.params[1]);
        break;
        
      case 'lostBall':
        giveBall(event.params[1]);
        break;
        
      case 'shotGoal':
        const scorerId = event.params[0];
        const scorer = findPlayer(scorerId);
        if (scorer?.team === 'T1') {
          newState.score.t2++;
        } else if (scorer?.team === 'T2') {
          newState.score.t1++;
        }
        clearBall();
        break;
        
      case 'shotFailed':
        giveBall(event.params[1]);
        break;
        
      case 'fwDfDuelSuccess':
        giveBall(event.params[0]);
        break;
        
      case 'fwDfDuelFailed':
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
    
    // Update tactical positions after ball ownership changes
    if (['wonKickoff', 'passBall', 'lostBall', 'shotFailed', 'fwDfDuelSuccess', 'fwDfDuelFailed'].includes(event.type)) {
      newState.players = updatePlayerPositions(newState.players, newState.ballOwnerId, newState.formation);
    }
    
    return newState;
  }, []);

  const stepForward = useCallback(() => {
    if (!parsedMatch || !matchState || eventIndex >= parsedMatch.events.length || isRepositioning) {
      if (eventIndex >= (parsedMatch?.events.length || 0)) {
        setIsPlaying(false);
      }
      return;
    }

    const event = parsedMatch.events[eventIndex];
    const newState = processEvent(event, matchState);
    setMatchState(newState);
    
    // Only log non-instant events
    if (!INSTANT_EVENTS.includes(event.type)) {
      setEventLog(prev => [...prev, event.raw]);
    }
    
    setEventIndex(prev => prev + 1);
    
    // Check if we need to pause for repositioning
    if (REPOSITION_EVENTS.includes(event.type)) {
      setIsRepositioning(true);
      repositionTimeoutRef.current = setTimeout(() => {
        setIsRepositioning(false);
      }, 800); // Allow time for players to animate to new positions
    }
  }, [parsedMatch, matchState, eventIndex, processEvent, isRepositioning]);

  // Process instant events immediately without delay
  useEffect(() => {
    if (!isPlaying || !parsedMatch || !matchState || isRepositioning) return;
    
    let currentIndex = eventIndex;
    let currentState = matchState;
    
    // Process all consecutive instant events immediately
    while (currentIndex < parsedMatch.events.length) {
      const nextEvent = parsedMatch.events[currentIndex];
      if (!INSTANT_EVENTS.includes(nextEvent.type)) break;
      
      currentState = processEvent(nextEvent, currentState);
      currentIndex++;
    }
    
    if (currentIndex !== eventIndex) {
      setMatchState(currentState);
      setEventIndex(currentIndex);
    }
  }, [isPlaying, parsedMatch, matchState, eventIndex, processEvent, isRepositioning]);

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
    setIsRepositioning(false);
    
    if (repositionTimeoutRef.current) {
      clearTimeout(repositionTimeoutRef.current);
    }
    
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
    if (isPlaying && !isRepositioning) {
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
  }, [isPlaying, playbackSpeed, stepForward, isRepositioning]);

  // Stop when match ends
  useEffect(() => {
    if (matchState?.isEnded || (parsedMatch && eventIndex >= parsedMatch.events.length)) {
      setIsPlaying(false);
    }
  }, [matchState?.isEnded, parsedMatch, eventIndex]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (repositionTimeoutRef.current) {
        clearTimeout(repositionTimeoutRef.current);
      }
    };
  }, []);

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
    totalEvents: parsedMatch?.events.length || 0,
    isRepositioning
  };
}
