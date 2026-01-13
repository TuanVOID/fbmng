import { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, Player, LogEntry, GamePhase, Team } from '@/types/game';
import {
  createTeam,
  distance,
  moveTowards,
  clamp,
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
const MIN_DEFENDER_DISTANCE = 60; // Khoảng cách tối thiểu giữa các hậu vệ

const generateId = () => Math.random().toString(36).slice(2, 9);

// Tạo cặp hậu vệ-tiền đạo để kèm người
type DefenderAssignment = Map<string, string>; // defenderId -> forwardId

export const useGameLoop = () => {
  const [gameState, setGameState] = useState<GameState>(() => initializeGame());
  const defenderAssignmentsRef = useRef<DefenderAssignment>(new Map());

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
      attackingTeam: 'blue',
      phaseTimer: 0,
      showGoalOverlay: false,
    };
  }

  // Tạo cặp bắt kèm cho hậu vệ
  const assignDefendersToForwards = (players: Player[]) => {
    const assignments = new Map<string, string>();
    
    const blueDefenders = players.filter(p => p.team === 'blue' && p.role === 'DF');
    const redDefenders = players.filter(p => p.team === 'red' && p.role === 'DF');
    const blueForwards = players.filter(p => p.team === 'blue' && p.role === 'FW');
    const redForwards = players.filter(p => p.team === 'red' && p.role === 'FW');

    // Blue defenders kèm red forwards
    blueDefenders.forEach((df, i) => {
      if (redForwards[i]) {
        assignments.set(df.id, redForwards[i].id);
      }
    });

    // Red defenders kèm blue forwards
    redDefenders.forEach((df, i) => {
      if (blueForwards[i]) {
        assignments.set(df.id, blueForwards[i].id);
      }
    });

    defenderAssignmentsRef.current = assignments;
  };

  const startMatch = useCallback(() => {
    const bluePlayers = createTeam('blue');
    const redPlayers = createTeam('red');
    const allPlayers = [...bluePlayers, ...redPlayers];

    // Đặt 1 FW mỗi bên ở giữa sân để tranh chấp
    const blueKickoffFW = allPlayers.find(p => p.team === 'blue' && p.role === 'FW' && p.id.includes('fw-1'));
    const redKickoffFW = allPlayers.find(p => p.team === 'red' && p.role === 'FW' && p.id.includes('fw-1'));
    
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

    setGameState({
      phase: 'kickoff_contest',
      players: allPlayers,
      ball: {
        x: PITCH_WIDTH / 2,
        y: PITCH_HEIGHT / 2,
        ownerId: null,
      },
      score: { blue: 0, red: 0 },
      matchLog: [{ id: generateId(), time: 0, message: '🏟️ Trận đấu bắt đầu! Bóng ở giữa sân!', type: 'info' }],
      selectedPlayerId: null,
      isRunning: true,
      matchTime: 0,
      attackingTeam: 'blue',
      phaseTimer: 0,
      showGoalOverlay: false,
    });
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

  const attemptShot = (shooter: Player, goalkeeper: Player): boolean => {
    const shooterPower = shooter.stats.atk + (shooter.isSkillActive && shooter.skill.type === 'attack' ? 50 : 0);
    const gkPower = goalkeeper.stats.def + (goalkeeper.isSkillActive ? 50 : 0);
    
    const shooterRoll = shooterPower + Math.random() * 50;
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

  // Di chuyển hậu vệ: bám theo tiền đạo được gán
  const getDefenderMovement = (
    defender: Player,
    ball: { x: number; y: number },
    ballHolder: Player | undefined,
    allPlayers: Player[],
    allDefenders: Player[] // Danh sách tất cả hậu vệ cùng đội để tránh chồng lên nhau
  ): { x: number; y: number } => {
    const isBlueTeam = defender.team === 'blue';
    const ownGoalY = isBlueTeam ? PITCH_HEIGHT - 30 : 30;
    const penaltyLineY = isBlueTeam ? PENALTY_AREA_Y_RED : PENALTY_AREA_Y_BLUE;

    // Tìm tiền đạo được gán kèm
    const assignedForwardId = defenderAssignmentsRef.current.get(defender.id);
    const assignedForward = allPlayers.find(p => p.id === assignedForwardId);

    // Nếu tiền đạo được gán CÓ bóng -> lùi dần về khung thành để phòng thủ
    if (assignedForward && ballHolder && ballHolder.id === assignedForward.id) {
      const retreatY = isBlueTeam 
        ? Math.max(penaltyLineY - 30, PITCH_HEIGHT - 180)
        : Math.min(penaltyLineY + 30, 180);
      
      // Đứng giữa tiền đạo và khung thành
      const blockX = clamp(assignedForward.x, 80, PITCH_WIDTH - 80);
      
      return {
        x: blockX,
        y: retreatY,
      };
    }

    // Nếu có tiền đạo đối phương khác CÓ bóng -> các hậu vệ vẫn kèm tiền đạo của mình nhưng lui về
    if (ballHolder && ballHolder.team !== defender.team && ballHolder.role === 'FW') {
      if (assignedForward) {
        // Bám theo tiền đạo được gán nhưng lùi về hướng gôn nhà
        const targetY = isBlueTeam 
          ? Math.max(assignedForward.y + 30, penaltyLineY)
          : Math.min(assignedForward.y - 30, penaltyLineY);
        
        return {
          x: clamp(assignedForward.x, 60, PITCH_WIDTH - 60),
          y: targetY,
        };
      }
    }

    // Nếu tiền đạo đối phương KHÔNG cầm bóng -> bám theo tiền đạo được gán
    if (assignedForward) {
      // Đứng giữa tiền đạo và khung thành của mình, nhưng giữ khoảng cách với tiền đạo
      const blockY = (assignedForward.y + ownGoalY) / 2;
      let targetX = clamp(assignedForward.x, 50, PITCH_WIDTH - 50);
      let targetY = clamp(blockY, 50, PITCH_HEIGHT - 50);

      // Tránh chồng lên hậu vệ khác
      for (const otherDF of allDefenders) {
        if (otherDF.id === defender.id) continue;
        const dist = distance(targetX, targetY, otherDF.x, otherDF.y);
        if (dist < MIN_DEFENDER_DISTANCE) {
          // Đẩy ra xa
          const dx = targetX - otherDF.x;
          const dy = targetY - otherDF.y;
          const pushDist = MIN_DEFENDER_DISTANCE - dist;
          const angle = Math.atan2(dy, dx);
          targetX = clamp(targetX + Math.cos(angle) * pushDist * 0.5, 50, PITCH_WIDTH - 50);
          targetY = clamp(targetY + Math.sin(angle) * pushDist * 0.5, 50, PITCH_HEIGHT - 50);
        }
      }

      return { x: targetX, y: targetY };
    }

    // Mặc định: di chuyển nhẹ quanh vị trí
    return getIdleMovementTarget(defender, ball);
  };

  // Di chuyển tiền đạo: theo bóng và hỗ trợ tấn công
  const getForwardMovement = (
    forward: Player,
    ball: { x: number; y: number },
    ballHolder: Player | undefined,
    attackingTeam: Team
  ): { x: number; y: number } => {
    const isBlueTeam = forward.team === 'blue';
    const ownHalfY = isBlueTeam ? PITCH_HEIGHT * 0.65 : PITCH_HEIGHT * 0.35;

    // Nếu đội mình đang tấn công (hậu vệ hoặc tiền đạo có bóng)
    if (ballHolder && ballHolder.team === forward.team) {
      // Dâng lên phần sân đối phương
      const targetY = isBlueTeam 
        ? Math.min(forward.y - 2, PITCH_HEIGHT * 0.25)
        : Math.max(forward.y + 2, PITCH_HEIGHT * 0.75);
      
      // Tìm vị trí rộng để nhận bóng
      const spreadX = forward.baseX + (Math.sin(Date.now() / 1000 + forward.x) * 20);
      
      return {
        x: clamp(spreadX, 60, PITCH_WIDTH - 60),
        y: targetY,
      };
    }

    // Nếu đội đối phương có bóng -> lui về gần sân nhà
    if (ballHolder && ballHolder.team !== forward.team) {
      return {
        x: clamp(forward.baseX + (ball.x - PITCH_WIDTH / 2) * 0.2, 60, PITCH_WIDTH - 60),
        y: ownHalfY,
      };
    }

    // Mặc định
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
          // Bóng ở giữa sân, 1 tiền đạo mỗi bên tranh chấp
          const centerX = PITCH_WIDTH / 2;
          const centerY = PITCH_HEIGHT / 2;

          // Chỉ 2 tiền đạo giữa (fw-1) tham gia tranh chấp
          const blueContestant = players.find(p => p.team === 'blue' && p.id.includes('fw-1'));
          const redContestant = players.find(p => p.team === 'red' && p.id.includes('fw-1'));

          if (!blueContestant || !redContestant) {
            // Fallback nếu không tìm thấy
            newPhase = 'df_buildup';
            break;
          }

          // Di chuyển 2 tiền đạo tranh chấp về giữa sân
          [blueContestant, redContestant].forEach(fw => {
            const idx = players.findIndex(p => p.id === fw.id);
            if (idx !== -1) {
              const speed = BASE_SPEED + fw.stats.spd / 60;
              const newPos = moveTowards({ x: fw.x, y: fw.y }, { x: centerX, y: centerY }, speed);
              players[idx] = { ...players[idx], x: newPos.x, y: newPos.y };
            }
          });

          // Di chuyển các cầu thủ khác nhẹ nhàng
          players = players.map(p => {
            if (p.id === blueContestant.id || p.id === redContestant.id || p.role === 'GK') return p;
            const target = getIdleMovementTarget(p, ball);
            const speed = BASE_SPEED * 0.5;
            const newPos = moveTowards({ x: p.x, y: p.y }, target, speed);
            return { ...p, x: newPos.x, y: newPos.y };
          });

          // Kiểm tra khi cả 2 đến gần bóng
          const blueDist = distance(blueContestant.x, blueContestant.y, centerX, centerY);
          const redDist = distance(redContestant.x, redContestant.y, centerX, centerY);

          if (blueDist < 25 && redDist < 25) {
            // Tranh chấp
            const bluePower = blueContestant.stats.atk + blueContestant.stats.spd;
            const redPower = redContestant.stats.atk + redContestant.stats.spd;
            
            const blueRoll = bluePower + Math.random() * 50;
            const redRoll = redPower + Math.random() * 50;
            
            const winner = blueRoll > redRoll ? blueContestant : redContestant;
            const winningTeam = winner.team;
            
            logs.push({ message: `⚡ ${winner.name} (${winningTeam.toUpperCase()}) đoạt bóng!`, type: 'action' });
            
            // Tìm hậu vệ gần nhất để chuyền
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

          // Timeout để tránh treo
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
          // Hậu vệ cầm bóng: dắt bóng lên hoặc chuyền ngang chờ tiền đạo
          if (!ballHolder || ballHolder.role !== 'DF') {
            // Không có ball holder hợp lệ, tìm hậu vệ để giao bóng
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
          
          // Dắt bóng lên
          const newPos = moveTowards(
            { x: ballHolder.x, y: ballHolder.y },
            { x: ballHolder.x, y: targetY },
            speed
          );
          players = players.map(p =>
            p.id === ballHolder.id ? { ...p, x: newPos.x, y: newPos.y } : p
          );
          ball = { x: newPos.x, y: newPos.y, ownerId: ballHolder.id };

          // Di chuyển các cầu thủ khác
          const myTeamDefenders = players.filter(p => p.team === ballHolder.team && p.role === 'DF');
          const opponentTeamDefenders = players.filter(p => p.team !== ballHolder.team && p.role === 'DF');

          players = players.map(p => {
            if (p.hasBall || p.role === 'GK') return p;
            
            let targetPos: { x: number; y: number };
            
            if (p.role === 'FW') {
              targetPos = getForwardMovement(p, ball, ballHolder, attackingTeam);
            } else {
              // Hậu vệ
              const sameTeamDFs = p.team === ballHolder.team ? myTeamDefenders : opponentTeamDefenders;
              targetPos = getDefenderMovement(p, ball, ballHolder, players, sameTeamDFs);
            }
            
            const moveSpeed = BASE_SPEED + p.stats.spd / 100;
            const newPlayerPos = moveTowards({ x: p.x, y: p.y }, targetPos, moveSpeed);
            return { ...p, x: newPlayerPos.x, y: newPlayerPos.y };
          });

          // Khi hậu vệ đến gần đường giữa sân và tiền đạo đã ở vị trí -> chuyền
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
            // Tỉ lệ bị chặn bởi tiền đạo đối phương
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
              
              // Tiền đạo đoạt bóng -> chuyền về cho hậu vệ
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
              break;
            }
            
            logs.push({ message: `📤 ${ballHolder.name} chuyền bóng cho ${targetFW.name}`, type: 'pass' });
            players = players.map(p => ({
              ...p,
              hasBall: p.id === targetFW.id,
            }));
            ball = { x: targetFW.x, y: targetFW.y, ownerId: targetFW.id };
            newPhase = 'fw_attacking';
            newState.phaseTimer = 0;
          }
          break;
        }

        case 'fw_attacking': {
          if (!ballHolder || ballHolder.role !== 'FW') {
            // Không có tiền đạo cầm bóng, quay lại df_buildup
            newPhase = 'df_buildup';
            break;
          }

          const isBlueTeam = ballHolder.team === 'blue';
          const speed = BASE_SPEED + ballHolder.stats.spd / 60;
          
          // Tiền đạo cầm bóng di chuyển về phía khung thành
          const newPos = moveTowards(
            { x: ballHolder.x, y: ballHolder.y },
            { x: PITCH_WIDTH / 2, y: goalY },
            speed
          );
          players = players.map(p =>
            p.id === ballHolder.id ? { ...p, x: newPos.x, y: newPos.y } : p
          );
          ball = { x: newPos.x, y: newPos.y, ownerId: ballHolder.id };

          // Di chuyển các cầu thủ khác
          const myTeamDefenders = players.filter(p => p.team === ballHolder.team && p.role === 'DF');
          const opponentTeamDefenders = players.filter(p => p.team !== ballHolder.team && p.role === 'DF');

          players = players.map(p => {
            if (p.hasBall || p.role === 'GK') return p;

            if (p.team === attackingTeam) {
              // Đội tấn công dâng lên, hậu vệ chỉ đến nửa sân
              if (p.role === 'DF') {
                const maxY = PASSING_LINE_Y;
                const targetY = isBlueTeam 
                  ? Math.max(p.baseY - 80, maxY)
                  : Math.min(p.baseY + 80, maxY);
                const moveSpeed = BASE_SPEED + p.stats.spd / 100;
                const newPlayerPos = moveTowards({ x: p.x, y: p.y }, { x: p.baseX, y: targetY }, moveSpeed);
                return { ...p, x: newPlayerPos.x, y: newPlayerPos.y };
              } else {
                // Tiền đạo hỗ trợ
                const targetPos = getForwardMovement(p, ball, ballHolder, attackingTeam);
                const moveSpeed = BASE_SPEED + p.stats.spd / 100;
                const newPlayerPos = moveTowards({ x: p.x, y: p.y }, targetPos, moveSpeed);
                return { ...p, x: newPlayerPos.x, y: newPlayerPos.y };
              }
            } else {
              // Đội phòng ngự
              if (p.role === 'DF') {
                // Hậu vệ bám theo tiền đạo được gán và lùi về
                const targetPos = getDefenderMovement(p, ball, ballHolder, players, opponentTeamDefenders);
                const moveSpeed = BASE_SPEED + p.stats.spd / 80;
                const newPlayerPos = moveTowards({ x: p.x, y: p.y }, targetPos, moveSpeed);
                return { ...p, x: newPlayerPos.x, y: newPlayerPos.y };
              } else {
                // Tiền đạo đội thủ lui về
                const targetPos = getForwardMovement(p, ball, ballHolder, attackingTeam);
                const moveSpeed = BASE_SPEED + p.stats.spd / 100;
                const newPlayerPos = moveTowards({ x: p.x, y: p.y }, targetPos, moveSpeed);
                return { ...p, x: newPlayerPos.x, y: newPlayerPos.y };
              }
            }
          });

          // Kiểm tra va chạm với hậu vệ (chỉ khi gần vùng 16m50)
          const penaltyY = isBlueTeam ? PENALTY_AREA_Y_BLUE : PENALTY_AREA_Y_RED;
          const nearPenalty = isBlueTeam 
            ? ballHolder.y < penaltyY + 80
            : ballHolder.y > penaltyY - 80;

          if (nearPenalty) {
            for (const defender of defendingDefenders) {
              const dist = distance(newPos.x, newPos.y, defender.x, defender.y);
              if (dist < TACKLE_DISTANCE) {
                newPhase = 'duel';
                newState.phaseTimer = 0;
                logs.push({ message: `⚔️ ${ballHolder.name} đối đầu ${defender.name}!`, type: 'duel' });
                break;
              }
            }
          }

          // Nếu vào vùng 16m50 mà không bị chặn -> sút
          const inPenaltyArea = isBlueTeam 
            ? newPos.y < penaltyY 
            : newPos.y > penaltyY;
          
          if (inPenaltyArea && newPhase !== 'duel') {
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
          logs.push({ message: `⚽ ${shooter.name} sút bóng!`, type: 'action' });

          const isGoal = attemptShot(shooter, goalkeeper);
          const isBlueTeam = shooter.team === 'blue';

          if (isGoal) {
            logs.push({ message: `🎉 GOAL! ${shooter.name} ghi bàn cho đội ${attackingTeam.toUpperCase()}!`, type: 'goal' });
            newState.score = {
              ...prev.score,
              [attackingTeam]: prev.score[attackingTeam] + 1,
            };
            
            // Bóng bay vào lưới
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
          } else {
            if (goalkeeper.isSkillActive) {
              logs.push({ message: `🧤 ${goalkeeper.name} sử dụng ${goalkeeper.skill.emoji} ${goalkeeper.skill.name}!`, type: 'skill' });
            }
            logs.push({ message: `🧤 ${goalkeeper.name} cản phá thành công!`, type: 'action' });
            
            players = players.map(p => ({
              ...p,
              hasBall: p.id === goalkeeper.id,
              isDashing: false,
            }));
            ball = { x: goalkeeper.x, y: goalkeeper.y, ownerId: goalkeeper.id };
            newPhase = 'save';
          }
          newState.phaseTimer = 0;
          break;
        }

        case 'goal_celebration': {
          // Hiển thị overlay 2 giây rồi reset
          if (prev.phaseTimer > 60) {
            newState.showGoalOverlay = false;
            newPhase = 'reset_to_center';
            newState.phaseTimer = 0;
          }
          break;
        }

        case 'save': {
          // Thủ môn cầm bóng -> chuyền cho hậu vệ để bắt đầu tấn công
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
          // Đưa cầu thủ về vị trí, bóng về giữa sân
          let allInPosition = true;
          
          // Đội bị ghi bàn sẽ có bóng - đặt tiền đạo giữa ở giữa sân
          const concededTeam = prev.lastScoringTeam === 'blue' ? 'red' : 'blue';
          const kickoffFW = players.find(p => p.team === concededTeam && p.id.includes('fw-1'));

          players = players.map(p => {
            // Tiền đạo giữa của đội bị ghi bàn đứng giữa sân cầm bóng
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

          // Cập nhật lại ball holder
          const newKickoffFW = players.find(p => p.id === kickoffFW?.id);
          if (newKickoffFW && newKickoffFW.hasBall) {
            ball = { x: newKickoffFW.x, y: newKickoffFW.y, ownerId: newKickoffFW.id, isInGoal: false };
          } else {
            ball = { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2, ownerId: null, isInGoal: false };
          }

          if (allInPosition || prev.phaseTimer > 80) {
            // Tiền đạo giữa của đội bị ghi bàn chuyền cho hậu vệ
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

            newState.attackingTeam = concededTeam;
            newPhase = 'df_buildup';
            newState.phaseTimer = 0;
          }
          break;
        }
      }

      // Thêm logs
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

  return {
    gameState,
    startMatch,
    selectPlayer,
  };
};
