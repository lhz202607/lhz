// ============================================================================
// 游戏联机客户端 — HTTP 轮询架构
// ============================================================================

import { useSyncExternalStore } from 'react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import { ClientMessage, PublicRoom, RoleId, AppraisalResult, Faction } from '@/shared/types';

interface GameState {
  room: PublicRoom | null;
  me: { id: string; name: string; isHost: boolean; isAI: boolean; connected: boolean } | null;
  myRole: RoleId | null;
  myAppraisals: any;
  skillHistory: Record<number, any>;
  fangzhenResults: { round: number; targetId: string; targetName: string; faction: Faction }[];
  sealedRounds: number[];
  randomlyBlockedRounds: number[];
  fangzhenSealPenaltyRounds: number[];
  knownAllies: { playerId: string; playerName: string; roleId: RoleId }[];
  remainingVotes: number;
  error: string | null;
  connected: boolean;
}

let state: GameState = {
  room: null, me: null, myRole: null, myAppraisals: {}, skillHistory: {},
  fangzhenResults: [], sealedRounds: [], randomlyBlockedRounds: [], fangzhenSealPenaltyRounds: [], knownAllies: [], remainingVotes: 0,
  error: null, connected: false,
};

let playerId: string | null = null;
let roomCode: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

const listeners = new Set<() => void>();
function emit() { listeners.forEach(l => l()); }
function setState(patch: Partial<GameState>) {
  state = { ...state, ...patch };
  emit();
}

interface HeartbeatResponse {
  room: PublicRoom;
  myRole: RoleId | null;
  myAppraisals: Record<number, AppraisalResult[]>;
  skillHistory: Record<number, any>;
  fangzhenResults: { round: number; targetId: string; targetName: string; faction: Faction }[];
  sealedRounds: number[];
  randomlyBlockedRounds: number[];
  fangzhenSealPenaltyRounds?: number[];
  knownAllies?: { playerId: string; playerName: string; roleId: RoleId }[];
  remainingVotes?: number;
}

function applyHeartbeat(data: HeartbeatResponse): void {
  const me = data.room.players.find(p => p.id === playerId) || null;
  setState({
    room: data.room, me,
    myRole: data.myRole,
    myAppraisals: data.myAppraisals,
    skillHistory: data.skillHistory || {},
    fangzhenResults: data.fangzhenResults,
    sealedRounds: data.sealedRounds,
    randomlyBlockedRounds: data.randomlyBlockedRounds || [],
    fangzhenSealPenaltyRounds: data.fangzhenSealPenaltyRounds || [],
    knownAllies: data.knownAllies || [],
    remainingVotes: data.remainingVotes || 0,
    connected: true, error: null,
  });
}

async function poll(): Promise<void> {
  if (!roomCode || !playerId) return;
  try {
    const res = await apiClient.post(`/game/rooms/${roomCode}/heartbeat`, { playerId });
    applyHeartbeat(res.data);
    // 动态调整轮询频率：等待阶段 500ms，游戏中 1000ms
    const phase = res.data.room?.game?.phase;
    const targetInterval = phase === 'waiting' ? 500 : 1000;
    if (pollTimer && currentInterval !== targetInterval) {
      clearInterval(pollTimer);
      currentInterval = targetInterval;
      pollTimer = setInterval(poll, targetInterval);
    }
  } catch (e) { /* 静默失败 */ }
}

let currentInterval = 1000;

function startPolling(): void {
  if (pollTimer) clearInterval(pollTimer);
  currentInterval = 1000;
  pollTimer = setInterval(poll, currentInterval);
}

function stopPolling(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

export async function connectGame(code: string, name: string, pid?: string): Promise<void> {
  roomCode = code.toUpperCase();
  setState({
    room: null, me: null, myRole: null, myAppraisals: {}, skillHistory: {},
    fangzhenResults: [], sealedRounds: [], fangzhenSealPenaltyRounds: [], knownAllies: [], remainingVotes: 0,
    error: null, connected: false,
  });
  emit();

  try {
    const res = await apiClient.post(`/game/rooms/${roomCode}/join`, { name, pid });
    playerId = res.data.playerId;
    applyHeartbeat({
      room: res.data.room, myRole: res.data.myRole || null,
      myAppraisals: res.data.myAppraisals || {},
      skillHistory: res.data.skillHistory || {},
      fangzhenResults: res.data.fangzhenResults || [],
      sealedRounds: res.data.sealedRounds || [],
      randomlyBlockedRounds: res.data.randomlyBlockedRounds || [],
      knownAllies: res.data.knownAllies || [],
      remainingVotes: res.data.remainingVotes || 0,
    });
    startPolling();
  } catch (e: any) {
    setState({ error: e.response?.data?.error || '连接房间失败' });
    throw e;
  }
}

export async function send(msg: ClientMessage): Promise<void> {
  if (!roomCode || !playerId) return;
  try {
    const res = await apiClient.post(`/game/rooms/${roomCode}/action`, { playerId, action: msg });
    applyHeartbeat({
      room: res.data.room, myRole: res.data.myRole || null,
      myAppraisals: res.data.myAppraisals || {},
      skillHistory: res.data.skillHistory || {},
      fangzhenResults: res.data.fangzhenResults || [],
      sealedRounds: res.data.sealedRounds || [],
      randomlyBlockedRounds: res.data.randomlyBlockedRounds || [],
      knownAllies: res.data.knownAllies || [],
      remainingVotes: res.data.remainingVotes || 0,
    });
  } catch (e: any) {
    const errMsg = e.response?.data?.error || '操作失败';
    toast.error(errMsg);
  }
}

export async function addAI(): Promise<void> {
  if (!roomCode || !playerId) return;
  try {
    const res = await apiClient.post(`/game/rooms/${roomCode}/addAI`, { playerId });
    if (res.data.room) {
      const me = res.data.room.players.find((p: any) => p.id === playerId) || null;
      setState({ room: res.data.room, me });
    }
  } catch (e: any) {
    setState({ error: e.response?.data?.error || '添加失败' });
  }
}

export function disconnectGame(): void {
  if (roomCode && playerId) {
    apiClient.post(`/game/rooms/${roomCode}/leave`, { playerId }).catch(() => {});
  }
  stopPolling();
  playerId = null; roomCode = null;
  state = {
    room: null, me: null, myRole: null, myAppraisals: [], skillHistory: {},
    fangzhenResults: [], sealedRounds: [], randomlyBlockedRounds: [], fangzhenSealPenaltyRounds: [], knownAllies: [], remainingVotes: 0,
    error: null, connected: false,
  };
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): GameState { return state; }

export function useGameState(): GameState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
