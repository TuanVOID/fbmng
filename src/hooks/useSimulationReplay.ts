import { useState, useCallback, useRef, useEffect } from 'react';
import { SimEvent, SimPlayer, SimMatchState, ParsedMatch, SimEventType } from '@/types/simulation';
import { parseFormation, parseStaminaRage } from '@/utils/simulationParser';

const PITCH_WIDTH = 400;
const PITCH_HEIGHT = 600;

// Events that should be processed instantly (no delay)
const INSTANT_EVENTS: SimEventType[] = ['decrementStamina', 'incrementRage'];

// Events that require repositioning delay (goalkeeper has ball - 3 seconds)
const GK_REPOSITION_EVENTS: SimEventType[] = ['shotFailed', 'endTurn'];

// Events that require goal celebration delay
const GOAL_EVENTS: SimEventType[] = ['shotGoal'];

// Ball action events (for ball animation)
const BALL_ACTION_EVENTS: SimEventType[] = ['passBall', 'shotGoal', 'shotFailed', 'lostBall'];

// Phase delay (2 seconds for player movement)
const PHASE_DELAY = 2000;
// GK reposition delay (3 seconds)
const GK_REPOSITION_DELAY = 3000;
// Goal celebration delay
const GOAL_DELAY = 2500;

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
    // Forwards positioned closer to center of their own half initially
    const y = isTeam1 ? PITCH_HEIGHT / 2 + 60 : PITCH_HEIGHT / 2 - 60;
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
  const opponentFormation = isTeam1 ? formation.t2 : formation.t1;
  const basePos = getBasePosition(player.team, player.role, player.index, teamFormation);
  
  // GK stays at goal
  if (player.role === 'G') {
    return basePos;
  }
  
  // Get ball owner info
  const ballOwner = ballOwnerId ? allPlayers.find(p => p.id === ballOwnerId) : null;
  const teamHasBall = ballOwner?.team === player.team;
  const opponentHasBall = ballOwner && ballOwner.team !== player.team;
  
  if (player.role === 'F') {
    if (teamHasBall) {
      // Attack position - push deep into opponent half
      // Team 1 forwards go to top (y ~120-180), Team 2 forwards go to bottom (y ~420-480)
      const attackY = isTeam1 ? 120 + (player.index * 20) : PITCH_HEIGHT - 120 - (player.index * 20);
      return { x: basePos.x, y: attackY };
    } else {
      // Defensive position - retreat to own half near midfield
      // Team 1 forwards stay in bottom half, Team 2 forwards stay in top half  
      const defenseY = isTeam1 ? PITCH_HEIGHT / 2 + 80 : PITCH_HEIGHT / 2 - 80;
      return { x: basePos.x, y: defenseY };
    }
  }
  
  if (player.role === 'D') {
    // Get opponent forwards to potentially mark
    const opponentForwards = allPlayers.filter(
      p => p.team !== player.team && p.role === 'F'
    );
    
    if (opponentHasBall && opponentForwards.length > 0) {
      // Defensive mode - mark opponent forwards
      // Calculate marking position with offset to avoid overlapping
      const dfIndex = player.index - 1; // 0-based
      const fwCount = opponentForwards.length;
      
      // If more defenders than forwards, some will zone mark
      if (dfIndex < fwCount) {
        const assignedFw = opponentForwards[dfIndex];
        if (assignedFw) {
          // Position between forward and own goal with horizontal offset
          const offsetX = (dfIndex % 2 === 0 ? -25 : 25); // Stagger left/right
          const markY = isTeam1 
            ? Math.min(assignedFw.y + 50, PITCH_HEIGHT - 100) // Stay behind the forward
            : Math.max(assignedFw.y - 50, 100);
          return { 
            x: Math.max(40, Math.min(PITCH_WIDTH - 40, assignedFw.x + offsetX)), 
            y: markY
          };
        }
      } else {
        // Extra defenders cover space
        const zoneY = isTeam1 ? PITCH_HEIGHT - 150 : 150;
        return { x: basePos.x, y: zoneY };
      }
    }
    
    // When team has ball, push up to midfield to support
    if (teamHasBall) {
      const supportY = isTeam1 ? PITCH_HEIGHT / 2 + 20 : PITCH_HEIGHT / 2 - 20;
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
  const [ballPosition, setBallPosition] = useState<{ x: number; y: number } | null>(null);
  const [ballTarget, setBallTarget] = useState<{ x: number; y: number } | null>(null);
  const [isBallAnimating, setIsBallAnimating] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const repositionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ballAnimationRef = useRef<NodeJS.Timeout | null>(null);

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

  // Animate ball from one position to another
  const animateBall = useCallback((fromId: string | null, toId: string, players: SimPlayer[], isShot: boolean = false) => {
    const fromPlayer = fromId ? players.find(p => p.id === fromId) : null;
    const toPlayer = players.find(p => p.id === toId);
    
    if (!toPlayer) return;
    
    // If it's a shot, animate to goal area
    if (isShot) {
      const goalY = toPlayer.team === 'T1' ? 20 : PITCH_HEIGHT - 20;
      setBallPosition(fromPlayer ? { x: fromPlayer.x, y: fromPlayer.y } : { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2 });
      setBallTarget({ x: PITCH_WIDTH / 2, y: goalY });
    } else {
      setBallPosition(fromPlayer ? { x: fromPlayer.x, y: fromPlayer.y } : { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2 });
      setBallTarget({ x: toPlayer.x, y: toPlayer.y });
    }
    
    setIsBallAnimating(true);
    
    // Clear ball animation after it completes
    if (ballAnimationRef.current) {
      clearTimeout(ballAnimationRef.current);
    }
    ballAnimationRef.current = setTimeout(() => {
      setIsBallAnimating(false);
      setBallPosition(null);
      setBallTarget(null);
    }, 600);
  }, []);

  const stepForward = useCallback(() => {
    if (!parsedMatch || !matchState || eventIndex >= parsedMatch.events.length || isRepositioning) {
      if (eventIndex >= (parsedMatch?.events.length || 0)) {
        setIsPlaying(false);
      }
      return;
    }

    let currentIndex = eventIndex;
    let currentState = matchState;
    
    // Process current event
    const event = parsedMatch.events[currentIndex];
    const previousBallOwner = currentState.ballOwnerId;
    currentState = processEvent(event, currentState);
    currentIndex++;
    
    // Skip ahead through any instant events (stamina/rage changes)
    while (currentIndex < parsedMatch.events.length) {
      const nextEvent = parsedMatch.events[currentIndex];
      if (!INSTANT_EVENTS.includes(nextEvent.type)) break;
      currentState = processEvent(nextEvent, currentState);
      currentIndex++;
    }
    
    setMatchState(currentState);
    setEventIndex(currentIndex);
    
    // Only log non-instant events
    if (!INSTANT_EVENTS.includes(event.type)) {
      setEventLog(prev => [...prev, event.raw]);
    }
    
    // Handle ball animation for pass/shot events
    if (event.type === 'passBall') {
      animateBall(event.params[0], event.params[1], currentState.players);
    } else if (event.type === 'shotGoal' || event.type === 'shotFailed') {
      const shooterId = event.params[0];
      const targetId = event.type === 'shotFailed' ? event.params[1] : shooterId;
      animateBall(shooterId, targetId, currentState.players, true);
    } else if (event.type === 'lostBall') {
      animateBall(event.params[0], event.params[1], currentState.players);
    }
    
    // Check for different delay types
    if (GOAL_EVENTS.includes(event.type)) {
      // Goal scored - celebration delay
      setIsRepositioning(true);
      repositionTimeoutRef.current = setTimeout(() => {
        setIsRepositioning(false);
      }, GOAL_DELAY);
    } else if (GK_REPOSITION_EVENTS.includes(event.type)) {
      // GK gets ball - longer delay for all players to return to positions
      setIsRepositioning(true);
      repositionTimeoutRef.current = setTimeout(() => {
        setIsRepositioning(false);
      }, GK_REPOSITION_DELAY);
    } else if (!INSTANT_EVENTS.includes(event.type)) {
      // Normal phase - delay for player movement
      setIsRepositioning(true);
      repositionTimeoutRef.current = setTimeout(() => {
        setIsRepositioning(false);
      }, PHASE_DELAY);
    }
  }, [parsedMatch, matchState, eventIndex, processEvent, isRepositioning, animateBall]);

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

  // Cleanup ball animation on unmount
  useEffect(() => {
    return () => {
      if (ballAnimationRef.current) {
        clearTimeout(ballAnimationRef.current);
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
    isRepositioning,
    ballPosition,
    ballTarget,
    isBallAnimating
  };
}
