// ============================================================================
// 游戏模块路由 — HTTP 轮询架构
// ============================================================================

import { Router } from 'express';
import { ClientMessage, RoleId, ROLES, Faction } from '../../../shared/types';
import * as engine from '../../../shared/engine';
import { roomManager } from './roomManager';
import { runAIAction } from './ai';

export const gameRouter = Router();

function buildAllAppraisals(room: any, playerId: string): Record<number, any[]> {
  const states = room.game.playerRoundStates[playerId];
  if (!states) return {};
  const result: Record<number, any[]> = {};
  for (const [roundNum, state] of Object.entries(states)) {
    result[Number(roundNum)] = (state as any).appraisals || [];
  }
  return result;
}

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

gameRouter.get('/rooms/:code', (req, res) => {
  const room = roomManager.getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: '房间不存在' });
  res.json({ code: room.code, playerCount: room.players.length, maxPlayers: room.maxPlayers, phase: room.game.phase });
});

/** 加入房间 */
gameRouter.post('/rooms/:code/join', (req, res) => {
  const { name, pid } = req.body || {};
  if (!name) return res.status(400).json({ error: '请输入昵称' });
  const code = req.params.code.toUpperCase();
  const room = roomManager.getRoom(code);
  if (!room) return res.status(404).json({ error: '房间不存在' });

  if (pid) {
    const existing = room.players.find(p => p.id === pid);
    if (existing) {
      existing.connected = true;
      existing.name = name || existing.name;
      return res.json({ playerId: existing.id, room: roomManager.toPublicRoom(room, existing.id) });
    }
  }

  if (room.game.phase === 'waiting' || room.game.phase === 'ended') {
    const existingByName = room.players.find(p => p.name === name);
    if (existingByName) {
      existingByName.connected = true;
      return res.json({ playerId: existingByName.id, room: roomManager.toPublicRoom(room, existingByName.id) });
    }
    if (room.players.filter(p => !p.isAI).length >= room.maxPlayers) {
      return res.status(400).json({ error: '房间已满' });
    }
  }

  if (room.game.phase !== 'waiting' && room.game.phase !== 'ended') {
    const existing = room.players.find(p => p.name === name);
    if (existing) {
      existing.connected = true;
      return res.json({ playerId: existing.id, room: roomManager.toPublicRoom(room, existing.id) });
    }
    return res.status(400).json({ error: '游戏进行中，无法加入' });
  }

  const newPlayer = {
    id: 'p_' + Math.random().toString(36).slice(2, 10),
    name: name.trim().slice(0, 12), isHost: false, isAI: false, connected: true,
    seatNumber: 0, betArtifactIds: [], remainingVotes: 2,
  };
  room.players.push(newPlayer as any);
  engine.reindexSeats(room);
  res.json({ playerId: newPlayer.id, room: roomManager.toPublicRoom(room, newPlayer.id) });
});

/** 心跳 */
gameRouter.post('/rooms/:code/heartbeat', (req, res) => {
  const code = req.params.code.toUpperCase();
  const { playerId } = req.body || {};
  const room = roomManager.getRoom(code);
  if (!room) return res.status(404).json({ error: '房间不存在' });
  const player = room.players.find(p => p.id === playerId);
  if (player) player.connected = true;

  runAIAction(code);

  const viewer = room.players.find(p => p.id === playerId);
  res.json({
    room: roomManager.toPublicRoom(room, playerId),
    myRole: viewer?.role || null,
    myAppraisals: buildAllAppraisals(room, playerId),
    fangzhenResults: viewer?.fangzhenCheckResult ? [{
      round: room.game.currentRound, targetId: viewer.fangzhenCheckTarget!,
      targetName: room.players.find(p => p.id === viewer.fangzhenCheckTarget)?.name || '',
      faction: viewer.fangzhenCheckResult,
    }] : [],
    sealedRounds: Object.entries(room.game.playerRoundStates[playerId] || {})
      .filter(([_, s]) => (s as any).sealed).map(([r]) => Number(r)),
    randomlyBlockedRounds: Object.entries(room.game.playerRoundStates[playerId] || {})
      .filter(([_, s]) => (s as any).randomlyBlocked && !(s as any).sealed).map(([r]) => Number(r)),
    fangzhenSealPenaltyRounds: Object.entries(room.game.playerRoundStates[playerId] || {})
      .filter(([_, s]) => (s as any).fangzhenSealPenalty).map(([r]) => Number(r)),
    knownAllies: engine.getKnownAllies(room, playerId),
    remainingVotes: viewer?.remainingVotes || 0,
  });
});

/** 离开房间 */
gameRouter.post('/rooms/:code/leave', (req, res) => {
  roomManager.markDisconnected(req.params.code.toUpperCase(), (req.body || {}).playerId);
  res.json({ ok: true });
});

/** 添加 AI */
gameRouter.post('/rooms/:code/addAI', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = roomManager.getRoom(code);
  if (!room) return res.status(404).json({ error: '房间不存在' });
  if (room.game.phase !== 'waiting') return res.status(400).json({ error: '游戏已开始' });
  if (room.players.length >= room.maxPlayers) return res.status(400).json({ error: '房间已满' });
  const result = roomManager.addAI(code);
  if (!result.ok) return res.status(400).json({ error: result.error });
  engine.reindexSeats(room);
  res.json({ room: roomManager.toPublicRoom(room, (req.body as any)?.playerId) });
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
      case 'kickPlayer': {
        if (!player.isHost) { error = '只有房主可以踢人'; break; }
        if (room.game.phase !== 'waiting') { error = '游戏已开始'; break; }
        const r = roomManager.removePlayer(code, msg.targetId);
        if (!r.ok) error = r.error!;
        engine.reindexSeats(room);
        break;
      }
      case 'changeSeat': {
        const r = engine.changeSeat(room, playerId, msg.targetId);
        if (!r.ok) error = r.error!;
        break;
      }
      case 'disbandRoom': {
        if (!player.isHost) { error = '只有房主可以解散'; break; }
        roomManager.removeRoom(code);
        return res.json({ disbanded: true });
      }
      case 'startGame': {
        if (!player.isHost) { error = '只有房主可以开始'; break; }
        const isDev = (req.headers['x-dev-mode'] || '') === '1';
        if (!isDev && room.players.length < 6) { error = '至少需要 6 名玩家'; break; }
        engine.assignRoles(room);
        const allArts = roomManager.getAllArtifacts(code);
        const usedIds = roomManager.getUsedIds(code);
        engine.startRound(room, 1, allArts, usedIds);
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
        if (room.game.phase !== 'appraise') { error = '当前非鉴宝阶段'; break; }
        const cur = room.game.currentRound;
        const rnd = room.game.rounds[cur - 1];
        // 末位行动玩家（当前行动者）直接结束本轮时，需先把自身记入已完成
        const isLastAppraiser = rnd.currentAppraiserId === playerId;
        if (isLastAppraiser && !rnd.finishedAppraisers.includes(playerId)) {
          rnd.finishedAppraisers.push(playerId);
        }
        // 必须所有玩家都已完成鉴宝（或本轮无法鉴宝）才能进入发言
        const allDone = room.players.every((p: any) => {
          const rs = room.game.playerRoundStates[p.id]?.[cur];
          const cannot = rs && (rs.sealed || rs.randomlyBlocked);
          const noAppraise = p.role && ROLES[p.role as RoleId].appraiseCount === 0;
          return rnd.finishedAppraisers.includes(p.id) || cannot || noAppraise;
        });
        if (!allDone) { error = '尚有玩家未完成鉴宝'; break; }
        // 房主可推进；或最后一位行动玩家（当前行动者）自行结束本轮
        if (!player.isHost && !isLastAppraiser) { error = '由房主或末位玩家推进阶段'; break; }
        engine.enterDiscussPhase(room);
        break;
      }
      case 'passAppraiseTurn': {
        if (room.game.phase !== 'appraise') { error = '当前非鉴宝阶段'; break; }
        const r = engine.passAppraiseTurn(room, playerId, msg.nextPlayerId);
        if (!r.ok) error = r.error!;
        break;
      }
      case 'speech': {
        if (room.game.phase !== 'discuss') { error = '当前非发言阶段'; break; }
        const r = engine.playerSpeech(room, playerId, msg.content);
        if (!r.ok) error = r.error!;
        else if (engine.isDiscussDone(room)) engine.enterVotePhase(room);
        break;
      }
      case 'bet': {
        if (room.game.phase !== 'vote') { error = '当前非押币阶段'; break; }
        const r = engine.playerBet(room, playerId, msg.artifactId);
        if (!r.ok) error = r.error!;
        break;
      }
      case 'finishVote': {
        if (room.game.phase !== 'vote') { error = '当前非押币阶段'; break; }
        const r = engine.finishVoteForPlayer(room, playerId);
        if (!r.ok) error = r.error!;
        else if (engine.isVoteDone(room)) engine.resolveBets(room);
        break;
      }
      case 'nextRound': {
        if (!player.isHost) { error = '只有房主可以推进'; break; }
        if (room.game.phase === 'reveal') {
          if (room.game.xuyuanScore >= room.game.targetScore) {
            engine.enterIdentifyPhase(room);
          } else {
            engine.nextRoundOrEnd(room, roomManager.getAllArtifacts(code), roomManager.getUsedIds(code));
          }
        } else if (room.game.phase === 'identify') {
          engine.resolveIdentify(room);
        } else {
          error = '当前阶段无法推进';
        }
        break;
      }
      case 'identifyVote': {
        if (room.game.phase !== 'identify') { error = '当前非鉴人阶段'; break; }
        const r = engine.identifyVote(room, playerId, msg.targetId);
        if (!r.ok) error = r.error!;
        break;
      }
      case 'restart': {
        if (!player.isHost) { error = '只有房主可以重开'; break; }
        engine.assignRoles(room);
        const allArts = roomManager.getAllArtifacts(code);
        const usedIds = roomManager.getUsedIds(code);
        usedIds.clear();
        engine.startRound(room, 1, allArts, usedIds);
        break;
      }
      default:
        error = '未知操作';
    }
  } catch (e: any) {
    error = e.message;
  }

  runAIAction(code);

  if (error) return res.status(400).json({ error });

  const viewer = room.players.find(p => p.id === playerId);
  res.json({
    room: roomManager.toPublicRoom(room, playerId),
    myRole: viewer?.role || null,
    myAppraisals: buildAllAppraisals(room, playerId),
    fangzhenResults: viewer?.fangzhenCheckResult ? [{
      round: room.game.currentRound, targetId: viewer.fangzhenCheckTarget!,
      targetName: room.players.find(p => p.id === viewer.fangzhenCheckTarget)?.name || '',
      faction: viewer.fangzhenCheckResult,
    }] : [],
    sealedRounds: Object.entries(room.game.playerRoundStates[playerId] || {})
      .filter(([_, s]) => (s as any).sealed).map(([r]) => Number(r)),
    randomlyBlockedRounds: Object.entries(room.game.playerRoundStates[playerId] || {})
      .filter(([_, s]) => (s as any).randomlyBlocked && !(s as any).sealed).map(([r]) => Number(r)),
    fangzhenSealPenaltyRounds: Object.entries(room.game.playerRoundStates[playerId] || {})
      .filter(([_, s]) => (s as any).fangzhenSealPenalty).map(([r]) => Number(r)),
    knownAllies: engine.getKnownAllies(room, playerId),
    remainingVotes: viewer?.remainingVotes || 0,
  });
});
