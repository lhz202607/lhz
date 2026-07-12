// ============================================================================
// AI 行动逻辑 — 适配新规则
// ============================================================================

import { RoleId, ROLES } from '../../../shared/types';
import * as engine from '../../../shared/engine';
import { roomManager } from './roomManager';

const aiCooldown = new Map<string, number>();

export function runAIAction(code: string): void {
  const now = Date.now();
  const last = aiCooldown.get(code) || 0;
  if (now - last < 1500) return;
  aiCooldown.set(code, now);

  const room = roomManager.getRoom(code);
  if (!room || room.game.phase === 'waiting' || room.game.phase === 'ended' || room.game.phase === 'roleReveal') return;

  const phase = room.game.phase;

  if (phase === 'appraise') {
    const round = room.game.rounds[room.game.currentRound - 1];
    if (!round) return;
    const currentAppraiserId = round.currentAppraiserId;
    if (!currentAppraiserId) return;
    const currentAppraiser = room.players.find(p => p.id === currentAppraiserId);
    if (!currentAppraiser || !currentAppraiser.isAI) return;
    if (round.finishedAppraisers.includes(currentAppraiserId)) return;

    const p = currentAppraiser;
    // try-catch 兜底：即使 AI 执行出错（如角色名未定义等），也强制推进回合避免卡死
    try {
      const role = ROLES[p.role!];
      const check = engine.canAppraise(room, p.id);

      // 技能
      if (p.role === 'laochaofeng' && !round.laochaofengUsedFlip && Math.random() < 0.5) {
        engine.laochaofengUseFlip(room, p.id, true);
      }
      if (p.role === 'yaoburan' && !p.yaoburanSealTarget) {
        const targets = room.players.filter(t => ROLES[t.role!]?.faction === 'xuyuan' && t.id !== p.id);
        if (targets.length > 0) engine.yaoburanSeal(room, p.id, targets[Math.floor(Math.random() * targets.length)].id);
      }
      if (p.role === 'zhengguoqu' && p.zhengguoquLockedArtifact === undefined) {
        const avail = round.artifacts.filter(a => a.id !== round.lockedArtifactId);
        if (avail.length > 0) engine.zhengguoquLock(room, p.id, avail[Math.floor(Math.random() * avail.length)].id);
      }
      if (p.role === 'fangzhen' && !p.fangzhenCheckTarget) {
        const targets = room.players.filter(t => t.id !== p.id);
        if (targets.length > 0) engine.fangzhenCheck(room, p.id, targets[Math.floor(Math.random() * targets.length)].id);
      }

      // 鉴宝
      if (check.can && role && role.appraiseCount > 0) {
        const avail = round.artifacts.filter(a =>
          a.id !== round.lockedArtifactId &&
          !room.game.playerRoundStates[p.id][room.game.currentRound].appraisals.some((r: any) => r.artifactId === a.id)
        );
        for (let i = 0; i < check.count && avail.length > 0; i++) {
          const idx = Math.floor(Math.random() * avail.length);
          engine.appraise(room, p.id, avail.splice(idx, 1)[0].id);
        }
      }
    } catch (e) {
      console.error(`AI action error (room ${code}, player ${p.id}):`, e);
    }

    // 传递回合：严格按 appraiseOrder 相对顺序选"下一位"（含被封印/随机无法鉴宝的玩家，
    // 也需轮到其手动结束，不能自动跳过）。注意排除自己，避免末位时传给自己报错卡死。
    const order = round.appraiseOrder;
    const curIdx = order.indexOf(currentAppraiserId);
    let nextId: string | undefined;
    for (let k = 1; k <= order.length; k++) {
      const candId = order[(curIdx + k) % order.length];
      if (candId !== currentAppraiserId && !round.finishedAppraisers.includes(candId)) { nextId = candId; break; }
    }
    if (nextId) {
      engine.passAppraiseTurn(room, currentAppraiserId, nextId);
    } else {
      // 没有其他未完成的玩家（自己即末位）：直接结束本轮
      if (!round.finishedAppraisers.includes(currentAppraiserId)) round.finishedAppraisers.push(currentAppraiserId);
      round.currentAppraiserId = undefined;
      engine.enterDiscussPhase(room);
      round.events.push('全员鉴宝完毕，进入发言环节。');
    }

  } else if (phase === 'discuss') {
    const round = room.game.rounds[room.game.currentRound - 1];
    const currentId = round.speechOrder[round.currentSpeakerIndex];
    const current = room.players.find(p => p.id === currentId);
    if (current && current.isAI && !current.hasSpoken) {
      const speech = generateAISpeech(room, current);
      engine.playerSpeech(room, current.id, speech);
      if (engine.isDiscussDone(room)) engine.enterVotePhase(room);
    }
  } else if (phase === 'vote') {
    for (const p of room.players) {
      if (!p.isAI || p.remainingVotes <= 0) continue;
      const round = room.game.rounds[room.game.currentRound - 1];
      const candidates = round.artifacts.filter(a => !p.betArtifactIds.includes(a.id));
      if (candidates.length === 0) continue;
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      engine.playerBet(room, p.id, target.id);
    }
    if (engine.isVoteDone(room)) engine.resolveBets(room);
  } else if (phase === 'identify') {
    for (const p of room.players) {
      if (!p.isAI || p.identifyTargetId !== undefined) continue;
      const myRole = ROLES[p.role!];
      let targets: any[];
      if (myRole.id === 'laochaofeng') {
        // 老朝奉指认许愿
        targets = room.players.filter(t => t.id !== p.id);
      } else if (myRole.id === 'yaoburan') {
        // 药不然指认方震
        targets = room.players.filter(t => t.id !== p.id);
      } else {
        // 许愿阵营指认老朝奉
        targets = room.players.filter(t => t.id !== p.id);
      }
      if (targets.length > 0) {
        const t = targets[Math.floor(Math.random() * targets.length)];
        engine.identifyVote(room, p.id, t.id);
      }
    }
  }
}

function generateAISpeech(room: any, player: any): string {
  const role = ROLES[player.role as RoleId];
  const round = room.game.rounds[room.game.currentRound - 1];
  const rs = room.game.playerRoundStates[player.id]?.[room.game.currentRound];
  const lines: string[] = [];

  if (role.faction === 'xuyuan') {
    if (rs && rs.appraisals.length > 0) {
      const a = rs.appraisals[0];
      const art = round.artifacts.find((x: any) => x.id === a.artifactId);
      lines.push(`我鉴定了【${art?.name}】，依我看是${a.appearsReal ? '真品' : '赝品'}。`);
      lines.push(`各位注意，【${art?.name}】的来路需细查。`);
    } else {
      lines.push('我这轮未能鉴宝，但听各位发言，似乎另有隐情。');
      lines.push('我观诸位神色，恐有老朝奉的人混迹其中。');
    }
    if (player.role === 'fangzhen' && player.fangzhenCheckResult) {
      const target = room.players.find((p: any) => p.id === player.fangzhenCheckTarget);
      lines.push(`我暗中查探，${target?.name}的身份存疑。`);
    }
  } else {
    lines.push('我鉴定了一件，看着像是真的，不过拿不准。');
    lines.push('这局兽首真假难辨，我劝诸位莫要轻信一面之词。');
    lines.push('依我看，某些人发言闪烁其词，恐有蹊跷。');
  }
  return lines[Math.floor(Math.random() * lines.length)];
}
