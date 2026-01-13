import { useState, useCallback, useEffect } from 'react';
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
const IDLE_MOVEMENT_RANGE = 20; // Phạm vi di chuyển khi không có bóng

const generateId = () => Math.random().toString(36).slice(2, 9);

export const useGameLoop = () => {
  const [gameState, setGameState] = useState<GameState>(() => initializeGame());

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

  const startMatch = useCallback(() => {
    const bluePlayers = createTeam('blue');
    const redPlayers = createTeam('red');

    setGameState({
      phase: 'kickoff_contest',
      players: [...bluePlayers, ...redPlayers],
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

  // Tính toán vị trí di chuyển nhẹ quanh base position, hướng theo bóng
  const getIdleMovementTarget = (player: Player, ball: { x: number; y: number }, attackingTeam: Team): { x: number; y: number } => {
    const ballInfluence = 0.15; // Mức độ ảnh hưởng của bóng
    const time = Date.now() / 1000;
    
    // Di chuyển nhẹ theo pattern sin/cos để không đứng yên
    const wobbleX = Math.sin(time * 0.5 + player.x) * 8;
    const wobbleY = Math.cos(time * 0.4 + player.y) * 8;
    
    // Hướng về phía bóng một chút
    const toBallX = (ball.x - player.baseX) * ballInfluence;
    const toBallY = (ball.y - player.baseY) * ballInfluence;
    
    return {
      x: clamp(player.baseX + wobbleX + toBallX, 30, PITCH_WIDTH - 30),
      y: clamp(player.baseY + wobbleY + toBallY, 30, PITCH_HEIGHT - 30),
    };
  };

  // Di chuyển hậu vệ: chặn trước mặt tiền đạo đối phương
  const getDefenderMovement = (
    defender: Player,
    ball: { x: number; y: number },
    ballHolder: Player | undefined,
    opponentForwards: Player[],
    isOpponentAttacking: boolean
  ): { x: number; y: number } => {
    const isBlueTeam = defender.team === 'blue';
    const ownGoalY = isBlueTeam ? PITCH_HEIGHT - 30 : 30;
    const penaltyLineY = isBlueTeam ? PENALTY_AREA_Y_RED : PENALTY_AREA_Y_BLUE;

    // Nếu tiền đạo đối phương CÓ bóng -> lùi dần về khung thành
    if (ballHolder && ballHolder.team !== defender.team && ballHolder.role === 'FW') {
      // Lùi về hướng gôn nhà
      const retreatY = isBlueTeam 
        ? Math.max(defender.baseY + 50, penaltyLineY)
        : Math.min(defender.baseY - 50, penaltyLineY);
      
      return {
        x: clamp(ball.x, 80, PITCH_WIDTH - 80),
        y: retreatY,
      };
    }

    // Nếu tiền đạo đối phương KHÔNG cầm bóng -> kèm chặn trước mặt
    const nearestOpponentFW = opponentForwards
      .filter(fw => distance(defender.x, defender.y, fw.x, fw.y) < 150)
      .sort((a, b) => distance(defender.x, defender.y, a.x, a.y) - distance(defender.x, defender.y, b.x, b.y))[0];

    if (nearestOpponentFW) {
      // Đứng giữa tiền đạo và khung thành của mình
      const blockX = nearestOpponentFW.x;
      const blockY = (nearestOpponentFW.y + ownGoalY) / 2;
      
      return {
        x: clamp(blockX, 50, PITCH_WIDTH - 50),
        y: clamp(blockY, 50, PITCH_HEIGHT - 50),
      };
    }

    // Mặc định: di chuyển nhẹ quanh vị trí
    return getIdleMovementTarget(defender, ball, defender.team);
  };

  // Di chuyển tiền đạo: theo bóng và hỗ trợ tấn công
  const getForwardMovement = (
    forward: Player,
    ball: { x: number; y: number },
    ballHolder: Player | undefined,
    attackingTeam: Team
  ): { x: number; y: number } => {
    const isBlueTeam = forward.team === 'blue';
    const opponentGoalY = isBlueTeam ? GOAL_Y_BLUE : GOAL_Y_RED;
    const ownHalfY = isBlueTeam ? PITCH_HEIGHT * 0.65 : PITCH_HEIGHT * 0.35;

    // Nếu đội mình đang tấn công (hậu vệ hoặc tiền đạo có bóng)
    if (ballHolder && ballHolder.team === forward.team) {
      // Dâng lên phần sân đối phương
      const targetY = isBlueTeam 
        ? Math.min(forward.y, PITCH_HEIGHT * 0.35)
        : Math.max(forward.y, PITCH_HEIGHT * 0.65);
      
      // Tìm vị trí rộng để nhận bóng
      const spreadX = forward.baseX + (Math.random() - 0.5) * 40;
      
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
    return getIdleMovementTarget(forward, ball, attackingTeam);
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
      const defendingDefenders = defendingPlayers.filter(p => p.role === 'DF');

      switch (prev.phase) {
        case 'kickoff_contest': {
          // Bóng ở giữa sân, tiền đạo 2 bên chạy đến tranh chấp
          const centerX = PITCH_WIDTH / 2;
          const centerY = PITCH_HEIGHT / 2;

          // Di chuyển tất cả tiền đạo về giữa sân
          const allForwards = players.filter(p => p.role === 'FW');
          allForwards.forEach(fw => {
            const idx = players.findIndex(p => p.id === fw.id);
            if (idx !== -1) {
              const speed = BASE_SPEED + fw.stats.spd / 60;
              const newPos = moveTowards({ x: fw.x, y: fw.y }, { x: centerX, y: centerY }, speed);
              players[idx] = { ...players[idx], x: newPos.x, y: newPos.y };
            }
          });

          // Kiểm tra ai đến gần bóng nhất
          const nearestFW = allForwards
            .sort((a, b) => distance(a.x, a.y, centerX, centerY) - distance(b.x, b.y, centerX, centerY))[0];

          if (nearestFW && distance(nearestFW.x, nearestFW.y, centerX, centerY) < 20) {
            // Tranh chấp: random giữa 2 đội
            const blueContestants = allForwards.filter(f => f.team === 'blue');
            const redContestants = allForwards.filter(f => f.team === 'red');
            
            const bluePower = blueContestants.reduce((sum, p) => sum + p.stats.atk + p.stats.spd, 0) / blueContestants.length;
            const redPower = redContestants.reduce((sum, p) => sum + p.stats.atk + p.stats.spd, 0) / redContestants.length;
            
            const blueRoll = bluePower + Math.random() * 50;
            const redRoll = redPower + Math.random() * 50;
            
            const winningTeam: Team = blueRoll > redRoll ? 'blue' : 'red';
            const winner = allForwards.find(f => f.team === winningTeam)!;
            
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
          break;
        }

        case 'df_buildup': {
          // Hậu vệ cầm bóng: dắt bóng lên hoặc chuyền ngang chờ tiền đạo
          if (ballHolder && ballHolder.role === 'DF') {
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
            players = players.map(p => {
              if (p.hasBall || p.role === 'GK') return p;
              
              const targetPos = p.role === 'FW'
                ? getForwardMovement(p, ball, ballHolder, attackingTeam)
                : getDefenderMovement(
                    p, 
                    ball, 
                    ballHolder, 
                    p.team === 'blue' ? defendingForwards : attackingForwards,
                    ballHolder.team !== p.team
                  );
              
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
          }
          break;
        }

        case 'df_passing': {
          if (ballHolder && ballHolder.role === 'DF') {
            const forwards = attackingPlayers.filter(p => p.role === 'FW');
            const targetFW = forwards[Math.floor(Math.random() * forwards.length)];
            
            if (targetFW) {
              // Tỉ lệ bị chặn bởi tiền đạo đối phương
              const interceptionChance = 0.12;
              const isIntercepted = Math.random() < interceptionChance;
              
              if (isIntercepted) {
                const interceptor = defendingForwards[Math.floor(Math.random() * defendingForwards.length)];
                
                if (interceptor) {
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
                    setTimeout(() => {
                      setGameState(s => ({
                        ...s,
                        matchLog: [
                          { id: generateId(), time: s.matchTime, message: `📤 ${interceptor.name} chuyền về cho ${nearestDF.name}`, type: 'pass' },
                          ...s.matchLog.slice(0, 49),
                        ],
                      }));
                    }, 300);
                  }
                  
                  newState.attackingTeam = defendingTeam;
                  newPhase = 'df_buildup';
                  newState.phaseTimer = 0;
                  break;
                }
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
          }
          break;
        }

        case 'fw_attacking': {
          if (ballHolder && ballHolder.role === 'FW') {
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
                  // Hậu vệ lùi về và chuẩn bị tranh cướp
                  const targetPos = getDefenderMovement(p, ball, ballHolder, attackingForwards, true);
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
                const dist = distance(ballHolder.x, ballHolder.y, defender.x, defender.y);
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
              ? ballHolder.y < penaltyY 
              : ballHolder.y > penaltyY;
            
            if (inPenaltyArea && newPhase !== 'duel') {
              newPhase = 'shooting';
              newState.phaseTimer = 0;
            }
          }
          break;
        }

        case 'duel': {
          const attacker = players.find(p => p.hasBall && p.role === 'FW');
          const defenders = defendingDefenders;
          const nearestDefender = defenders
            .sort((a, b) => {
              if (!attacker) return 0;
              return distance(attacker.x, attacker.y, a.x, a.y) - distance(attacker.x, attacker.y, b.x, b.y);
            })[0];

          if (attacker && nearestDefender) {
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
          }
          break;
        }

        case 'fw_breakthrough': {
          const attacker = players.find(p => p.hasBall && p.role === 'FW');
          
          if (attacker) {
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
          }
          break;
        }

        case 'shooting': {
          const shooter = players.find(p => p.hasBall);
          const goalkeeper = defendingPlayers.find(p => p.role === 'GK');
          
          if (shooter && goalkeeper) {
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
          }
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
          
          if (goalkeeper && prev.phaseTimer > 40) {
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
          players = players.map(p => {
            const dist = distance(p.x, p.y, p.baseX, p.baseY);
            if (dist > 10) {
              allInPosition = false;
              const speed = FAST_SPEED;
              const newPos = moveTowards({ x: p.x, y: p.y }, { x: p.baseX, y: p.baseY }, speed);
              return { ...p, x: newPos.x, y: newPos.y, hasBall: false, isDashing: false };
            }
            return { ...p, hasBall: false, isDashing: false };
          });

          ball = { x: PITCH_WIDTH / 2, y: PITCH_HEIGHT / 2, ownerId: null, isInGoal: false };

          if (allInPosition || prev.phaseTimer > 80) {
            // Đội bị ghi bàn sẽ có bóng
            const concededTeam = prev.lastScoringTeam === 'blue' ? 'red' : 'blue';
            newState.attackingTeam = concededTeam;
            newPhase = 'kickoff_contest';
            newState.phaseTimer = 0;
            logs.push({ message: `🏟️ Tiếp tục! Đội ${concededTeam.toUpperCase()} phát bóng!`, type: 'info' });
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
