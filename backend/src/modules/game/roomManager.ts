// ============================================================================
// 房间管理器 — 管理所有房间状态
// ============================================================================

import { Room, Player, PublicRoom, PublicPlayer, RoleId } from '../../../shared/types';
import * as engine from '../../../shared/engine';

class RoomManager {
  private rooms = new Map<string, Room>();
  private roomAllArtifacts = new Map<string, any[]>();
  private roomUsedIds = new Map<string, Set<number>>();

  createRoom(hostName: string, maxPlayers: number = 8): Room {
    let room = engine.createRoom(hostName, maxPlayers);
    while (this.rooms.has(room.code)) {
      room = engine.createRoom(hostName, maxPlayers);
    }
    this.rooms.set(room.code, room);
    // 为房间预生成全部 12 个兽首
    this.roomAllArtifacts.set(room.code, engine.generateAllArtifacts());
    this.roomUsedIds.set(room.code, new Set());
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  removeRoom(code: string): void {
    this.rooms.delete(code);
    this.roomAllArtifacts.delete(code);
    this.roomUsedIds.delete(code);
  }

  getAllArtifacts(code: string): any[] {
    return this.roomAllArtifacts.get(code) || engine.generateAllArtifacts();
  }

  getUsedIds(code: string): Set<number> {
    return this.roomUsedIds.get(code) || new Set();
  }

  addAI(code: string): { ok: boolean; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { ok: false, error: '房间不存在' };
    if (room.game.phase !== 'waiting') return { ok: false, error: '游戏已开始' };
    if (room.players.length >= room.maxPlayers) return { ok: false, error: '房间已满' };
    const ai = engine.createAIPlayer();
    room.players.push(ai);
    return { ok: true };
  }

  removePlayer(code: string, playerId: string): { ok: boolean; error?: string } {
    const room = this.getRoom(code);
    if (!room) return { ok: false, error: '房间不存在' };
    const player = room.players.find(p => p.id === playerId);
    if (!player) return { ok: false, error: '玩家不存在' };
    if (player.isHost) return { ok: false, error: '不能踢出房主' };
    room.players = room.players.filter(p => p.id !== playerId);
    return { ok: true };
  }

  markDisconnected(code: string, playerId: string): void {
    const room = this.getRoom(code);
    if (!room) return;
    const player = room.players.find(p => p.id === playerId);
    if (player && !player.isAI) player.connected = false;
    const hasReal = room.players.some(p => !p.isAI && p.connected);
    if (!hasReal && room.game.phase === 'waiting') {
      setTimeout(() => {
        const r = this.getRoom(code);
        if (r && !r.players.some(p => !p.isAI && p.connected) && r.game.phase === 'waiting') {
          this.removeRoom(code);
        }
      }, 10000);
    }
  }

  toPublicRoom(room: Room, viewerId?: string): PublicRoom {
    const round = room.game.rounds[room.game.currentRound - 1];
    const isReveal = room.game.phase === 'reveal' || room.game.phase === 'ended';
    const isIdentify = room.game.phase === 'identify';

    const players: PublicPlayer[] = room.players.map(p => {
      const rs = room.game.playerRoundStates[p.id]?.[room.game.currentRound];
      return {
        id: p.id, name: p.name, isHost: p.isHost, isAI: p.isAI, connected: p.connected,
        hasSpoken: p.hasSpoken,
        betArtifactIds: (room.game.phase === 'vote' || room.game.phase === 'reveal' || room.game.phase === 'ended') ? p.betArtifactIds : undefined,
        visiblySealed: rs?.sealed,
        role: (room.game.phase === 'ended' || isIdentify) ? p.role : undefined,
        identifyTargetId: isIdentify ? p.identifyTargetId : undefined,
      };
    });

    let artifacts: { id: number; name: any; locked?: boolean }[] = [];
    let revealedArtifacts: { id: number; name: any; isReal?: boolean; betCount: number; hidden: boolean }[] = [];
    let speechOrder: string[] = [];
    let currentSpeakerIndex = 0;
    let speeches: Record<string, string> = {};
    let events: string[] = [];
    let flipUsedThisRound = false;
    let appraiseOrder: string[] = [];

    if (round) {
      flipUsedThisRound = round.laochaofengUsedFlip;
      artifacts = round.artifacts.map(a => ({ id: a.id, name: a.name, locked: round.lockedArtifactId === a.id }));
      speechOrder = round.speechOrder;
      currentSpeakerIndex = round.currentSpeakerIndex;
      events = round.events;
      appraiseOrder = round.appraiseOrder;
      room.players.forEach(p => { if (p.speech) speeches[p.id] = p.speech; });

      if (isReveal) {
        revealedArtifacts = round.artifacts.map(a => {
          const betCount = round.betCounts[a.id] || 0;
          const hidden = round.hiddenArtifactId === a.id;
          const revealed = round.revealedArtifactId === a.id;
          return { id: a.id, name: a.name, isReal: (revealed || room.game.phase === 'ended') ? a.isReal : undefined, betCount, hidden };
        });
      }
    }

    return {
      code: room.code, players, maxPlayers: room.maxPlayers,
      game: {
        phase: room.game.phase, currentRound: room.game.currentRound,
        xuyuanScore: room.game.xuyuanScore, targetScore: room.game.targetScore,
        winner: room.game.winner, endLog: room.game.endLog,
        artifacts, revealedArtifacts,
        speechOrder, currentSpeakerIndex, speeches, events,
        flipUsedThisRound,
        currentAppraiserId: round?.currentAppraiserId,
        finishedAppraisers: round?.finishedAppraisers || [],
        appraiseOrder,
        identifyVotes: room.game.identifyVotes || {},
      },
    };
  }
}

export const roomManager = new RoomManager();
