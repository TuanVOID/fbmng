import { PlayerRole, Team } from '@/types/game';

// Constants
const PITCH_WIDTH = 400;
const PITCH_HEIGHT = 600;

// Simulation parameters (simplified for speed)
const BASE_TACKLE_CHANCE = 0.5;
const TACKLE_BONUS_PER_EXTRA_DF = 0.13;
const BREAKTHROUGH_BONUS_PER_EXTRA_FW = 0.10;
const INTERCEPTION_CHANCE = 0.12;
const FORWARD_PASS_CHANCE = 0.8;
const GOAL_BONUS_AFTER_PASS = 0.05;

export type Formation = '2-4' | '3-3' | '4-2';

export interface PlayerStats {
  atk: number;
  def: number;
  spd: number;
}

export interface TeamStats {
  gk: PlayerStats;
  defenders: PlayerStats[];
  forwards: PlayerStats[];
}

export interface SimulationConfig {
  blueFormation: Formation;
  redFormation: Formation;
  numMatches: number;
  turnsPerMatch: number;
  // Custom stats (optional) - now per-player
  blueStats?: TeamStats;
  redStats?: TeamStats;
}

export interface SimulationResult {
  blueWins: number;
  redWins: number;
  draws: number;
  blueGoals: number;
  redGoals: number;
  totalMatches: number;
}

interface SimPlayer {
  id: string;
  role: PlayerRole;
  team: Team;
  atk: number;
  def: number;
  spd: number;
  hasBall: boolean;
}

const randomStat = () => Math.floor(Math.random() * 60) + 40;

export const getFormationCounts = (formation: Formation): { defenders: number; forwards: number } => {
  switch (formation) {
    case '2-4': return { defenders: 2, forwards: 4 };
    case '3-3': return { defenders: 3, forwards: 3 };
    case '4-2': return { defenders: 4, forwards: 2 };
    default: return { defenders: 3, forwards: 3 };
  }
};

export const createDefaultTeamStats = (formation: Formation): TeamStats => {
  const { defenders, forwards } = getFormationCounts(formation);
  return {
    gk: { atk: 60, def: 80, spd: 50 },
    defenders: Array(defenders).fill(null).map(() => ({ atk: 50, def: 75, spd: 60 })),
    forwards: Array(forwards).fill(null).map(() => ({ atk: 80, def: 50, spd: 70 })),
  };
};

const createSimTeam = (team: Team, formation: Formation, customStats?: TeamStats): SimPlayer[] => {
  const players: SimPlayer[] = [];
  const { defenders, forwards } = getFormationCounts(formation);

  // GK
  players.push({
    id: `${team}-gk`,
    role: 'GK',
    team,
    atk: customStats?.gk.atk ?? randomStat(),
    def: customStats?.gk.def ?? randomStat(),
    spd: customStats?.gk.spd ?? randomStat(),
    hasBall: false,
  });

  // Defenders - use individual stats
  for (let i = 0; i < defenders; i++) {
    const dfStats = customStats?.defenders[i];
    players.push({
      id: `${team}-df-${i}`,
      role: 'DF',
      team,
      atk: dfStats?.atk ?? randomStat(),
      def: dfStats?.def ?? randomStat(),
      spd: dfStats?.spd ?? randomStat(),
      hasBall: false,
    });
  }

  // Forwards - use individual stats
  for (let i = 0; i < forwards; i++) {
    const fwStats = customStats?.forwards[i];
    players.push({
      id: `${team}-fw-${i}`,
      role: 'FW',
      team,
      atk: fwStats?.atk ?? randomStat(),
      def: fwStats?.def ?? randomStat(),
      spd: fwStats?.spd ?? randomStat(),
      hasBall: false,
    });
  }

  return players;
};

const calculateTackleChance = (defendingDFs: number, attackingFWs: number): number => {
  const difference = defendingDFs - attackingFWs;
  if (difference > 0) {
    return Math.min(0.85, BASE_TACKLE_CHANCE + (difference * TACKLE_BONUS_PER_EXTRA_DF));
  } else if (difference < 0) {
    return Math.max(0.25, BASE_TACKLE_CHANCE - (Math.abs(difference) * BREAKTHROUGH_BONUS_PER_EXTRA_FW));
  }
  return BASE_TACKLE_CHANCE;
};

// Pure stat-based duel (no rage/stamina)
const performDuel = (attacker: SimPlayer, defender: SimPlayer): 'attacker' | 'defender' => {
  const attackerPower = attacker.atk;
  const defenderPower = defender.def;
  
  const attackerRoll = attackerPower + Math.random() * 40;
  const defenderRoll = defenderPower + Math.random() * 40;
  
  return attackerRoll > defenderRoll ? 'attacker' : 'defender';
};

// Pure stat-based shot (no rage/stamina)
const attemptShot = (shooter: SimPlayer, goalkeeper: SimPlayer, bonusChance: number = 0): boolean => {
  const shooterPower = shooter.atk;
  const gkPower = goalkeeper.def;
  
  const shooterRoll = shooterPower + Math.random() * 50 + (bonusChance * 100);
  const gkRoll = gkPower + Math.random() * 30;
  
  return shooterRoll > gkRoll;
};

// Simulate a single turn (from kickoff/restart to goal or save)
const simulateTurn = (
  bluePlayers: SimPlayer[],
  redPlayers: SimPlayer[],
  attackingTeam: Team
): { scoringTeam: Team | null; newAttackingTeam: Team } => {
  let goalBonus = 0;
  
  // Phase 1: Kickoff contest (simplified - 50/50)
  const kickoffWinner = Math.random() > 0.5 ? 'blue' : 'red';
  let currentAttackingTeam: Team = kickoffWinner;
  
  // Re-assign based on kickoff winner
  const currentAttackers = currentAttackingTeam === 'blue' ? bluePlayers : redPlayers;
  const currentDefenders = currentAttackingTeam === 'blue' ? redPlayers : bluePlayers;
  const currentAttackingFWs = currentAttackers.filter(p => p.role === 'FW');
  const currentDefendingDFs = currentDefenders.filter(p => p.role === 'DF');
  const currentDefendingGK = currentDefenders.find(p => p.role === 'GK')!;
  
  // Phase 2: DF buildup -> DF passing (with interception chance)
  if (Math.random() < INTERCEPTION_CHANCE) {
    // Interception - switch possession
    currentAttackingTeam = currentAttackingTeam === 'blue' ? 'red' : 'blue';
    return simulateTurnFromDfBuildUp(bluePlayers, redPlayers, currentAttackingTeam);
  }
  
  // Phase 3: FW attacking
  const tackleChance = calculateTackleChance(currentDefendingDFs.length, currentAttackingFWs.length);
  
  // Simulate encounters with defenders
  let attackSuccess = true;
  for (const defender of currentDefendingDFs) {
    if (Math.random() < tackleChance) {
      // Tackle successful
      attackSuccess = false;
      currentAttackingTeam = currentAttackingTeam === 'blue' ? 'red' : 'blue';
      break;
    } else {
      // Attacker can try to pass or duel
      const shouldPass = currentAttackingFWs.length > 1 && Math.random() < 0.4;
      if (shouldPass) {
        if (Math.random() < FORWARD_PASS_CHANCE) {
          goalBonus += GOAL_BONUS_AFTER_PASS;
        } else {
          attackSuccess = false;
          currentAttackingTeam = currentAttackingTeam === 'blue' ? 'red' : 'blue';
          break;
        }
      } else {
        // Duel
        const attacker = currentAttackingFWs[Math.floor(Math.random() * currentAttackingFWs.length)];
        const winner = performDuel(attacker, defender);
        if (winner === 'defender') {
          attackSuccess = false;
          currentAttackingTeam = currentAttackingTeam === 'blue' ? 'red' : 'blue';
          break;
        }
      }
    }
  }
  
  if (!attackSuccess) {
    return { scoringTeam: null, newAttackingTeam: currentAttackingTeam };
  }
  
  // Phase 4: Shooting
  const shooter = currentAttackingFWs[Math.floor(Math.random() * currentAttackingFWs.length)];
  const isGoal = attemptShot(shooter, currentDefendingGK, goalBonus);
  
  if (isGoal) {
    return { scoringTeam: currentAttackingTeam, newAttackingTeam: currentAttackingTeam === 'blue' ? 'red' : 'blue' };
  } else {
    return { scoringTeam: null, newAttackingTeam: currentAttackingTeam === 'blue' ? 'red' : 'blue' };
  }
};

// Helper for recursive simulation after interception
const simulateTurnFromDfBuildUp = (
  bluePlayers: SimPlayer[],
  redPlayers: SimPlayer[],
  attackingTeam: Team
): { scoringTeam: Team | null; newAttackingTeam: Team } => {
  const currentAttackers = attackingTeam === 'blue' ? bluePlayers : redPlayers;
  const currentDefenders = attackingTeam === 'blue' ? redPlayers : bluePlayers;
  const currentAttackingFWs = currentAttackers.filter(p => p.role === 'FW');
  const currentDefendingDFs = currentDefenders.filter(p => p.role === 'DF');
  const currentDefendingGK = currentDefenders.find(p => p.role === 'GK')!;
  
  let goalBonus = 0;
  let currentAttackingTeam = attackingTeam;
  
  const tackleChance = calculateTackleChance(currentDefendingDFs.length, currentAttackingFWs.length);
  
  let attackSuccess = true;
  for (const defender of currentDefendingDFs) {
    if (Math.random() < tackleChance) {
      attackSuccess = false;
      currentAttackingTeam = currentAttackingTeam === 'blue' ? 'red' : 'blue';
      break;
    } else {
      const shouldPass = currentAttackingFWs.length > 1 && Math.random() < 0.4;
      if (shouldPass) {
        if (Math.random() < FORWARD_PASS_CHANCE) {
          goalBonus += GOAL_BONUS_AFTER_PASS;
        } else {
          attackSuccess = false;
          currentAttackingTeam = currentAttackingTeam === 'blue' ? 'red' : 'blue';
          break;
        }
      } else {
        const attacker = currentAttackingFWs[Math.floor(Math.random() * currentAttackingFWs.length)];
        const winner = performDuel(attacker, defender);
        if (winner === 'defender') {
          attackSuccess = false;
          currentAttackingTeam = currentAttackingTeam === 'blue' ? 'red' : 'blue';
          break;
        }
      }
    }
  }
  
  if (!attackSuccess) {
    return { scoringTeam: null, newAttackingTeam: currentAttackingTeam };
  }
  
  const shooter = currentAttackingFWs[Math.floor(Math.random() * currentAttackingFWs.length)];
  const isGoal = attemptShot(shooter, currentDefendingGK, goalBonus);
  
  if (isGoal) {
    return { scoringTeam: currentAttackingTeam, newAttackingTeam: currentAttackingTeam === 'blue' ? 'red' : 'blue' };
  } else {
    return { scoringTeam: null, newAttackingTeam: currentAttackingTeam === 'blue' ? 'red' : 'blue' };
  }
};

// Simulate a full match
const simulateMatch = (config: SimulationConfig): { blueGoals: number; redGoals: number } => {
  const bluePlayers = createSimTeam('blue', config.blueFormation, config.blueStats);
  const redPlayers = createSimTeam('red', config.redFormation, config.redStats);
  
  let blueGoals = 0;
  let redGoals = 0;
  let attackingTeam: Team = Math.random() > 0.5 ? 'blue' : 'red';
  
  for (let turn = 0; turn < config.turnsPerMatch; turn++) {
    const result = simulateTurn(bluePlayers, redPlayers, attackingTeam);
    
    if (result.scoringTeam === 'blue') {
      blueGoals++;
    } else if (result.scoringTeam === 'red') {
      redGoals++;
    }
    
    attackingTeam = result.newAttackingTeam;
  }
  
  return { blueGoals, redGoals };
};

// Main simulation function
export const runSimulation = (config: SimulationConfig): SimulationResult => {
  let blueWins = 0;
  let redWins = 0;
  let draws = 0;
  let totalBlueGoals = 0;
  let totalRedGoals = 0;
  
  for (let i = 0; i < config.numMatches; i++) {
    const result = simulateMatch(config);
    totalBlueGoals += result.blueGoals;
    totalRedGoals += result.redGoals;
    
    if (result.blueGoals > result.redGoals) {
      blueWins++;
    } else if (result.redGoals > result.blueGoals) {
      redWins++;
    } else {
      draws++;
    }
  }
  
  return {
    blueWins,
    redWins,
    draws,
    blueGoals: totalBlueGoals,
    redGoals: totalRedGoals,
    totalMatches: config.numMatches,
  };
};
