// ============================================================================
// 游戏模块路由 — HTTP 轮询架构
// ============================================================================

import { Router } from 'express';
import { ClientMessage, ServerMessage, RoleId, ROLES, AppraisalResult, Faction } from '../../../shared/types';
import * as engine from '../../../shared/engine';
import { roomManager } from './roomManager';
import { runAIAction } from './ai';

export const gameRouter = Router();

/** 创建房间 */
gameRouter.post('/rooms', (req, res) => {
  const { name, maxPlayers } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: '请输入昵称' });
  }
  const max = Math.min(8, Math.max(6, Number(maxPlayers) || 8));
  const room = roomManager.createRoom(name.trim().slice(0, 12), max);
  res.json({ code: room.code, maxPlayers: room.maxPlayers, playerId: room.players[0].id });
});

/** 查询房间是否存在 */
gameRouter.get('/rooms/:code', (req, res) => {
  const room = roomManager.getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: '房间不存在' });
  res.json({
    code: room.code,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    phase: room.game.phase,
  });
});

/** 加入房间（HTTP）*/
gameRouter.post('/rooms/:code/join', (req, res) => {
  const { name, pid } = req.body || {};
  if (!name) return res.status(400).json({ error: '请输入昵称' });
  const code = req.params.code.toUpperCase();
  const room = roomManager.getRoom(code);
  if (!room) return res.status(404).json({ error: '房间不存在' });

  // 优先按 pid 重连
  if (pid) {
    const existing = room.players.find(p => p.id === pid);
    if (existing) {
      existing.connected = true;
      existing.name = name || existing.name;
      return res.json({
        playerId: existing.id,
        room: roomManager.toPublicRoom(room, existing.id),
      });
    }
  }

  // waiting 阶段：允许按名字重连
  if (room.game.phase === 'waiting' || room.game.phase === 'ended') {
    const existingByName = room.players.find(p => p.name === name);
    if (existingByName) {
      existingByName.connected = true;
      return res.json({
        playerId: existingByName.id,
        room: roomManager.toPublicRoom(room, existingByName.id),
      });
    }
    // waiting 阶段：只有房间不满才允许新加入
    if (room.players.filter(p => !p.isAI).length >= room.maxPlayers) {
      return res.status(400).json({ error: '房间已满' });
    }
  }

  // 游戏进行中：只允许重连
  if (room.game.phase !== 'waiting' && room.game.phase !== 'ended') {
    const existing = room.players.find(p => p.name === name);
    if (existing) {
      existing.connected = true;
      return res.json({
        playerId: existing.id,
        room: roomManager.toPublicRoom(room, existing.id),
      });
    }
    return res.status(400).json({ error: '游戏进行中，无法加入' });
  }

  const newPlayer = {
    id: 'p_' + Math.random().toString(36).slice(2, 10),
    name: name.trim().slice(0, 12),
    isHost: false,
    isAI: false,
    connected: true,
  };
  room.players.push(newPlayer as any);
  res.json({
    playerId: newPlayer.id,
    room: roomManager.toPublicRoom(room, newPlayer.id),
  });
});

/** 心跳：标记玩家在线，返回最新房间状态 */
gameRouter.post('/rooms/:code/heartbeat', (req, res) => {
  const code = req.params.code.toUpperCase();
  const { playerId } = req.body || {};
  const room = roomManager.getRoom(code);
  if (!room) return res.status(404).json({ error: '房间不存在' });
  const player = room.players.find(p => p.id === playerId);
  if (player) player.connected = true;

  // 驱动 AI 行动
  runAIAction(code);

  const viewer = room.players.find(p => p.id === playerId);
  res.json({
    room: roomManager.toPublicRoom(room, playerId),
    myRole: viewer?.role || null,
    myAppraisals: room.game.playerRoundStates[playerId]?.[room.game.currentRound]?.appraisals || [],
    fangzhenResults: viewer?.fangzhenCheckResult ? [{
      round: room.game.currentRound,
      targetId: viewer.fangzhenCheckTarget!,
      targetName: room.players.find(p => p.id === viewer.fangzhenCheckTarget)?.name || '',
      faction: viewer.fangzhenCheckResult,
    }] : [],
    sealedRounds: Object.entries(room.game.playerRoundStates[playerId] || {})
      .filter(([_, s]) => (s as any).sealed).map(([r]) => Number(r)),
  });
});

/** 离开房间 */
gameRouter.post('/rooms/:code/leave', (req, res) => {
  const code = req.params.code.toUpperCase();
  const { playerId } = req.body || {};
  roomManager.markDisconnected(code, playerId);
  res.json({ ok: true });
});

/** 通用行动接口 */
gameRouter.post('/rooms/:code/action', (req, res) => {
  const code = req.params.code.toUpperCase();
  const { playerId, action } = req.body || {};
  const room = roomManager.getRoom(code);
  if (!room) return res.status(404).json({ error: '房间不存在' });
  const player = room.players.find(p => p.id === playerId);
  if (!player) return res.status(400).json({ error: '玩家不存在' });

  const msg = action as ClientMessage;
  let error: string | null = null;

  try {
    switch (msg.type) {
      case 'startGame': {
        if (!player.isHost) { error = '只有房主可以开始游戏'; break; }
        // 调试模式：X-Dev-Mode header 跳过人数检查
        const isDev = (req.headers['x-dev-mode'] || '') === '1';
        if (!isDev && room.players.length < 6) { error = '至少需要 6 名玩家'; break; }
        engine.assignRoles(room);
        engine.startRound(room, 1);
        break;
      }
      case 'appraise': {
        if (room.game.phase !== 'appraise') { error = '当前非鉴宝阶段'; break; }
        const result = engine.appraise(room, playerId, msg.artifactId);
        if ('error' in result) { error = result.error; break; }
        break;
      }
      case 'laochaofengFlip': {
        const r = engine.laochaofengUseFlip(room, playerId, msg.use);
        if (!r.ok) error = r.error!;
        break;
      }
      case 'yaoburanSeal': {
        const r = engine.yaoburanSeal(room, playerId, msg.targetId);
        if (!r.ok) error = r.error!;
        break;
      }
      case 'zhengguoquLock': {
        const r = engine.zhengguoquLock(room, playerId, msg.artifactId);
        if (!r.ok) error = r.error!;
        break;
      }
      case 'fangzhenCheck': {
        const r = engine.fangzhenCheck(room, playerId, msg.targetId);
        if (!r.ok) error = r.error!;
        break;
      }
      case 'finishAppraise': {
        if (!player.isHost) { error = '由房主推进阶段'; break; }
        if (room.game.phase !== 'appraise') { error = '当前非鉴宝阶段'; break; }
        engine.enterDiscussPhase(room);
        break;
      }
      case 'speech': {
        if (room.game.phase !== 'discuss') { error = '当前非发言阶段'; break; }
        const r = engine.playerSpeech(room, playerId, msg.content);
        if (!r.ok) error = r.error!;
        else if (engine.isDiscussDone(room)) {
          engine.enterVotePhase(room);
        }
        break;
      }
      case 'bet': {
        if (room.game.phase !== 'vote') { error = '当前非押币阶段'; break; }
        const r = engine.playerBet(room, playerId, msg.artifactId);
        if (!r.ok) error = r.error!;
        else if (engine.isVoteDone(room)) {
          engine.resolveBets(room);
        }
        break;
      }
      case 'nextRound': {
        if (!player.isHost) { error = '只有房主可以推进'; break; }
        if (room.game.phase !== 'reveal') { error = '当前非揭示阶段'; break; }
        if (room.game.xuyuanScore >= room.game.targetScore) {
          engine.endGame(room);
        } else {
          engine.nextRoundOrEnd(room);
        }
        break;
      }
      case 'restart': {
        if (!player.isHost) { error = '只有房主可以重开'; break; }
        engine.assignRoles(room);
        engine.startRound(room, 1);
        break;
      }
      default:
        error = '未知操作';
    }
  } catch (e: any) {
    error = e.message;
  }

  // 驱动 AI
  runAIAction(code);

  if (error) return res.status(400).json({ error });

  const viewer = room.players.find(p => p.id === playerId);
  res.json({
    room: roomManager.toPublicRoom(room, playerId),
    myRole: viewer?.role || null,
    myAppraisals: room.game.playerRoundStates[playerId]?.[room.game.currentRound]?.appraisals || [],
    fangzhenResults: viewer?.fangzhenCheckResult ? [{
      round: room.game.currentRound,
      targetId: viewer.fangzhenCheckTarget!,
      targetName: room.players.find(p => p.id === viewer.fangzhenCheckTarget)?.name || '',
      faction: viewer.fangzhenCheckResult,
    }] : [],
    sealedRounds: Object.entries(room.game.playerRoundStates[playerId] || {})
      .filter(([_, s]) => (s as any).sealed).map(([r]) => Number(r)),
  });
});
