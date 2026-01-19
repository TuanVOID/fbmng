import { Player, PlayerRole, Team, Skill } from '@/types/game';
import { petNames, attackSkills, defenseSkills, gkSkills } from '@/data/petNames';

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

export interface SimulationConfig {
  blueFormation: Formation;
  redFormation: Formation;
  numMatches: number;
  turnsPerMatch: number;
  // Custom stats (optional)
  blueStats?: TeamStats;
  redStats?: TeamStats;
}

export interface TeamStats {
  gkAtk: number;
  gkDef: number;
  gkSpd: number;
  dfAtk: number;
  dfDef: number;
  dfSpd: number;
  fwAtk: number;
  fwDef: number;
  fwSpd: number;
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
  hasSkillActive: boolean;
  skillType: 'attack' | 'defense' | 'gk';
  rage: number;
}

const randomStat = () => Math.floor(Math.random() * 60) + 40;

const getFormationCounts = (formation: Formation): { defenders: number; forwards: number } => {
  switch (formation) {
    case '2-4': return { defenders: 2, forwards: 4 };
    case '3-3': return { defenders: 3, forwards: 3 };
    case '4-2': return { defenders: 4, forwards: 2 };
    default: return { defenders: 3, forwards: 3 };
  }
};

const getSkillType = (role: PlayerRole): 'attack' | 'defense' | 'gk' => {
  if (role === 'GK') return 'gk';
  if (role === 'FW') return 'attack';
  return 'defense';
};

const createSimTeam = (team: Team, formation: Formation, customStats?: TeamStats): SimPlayer[] => {
  const players: SimPlayer[] = [];
  const { defenders, forwards } = getFormationCounts(formation);

  // GK
  players.push({
    id: `${team}-gk`,
    role: 'GK',
    team,
    atk: customStats?.gkAtk ?? randomStat(),
    def: customStats?.gkDef ?? randomStat(),
    spd: customStats?.gkSpd ?? randomStat(),
    hasBall: false,
    hasSkillActive: false,
    skillType: 'gk',
    rage: 0,
  });

  // Defenders
  for (let i = 0; i < defenders; i++) {
    players.push({
      id: `${team}-df-${i}`,
      role: 'DF',
      team,
      atk: customStats?.dfAtk ?? randomStat(),
      def: customStats?.dfDef ?? randomStat(),
      spd: customStats?.dfSpd ?? randomStat(),
      hasBall: false,
      hasSkillActive: false,
      skillType: 'defense',
      rage: 0,
    });
  }

  // Forwards
  for (let i = 0; i < forwards; i++) {
    players.push({
      id: `${team}-fw-${i}`,
      role: 'FW',
      team,
      atk: customStats?.fwAtk ?? randomStat(),
      def: customStats?.fwDef ?? randomStat(),
      spd: customStats?.fwSpd ?? randomStat(),
      hasBall: false,
      hasSkillActive: false,
      skillType: 'attack',
      rage: 0,
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

const performDuel = (attacker: SimPlayer, defender: SimPlayer): 'attacker' | 'defender' => {
  const attackerPower = attacker.atk + (attacker.hasSkillActive && attacker.skillType === 'attack' ? 30 : 0);
  const defenderPower = defender.def + (defender.hasSkillActive && defender.skillType === 'defense' ? 30 : 0);
  
  const attackerRoll = attackerPower + Math.random() * 40;
  const defenderRoll = defenderPower + Math.random() * 40;
  
  return attackerRoll > defenderRoll ? 'attacker' : 'defender';
};

const attemptShot = (shooter: SimPlayer, goalkeeper: SimPlayer, bonusChance: number = 0): boolean => {
  const shooterPower = shooter.atk + (shooter.hasSkillActive && shooter.skillType === 'attack' ? 50 : 0);
  const gkPower = goalkeeper.def + (goalkeeper.hasSkillActive ? 50 : 0);
  
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
  const allPlayers = [...bluePlayers, ...redPlayers];
  const attackers = attackingTeam === 'blue' ? bluePlayers : redPlayers;
  const defenders = attackingTeam === 'blue' ? redPlayers : bluePlayers;
  
  const attackingFWs = attackers.filter(p => p.role === 'FW');
  const attackingDFs = attackers.filter(p => p.role === 'DF');
  const defendingDFs = defenders.filter(p => p.role === 'DF');
  const defendingGK = defenders.find(p => p.role === 'GK')!;
  
  // Update rage
  allPlayers.forEach(p => {
    p.rage = Math.min(100, p.rage + 10);
    p.hasSkillActive = p.rage >= 100;
  });
  
  let goalBonus = 0;
  let currentAttackingTeam = attackingTeam;
  
  // Phase 1: Kickoff contest (simplified - 50/50)
  const kickoffWinner = Math.random() > 0.5 ? 'blue' : 'red';
  currentAttackingTeam = kickoffWinner;
  
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
          attacker.rage = 0;
          attacker.hasSkillActive = false;
          break;
        } else {
          defender.rage = 0;
          defender.hasSkillActive = false;
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
    shooter.rage = 0;
    shooter.hasSkillActive = false;
    return { scoringTeam: currentAttackingTeam, newAttackingTeam: currentAttackingTeam === 'blue' ? 'red' : 'blue' };
  } else {
    currentDefendingGK.rage = 0;
    currentDefendingGK.hasSkillActive = false;
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
