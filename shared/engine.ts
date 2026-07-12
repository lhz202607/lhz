// ============================================================================
// 古董局中局·十二兽首 — 游戏规则引擎
// ============================================================================

import {
  Artifact, GameRound, GamePhase, GameState, Player, RoleId, Room,
  ROLES, ROLE_CONFIGS, REAL_COUNT, ZODIAC_NAMES, TARGET_SCORE, Faction,
  PlayerRoundState, AppraisalResult, ARTIFACTS_PER_ROUND,
} from './types';

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function generatePlayerId(): string {
  return 'p_' + Math.random().toString(36).slice(2, 10);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 生成全部 12 个兽首 */
export function generateAllArtifacts(): Artifact[] {
  const realFlags = shuffle([true, true, true, true, true, true, false, false, false, false, false, false]);
  return ZODIAC_NAMES.map((name, i) => ({ id: i, name, isReal: realFlags[i] }));
}

/** 从已用集合中选取 4 个新兽首（不重复），尽量保证 2 真 2 假 */
export function pickArtifactsForRound(allArtifacts: Artifact[], usedIds: Set<number>): Artifact[] {
  const available = allArtifacts.filter(a => !usedIds.has(a.id));
  const reals = shuffle(available.filter(a => a.isReal));
  const fakes = shuffle(available.filter(a => !a.isReal));
  const picked: Artifact[] = [];
  // 优先各取 2 个；真品或假品不足时由另一类补足至 4 个
  const needReals = Math.max(2, ARTIFACTS_PER_ROUND - fakes.length);
  const needFakes = ARTIFACTS_PER_ROUND - needReals;
  picked.push(...reals.slice(0, needReals), ...fakes.slice(0, needFakes));
  return shuffle(picked);
}

export function createInitialState(): GameState {
  return {
    phase: 'waiting', currentRound: 1, rounds: [],
    xuyuanScore: 0, targetScore: TARGET_SCORE,
    endLog: [], playerRoundStates: {},
    identifyVotes: {}, skipRoundsMap: {}, pendingSeals: {},
  };
}

export function createRoom(hostName: string, maxPlayers: number = 8): Room {
  const hostId = generatePlayerId();
  return {
    code: generateRoomCode(), maxPlayers,
    players: [{ id: hostId, name: hostName, isHost: true, isAI: false, connected: true, seatNumber: 1, betArtifactIds: [], remainingVotes: 0 }],
    game: createInitialState(),
    createdAt: Date.now(),
  };
}

export function createAIPlayer(name?: string): Player {
  const aiNames = ['AI·许衡', 'AI·黄克明', 'AI·药来', 'AI·姬天明', 'AI·木户三郎', 'AI·郑老'];
  return {
    id: generatePlayerId(), name: name || aiNames[Math.floor(Math.random() * aiNames.length)],
    isHost: false, isAI: true, connected: true, seatNumber: 0,
    betArtifactIds: [], remainingVotes: 0,
  };
}

/** 按当前玩家列表（房主+真人+AI，保持数组顺序）重新分配座位号 1,2,3... */
export function reindexSeats(room: Room): void {
  room.players.forEach((p, i) => { p.seatNumber = i + 1; });
}

/**
 * 落座阶段交换两个玩家的座位号（游戏开始前可用）。
 * 返回 { ok, error? }
 */
export function changeSeat(room: Room, playerId: string, targetId: string): { ok: boolean; error?: string } {
  if (room.game.phase !== 'waiting' && room.game.phase !== 'ended') {
    return { ok: false, error: '游戏已开始，座位已固定' };
  }
  if (playerId === targetId) return { ok: false, error: '不能与自己交换' };
  const a = room.players.find(p => p.id === playerId);
  const b = room.players.find(p => p.id === targetId);
  if (!a || !b) return { ok: false, error: '玩家不存在' };
  const tmp = a.seatNumber;
  a.seatNumber = b.seatNumber;
  b.seatNumber = tmp;
  return { ok: true };
}

/** 分配角色（随机、不重复） */
export function assignRoles(room: Room): void {
  const config = ROLE_CONFIGS[room.players.length];
  if (!config) throw new Error(`不支持 ${room.players.length} 人局`);
  const deck = shuffle([...new Set(config)]);
  room.players.forEach((p, i) => {
    p.role = deck[i];
    p.permanentlyDisabled = false;
    p.fangzhenCheckTarget = undefined; p.fangzhenCheckResult = undefined;
    p.yaoburanSealTarget = undefined; p.zhengguoquLockedArtifact = undefined;
    p.laochaofengUsedFlip = false;
    p.speech = undefined; p.hasSpoken = false;
    p.betArtifactIds = []; p.remainingVotes = 0;
    p.identifyTargetId = undefined;
  });
  room.game.playerRoundStates = {};
  room.game.xuyuanScore = 0;
  room.game.endLog = [];
  room.game.winner = undefined;
  room.game.identifyVotes = {};
  // 预先设定木户加奈/黄烟烟的跳过轮次（每人在1-3轮中随机一轮无法鉴宝）
  room.game.skipRoundsMap = {};
  room.players.forEach(p => {
    if (p.role === 'huangyanyan' || p.role === 'muhujianai') {
      room.game.skipRoundsMap[p.id] = 1 + Math.floor(Math.random() * 3);
    }
  });
}

/** 获取老朝奉阵营玩家可见的队友列表 */
export function getKnownAllies(room: Room, playerId: string): { playerId: string; playerName: string; roleId: RoleId }[] {
  const player = room.players.find(p => p.id === playerId);
  if (!player || !player.role) return [];
  if (player.role === 'laochaofeng' || player.role === 'yaoburan') {
    // 老朝奉和药不然互相可见
    return room.players
      .filter(p => p.id !== playerId && (p.role === 'laochaofeng' || p.role === 'yaoburan'))
      .map(p => ({ playerId: p.id, playerName: p.name, roleId: p.role! }));
  }
  // 郑国渠看不到队友，其他好人也不知道队友
  return [];
}

/** 开始新一轮 */
export function startRound(room: Room, roundNumber: number, allArtifacts: Artifact[], usedArtifactIds: Set<number>): void {
  const game = room.game;
  // 选取本轮 4 个兽首
  const artifacts = pickArtifactsForRound(allArtifacts, usedArtifactIds);
  artifacts.forEach(a => usedArtifactIds.add(a.id));

  const speechOrder = shuffle(room.players.map(p => p.id));

  // 行动顺序：上一轮【实际最后行动】的玩家自动成为本轮首位，其余随机
  let appraiseOrder: string[];
  const prevRound = game.rounds[roundNumber - 2]; // 上一轮（如果有）
  const prevActual = prevRound?.actualOrder && prevRound.actualOrder.length > 0
    ? prevRound.actualOrder
    : prevRound?.appraiseOrder;
  if (prevActual && prevActual.length > 0) {
    const lastAppraiser = prevActual[prevActual.length - 1];
    const others = shuffle(room.players.map(p => p.id).filter(id => id !== lastAppraiser));
    appraiseOrder = [lastAppraiser, ...others];
  } else {
    appraiseOrder = shuffle(room.players.map(p => p.id));
  }
  const firstAppraiser = appraiseOrder[0];

  const round: GameRound = {
    roundNumber, phase: 'appraise', speechOrder, currentSpeakerIndex: 0,
    artifacts, laochaofengUsedFlip: false, betCounts: {}, events: [],
    currentAppraiserId: firstAppraiser, appraiseOrder, finishedAppraisers: [],
    actualOrder: [firstAppraiser],
    yaoburanSealUsedThisRound: false,
  };

  game.rounds[roundNumber - 1] = round;
  game.currentRound = roundNumber;
  game.phase = 'appraise';

  room.players.forEach(p => {
    p.fangzhenCheckTarget = undefined; p.fangzhenCheckResult = undefined;
    p.yaoburanSealTarget = undefined; p.zhengguoquLockedArtifact = undefined;
    p.laochaofengUsedFlip = false;
    p.speech = undefined; p.hasSpoken = false;
    p.betArtifactIds = [];
    // 每轮重置为 2 票（加上上一轮未用完的）
    p.remainingVotes = (p.remainingVotes || 0) + 2;
    p.finishedVote = false;
  });

  room.players.forEach(p => {
    if (!game.playerRoundStates[p.id]) game.playerRoundStates[p.id] = {};
    const randomlyBlocked = game.skipRoundsMap?.[p.id] === roundNumber;
    // 应用上一轮药不然对前置位玩家的延迟封印（仅生效一轮）
    let sealed = false;
    if (game.pendingSeals[p.id] === roundNumber) {
      sealed = true;
      delete game.pendingSeals[p.id];
      // 若被延迟封印的是方震，下一轮许愿同时丧失鉴宝能力（连带效果，不显示被直接封印）
      if (p.role === 'fangzhen') {
        const xuyuan = room.players.find(x => x.role === 'xuyuan');
        if (xuyuan && game.playerRoundStates[xuyuan.id]?.[roundNumber]) {
          game.playerRoundStates[xuyuan.id][roundNumber].fangzhenSealPenalty = true;
        }
      }
    }
    game.playerRoundStates[p.id][roundNumber] = { sealed, randomlyBlocked, appraisals: [] };
  });
}

export function canAppraise(room: Room, playerId: string): { can: boolean; reason?: string; count: number } {
  const player = room.players.find(p => p.id === playerId);
  if (!player || !player.role) return { can: false, reason: '未分配角色', count: 0 };
  const role = ROLES[player.role];
  if (player.permanentlyDisabled) return { can: false, reason: '已被永久封印', count: 0 };
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return { can: false, reason: '当前无进行中的轮次', count: 0 };
  const rs = room.game.playerRoundStates[playerId]?.[room.game.currentRound];
  if (!rs) return { can: false, reason: '状态未初始化', count: 0 };
  // 封印 / 心神不宁优先判定：即便该角色本就不鉴宝（如方震预言家），被封印也应
  // "轮到自己"手动结束回合，而不能被当作"角色无法鉴宝"而自动跳过。
  if (rs.sealed) return { can: false, reason: '本轮已被封印', count: 0 };
  if (rs.randomlyBlocked) return { can: false, reason: '本轮心神不宁', count: 0 };
  if (rs.fangzhenSealPenalty) return { can: false, reason: '同伴被封印而丧失鉴宝能力', count: 0 };
  if (role.appraiseCount === 0) return { can: false, reason: '该角色无法鉴宝', count: 0 };
  const done = rs.appraisals.length;
  const remaining = role.appraiseCount - done;
  if (remaining <= 0) return { can: false, reason: '次数已用完', count: 0 };
  return { can: true, count: remaining };
}

export function appraise(room: Room, playerId: string, artifactId: number): AppraisalResult | { error: string } {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: '玩家不存在' };
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return { error: '当前无进行中的轮次' };
  if (round.currentAppraiserId && round.currentAppraiserId !== playerId) return { error: '当前不是你的鉴宝回合' };
  const check = canAppraise(room, playerId);
  if (!check.can) return { error: check.reason || '无法鉴宝' };
  const artifact = round.artifacts.find(a => a.id === artifactId);
  if (!artifact) return { error: '兽首不存在' };
  if (round.lockedArtifactId === artifactId) return { error: '此兽首鉴定结果已被隐藏' };
  const rs = room.game.playerRoundStates[playerId][room.game.currentRound];
  let appearsReal = artifact.isReal;
  const role = ROLES[player.role!];
  if (role.id !== 'jiyunfu' && round.laochaofengUsedFlip) appearsReal = !appearsReal;
  if (role.faction === 'laochaofeng') appearsReal = artifact.isReal;
  const result: AppraisalResult = { artifactId, appearsReal };
  rs.appraisals.push(result);
  return result;
}

export function passAppraiseTurn(room: Room, playerId: string, nextPlayerId: string): { ok: boolean; error?: string } {
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return { ok: false, error: '当前无进行中的轮次' };
  if (room.game.phase !== 'appraise') return { ok: false, error: '当前非鉴宝阶段' };
  if (round.currentAppraiserId !== playerId) return { ok: false, error: '当前不是你的鉴宝回合' };
  if (playerId === nextPlayerId) return { ok: false, error: '不能指定自己' };
  if (round.finishedAppraisers.includes(nextPlayerId)) return { ok: false, error: '该玩家已完成鉴宝' };
  const nextPlayer = room.players.find(p => p.id === nextPlayerId);
  if (!nextPlayer) return { ok: false, error: '目标玩家不存在' };
  if (!round.finishedAppraisers.includes(playerId)) round.finishedAppraisers.push(playerId);
  const nextCheck = canAppraise(room, nextPlayerId);
  // 被封印或随机无法鉴宝的玩家仍需"轮到自己"，手动点击结束回合（不自动跳过）
  if (!nextCheck.can && (nextCheck.reason === '本轮已被封印' || nextCheck.reason === '本轮心神不宁')) {
    round.currentAppraiserId = nextPlayerId;
    pushActual(round, nextPlayerId);
    return { ok: true };
  }
  // 其余强制无法鉴宝的情况（如次数用尽前的角色）才自动跳过
  if (!nextCheck.can) {
    if (!round.finishedAppraisers.includes(nextPlayerId)) round.finishedAppraisers.push(nextPlayerId);
    pushActual(round, nextPlayerId);
    const remaining = round.appraiseOrder.find(id => !round.finishedAppraisers.includes(id) && canAppraise(room, id).can);
    if (remaining) { round.currentAppraiserId = remaining; pushActual(round, remaining); return { ok: true }; }
    const anyLeft = round.appraiseOrder.find(id => !round.finishedAppraisers.includes(id) && canAppraise(room, id).can);
    if (!anyLeft) {
      round.appraiseOrder.forEach(id => { if (!round.finishedAppraisers.includes(id)) { round.finishedAppraisers.push(id); pushActual(round, id); } });
      round.currentAppraiserId = undefined;
      enterDiscussPhase(room);
      round.events.push('全员鉴宝完毕，进入发言环节。');
    }
    return { ok: true };
  }
  round.currentAppraiserId = nextPlayerId;
  pushActual(round, nextPlayerId);
  return { ok: true };
}

/** 记录实际发生鉴宝行动的玩家（按发生先后，去重保留首次） */
function pushActual(round: GameRound, playerId: string): void {
  if (!round.actualOrder) round.actualOrder = [];
  if (!round.actualOrder.includes(playerId)) round.actualOrder.push(playerId);
}

export function isAppraiseDone(room: Room): boolean {
  const round = room.game.rounds[room.game.currentRound - 1];
  return round ? round.finishedAppraisers.length >= room.players.length : false;
}

export function laochaofengUseFlip(room: Room, playerId: string, use: boolean): { ok: boolean; error?: string } {
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.role !== 'laochaofeng') return { ok: false, error: '只有老朝奉可使用此技能' };
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return { ok: false, error: '当前无进行中的轮次' };
  if (room.game.phase !== 'appraise') return { ok: false, error: '仅鉴宝阶段可使用' };
  round.laochaofengUsedFlip = use;
  player.laochaofengUsedFlip = use;
  return { ok: true };
}

export function yaoburanSeal(room: Room, playerId: string, targetId: string): { ok: boolean; delayed?: boolean; error?: string } {
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.role !== 'yaoburan') return { ok: false, error: '只有药不然可使用此技能' };
  if (playerId === targetId) return { ok: false, error: '不能封印自己' };
  const target = room.players.find(p => p.id === targetId);
  if (!target) return { ok: false, error: '目标不存在' };
  if (room.game.phase !== 'appraise') return { ok: false, error: '仅鉴宝阶段可使用' };
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return { ok: false, error: '当前无进行中的轮次' };
  const rs = room.game.playerRoundStates[targetId]?.[room.game.currentRound];
  if (!rs) return { ok: false, error: '目标状态未初始化' };
  // 每轮仅可偷袭一次
  if (round.yaoburanSealUsedThisRound) return { ok: false, error: '本轮已偷袭过一次' };
  player.yaoburanSealTarget = targetId;

  // 判断目标是否为药不然的「前置位」玩家（行动顺序中排在药不然之前）
  const order = room.game.rounds[room.game.currentRound - 1]?.appraiseOrder || [];
  const ybrPos = order.indexOf(playerId);
  const targetPos = order.indexOf(targetId);
  const isPredecessor = ybrPos >= 0 && targetPos >= 0 && targetPos < ybrPos;

  if (isPredecessor) {
    // 前置位：延迟到下一轮生效，本轮照常鉴宝
    room.game.pendingSeals[targetId] = room.game.currentRound + 1;
    const tname = target.name;
    // 机密信息：仅药不然本人可见
    round.secretEvents = round.secretEvents || [];
    round.secretEvents.push(`你偷袭了${tname}（前置位），封印将于下一轮生效。`);
    round.yaoburanSealUsedThisRound = true;
    return { ok: true, delayed: true };
  } else {
    // 非前置位：本轮立即生效
    rs.sealed = true;
    if (target.role === 'jiyunfu') target.permanentlyDisabled = true;
    // 方震（预言家）被封印：连带使许愿本轮丧失鉴宝能力
    if (target.role === 'fangzhen') {
      const xuyuan = room.players.find(x => x.role === 'xuyuan');
      if (xuyuan) {
        const xrs = room.game.playerRoundStates[xuyuan.id]?.[room.game.currentRound];
        if (xrs) xrs.fangzhenSealPenalty = true;
      }
    }
    // 机密信息：仅药不然本人可见（不向其他玩家及老朝奉泄露偷袭目标）
    round.secretEvents = round.secretEvents || [];
    round.secretEvents.push(`你偷袭了${target.name}（后置位），其本轮被封印，下位行动受限。`);
  }
  round.yaoburanSealUsedThisRound = true;
  return { ok: true };
}

export function zhengguoquLock(room: Room, playerId: string, artifactId: number): { ok: boolean; error?: string } {
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.role !== 'zhengguoqu') return { ok: false, error: '只有郑国渠可使用此技能' };
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return { ok: false, error: '当前无进行中的轮次' };
  if (room.game.phase !== 'appraise') return { ok: false, error: '仅鉴宝阶段可使用' };
  const artifact = round.artifacts.find(a => a.id === artifactId);
  if (!artifact) return { ok: false, error: '兽首不存在' };
  round.lockedArtifactId = artifactId;
  player.zhengguoquLockedArtifact = artifactId;
  return { ok: true };
}

export function fangzhenCheck(room: Room, playerId: string, targetId: string): { ok: boolean; faction?: Faction; error?: string } {
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.role !== 'fangzhen') return { ok: false, error: '只有方震可使用此技能' };
  if (playerId === targetId) return { ok: false, error: '不能查验自己' };
  const target = room.players.find(p => p.id === targetId);
  if (!target || !target.role) return { ok: false, error: '目标无效' };
  if (room.game.phase !== 'appraise') return { ok: false, error: '仅鉴宝阶段可使用' };
  const faction = ROLES[target.role].faction;
  player.fangzhenCheckTarget = targetId;
  player.fangzhenCheckResult = faction;
  return { ok: true, faction };
}

export function enterDiscussPhase(room: Room): void {
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return;
  round.phase = 'discuss';
  room.game.phase = 'discuss';
  round.currentSpeakerIndex = 0;
}

export function playerSpeech(room: Room, playerId: string, content: string): { ok: boolean; error?: string } {
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round || round.phase !== 'discuss') return { ok: false, error: '当前非发言阶段' };
  const currentSpeakerId = round.speechOrder[round.currentSpeakerIndex];
  if (playerId !== currentSpeakerId) return { ok: false, error: '未轮到你发言' };
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { ok: false, error: '玩家不存在' };
  player.speech = content;
  player.hasSpoken = true;
  round.currentSpeakerIndex++;
  return { ok: true };
}

export function isDiscussDone(room: Room): boolean {
  const round = room.game.rounds[room.game.currentRound - 1];
  return round ? round.currentSpeakerIndex >= round.speechOrder.length : false;
}

export function enterVotePhase(room: Room): void {
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return;
  round.phase = 'vote';
  room.game.phase = 'vote';
  round.betCounts = {};
  room.players.forEach(p => { p.betArtifactIds = []; p.finishedVote = false; });
}

/** 玩家押币（支持多票，可投同一兽首） */
export function playerBet(room: Room, playerId: string, artifactId: number): { ok: boolean; error?: string } {
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round || round.phase !== 'vote') return { ok: false, error: '当前非押币阶段' };
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { ok: false, error: '玩家不存在' };
  if (player.remainingVotes <= 0) return { ok: false, error: '本轮投票次数已用完' };
  const artifact = round.artifacts.find(a => a.id === artifactId);
  if (!artifact) return { ok: false, error: '兽首不存在' };
  player.betArtifactIds.push(artifactId);
  player.remainingVotes--;
  round.betCounts[artifactId] = (round.betCounts[artifactId] || 0) + 1;
  return { ok: true };
}

/** 玩家手动结束投票（未用完的票顺延至下一轮） */
export function finishVoteForPlayer(room: Room, playerId: string): { ok: boolean; error?: string } {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { ok: false, error: '玩家不存在' };
  if (room.game.phase !== 'vote') return { ok: false, error: '当前非押币阶段' };
  player.finishedVote = true;
  return { ok: true };
}

export function isVoteDone(room: Room): boolean {
  return room.players.every(p => p.remainingVotes <= 0 || p.finishedVote || p.isAI);
}

export function resolveBets(room: Room): void {
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return;
  round.phase = 'reveal';
  room.game.phase = 'reveal';

  // 以本轮全部 4 个兽首为基准统计票数（未获投票的兽首记为 0 票）
  const entries = round.artifacts.map(a => ({ artifactId: a.id, count: round.betCounts[a.id] || 0 }));

  const noVotes = entries.every(e => e.count === 0);
  if (noVotes) round.events.push('本轮无人押币，按十二生肖顺序揭示。');

  // 统一排序：票数降序，票数相同时按生肖 ID 升序（鼠→猪）
  // 全 0 票（极端情况）也按此规则：隐藏生肖序第一，揭示生肖序第二
  entries.sort((a, b) => b.count - a.count || a.artifactId - b.artifactId);

  // 第1名：隐藏
  const hiddenId = entries[0].artifactId;
  round.hiddenArtifactId = hiddenId;
  const hiddenArtifact = round.artifacts.find(a => a.id === hiddenId)!;
  round.hiddenArtifactName = hiddenArtifact.name;
  round.events.push(`【${hiddenArtifact.name}】票数排名第一（${entries[0].count}票），已被隐藏。`);

  // 第2名：揭示真假（票数第二多；并列时按生肖顺序取靠前者）
  let roundScore = 0;
  const revealedId = entries[1].artifactId;
  round.revealedArtifactId = revealedId;
  const revealedArtifact = round.artifacts.find(a => a.id === revealedId)!;
  const revealedIsReal = revealedArtifact.isReal;
  round.revealedArtifactName = revealedArtifact.name;
  round.revealedIsReal = revealedIsReal;
  round.events.push(`【${revealedArtifact.name}】票数排名第二（${entries[1].count}票），予以揭露——${revealedIsReal ? '真品！' : '赝品。'}`);
  if (revealedIsReal) {
    room.game.xuyuanScore += 1;
    roundScore = 1;
    round.events.push('揭露真品，许愿阵营 +1 分。');
  }
  round.roundScore = roundScore;

  // 记录每位玩家投票明细，供前端展示
  round.playerVotes = {};
  for (const p of room.players) {
    round.playerVotes[p.id] = [...(p.betArtifactIds || [])];
  }
}

export function nextRoundOrEnd(room: Room, allArtifacts: Artifact[], usedArtifactIds: Set<number>): void {
  if (room.game.currentRound >= 3) {
    enterIdentifyPhase(room);
    return;
  }
  startRound(room, room.game.currentRound + 1, allArtifacts, usedArtifactIds);
}

// ============================================================================
// 鉴人环节
// ============================================================================

export function enterIdentifyPhase(room: Room): void {
  room.game.phase = 'identify';
  room.game.identifyVotes = {};
  room.players.forEach(p => { p.identifyTargetId = undefined; });
}

/** 鉴人环节投票 */
export function identifyVote(room: Room, playerId: string, targetId: string): { ok: boolean; error?: string } {
  if (room.game.phase !== 'identify') return { ok: false, error: '当前非鉴人阶段' };
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { ok: false, error: '玩家不存在' };
  const target = room.players.find(p => p.id === targetId);
  if (!target) return { ok: false, error: '目标不存在' };
  // 不能投自己
  if (playerId === targetId) return { ok: false, error: '不能指认自己' };
  const myFaction = ROLES[player.role!].faction;
  const targetFaction = ROLES[target.role!].faction;
  // 老朝奉阵营（老朝奉、药不然）不能指认自己阵营的人；郑国渠不知道队友，可随便投
  if (myFaction === 'laochaofeng' && targetFaction === 'laochaofeng') {
    return { ok: false, error: '不能指认自己阵营的同伴' };
  }
  player.identifyTargetId = targetId;
  room.game.identifyVotes[playerId] = targetId;
  return { ok: true };
}

export function isIdentifyDone(room: Room): boolean {
  // 郑国渠不参与终局指认
  return room.players
    .filter(p => p.role && p.role !== 'zhengguoqu')
    .every(p => p.identifyTargetId !== undefined);
}

export function resolveIdentify(room: Room): void {
  const game = room.game;
  const log: string[] = [];
  log.push('—— 鉴人环节 ——');

  // 统计许愿阵营（好人）对老朝奉的指认
  const xuyuanVotes = room.players
    .filter(p => p.role && ROLES[p.role].faction === 'xuyuan')
    .map(p => game.identifyVotes[p.id])
    .filter(Boolean);
  const laochaofengId = room.players.find(p => p.role === 'laochaofeng')?.id;
  const xuyuanId = room.players.find(p => p.role === 'xuyuan')?.id;
  const fangzhenId = room.players.find(p => p.role === 'fangzhen')?.id;
  const yaoburanId = room.players.find(p => p.role === 'yaoburan')?.id;

  // 1. 许愿阵营指认老朝奉
  if (laochaofengId) {
    const correctVotes = xuyuanVotes.filter(v => v === laochaofengId);
    // 多数决：超过半数好人指认正确则成功
    const xuyuanPlayers = room.players.filter(p => p.role && ROLES[p.role].faction === 'xuyuan');
    if (correctVotes.length >= Math.ceil(xuyuanPlayers.length / 2)) {
      game.xuyuanScore += 1;
      log.push(`许愿阵营成功指认老朝奉！许愿阵营 +1 分。`);
    } else {
      log.push(`许愿阵营未能指认出老朝奉。`);
    }
  }

  // 2. 老朝奉指认许愿
  if (laochaofengId && xuyuanId) {
    const lcfVote = game.identifyVotes[laochaofengId];
    if (lcfVote === xuyuanId) {
      log.push(`老朝奉成功指认许愿！但这对胜负无直接影响。`);
    } else {
      game.xuyuanScore += 2;
      log.push(`老朝奉未指认出许愿！许愿阵营 +2 分。`);
    }
  }

  // 3. 药不然指认方震
  if (yaoburanId && fangzhenId) {
    const ybrVote = game.identifyVotes[yaoburanId];
    if (ybrVote === fangzhenId) {
      log.push(`药不然成功指认方震！但这对胜负无直接影响。`);
    } else {
      game.xuyuanScore += 1;
      log.push(`药不然未指认出方震！许愿阵营 +1 分。`);
    }
  }

  log.push(`许愿阵营最终得分：${game.xuyuanScore} / ${game.targetScore}`);

  // 公布每位玩家指认票型
  log.push('—— 指认票型 ——');
  for (const p of room.players) {
    if (p.role === 'zhengguoqu') {
      log.push(`VOTE:${p.id}:${p.name}:不参与`);
      continue;
    }
    const targetId = game.identifyVotes[p.id];
    const targetName = targetId ? room.players.find(t => t.id === targetId)?.name || '未知' : '未投票';
    log.push(`VOTE:${p.id}:${p.name}:${targetName}`);
  }

  if (game.xuyuanScore >= game.targetScore) {
    game.winner = 'xuyuan';
    log.push('许愿阵营达到目标分数，赢得本局！');
  } else {
    game.winner = 'laochaofeng';
    log.push('许愿阵营未达目标分数，老朝奉阵营赢得本局！');
  }

  game.endLog = log;
  game.phase = 'ended';
}

/** 兼容旧调用 */
export function endGame(room: Room): void {
  enterIdentifyPhase(room);
}
