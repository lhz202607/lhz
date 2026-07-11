// ============================================================================
// 游戏联机客户端 — HTTP 轮询架构（无 WebSocket）
// ============================================================================

import { useSyncExternalStore } from 'react';
import apiClient from '@/lib/api-client';
import { ClientMessage, PublicRoom, RoleId, AppraisalResult, Faction } from '@/shared/types';

interface GameState {
  room: PublicRoom | null;
  me: { id: string; name: string; isHost: boolean; isAI: boolean; connected: boolean } | null;
  myRole: RoleId | null;
  myAppraisals: any;
  fangzhenResults: { round: number; targetId: string; targetName: string; faction: Faction }[];
  sealedRounds: number[];
  error: string | null;
  connected: boolean;
}

let state: GameState = {
  room: null,
  me: null,
  myRole: null,
  myAppraisals: {},
  fangzhenResults: [],
  sealedRounds: [],
  error: null,
  connected: false,
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
  fangzhenResults: { round: number; targetId: string; targetName: string; faction: Faction }[];
  sealedRounds: number[];
}

function applyHeartbeat(data: HeartbeatResponse): void {
  const me = data.room.players.find(p => p.id === playerId) || null;
  setState({
    room: data.room,
    me,
    myRole: data.myRole,
    myAppraisals: data.myAppraisals,
    fangzhenResults: data.fangzhenResults,
    sealedRounds: data.sealedRounds,
    connected: true,
    error: null,
  });
}

async function poll(): Promise<void> {
  if (!roomCode || !playerId) return;
  try {
    const res = await apiClient.post(`/game/rooms/${roomCode}/heartbeat`, { playerId });
    applyHeartbeat(res.data);
  } catch (e) {
    // 静默失败，保持上次状态
  }
}

function startPolling(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, 1500);
}

function stopPolling(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

/** 连接房间（HTTP）：加入或重连 */
export async function connectGame(code: string, name: string, pid?: string): Promise<void> {
  roomCode = code.toUpperCase();
  setState({
    room: null, me: null, myRole: null, myAppraisals: {},
    fangzhenResults: [], sealedRounds: [], error: null, connected: false,
  });
  emit();

  try {
    const res = await apiClient.post(`/game/rooms/${roomCode}/join`, { name, pid });
    playerId = res.data.playerId;
    applyHeartbeat({
      room: res.data.room,
      myRole: res.data.myRole || null,
      myAppraisals: res.data.myAppraisals || {},
      fangzhenResults: res.data.fangzhenResults || [],
      sealedRounds: res.data.sealedRounds || [],
    });
    startPolling();
  } catch (e: any) {
    setState({ error: e.response?.data?.error || '连接房间失败' });
    throw e;
  }
}

/** 发送行动 */
export async function send(msg: ClientMessage): Promise<void> {
  if (!roomCode || !playerId) return;
  try {
    const res = await apiClient.post(`/game/rooms/${roomCode}/action`, { playerId, action: msg });
    applyHeartbeat({
      room: res.data.room,
      myRole: res.data.myRole || null,
      myAppraisals: res.data.myAppraisals || {},
      fangzhenResults: res.data.fangzhenResults || [],
      sealedRounds: res.data.sealedRounds || [],
    });
  } catch (e: any) {
    const errMsg = e.response?.data?.error || '操作失败';
    setState({ error: errMsg });
    setTimeout(() => {
      setState({ error: state.error === errMsg ? null : state.error });
    }, 3000);
  }
}

/** 添加 AI（专用接口） */
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

/** 断开连接 */
export function disconnectGame(): void {
  if (roomCode && playerId) {
    apiClient.post(`/game/rooms/${roomCode}/leave`, { playerId }).catch(() => {});
  }
  stopPolling();
  playerId = null;
  roomCode = null;
  state = {
    room: null, me: null, myRole: null, myAppraisals: {},
    fangzhenResults: [], sealedRounds: [], error: null, connected: false,
  };
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): GameState {
  return state;
}

export function useGameState(): GameState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
