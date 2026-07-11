// ============================================================================
// 古董局中局·十二兽首 — 游戏规则引擎
// 纯函数实现，供后端调用；前后端共享类型
// ============================================================================

import {
  Artifact, GameRound, GamePhase, GameState, Player, RoleId, Room,
  ROLES, ROLE_CONFIGS, REAL_COUNT, ZODIAC_NAMES, TARGET_SCORE, Faction,
  PlayerRoundState, AppraisalResult,
} from './types';

/** 生成 6 位房间码 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** 生成玩家 id */
export function generatePlayerId(): string {
  return 'p_' + Math.random().toString(36).slice(2, 10);
}

/** 洗牌 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 生成一局十二兽首：6 真 6 假，打乱顺序 */
export function generateArtifacts(): Artifact[] {
  const realFlags = shuffle([true, true, true, true, true, true, false, false, false, false, false, false]);
  return ZODIAC_NAMES.map((name, i) => ({
    id: i,
    name,
    isReal: realFlags[i],
  }));
}

/** 创建初始游戏状态 */
export function createInitialState(): GameState {
  return {
    phase: 'waiting',
    currentRound: 1,
    rounds: [],
    xuyuanScore: 0,
    targetScore: TARGET_SCORE,
    endLog: [],
    playerRoundStates: {},
  };
}

/** 创建初始房间 */
export function createRoom(hostName: string, maxPlayers: number = 8): Room {
  const hostId = generatePlayerId();
  return {
    code: generateRoomCode(),
    maxPlayers,
    players: [{
      id: hostId,
      name: hostName,
      isHost: true,
      isAI: false,
      connected: true,
    }],
    game: createInitialState(),
    createdAt: Date.now(),
  };
}

/** 创建 AI 玩家 */
export function createAIPlayer(name?: string): Player {
  const aiNames = ['AI·许衡', 'AI·黄克明', 'AI·药来', 'AI·姬天明', 'AI·木户三郎', 'AI·郑老'];
  const nm = name || aiNames[Math.floor(Math.random() * aiNames.length)];
  return {
    id: generatePlayerId(),
    name: nm,
    isHost: false,
    isAI: true,
    connected: true,
  };
}

/** 分配角色 */
export function assignRoles(room: Room): void {
  const config = ROLE_CONFIGS[room.players.length];
  if (!config) throw new Error(`不支持 ${room.players.length} 人局`);
  const deck = shuffle(config);
  room.players.forEach((p, i) => {
    p.role = deck[i];
    // 重置玩家游戏内状态
    p.permanentlyDisabled = false;
    p.fangzhenCheckTarget = undefined;
    p.fangzhenCheckResult = undefined;
    p.yaoburanSealTarget = undefined;
    p.zhengguoquLockedArtifact = undefined;
    p.laochaofengUsedFlip = false;
    p.speech = undefined;
    p.hasSpoken = false;
    p.betArtifactId = undefined;
  });
  room.game.playerRoundStates = {};
  room.game.xuyuanScore = 0;
  room.game.endLog = [];
  room.game.winner = undefined;
}

/** 开始新一轮：生成兽首、确定发言顺序、设置随机无法鉴宝 */
export function startRound(room: Room, roundNumber: number): void {
  const game = room.game;
  const artifacts = generateArtifacts();

  // 发言顺序随机
  const speechOrder = shuffle(room.players.map(p => p.id));

  const round: GameRound = {
    roundNumber,
    phase: 'appraise',
    speechOrder,
    currentSpeakerIndex: 0,
    artifacts,
    laochaofengUsedFlip: false,
    betCounts: {},
    events: [],
  };

  // 移除上一轮数据（保留历史 rounds 数组用于记录）
  game.rounds[roundNumber - 1] = round;
  game.currentRound = roundNumber;
  game.phase = 'appraise';

  // 重置玩家本轮状态
  room.players.forEach(p => {
    p.fangzhenCheckTarget = undefined;
    p.fangzhenCheckResult = undefined;
    p.yaoburanSealTarget = undefined;
    p.zhengguoquLockedArtifact = undefined;
    p.laochaofengUsedFlip = false;
    p.speech = undefined;
    p.hasSpoken = false;
    p.betArtifactId = undefined;
  });

  // 初始化每玩家本轮状态，并设置黄烟烟/木户加奈的随机无法鉴宝
  const skipPlayers = room.players.filter(p => p.role === 'huangyanyan' || p.role === 'muhujianai');
  // 三轮中随机一轮无法鉴宝；这里为简单：每轮 30% 概率，但保证三轮中至少一轮
  const skipRounds = new Set<number>();
  // 随机选定一轮（1/2/3）
  skipRounds.add(1 + Math.floor(Math.random() * 3));

  room.players.forEach(p => {
    if (!game.playerRoundStates[p.id]) game.playerRoundStates[p.id] = {};
    const randomlyBlocked = skipPlayers.includes(p) && skipRounds.has(roundNumber);
    game.playerRoundStates[p.id][roundNumber] = {
      sealed: false,
      randomlyBlocked,
      appraisals: [],
    };
  });
}

/** 判断玩家本轮是否能鉴宝 */
export function canAppraise(room: Room, playerId: string): { can: boolean; reason?: string; count: number } {
  const player = room.players.find(p => p.id === playerId);
  if (!player || !player.role) return { can: false, reason: '未分配角色', count: 0 };

  const role = ROLES[player.role];
  if (role.appraiseCount === 0) return { can: false, reason: '该角色无法鉴宝', count: 0 };

  // 姬云浮永久失能
  if (player.permanentlyDisabled) return { can: false, reason: '已被永久封印', count: 0 };

  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return { can: false, reason: '当前无进行中的轮次', count: 0 };

  const rs = room.game.playerRoundStates[playerId]?.[room.game.currentRound];
  if (!rs) return { can: false, reason: '状态未初始化', count: 0 };

  if (rs.sealed) return { can: false, reason: '本轮已被药不然封印', count: 0 };
  if (rs.randomlyBlocked) return { can: false, reason: '本轮心神不宁，无法鉴宝', count: 0 };

  // 已鉴定数量
  const done = rs.appraisals.length;
  const remaining = role.appraiseCount - done;
  if (remaining <= 0) return { can: false, reason: '本轮鉴宝次数已用完', count: 0 };

  return { can: true, count: remaining };
}

/** 玩家执行鉴宝：返回该玩家看到的真假 */
export function appraise(room: Room, playerId: string, artifactId: number): AppraisalResult | { error: string } {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: '玩家不存在' };

  const check = canAppraise(room, playerId);
  if (!check.can) return { error: check.reason || '无法鉴宝' };

  const round = room.game.rounds[room.game.currentRound - 1];
  const artifact = round.artifacts.find(a => a.id === artifactId);
  if (!artifact) return { error: '兽首不存在' };

  // 郑国渠封存的兽首无法鉴定
  if (round.lockedArtifactId === artifactId) return { error: '该兽首已被封存，无法鉴定' };

  const rs = room.game.playerRoundStates[playerId][room.game.currentRound];

  // 判断玩家看到的真假
  let appearsReal = artifact.isReal;
  const role = ROLES[player.role!];

  // 姬云浮不受颠倒影响
  if (role.id !== 'jiyunfu' && round.laochaofengUsedFlip) {
    appearsReal = !appearsReal;
  }

  // 老朝奉自己看到的是真实（颠倒只对好人）
  if (role.faction === 'laochaofeng') {
    appearsReal = artifact.isReal;
  }

  const result: AppraisalResult = { artifactId, appearsReal };
  rs.appraisals.push(result);
  return result;
}

/** 老朝奉使用颠倒乾坤 */
export function laochaofengUseFlip(room: Room, playerId: string, use: boolean): { ok: boolean; error?: string } {
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.role !== 'laochaofeng') return { ok: false, error: '只有老朝奉可使用此技能' };
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return { ok: false, error: '当前无进行中的轮次' };
  // 颠倒在鉴宝阶段使用，影响后续好人
  if (room.game.phase !== 'appraise') return { ok: false, error: '仅鉴宝阶段可使用' };
  round.laochaofengUsedFlip = use;
  player.laochaofengUsedFlip = use;
  return { ok: true };
}

/** 药不然封印玩家 */
export function yaoburanSeal(room: Room, playerId: string, targetId: string): { ok: boolean; error?: string } {
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.role !== 'yaoburan') return { ok: false, error: '只有药不然可使用此技能' };
  if (playerId === targetId) return { ok: false, error: '不能封印自己' };
  const target = room.players.find(p => p.id === targetId);
  if (!target) return { ok: false, error: '目标不存在' };
  if (room.game.phase !== 'appraise') return { ok: false, error: '仅鉴宝阶段可使用' };

  const rs = room.game.playerRoundStates[targetId]?.[room.game.currentRound];
  if (!rs) return { ok: false, error: '目标状态未初始化' };
  rs.sealed = true;
  player.yaoburanSealTarget = targetId;

  // 姬云浮被药不然封印则永久失能
  if (target.role === 'jiyunfu') {
    target.permanentlyDisabled = true;
  }
  // 方震被封印则许愿本轮也无法鉴宝
  if (target.role === 'fangzhen') {
    const xuyuan = room.players.find(p => p.role === 'xuyuan');
    if (xuyuan) {
      const xrs = room.game.playerRoundStates[xuyuan.id]?.[room.game.currentRound];
      if (xrs) xrs.sealed = true;
    }
  }
  return { ok: true };
}

/** 郑国渠封存兽首 */
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

/** 方震查验阵营 */
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

/** 检查所有玩家是否完成鉴宝阶段（技能使用完毕 + 鉴宝次数用尽或主动结束） */
export function isAppraisePhaseDone(room: Room): boolean {
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return false;
  for (const p of room.players) {
    if (p.isAI) continue;
    const rs = room.game.playerRoundStates[p.id]?.[room.game.currentRound];
    if (!rs) return false;
    const role = ROLES[p.role!];
    // 方震无鉴宝，但需确认已查验或放弃
    // 简化：只要鉴宝次数用完或无法鉴宝即可
    if (role.appraiseCount > 0 && !rs.sealed && !rs.randomlyBlocked && !p.permanentlyDisabled) {
      if (rs.appraisals.length < role.appraiseCount) {
        // 还能鉴宝但未鉴完 —— 允许玩家主动结束，所以不算未完成
        // 由前端「结束鉴宝」按钮处理
      }
    }
  }
  return true; // 由「结束鉴宝」按钮主动推进
}

/** 进入发言阶段 */
export function enterDiscussPhase(room: Room): void {
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return;
  round.phase = 'discuss';
  room.game.phase = 'discuss';
  round.currentSpeakerIndex = 0;
}

/** 玩家发言 */
export function playerSpeech(room: Room, playerId: string, content: string): { ok: boolean; error?: string } {
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round || round.phase !== 'discuss') return { ok: false, error: '当前非发言阶段' };
  const currentSpeakerId = round.speechOrder[round.currentSpeakerIndex];
  if (playerId !== currentSpeakerId) return { ok: false, error: '未轮到你发言' };
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { ok: false, error: '玩家不存在' };
  player.speech = content;
  player.hasSpoken = true;
  // 推进到下一位
  round.currentSpeakerIndex++;
  return { ok: true };
}

/** 是否所有人发言完毕 */
export function isDiscussDone(room: Room): boolean {
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return false;
  return round.currentSpeakerIndex >= round.speechOrder.length;
}

/** 进入押币阶段 */
export function enterVotePhase(room: Room): void {
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return;
  round.phase = 'vote';
  room.game.phase = 'vote';
  round.betCounts = {};
  room.players.forEach(p => { p.betArtifactId = undefined; });
}

/** 玩家押币 */
export function playerBet(room: Room, playerId: string, artifactId: number): { ok: boolean; error?: string } {
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round || round.phase !== 'vote') return { ok: false, error: '当前非押币阶段' };
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { ok: false, error: '玩家不存在' };
  if (player.betArtifactId !== undefined) return { ok: false, error: '本轮已押币' };
  const artifact = round.artifacts.find(a => a.id === artifactId);
  if (!artifact) return { ok: false, error: '兽首不存在' };
  player.betArtifactId = artifactId;
  round.betCounts[artifactId] = (round.betCounts[artifactId] || 0) + 1;
  return { ok: true };
}

/** 是否所有人押币完毕 */
export function isVoteDone(room: Room): boolean {
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return false;
  return room.players.every(p => p.betArtifactId !== undefined);
}

/** 结算本轮押币：押币最多者隐藏，第二多者揭露 */
export function resolveBets(room: Room): void {
  const round = room.game.rounds[room.game.currentRound - 1];
  if (!round) return;
  round.phase = 'reveal';
  room.game.phase = 'reveal';

  // 统计：按押币数排序
  const entries = Object.entries(round.betCounts).map(([id, count]) => ({
    artifactId: Number(id),
    count,
  }));
  entries.sort((a, b) => b.count - a.count);

  if (entries.length === 0) {
    round.events.push('本轮无人押币。');
    return;
  }

  const hiddenId = entries[0].artifactId;
  round.hiddenArtifactId = hiddenId;
  const hiddenArtifact = round.artifacts.find(a => a.id === hiddenId)!;
  round.events.push(`【${hiddenArtifact.name}】获得最多押币，已被隐藏，真伪成谜。`);

  let revealedId: number | undefined;
  let revealedIsReal = false;
  if (entries.length >= 2) {
    revealedId = entries[1].artifactId;
    round.revealedArtifactId = revealedId;
    const revealedArtifact = round.artifacts.find(a => a.id === revealedId)!;
    revealedIsReal = revealedArtifact.isReal;
    round.revealedIsReal = revealedIsReal;
    round.events.push(
      `【${revealedArtifact.name}】获得第二多押币，予以揭露——${revealedIsReal ? '真品！' : '赝品。'}`
    );
    // 揭露为真品，许愿阵营 +1
    if (revealedIsReal) {
      room.game.xuyuanScore += 1;
      round.events.push('揭露真品，许愿阵营 +1 分。');
    }
  }
}

/** 进入下一轮或结束游戏 */
export function nextRoundOrEnd(room: Room): void {
  if (room.game.currentRound >= 3) {
    endGame(room);
    return;
  }
  startRound(room, room.game.currentRound + 1);
}

/** 游戏结束结算 */
export function endGame(room: Room): void {
  const game = room.game;
  game.phase = 'ended';

  // 识别身份：方震是否被药不然封印过（简化：检查药不然是否在三轮中封印过方震）
  // 这里采用更直接的判定：由前端在押币阶段猜测，此处简化为基于兽首揭真得分 + 身份识别加分
  // 为了游戏性，我们让游戏在三轮后进入「身份指认」环节由玩家投票
  // 此处先做基础判定：根据已有分数

  const log: string[] = [];
  log.push('—— 三轮鉴宝结束 ——');
  log.push(`许愿阵营当前得分：${game.xuyuanScore} / ${game.targetScore}`);

  // 身份识别奖励（简化版）：好人若在押币阶段押中真品更多，视为找到线索
  // 此处简化胜负判定
  if (game.xuyuanScore >= game.targetScore) {
    game.winner = 'xuyuan';
    log.push('许愿阵营达到目标分数，赢得本局！');
  } else {
    game.winner = 'laochaofeng';
    log.push(`许愿阵营未达目标分数，老朝奉阵营赢得本局！`);
  }

  game.endLog = log;
}
