// ============================================================================
// AI 行动逻辑 — 在 HTTP 请求时同步驱动 AI 行动
// ============================================================================

import { RoleId, ROLES } from '../../../shared/types';
import * as engine from '../../../shared/engine';
import { roomManager } from './roomManager';

const aiCooldown = new Map<string, number>(); // roomCode -> 上次行动时间

export function runAIAction(code: string): void {
  const now = Date.now();
  const last = aiCooldown.get(code) || 0;
  // 1 秒内只驱动一次，避免请求风暴
  if (now - last < 1000) return;
  aiCooldown.set(code, now);

  const room = roomManager.getRoom(code);
  if (!room || room.game.phase === 'waiting' || room.game.phase === 'ended' || room.game.phase === 'roleReveal') return;

  const phase = room.game.phase;

  if (phase === 'appraise') {
    let acted = false;
    for (const p of room.players) {
      if (!p.isAI || !p.role) continue;
      const role = ROLES[p.role];
      const check = engine.canAppraise(room, p.id);

      if (p.role === 'laochaofeng' && !room.game.rounds[room.game.currentRound - 1].laochaofengUsedFlip) {
        if (Math.random() < 0.5) {
          engine.laochaofengUseFlip(room, p.id, true);
          acted = true;
        }
      }
      if (p.role === 'yaoburan' && !p.yaoburanSealTarget) {
        const targets = room.players.filter(t => ROLES[t.role!]?.faction === 'xuyuan' && t.id !== p.id);
        if (targets.length > 0) {
          const target = targets[Math.floor(Math.random() * targets.length)];
          engine.yaoburanSeal(room, p.id, target.id);
          acted = true;
        }
      }
      if (p.role === 'zhengguoqu' && p.zhengguoquLockedArtifact === undefined) {
        const round = room.game.rounds[room.game.currentRound - 1];
        const avail = round.artifacts.filter(a => a.id !== round.lockedArtifactId);
        if (avail.length > 0) {
          const target = avail[Math.floor(Math.random() * avail.length)];
          engine.zhengguoquLock(room, p.id, target.id);
          acted = true;
        }
      }
      if (p.role === 'fangzhen' && !p.fangzhenCheckTarget) {
        const targets = room.players.filter(t => t.id !== p.id);
        if (targets.length > 0) {
          const target = targets[Math.floor(Math.random() * targets.length)];
          engine.fangzhenCheck(room, p.id, target.id);
          acted = true;
        }
      }
      if (check.can && role.appraiseCount > 0) {
        const round = room.game.rounds[room.game.currentRound - 1];
        const avail = round.artifacts.filter(a =>
          a.id !== round.lockedArtifactId &&
          !room.game.playerRoundStates[p.id][room.game.currentRound].appraisals.some(r => r.artifactId === a.id)
        );
        for (let i = 0; i < check.count && avail.length > 0; i++) {
          const idx = Math.floor(Math.random() * avail.length);
          const target = avail.splice(idx, 1)[0];
          engine.appraise(room, p.id, target.id);
          acted = true;
        }
      }
    }
    // AI 行动后不自动推进阶段（由房主确认），但如果全是 AI 则自动推进
    const hasHuman = room.players.some(p => !p.isAI && p.connected);
    if (!hasHuman) {
      engine.enterDiscussPhase(room);
    }
  } else if (phase === 'discuss') {
    const round = room.game.rounds[room.game.currentRound - 1];
    const currentId = round.speechOrder[round.currentSpeakerIndex];
    const current = room.players.find(p => p.id === currentId);
    if (current && current.isAI && !current.hasSpoken) {
      const speech = generateAISpeech(room, current);
      engine.playerSpeech(room, current.id, speech);
      if (engine.isDiscussDone(room)) {
        engine.enterVotePhase(room);
      }
    }
  } else if (phase === 'vote') {
    let acted = false;
    for (const p of room.players) {
      if (!p.isAI || p.betArtifactId !== undefined) continue;
      const round = room.game.rounds[room.game.currentRound - 1];
      const candidates = round.artifacts.slice();
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      engine.playerBet(room, p.id, target.id);
      acted = true;
    }
    if (acted && engine.isVoteDone(room)) {
      engine.resolveBets(room);
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
      lines.push(`我鉴定了【${art.name}】，依我看是${a.appearsReal ? '真品' : '赝品'}。`);
      lines.push(`各位注意，【${art.name}】的来路需细查。`);
      lines.push(`方才所见，【${art.name}】真伪难断，还需诸位印证。`);
    } else {
      lines.push('我这轮未能鉴宝，但听各位发言，似乎另有隐情。');
      lines.push('我观诸位神色，恐有老朝奉的人混迹其中。');
      lines.push('且慢下定论，鉴宝之事需从长计议。');
    }
    if (player.role === 'fangzhen' && player.fangzhenCheckResult) {
      const target = room.players.find((p: any) => p.id === player.fangzhenCheckTarget);
      lines.push(`我暗中查探，${target?.name} 的身份存疑，望诸位留意。`);
    }
  } else {
    const fakeLines = [
      '我鉴定了一件，看着像是真的，不过拿不准。',
      '这局兽首真假难辨，我劝诸位莫要轻信一面之词。',
      '依我看，某些人发言闪烁其词，恐有蹊跷。',
      '鉴宝需凭真本事，不可被旁人带了节奏。',
      '我倒是觉得，真品或许藏在我们意想不到之处。',
    ];
    lines.push(fakeLines[Math.floor(Math.random() * fakeLines.length)]);
  }
  return lines[Math.floor(Math.random() * lines.length)];
}
