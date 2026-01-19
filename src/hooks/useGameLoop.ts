import { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, Player, LogEntry, GamePhase, Team } from '@/types/game';
import {
  createTeam,
  distance,
  moveTowards,
  clamp,
  Formation,
} from '@/utils/gameUtils';

const PITCH_WIDTH = 400;
const PITCH_HEIGHT = 600;
const PLAYER_RADIUS = 15;
const TACKLE_DISTANCE = 30;
const PASSING_LINE_Y = PITCH_HEIGHT / 2;
const PENALTY_AREA_Y_BLUE = 100;
const PENALTY_AREA_Y_RED = PITCH_HEIGHT - 100;
const GOAL_Y_BLUE = 10;
const GOAL_Y_RED = PITCH_HEIGHT - 10;
const BASE_SPEED = 1.5;
const FAST_SPEED = 2.5;
const DASH_SPEED = 8;
const MIN_DEFENDER_DISTANCE = 60;

// Tỉ lệ cướp bóng theo số lượng
const BASE_TACKLE_CHANCE = 0.5; // 50% cơ bản 1v1
const TACKLE_BONUS_PER_EXTRA_DF = 0.13; // +13% mỗi hậu vệ thừa
const BASE_BREAKTHROUGH_CHANCE = 0.5; // 50% cơ bản 1v1
const BREAKTHROUGH_BONUS_PER_EXTRA_FW = 0.10; // +10% mỗi tiền đạo thừa

// Tỉ lệ chuyền bóng và bonus ghi bàn
const FORWARD_PASS_CHANCE = 0.8; // 80% chuyền thành công
const GOAL_BONUS_AFTER_PASS = 0.05; // +5% ghi bàn sau khi chuyền

const generateId = () => Math.random().toString(36).slice(2, 9);

// Cặp hậu vệ-tiền đạo để kèm người
type DefenderAssignment = Map<string, string[]>; // defenderId -> [forwardIds]

const initializeGame = (): GameState => {
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
    attackingTeam: 'blue',
    phaseTimer: 0,
    showGoalOverlay: false,
    maxTurns: 10,
    currentTurn: 0,
    isMatchEnded: false,
  };
};

export const useGameLoop = () => {
  const [gameState, setGameState] = useState<GameState>(() => initializeGame());
  const [blueFormation, setBlueFormation] = useState<Formation>('3-3');
  const [redFormation, setRedFormation] = useState<Formation>('3-3');
  const [maxTurns, setMaxTurns] = useState<number>(10);
  const defenderAssignmentsRef = useRef<DefenderAssignment>(new Map());
  const goalBonusRef = useRef<number>(0); // Bonus ghi bàn từ chuyền bóng

  // Tạo cặp bắt kèm cân đối cho hậu vệ
  const assignDefendersToForwards = (players: Player[]) => {
    const assignments = new Map<string, string[]>();
    
    const blueDefenders = players.filter(p => p.team === 'blue' && p.role === 'DF');
    const redDefenders = players.filter(p => p.team === 'red' && p.role === 'DF');
    const blueForwards = players.filter(p => p.team === 'blue' && p.role === 'FW');
    const redForwards = players.filter(p => p.team === 'red' && p.role === 'FW');

    // Hàm phân bổ hậu vệ cho tiền đạo
    const assignTeamDefenders = (defenders: Player[], forwards: Player[]) => {
      if (defenders.length === 0 || forwards.length === 0) return;

      const dfCount = defenders.length;
      const fwCount = forwards.length;

      if (dfCount === fwCount) {
        // 1 kèm 1
        defenders.forEach((df, i) => {
          assignments.set(df.id, [forwards[i].id]);
        });
      } else if (dfCount > fwCount) {
        // Nhiều hậu vệ hơn tiền đạo: chia đều hậu vệ cho các tiền đạo
        const dfPerFw = Math.floor(dfCount / fwCount);
        const remainder = dfCount % fwCount;
        let dfIndex = 0;
        
        forwards.forEach((fw, fwIdx) => {
          const numDfs = dfPerFw + (fwIdx < remainder ? 1 : 0);
          for (let i = 0; i < numDfs && dfIndex < dfCount; i++) {
            const currentAssignment = assignments.get(defenders[dfIndex].id) || [];
            assignments.set(defenders[dfIndex].id, [...currentAssignment, fw.id]);
            dfIndex++;
          }
        });
      } else {
        // Nhiều tiền đạo hơn hậu vệ: mỗi hậu vệ kèm 1-2 tiền đạo
        // Ưu tiên kèm người có bóng (xử lý động trong game loop)
        defenders.forEach((df, i) => {
          // Mỗi hậu vệ kèm 1 tiền đạo cố định
          const primaryFw = forwards[i % fwCount];
          assignments.set(df.id, [primaryFw.id]);
        });
      }
    };

    // Blue defenders kèm red forwards
    assignTeamDefenders(blueDefenders, redForwards);
    // Red defenders kèm blue forwards  
    assignTeamDefenders(redDefenders, blueForwards);

    defenderAssignmentsRef.current = assignments;
  };

  // Tính tỉ lệ cướp bóng dựa trên số lượng người
  const calculateTackleChance = (defendingDFs: number, attackingFWs: number): number => {
    const difference = defendingDFs - attackingFWs;
    if (difference > 0) {
      // Nhiều hậu vệ hơn: tăng tỉ lệ cướp
      return Math.min(0.85, BASE_TACKLE_CHANCE + (difference * TACKLE_BONUS_PER_EXTRA_DF));
    } else if (difference < 0) {
      // Nhiều tiền đạo hơn: giảm tỉ lệ cướp (tăng tỉ lệ vượt qua)
      return Math.max(0.25, BASE_TACKLE_CHANCE - (Math.abs(difference) * BREAKTHROUGH_BONUS_PER_EXTRA_FW));
    }
    return BASE_TACKLE_CHANCE;
  };

  const startMatch = useCallback(() => {
    const bluePlayers = createTeam('blue', blueFormation);
    const redPlayers = createTeam('red', redFormation);
    const allPlayers = [...bluePlayers, ...redPlayers];

    // Đặt 1 FW mỗi bên ở giữa sân để tranh chấp
    const blueKickoffFW = allPlayers.find(p => p.team === 'blue' && p.role === 'FW' && p.id.includes('fw-0'));
    const redKickoffFW = allPlayers.find(p => p.team === 'red' && p.role === 'FW' && p.id.includes('fw-0'));
    
    if (blueKickoffFW) {
      blueKickoffFW.x = PITCH_WIDTH / 2 - 30;
      blueKickoffFW.y = PITCH_HEIGHT / 2;
    }
    if (redKickoffFW) {
      redKickoffFW.x = PITCH_WIDTH / 2 + 30;
      redKickoffFW.y = PITCH_HEIGHT / 2;
    }

    // Tạo cặp bắt kèm
    assignDefendersToForwards(allPlayers);
    goalBonusRef.current = 0;

    setGameState({
      phase: 'kickoff_contest',
      players: allPlayers,
      ball: {
        x: PITCH_WIDTH / 2,
        y: PITCH_HEIGHT / 2,
        ownerId: null,
      },
      score: { blue: 0, red: 0 },
      matchLog: [{ id: generateId(), time: 0, message: `🏟️ Trận đấu bắt đầu! Số turn: ${maxTurns}`, type: 'info' }],
      selectedPlayerId: null,
      isRunning: true,
      matchTime: 0,
      attackingTeam: 'blue',
      phaseTimer: 0,
      showGoalOverlay: false,
      maxTurns: maxTurns,
      currentTurn: 0,
      isMatchEnded: false,
    });
  }, [blueFormation, redFormation]);

  const stopMatch = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isRunning: false,
      phase: 'idle',
    }));
  }, []);

  const selectPlayer = useCallback((playerId: string | null) => {
    setGameState(prev => ({ ...prev, selectedPlayerId: playerId }));
  }, []);

  const performDuel = (attacker: Player, defender: Player): 'attacker' | 'defender' => {
    const attackerPower = attacker.stats.atk + (attacker.isSkillActive && attacker.skill.type === 'attack' ? 30 : 0);
    const defenderPower = defender.stats.def + (defender.isSkillActive && defender.skill.type === 'defense' ? 30 : 0);
    
    const attackerRoll = attackerPower + Math.random() * 40;
    const defenderRoll = defenderPower + Math.random() * 40;
    
    return attackerRoll > defenderRoll ? 'attacker' : 'defender';
  };

  const attemptShot = (shooter: Player, goalkeeper: Player, bonusChance: number = 0): boolean => {
    const shooterPower = shooter.stats.atk + (shooter.isSkillActive && shooter.skill.type === 'attack' ? 50 : 0);
    const gkPower = goalkeeper.stats.def + (goalkeeper.isSkillActive ? 50 : 0);
    
    const shooterRoll = shooterPower + Math.random() * 50 + (bonusChance * 100);
    const gkRoll = gkPower + Math.random() * 30;
    
    return shooterRoll > gkRoll;
  };

  const getGoalY = (team: Team): number => {
    return team === 'blue' ? GOAL_Y_BLUE : GOAL_Y_RED;
  };

  // Tính toán vị trí di chuyển nhẹ quanh base position
  const getIdleMovementTarget = (player: Player, ball: { x: number; y: number }): { x: number; y: number } => {
    const ballInfluence = 0.1;
    const time = Date.now() / 1000;
    
    const wobbleX = Math.sin(time * 0.5 + player.x * 0.1) * 8;
    const wobbleY = Math.cos(time * 0.4 + player.y * 0.1) * 8;
    
    const toBallX = (ball.x - player.baseX) * ballInfluence;
    const toBallY = (ball.y - player.baseY) * ballInfluence;
    
    return {
      x: clamp(player.baseX + wobbleX + toBallX, 30, PITCH_WIDTH - 30),
      y: clamp(player.baseY + wobbleY + toBallY, 30, PITCH_HEIGHT - 30),
    };
  };

  // Di chuyển hậu vệ: giữ đội hình + bám theo tiền đạo được gán
  // Khi số tiền đạo nhiều hơn hậu vệ: hậu vệ gần nhất với người cầm bóng sẽ lao tới ngăn chặn
  // Các hậu vệ còn lại bám theo các tiền đạo còn lại
  const getDefenderMovement = (
    defender: Player,
    ball: { x: number; y: number },
    ballHolder: Player | undefined,
    allPlayers: Player[],
    allDefenders: Player[],
    defenderIndex: number
  ): { x: number; y: number } => {
    const isBlueTeam = defender.team === 'blue';
    const ownGoalY = isBlueTeam ? PITCH_HEIGHT - 30 : 30;
    const penaltyLineY = isBlueTeam ? PENALTY_AREA_Y_RED : PENALTY_AREA_Y_BLUE;
    
    // Tính vị trí cơ bản theo đội hình (dựa trên baseX, baseY)
    const numDefenders = allDefenders.length;
    
    // Tính offset X để giữ khoảng cách đều giữa các hậu vệ
    const spacing = (PITCH_WIDTH - 100) / Math.max(numDefenders - 1, 1);
    const formationBaseX = numDefenders === 1 
      ? PITCH_WIDTH / 2 
      : 50 + defenderIndex * spacing;

    let targetX = formationBaseX;
    let targetY = defender.baseY;

    // Lấy tất cả tiền đạo đối phương
    const opponentForwards = allPlayers.filter(p => p.team !== defender.team && p.role === 'FW');
    const dfCount = numDefenders;
    const fwCount = opponentForwards.length;

    // Nếu có tiền đạo đối phương CÓ bóng
    if (ballHolder && ballHolder.team !== defender.team && ballHolder.role === 'FW') {
      // Xử lý đặc biệt khi số tiền đạo nhiều hơn hậu vệ
      if (fwCount > dfCount) {
        // Tìm hậu vệ gần người cầm bóng nhất
        let nearestDefender: Player | null = null;
        let nearestDist = Infinity;
        for (const df of allDefenders) {
          const dist = distance(df.x, df.y, ballHolder.x, ballHolder.y);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestDefender = df;
          }
        }

        if (defender.id === nearestDefender?.id) {
          // Hậu vệ này gần nhất -> lao tới ngăn chặn người cầm bóng
          const retreatY = isBlueTeam 
            ? Math.max(penaltyLineY - 30, PITCH_HEIGHT - 180)
            : Math.min(penaltyLineY + 30, 180);
          
          const blendFactor = 0.7; // 70% theo bóng, 30% giữ đội hình
          targetX = formationBaseX * (1 - blendFactor) + clamp(ballHolder.x, 60, PITCH_WIDTH - 60) * blendFactor;
          targetY = retreatY;
        } else {
          // Hậu vệ còn lại -> bám theo các tiền đạo KHÁC (không phải người cầm bóng)
          const otherForwards = opponentForwards.filter(fw => fw.id !== ballHolder.id);
          
          // Tìm vị trí của hậu vệ này trong danh sách hậu vệ còn lại (không tính người kèm ball holder)
          const remainingDefenders = allDefenders.filter(df => df.id !== nearestDefender?.id);
          const myIndexInRemaining = remainingDefenders.findIndex(df => df.id === defender.id);
          
          if (otherForwards.length > 0 && myIndexInRemaining >= 0) {
            // Gán tiền đạo theo thứ tự
            const assignedForward = otherForwards[myIndexInRemaining % otherForwards.length];
            
            // Tính vị trí đội hình riêng cho hậu vệ còn lại
            const remainingSpacing = (PITCH_WIDTH - 100) / Math.max(remainingDefenders.length - 1, 1);
            const remainingBaseX = remainingDefenders.length === 1 
              ? PITCH_WIDTH / 2 
              : 50 + myIndexInRemaining * remainingSpacing;
            
            const blendFactor = 0.5; // 50% theo tiền đạo, 50% giữ đội hình
            targetX = remainingBaseX * (1 - blendFactor) + clamp(assignedForward.x, 60, PITCH_WIDTH - 60) * blendFactor;
            targetY = isBlueTeam 
              ? Math.max(assignedForward.y + 30, penaltyLineY)
              : Math.min(assignedForward.y - 30, penaltyLineY);
          }
        }
      } else {
        // Số hậu vệ >= số tiền đạo: dùng logic gán cố định
        const assignedForwardIds = defenderAssignmentsRef.current.get(defender.id) || [];
        
        // Nếu hậu vệ này được gán kèm người có bóng -> bám theo nhưng giữ vị trí tương đối
        if (assignedForwardIds.includes(ballHolder.id)) {
          const retreatY = isBlueTeam 
            ? Math.max(penaltyLineY - 30, PITCH_HEIGHT - 180)
            : Math.min(penaltyLineY + 30, 180);
          
          // Blend giữa vị trí người có bóng và vị trí đội hình
          const blendFactor = 0.6; // 60% theo bóng, 40% giữ đội hình
          targetX = formationBaseX * (1 - blendFactor) + clamp(ballHolder.x, 60, PITCH_WIDTH - 60) * blendFactor;
          targetY = retreatY;
        } else {
          // Hậu vệ khác vẫn kèm tiền đạo được gán của mình nhưng giữ vị trí X theo đội hình
          const assignedForwards = allPlayers.filter(p => assignedForwardIds.includes(p.id));
          if (assignedForwards.length > 0) {
            const primaryTarget = assignedForwards[0];
            const blendFactor = 0.4; // 40% theo tiền đạo, 60% giữ đội hình
            targetX = formationBaseX * (1 - blendFactor) + clamp(primaryTarget.x, 60, PITCH_WIDTH - 60) * blendFactor;
            targetY = isBlueTeam 
              ? Math.max(primaryTarget.y + 30, penaltyLineY)
              : Math.min(primaryTarget.y - 30, penaltyLineY);
          }
        }
      }
    } else {
      // Tiền đạo đối phương KHÔNG cầm bóng -> bám nhẹ theo tiền đạo nhưng giữ đội hình
      const assignedForwardIds = defenderAssignmentsRef.current.get(defender.id) || [];
      const assignedForwards = allPlayers.filter(p => assignedForwardIds.includes(p.id));
      
      if (assignedForwards.length > 0) {
        const primaryTarget = assignedForwards[0];
        const blockY = (primaryTarget.y + ownGoalY) / 2;
        
        // Blend nhẹ hơn khi không có bóng (30% theo tiền đạo, 70% giữ đội hình)
        const blendFactor = 0.3;
        targetX = formationBaseX * (1 - blendFactor) + clamp(primaryTarget.x, 60, PITCH_WIDTH - 60) * blendFactor;
        targetY = clamp(blockY, 50, PITCH_HEIGHT - 50);
      } else if (fwCount > dfCount) {
        // Khi không có gán cố định và tiền đạo nhiều hơn, bám theo tiền đạo gần nhất
        let nearestFW: Player | null = null;
        let nearestDist = Infinity;
        for (const fw of opponentForwards) {
          const dist = distance(defender.x, defender.y, fw.x, fw.y);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestFW = fw;
          }
        }
        
        if (nearestFW) {
          const blockY = (nearestFW.y + ownGoalY) / 2;
          const blendFactor = 0.3;
          targetX = formationBaseX * (1 - blendFactor) + clamp(nearestFW.x, 60, PITCH_WIDTH - 60) * blendFactor;
          targetY = clamp(blockY, 50, PITCH_HEIGHT - 50);
        }
      }
    }

    // Đảm bảo khoảng cách tối thiểu với hậu vệ khác
    for (const otherDF of allDefenders) {
      if (otherDF.id === defender.id) continue;
      const dist = distance(targetX, targetY, otherDF.x, otherDF.y);
      if (dist < MIN_DEFENDER_DISTANCE) {
        // Đẩy ra xa dựa trên vị trí trong đội hình
        const pushDirection = defenderIndex < allDefenders.findIndex(d => d.id === otherDF.id) ? -1 : 1;
        targetX = clamp(targetX + pushDirection * (MIN_DEFENDER_DISTANCE - dist), 40, PITCH_WIDTH - 40);
      }
    }

    return { 
      x: clamp(targetX, 40, PITCH_WIDTH - 40), 
      y: clamp(targetY, 40, PITCH_HEIGHT - 40) 
    };
  };

  // Di chuyển tiền đạo
  const getForwardMovement = (
    forward: Player,
    ball: { x: number; y: number },
    ballHolder: Player | undefined,
    attackingTeam: Team
  ): { x: number; y: number } => {
    const isBlueTeam = forward.team === 'blue';
    const ownHalfY = isBlueTeam ? PITCH_HEIGHT * 0.65 : PITCH_HEIGHT * 0.35;

    if (ballHolder && ballHolder.team === forward.team) {
      const targetY = isBlueTeam 
        ? Math.min(forward.y - 2, PITCH_HEIGHT * 0.25)
        : Math.max(forward.y + 2, PITCH_HEIGHT * 0.75);
      
      const spreadX = forward.baseX + (Math.sin(Date.now() / 1000 + forward.x) * 20);
      
      return {
        x: clamp(spreadX, 60, PITCH_WIDTH - 60),
        y: targetY,
      };
    }

    if (ballHolder && ballHolder.team !== forward.team) {
      return {
        x: clamp(forward.baseX + (ball.x - PITCH_WIDTH / 2) * 0.2, 60, PITCH_WIDTH - 60),
        y: ownHalfY,
      };
    }

    return getIdleMovementTarget(forward, ball);
  };

  const updateGame = useCallback(() => {
    setGameState(prev => {
      if (!prev.isRunning || prev.phase === 'idle') return prev;

      let newState = { ...prev };
      let players = prev.players.map(p => ({ ...p }));
      let ball = { ...prev.ball };
      let logs: { message: string; type: LogEntry['type'] }[] = [];
      let newPhase: GamePhase = prev.phase;

      newState.matchTime = prev.matchTime + 1;
      newState.phaseTimer = prev.phaseTimer + 1;

      // Update rage
      players = players.map(p => ({
        ...p,
        rage: Math.min(p.maxRage, p.rage + 0.2),
        isSkillActive: p.rage >= p.maxRage,
      }));

      const attackingTeam = prev.attackingTeam;
      const defendingTeam = attackingTeam === 'blue' ? 'red' : 'blue';
      const goalY = getGoalY(attackingTeam);
      const isAttackingUp = attackingTeam === 'blue';

      const ballHolder = players.find(p => p.hasBall);
      const attackingPlayers = players.filter(p => p.team === attackingTeam);
      const defendingPlayers = players.filter(p => p.team === defendingTeam);
      const attackingForwards = attackingPlayers.filter(p => p.role === 'FW');
      const defendingForwards = defendingPlayers.filter(p => p.role === 'FW');
      const attackingDefenders = attackingPlayers.filter(p => p.role === 'DF');
      const defendingDefenders = defendingPlayers.filter(p => p.role === 'DF');

      switch (prev.phase) {
        case 'kickoff_contest': {
          const centerX = PITCH_WIDTH / 2;
          const centerY = PITCH_HEIGHT / 2;

          const blueContestant = players.find(p => p.team === 'blue' && p.id.includes('fw-0'));
          const redContestant = players.find(p => p.team === 'red' && p.id.includes('fw-0'));

          if (!blueContestant || !redContestant) {
            newPhase = 'df_buildup';
            break;
          }

          [blueContestant, redContestant].forEach(fw => {
            const idx = players.findIndex(p => p.id === fw.id);
            if (idx !== -1) {
              const speed = BASE_SPEED + fw.stats.spd / 60;
              const newPos = moveTowards({ x: fw.x, y: fw.y }, { x: centerX, y: centerY }, speed);
              players[idx] = { ...players[idx], x: newPos.x, y: newPos.y };
            }
          });

          players = players.map(p => {
            if (p.id === blueContestant.id || p.id === redContestant.id || p.role === 'GK') return p;
            const target = getIdleMovementTarget(p, ball);
            const speed = BASE_SPEED * 0.5;
            const newPos = moveTowards({ x: p.x, y: p.y }, target, speed);
            return { ...p, x: newPos.x, y: newPos.y };
          });

          const blueDist = distance(blueContestant.x, blueContestant.y, centerX, centerY);
          const redDist = distance(redContestant.x, redContestant.y, centerX, centerY);

          if (blueDist < 25 && redDist < 25) {
            const bluePower = blueContestant.stats.atk + blueContestant.stats.spd;
            const redPower = redContestant.stats.atk + redContestant.stats.spd;
            
            const blueRoll = bluePower + Math.random() * 50;
            const redRoll = redPower + Math.random() * 50;
            
            const winner = blueRoll > redRoll ? blueContestant : redContestant;
            const winningTeam = winner.team;
            
            logs.push({ message: `⚡ ${winner.name} (${winningTeam.toUpperCase()}) đoạt bóng!`, type: 'action' });
            
            const teammates = players.filter(p => p.team === winningTeam && p.role === 'DF');
            const nearestDF = teammates.sort((a, b) => 
              distance(winner.x, winner.y, a.x, a.y) - distance(winner.x, winner.y, b.x, b.y)
            )[0];

            if (nearestDF) {
              logs.push({ message: `📤 ${winner.name} chuyền về cho ${nearestDF.name}`, type: 'pass' });
              players = players.map(p => ({
                ...p,
                hasBall: p.id === nearestDF.id,
              }));
              ball = { x: nearestDF.x, y: nearestDF.y, ownerId: nearestDF.id };
              newState.attackingTeam = winningTeam;
              newPhase = 'df_buildup';
              newState.phaseTimer = 0;
            }
          }

          if (prev.phaseTimer > 200) {
            const winner = Math.random() > 0.5 ? blueContestant : redContestant;
            const winningTeam = winner.team;
            const teammates = players.filter(p => p.team === winningTeam && p.role === 'DF');
            const nearestDF = teammates[0];
            if (nearestDF) {
              players = players.map(p => ({
                ...p,
                hasBall: p.id === nearestDF.id,
              }));
              ball = { x: nearestDF.x, y: nearestDF.y, ownerId: nearestDF.id };
              newState.attackingTeam = winningTeam;
              newPhase = 'df_buildup';
              newState.phaseTimer = 0;
            }
          }
          break;
        }

        case 'df_buildup': {
          if (!ballHolder || ballHolder.role !== 'DF') {
            const df = attackingDefenders[0];
            if (df) {
              players = players.map(p => ({
                ...p,
                hasBall: p.id === df.id,
              }));
              ball = { x: df.x, y: df.y, ownerId: df.id };
            }
            break;
          }

          const isBlueTeam = ballHolder.team === 'blue';
          const targetY = isBlueTeam ? PASSING_LINE_Y - 20 : PASSING_LINE_Y + 20;
          const speed = BASE_SPEED + ballHolder.stats.spd / 80;
          
          const newPos = moveTowards(
            { x: ballHolder.x, y: ballHolder.y },
            { x: ballHolder.x, y: targetY },
            speed
          );
          players = players.map(p =>
            p.id === ballHolder.id ? { ...p, x: newPos.x, y: newPos.y } : p
          );
          ball = { x: newPos.x, y: newPos.y, ownerId: ballHolder.id };

          const myTeamDefenders = players.filter(p => p.team === ballHolder.team && p.role === 'DF');
          const opponentTeamDefenders = players.filter(p => p.team !== ballHolder.team && p.role === 'DF');

          players = players.map(p => {
            if (p.hasBall || p.role === 'GK') return p;
            
            let targetPos: { x: number; y: number };
            
            if (p.role === 'FW') {
              targetPos = getForwardMovement(p, ball, ballHolder, attackingTeam);
            } else {
              const sameTeamDFs = p.team === ballHolder.team ? myTeamDefenders : opponentTeamDefenders;
              const dfIndex = sameTeamDFs.findIndex(d => d.id === p.id);
              targetPos = getDefenderMovement(p, ball, ballHolder, players, sameTeamDFs, dfIndex);
            }
            
            const moveSpeed = BASE_SPEED + p.stats.spd / 100;
            const newPlayerPos = moveTowards({ x: p.x, y: p.y }, targetPos, moveSpeed);
            return { ...p, x: newPlayerPos.x, y: newPlayerPos.y };
          });

          const distToMidline = Math.abs(ballHolder.y - PASSING_LINE_Y);
          const myForwards = players.filter(p => p.team === ballHolder.team && p.role === 'FW');
          const forwardsInPosition = myForwards.some(fw => {
            const targetHalfY = isBlueTeam ? PITCH_HEIGHT * 0.4 : PITCH_HEIGHT * 0.6;
            return isBlueTeam ? fw.y < targetHalfY : fw.y > targetHalfY;
          });

          if ((distToMidline < 60 && forwardsInPosition) || prev.phaseTimer > 120) {
            newPhase = 'df_passing';
            newState.phaseTimer = 0;
          }
          break;
        }

        case 'df_passing': {
          if (!ballHolder || ballHolder.role !== 'DF') {
            newPhase = 'df_buildup';
            break;
          }

          const forwards = attackingPlayers.filter(p => p.role === 'FW');
          const targetFW = forwards[Math.floor(Math.random() * forwards.length)];
          
          if (targetFW) {
            const interceptionChance = 0.12;
            const isIntercepted = Math.random() < interceptionChance;
            
            if (isIntercepted && defendingForwards.length > 0) {
              const interceptor = defendingForwards[Math.floor(Math.random() * defendingForwards.length)];
              
              logs.push({ message: `🔄 ${interceptor.name} chặn đường chuyền!`, type: 'action' });
              players = players.map(p => ({
                ...p,
                hasBall: p.id === interceptor.id,
              }));
              ball = { x: interceptor.x, y: interceptor.y, ownerId: interceptor.id };
              
              const interceptorTeamDFs = players.filter(p => p.team === interceptor.team && p.role === 'DF');
              const nearestDF = interceptorTeamDFs.sort((a, b) =>
                distance(interceptor.x, interceptor.y, a.x, a.y) - distance(interceptor.x, interceptor.y, b.x, b.y)
              )[0];
              
              if (nearestDF) {
                logs.push({ message: `📤 ${interceptor.name} chuyền về cho ${nearestDF.name}`, type: 'pass' });
                players = players.map(p => ({
                  ...p,
                  hasBall: p.id === nearestDF.id,
                }));
                ball = { x: nearestDF.x, y: nearestDF.y, ownerId: nearestDF.id };
              }
              
              newState.attackingTeam = defendingTeam;
              newPhase = 'df_buildup';
              newState.phaseTimer = 0;
              goalBonusRef.current = 0;
              break;
            }
            
            logs.push({ message: `📤 ${ballHolder.name} chuyền bóng cho ${targetFW.name}`, type: 'pass' });
            players = players.map(p => ({
              ...p,
              hasBall: p.id === targetFW.id,
            }));
            ball = { x: targetFW.x, y: targetFW.y, ownerId: targetFW.id };
            goalBonusRef.current = 0; // Reset bonus
            newPhase = 'fw_attacking';
            newState.phaseTimer = 0;
          }
          break;
        }

        case 'fw_attacking': {
          if (!ballHolder || ballHolder.role !== 'FW') {
            newPhase = 'df_buildup';
            break;
          }

          const isBlueTeam = ballHolder.team === 'blue';
          const speed = BASE_SPEED + ballHolder.stats.spd / 60;
          
          const newPos = moveTowards(
            { x: ballHolder.x, y: ballHolder.y },
            { x: PITCH_WIDTH / 2, y: goalY },
            speed
          );
          players = players.map(p =>
            p.id === ballHolder.id ? { ...p, x: newPos.x, y: newPos.y } : p
          );
          ball = { x: newPos.x, y: newPos.y, ownerId: ballHolder.id };

          const myTeamDefenders = players.filter(p => p.team === ballHolder.team && p.role === 'DF');
          const opponentTeamDefenders = players.filter(p => p.team !== ballHolder.team && p.role === 'DF');

          players = players.map(p => {
            if (p.hasBall || p.role === 'GK') return p;

            if (p.team === attackingTeam) {
              if (p.role === 'DF') {
                const maxY = PASSING_LINE_Y;
                const targetY = isBlueTeam 
                  ? Math.max(p.baseY - 80, maxY)
                  : Math.min(p.baseY + 80, maxY);
                const moveSpeed = BASE_SPEED + p.stats.spd / 100;
                const newPlayerPos = moveTowards({ x: p.x, y: p.y }, { x: p.baseX, y: targetY }, moveSpeed);
                return { ...p, x: newPlayerPos.x, y: newPlayerPos.y };
              } else {
                const targetPos = getForwardMovement(p, ball, ballHolder, attackingTeam);
                const moveSpeed = BASE_SPEED + p.stats.spd / 100;
                const newPlayerPos = moveTowards({ x: p.x, y: p.y }, targetPos, moveSpeed);
                return { ...p, x: newPlayerPos.x, y: newPlayerPos.y };
              }
            } else {
              if (p.role === 'DF') {
                const dfIndex = opponentTeamDefenders.findIndex(d => d.id === p.id);
                const targetPos = getDefenderMovement(p, ball, ballHolder, players, opponentTeamDefenders, dfIndex);
                const moveSpeed = BASE_SPEED + p.stats.spd / 80;
                const newPlayerPos = moveTowards({ x: p.x, y: p.y }, targetPos, moveSpeed);
                return { ...p, x: newPlayerPos.x, y: newPlayerPos.y };
              } else {
                const targetPos = getForwardMovement(p, ball, ballHolder, attackingTeam);
                const moveSpeed = BASE_SPEED + p.stats.spd / 100;
                const newPlayerPos = moveTowards({ x: p.x, y: p.y }, targetPos, moveSpeed);
                return { ...p, x: newPlayerPos.x, y: newPlayerPos.y };
              }
            }
          });

          // Tính tỉ lệ cướp bóng dựa trên số lượng
          const tackleChance = calculateTackleChance(defendingDefenders.length, attackingForwards.length);

          // Kiểm tra va chạm với hậu vệ
          for (const defender of defendingDefenders) {
            const dist = distance(newPos.x, newPos.y, defender.x, defender.y);
            if (dist < TACKLE_DISTANCE) {
              const tackleSuccess = Math.random() < tackleChance;
              
              if (tackleSuccess) {
                logs.push({ 
                  message: `💪 ${defender.name} cắt bóng từ ${ballHolder.name}! (${Math.round(tackleChance * 100)}%)`, 
                  type: 'duel' 
                });
                
                players = players.map(p => ({
                  ...p,
                  hasBall: p.id === defender.id,
                }));
                ball = { x: defender.x, y: defender.y, ownerId: defender.id };
                newState.attackingTeam = defendingTeam;
                newPhase = 'df_buildup';
                newState.phaseTimer = 0;
                goalBonusRef.current = 0;
                break;
              } else {
                // Tiền đạo có cơ hội chuyền cho đồng đội
                const otherForwards = attackingForwards.filter(f => f.id !== ballHolder.id);
                const shouldPass = otherForwards.length > 0 && Math.random() < 0.4;
                
                if (shouldPass) {
                  const passSuccess = Math.random() < FORWARD_PASS_CHANCE;
                  const targetTeammate = otherForwards[Math.floor(Math.random() * otherForwards.length)];
                  
                  if (passSuccess) {
                    logs.push({ message: `📤 ${ballHolder.name} chuyền cho ${targetTeammate.name}!`, type: 'pass' });
                    players = players.map(p => ({
                      ...p,
                      hasBall: p.id === targetTeammate.id,
                    }));
                    ball = { x: targetTeammate.x, y: targetTeammate.y, ownerId: targetTeammate.id };
                    goalBonusRef.current += GOAL_BONUS_AFTER_PASS;
                    break;
                  } else {
                    logs.push({ message: `❌ ${ballHolder.name} chuyền hỏng! ${defender.name} cắt bóng!`, type: 'action' });
                    players = players.map(p => ({
                      ...p,
                      hasBall: p.id === defender.id,
                    }));
                    ball = { x: defender.x, y: defender.y, ownerId: defender.id };
                    newState.attackingTeam = defendingTeam;
                    newPhase = 'df_buildup';
                    newState.phaseTimer = 0;
                    goalBonusRef.current = 0;
                    break;
                  }
                }
                
                // Vượt qua hậu vệ
                newPhase = 'duel';
                newState.phaseTimer = 0;
                logs.push({ message: `⚔️ ${ballHolder.name} đối đầu ${defender.name}!`, type: 'duel' });
                break;
              }
            }
          }

          const penaltyY = isBlueTeam ? PENALTY_AREA_Y_BLUE : PENALTY_AREA_Y_RED;
          const inPenaltyArea = isBlueTeam 
            ? newPos.y < penaltyY 
            : newPos.y > penaltyY;
          
          if (inPenaltyArea && newPhase !== 'duel' && newPhase !== 'df_buildup') {
            newPhase = 'shooting';
            newState.phaseTimer = 0;
          }
          break;
        }

        case 'duel': {
          const attacker = players.find(p => p.hasBall && p.role === 'FW');
          
          if (!attacker) {
            newPhase = 'df_buildup';
            break;
          }

          const nearestDefender = defendingDefenders
            .sort((a, b) => distance(attacker.x, attacker.y, a.x, a.y) - distance(attacker.x, attacker.y, b.x, b.y))[0];

          if (!nearestDefender) {
            newPhase = 'fw_breakthrough';
            break;
          }

          const winner = performDuel(attacker, nearestDefender);

          if (winner === 'attacker') {
            if (attacker.isSkillActive) {
              logs.push({ message: `⚡ ${attacker.name} sử dụng ${attacker.skill.emoji} ${attacker.skill.name}!`, type: 'skill' });
            }
            logs.push({ message: `🏃 ${attacker.name} vượt qua ${nearestDefender.name}!`, type: 'duel' });
            
            const isBlueTeam = attacker.team === 'blue';
            const dashDirection = isBlueTeam ? -1 : 1;
            players = players.map(p => {
              if (p.id === attacker.id) {
                return { 
                  ...p, 
                  y: clamp(p.y + (dashDirection * DASH_SPEED * 5), 30, PITCH_HEIGHT - 30),
                  isDashing: true,
                  rage: 0,
                  isSkillActive: false,
                };
              }
              return p;
            });
            const newAttacker = players.find(p => p.id === attacker.id)!;
            ball = { x: newAttacker.x, y: newAttacker.y, ownerId: attacker.id };
            newPhase = 'fw_breakthrough';
          } else {
            if (nearestDefender.isSkillActive) {
              logs.push({ message: `🛡️ ${nearestDefender.name} sử dụng ${nearestDefender.skill.emoji} ${nearestDefender.skill.name}!`, type: 'skill' });
            }
            logs.push({ message: `💪 ${nearestDefender.name} cắt bóng từ ${attacker.name}!`, type: 'duel' });
            
            players = players.map(p => ({
              ...p,
              hasBall: p.id === nearestDefender.id,
              isDashing: p.id === nearestDefender.id,
              rage: p.id === nearestDefender.id ? 0 : p.rage,
              isSkillActive: p.id === nearestDefender.id ? false : p.isSkillActive,
            }));
            ball = { x: nearestDefender.x, y: nearestDefender.y, ownerId: nearestDefender.id };
            
            newState.attackingTeam = defendingTeam;
            newPhase = 'df_buildup';
            goalBonusRef.current = 0;
          }
          newState.phaseTimer = 0;
          break;
        }

        case 'fw_breakthrough': {
          const attacker = players.find(p => p.hasBall && p.role === 'FW');
          
          if (!attacker) {
            newPhase = 'df_buildup';
            break;
          }

          const isBlueTeam = attacker.team === 'blue';
          const speed = FAST_SPEED + attacker.stats.spd / 50;
          const newPos = moveTowards(
            { x: attacker.x, y: attacker.y },
            { x: PITCH_WIDTH / 2, y: goalY },
            speed
          );
          players = players.map(p =>
            p.id === attacker.id ? { ...p, x: newPos.x, y: newPos.y, isDashing: false } : p
          );
          ball = { x: newPos.x, y: newPos.y, ownerId: attacker.id };

          const penaltyY = isBlueTeam ? PENALTY_AREA_Y_BLUE : PENALTY_AREA_Y_RED;
          const inPenaltyArea = isBlueTeam 
            ? attacker.y < penaltyY + 20
            : attacker.y > penaltyY - 20;
          
          if (inPenaltyArea || prev.phaseTimer > 40) {
            newPhase = 'shooting';
            newState.phaseTimer = 0;
          }
          break;
        }

        case 'shooting': {
          const shooter = players.find(p => p.hasBall);
          const goalkeeper = defendingPlayers.find(p => p.role === 'GK');
          
          if (!shooter || !goalkeeper) {
            newPhase = 'df_buildup';
            break;
          }

          if (shooter.isSkillActive) {
            logs.push({ message: `⚡ ${shooter.name} sử dụng ${shooter.skill.emoji} ${shooter.skill.name}!`, type: 'skill' });
          }
          
          const bonusText = goalBonusRef.current > 0 ? ` (+${Math.round(goalBonusRef.current * 100)}% bonus)` : '';
          logs.push({ message: `⚽ ${shooter.name} sút bóng!${bonusText}`, type: 'action' });

          const isGoal = attemptShot(shooter, goalkeeper, goalBonusRef.current);
          const isBlueTeam = shooter.team === 'blue';

          if (isGoal) {
            const newTurn = prev.currentTurn + 1;
            logs.push({ message: `🎉 GOAL! ${shooter.name} ghi bàn cho đội ${attackingTeam.toUpperCase()}! (Turn ${newTurn}/${prev.maxTurns})`, type: 'goal' });
            newState.score = {
              ...prev.score,
              [attackingTeam]: prev.score[attackingTeam] + 1,
            };
            newState.currentTurn = newTurn;
            
            // Kiểm tra kết thúc trận đấu
            if (newTurn >= prev.maxTurns) {
              logs.push({ message: `🏁 Trận đấu kết thúc sau ${prev.maxTurns} turn!`, type: 'info' });
              newState.isMatchEnded = true;
              newState.isRunning = false;
              newPhase = 'idle';
            } else {
              ball = { 
                x: PITCH_WIDTH / 2, 
                y: isBlueTeam ? GOAL_Y_BLUE : GOAL_Y_RED,
                ownerId: null,
                isInGoal: true,
              };
              
              players = players.map(p => ({ ...p, hasBall: false, isDashing: false }));
              newState.showGoalOverlay = true;
              newState.lastScoringTeam = attackingTeam;
              newPhase = 'goal_celebration';
            }
            goalBonusRef.current = 0;
          } else {
            const newTurn = prev.currentTurn + 1;
            if (goalkeeper.isSkillActive) {
              logs.push({ message: `🧤 ${goalkeeper.name} sử dụng ${goalkeeper.skill.emoji} ${goalkeeper.skill.name}!`, type: 'skill' });
            }
            logs.push({ message: `🧤 ${goalkeeper.name} cản phá thành công! (Turn ${newTurn}/${prev.maxTurns})`, type: 'action' });
            newState.currentTurn = newTurn;
            
            // Kiểm tra kết thúc trận đấu
            if (newTurn >= prev.maxTurns) {
              logs.push({ message: `🏁 Trận đấu kết thúc sau ${prev.maxTurns} turn!`, type: 'info' });
              newState.isMatchEnded = true;
              newState.isRunning = false;
              newPhase = 'idle';
            } else {
              players = players.map(p => ({
                ...p,
                hasBall: p.id === goalkeeper.id,
                isDashing: false,
              }));
              ball = { x: goalkeeper.x, y: goalkeeper.y, ownerId: goalkeeper.id };
              newPhase = 'save';
            }
            goalBonusRef.current = 0;
          }
          newState.phaseTimer = 0;
          break;
        }

        case 'goal_celebration': {
          if (prev.phaseTimer > 60) {
            newState.showGoalOverlay = false;
            newPhase = 'reset_to_center';
            newState.phaseTimer = 0;
          }
          break;
        }

        case 'save': {
          const goalkeeper = players.find(p => p.hasBall && p.role === 'GK');
          
          if (!goalkeeper) {
            newPhase = 'df_buildup';
            break;
          }

          if (prev.phaseTimer > 40) {
            const teammates = players.filter(p => p.team === goalkeeper.team && p.role === 'DF');
            const nearestDF = teammates.sort((a, b) =>
              distance(goalkeeper.x, goalkeeper.y, a.x, a.y) - distance(goalkeeper.x, goalkeeper.y, b.x, b.y)
            )[0];
            
            if (nearestDF) {
              logs.push({ message: `📤 ${goalkeeper.name} chuyền bóng cho ${nearestDF.name}`, type: 'pass' });
              players = players.map(p => ({
                ...p,
                hasBall: p.id === nearestDF.id,
              }));
              ball = { x: nearestDF.x, y: nearestDF.y, ownerId: nearestDF.id };
              newState.attackingTeam = goalkeeper.team;
              newPhase = 'df_buildup';
              newState.phaseTimer = 0;
            }
          }
          break;
        }

        case 'reset_to_center': {
          let allInPosition = true;
          
          const concededTeam = prev.lastScoringTeam === 'blue' ? 'red' : 'blue';
          const kickoffFW = players.find(p => p.team === concededTeam && p.id.includes('fw-0'));

          players = players.map(p => {
            if (p.id === kickoffFW?.id) {
              const dist = distance(p.x, p.y, PITCH_WIDTH / 2, PITCH_HEIGHT / 2);
              if (dist > 10) {
                allInPosition = false;
                const newPos = moveTowards({ x: p.x, y: p.y }, { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2 }, FAST_SPEED);
                return { ...p, x: newPos.x, y: newPos.y, hasBall: false, isDashing: false };
              }
              return { ...p, x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2, hasBall: true, isDashing: false };
            }

            const dist = distance(p.x, p.y, p.baseX, p.baseY);
            if (dist > 10) {
              allInPosition = false;
              const speed = FAST_SPEED;
              const newPos = moveTowards({ x: p.x, y: p.y }, { x: p.baseX, y: p.baseY }, speed);
              return { ...p, x: newPos.x, y: newPos.y, hasBall: false, isDashing: false };
            }
            return { ...p, hasBall: false, isDashing: false };
          });

          const newKickoffFW = players.find(p => p.id === kickoffFW?.id);
          if (newKickoffFW && newKickoffFW.hasBall) {
            ball = { x: newKickoffFW.x, y: newKickoffFW.y, ownerId: newKickoffFW.id, isInGoal: false };
          } else {
            ball = { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2, ownerId: null, isInGoal: false };
          }

          if (allInPosition || prev.phaseTimer > 80) {
            if (kickoffFW) {
              const teammates = players.filter(p => p.team === concededTeam && p.role === 'DF');
              const nearestDF = teammates.sort((a, b) =>
                distance(kickoffFW.x, kickoffFW.y, a.x, a.y) - distance(kickoffFW.x, kickoffFW.y, b.x, b.y)
              )[0];

              if (nearestDF) {
                logs.push({ message: `🏟️ Tiếp tục! ${kickoffFW.name} chuyền cho ${nearestDF.name}!`, type: 'info' });
                players = players.map(p => ({
                  ...p,
                  hasBall: p.id === nearestDF.id,
                }));
                ball = { x: nearestDF.x, y: nearestDF.y, ownerId: nearestDF.id, isInGoal: false };
              }
            }

            // Re-assign defenders after reset
            assignDefendersToForwards(players);
            
            newState.attackingTeam = concededTeam;
            newPhase = 'df_buildup';
            newState.phaseTimer = 0;
            goalBonusRef.current = 0;
          }
          break;
        }
      }

      logs.forEach(log => {
        newState.matchLog = [
          { id: generateId(), time: newState.matchTime, message: log.message, type: log.type },
          ...newState.matchLog.slice(0, 49),
        ];
      });

      return { ...newState, players, ball, phase: newPhase };
    });
  }, []);

  useEffect(() => {
    if (gameState.isRunning) {
      const interval = setInterval(updateGame, 50);
      return () => clearInterval(interval);
    }
  }, [gameState.isRunning, updateGame]);

  const closeMatchEnd = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      isMatchEnded: false,
    }));
  }, []);

  return {
    gameState,
    startMatch,
    stopMatch,
    selectPlayer,
    blueFormation,
    setBlueFormation,
    redFormation,
    setRedFormation,
    maxTurns,
    setMaxTurns,
    closeMatchEnd,
  };
};