// ============================================================================
// 古董局中局·十二兽首 — 共享类型与常量
// 前后端共用的游戏规则定义
// ============================================================================

/** 十二生肖兽首名称 */
export const ZODIAC_NAMES = [
  '鼠首', '牛首', '虎首', '兔首',
  '龙首', '蛇首', '马首', '羊首',
  '猴首', '鸡首', '狗首', '猪首',
] as const;

export type ZodiacName = typeof ZODIAC_NAMES[number];

/** 阵营 */
export type Faction = 'xuyuan' | 'laochaofeng';

/** 角色编号 */
export type RoleId =
  | 'xuyuan'        // 许愿 — 好人主公
  | 'fangzhen'      // 方震 — 好人老二/预言家
  | 'jiyunfu'       // 姬云浮 — 不受老朝奉技能
  | 'huangyanyan'   // 黄烟烟 — 随机一轮无法鉴宝
  | 'muhujianai'    // 木户加奈 — 随机一轮无法鉴宝
  | 'laochaofeng'   // 老朝奉 — 坏人主公
  | 'yaoburan'      // 药不然 — 坏人老二/刺客
  | 'zhengguoqu';   // 郑国渠 — 坏人小弟/隐藏兽首

export interface RoleDef {
  id: RoleId;
  name: string;
  faction: Faction;
  /** 阵营内的身份描述 */
  title: string;
  /** 技能描述（玩家可见） */
  ability: string;
  /** 每轮可鉴定的兽首数量，0 表示无法鉴宝 */
  appraiseCount: number;
  /** 角色简介背景 */
  bio: string;
}

/** 全部角色定义 */
export const ROLES: Record<RoleId, RoleDef> = {
  xuyuan: {
    id: 'xuyuan',
    name: '许愿',
    faction: 'xuyuan',
    title: '好人主公',
    ability: '每轮可鉴定 2 件兽首的真伪。需隐藏身份，被药不然锁定则鉴宝能力丧失。',
    appraiseCount: 2,
    bio: '古董世家许家传人，五脉之首，鉴宝眼力超群。',
  },
  fangzhen: {
    id: 'fangzhen',
    name: '方震',
    faction: 'xuyuan',
    title: '好人老二 · 预言家',
    ability: '不会鉴宝。每轮可查验一名玩家所属阵营。若被药不然封印，许愿同时丧失鉴宝能力。',
    appraiseCount: 0,
    bio: '刑警出身，心思缜密，专司鉴人。',
  },
  jiyunfu: {
    id: 'jiyunfu',
    name: '姬云浮',
    faction: 'xuyuan',
    title: '山林隐士',
    ability: '每轮可鉴定 1 件兽首，且不受老朝奉技能影响（所见即真）。一旦被药不然封印，整局永久失去鉴宝能力。',
    appraiseCount: 1,
    bio: '博学多才的隐士，眼力通天，但身娇体弱。',
  },
  huangyanyan: {
    id: 'huangyanyan',
    name: '黄烟烟',
    faction: 'xuyuan',
    title: '好人平民',
    ability: '每轮可鉴定 1 件兽首，但三轮中会随机有一轮无法鉴宝。',
    appraiseCount: 1,
    bio: '黄家后人，与许愿关系匪浅。',
  },
  muhujianai: {
    id: 'muhujianai',
    name: '木户加奈',
    faction: 'xuyuan',
    title: '好人平民',
    ability: '每轮可鉴定 1 件兽首，但三轮中会随机有一轮无法鉴宝。',
    appraiseCount: 1,
    bio: '日本学者，对中国古董颇有研究。',
  },
  laochaofeng: {
    id: 'laochaofeng',
    name: '老朝奉',
    faction: 'laochaofeng',
    title: '坏人主公',
    ability: '每轮可鉴定 1 件兽首，并可选择「颠倒乾坤」：使用后，所有好人本轮的鉴宝结果真假互换。',
    appraiseCount: 1,
    bio: '潜伏古董界的黑暗势力首脑，神出鬼没。',
  },
  yaoburan: {
    id: 'yaoburan',
    name: '药不然',
    faction: 'laochaofeng',
    title: '坏人老二 · 刺客',
    ability: '每轮可鉴定 1 件兽首。每轮可选择封印一名玩家，使其本轮无法鉴宝且技能失效。',
    appraiseCount: 1,
    bio: '药家传人，表面吊儿郎当，实则深不可测。',
  },
  zhengguoqu: {
    id: 'zhengguoqu',
    name: '郑国渠',
    faction: 'laochaofeng',
    title: '坏人小弟',
    ability: '每轮可鉴定 1 件兽首，并可选择一件兽首「封存」，使其本轮无法被任何人鉴定。开局不知晓队友。',
    appraiseCount: 1,
    bio: '郑家后人，行事低调，暗中搅局。',
  },
};

/** 不同人数的角色配置 */
export const ROLE_CONFIGS: Record<number, RoleId[]> = {
  6: ['xuyuan', 'fangzhen', 'huangyanyan', 'muhujianai', 'laochaofeng', 'yaoburan'],
  7: ['xuyuan', 'fangzhen', 'huangyanyan', 'muhujianai', 'laochaofeng', 'yaoburan', 'zhengguoqu'],
  8: ['xuyuan', 'fangzhen', 'jiyunfu', 'huangyanyan', 'muhujianai', 'laochaofeng', 'yaoburan', 'zhengguoqu'],
};

/** 真品兽首数量（每局固定 6 真 6 假） */
export const REAL_COUNT = 6;

/** 游戏阶段 */
export type GamePhase =
  | 'waiting'        // 房间等待
  | 'roleReveal'     // 角色揭示
  | 'appraise'       // 鉴宝阶段
  | 'discuss'        // 发言阶段
  | 'vote'           // 押币投票
  | 'reveal'         // 揭示阶段
  | 'ended';         // 游戏结束

/** 一件兽首的真相 */
export interface Artifact {
  id: number;
  name: ZodiacName;
  isReal: boolean;
}

/** 单个玩家的鉴宝结果（自己看到的） */
export interface AppraisalResult {
  artifactId: number;
  /** 玩家看到的真假（可能被老朝奉颠倒） */
  appearsReal: boolean;
}

/** 玩家在某轮的状态 */
export interface PlayerRoundState {
  /** 本轮是否被药不然封印 */
  sealed: boolean;
  /** 本轮是否因随机无法鉴宝（黄烟烟/木户加奈） */
  randomlyBlocked: boolean;
  /** 本轮已鉴定的兽首结果 */
  appraisals: AppraisalResult[];
  /** 老朝奉本轮是否使用了颠倒乾坤 */
  // (此字段仅老朝奉自己可见，存在 game.round.laochaofengUsedFlip)
}

/** 房间内一名玩家 */
export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isAI: boolean;
  role?: RoleId;          // 游戏开始后才有
  connected: boolean;
  /** 姬云浮永久失能标记 */
  permanentlyDisabled?: boolean;
  /** 方震本轮查验目标 */
  fangzhenCheckTarget?: string;
  /** 方震本轮查验结果 */
  fangzhenCheckResult?: Faction;
  /** 药不然本轮封印目标 */
  yaoburanSealTarget?: string;
  /** 郑国渠本轮封存的兽首 id */
  zhengguoquLockedArtifact?: number;
  /** 老朝奉本轮是否使用颠倒 */
  laochaofengUsedFlip?: boolean;
  /** 本轮发言内容 */
  speech?: string;
  /** 本轮已发言 */
  hasSpoken?: boolean;
  /** 押币选择（兽首 id） */
  betArtifactId?: number;
}

/** 单轮游戏记录 */
export interface GameRound {
  roundNumber: number;       // 1-3
  phase: GamePhase;
  /** 本轮发言顺序（玩家 id 数组） */
  speechOrder: string[];
  currentSpeakerIndex: number;
  /** 本轮所有兽首（含真假，仅服务端权威；reveal 阶段会公开部分） */
  artifacts: Artifact[];
  /** 被郑国渠封存的兽首 id */
  lockedArtifactId?: number;
  /** 老朝奉本轮是否使用颠倒 */
  laochaofengUsedFlip: boolean;
  /** 押币统计：artifactId -> 押币玩家数 */
  betCounts: Record<number, number>;
  /** 本轮被隐藏（押币最多）的兽首 id */
  hiddenArtifactId?: number;
  /** 本轮被揭露（押币第二多）的兽首 id */
  revealedArtifactId?: number;
  /** 揭露的兽首是否为真 */
  revealedIsReal?: boolean;
  /** 揭露阶段产生的发言/日志 */
  events: string[];
  /** 当前正在鉴宝的玩家 id */
  currentAppraiserId?: string;
  /** 已完成鉴宝的玩家 id 列表（顺序） */
  appraiseOrder: string[];
  /** 已完成鉴宝的玩家 id 集合 */
  finishedAppraisers: string[];
}

/** 游戏状态 */
export interface GameState {
  phase: GamePhase;
  currentRound: number;       // 1-3
  rounds: GameRound[];
  /** 许愿阵营得分 */
  xuyuanScore: number;
  /** 目标得分 */
  targetScore: number;
  /** 胜利阵营 */
  winner?: Faction;
  /** 游戏结束日志 */
  endLog: string[];
  /** 各玩家每轮状态：playerId -> roundNumber -> state */
  playerRoundStates: Record<string, Record<number, PlayerRoundState>>;
}

/** 房间状态 */
export interface Room {
  code: string;
  players: Player[];
  maxPlayers: number;
  game: GameState;
  createdAt: number;
  /** 角色分配顺序（内部用，分配后清空） */
  _roleDeck?: RoleId[];
}

// ============================================================================
// WebSocket 消息协议
// ============================================================================

/** 客户端 -> 服务端 消息 */
export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'addAI' }
  | { type: 'startGame' }
  | { type: 'kickPlayer'; targetId: string }
  | { type: 'appraise'; artifactId: number }
  | { type: 'fangzhenCheck'; targetId: string }
  | { type: 'yaoburanSeal'; targetId: string }
  | { type: 'zhengguoquLock'; artifactId: number }
  | { type: 'laochaofengFlip'; use: boolean }
  | { type: 'finishAppraise' }       // 玩家确认结束本轮鉴宝
  | { type: 'passAppraiseTurn'; nextPlayerId: string }  // 鉴宝完毕后指定下一个鉴宝玩家
  | { type: 'speech'; content: string }
  | { type: 'bet'; artifactId: number }
  | { type: 'nextRound' }            // 房主进入下一轮
  | { type: 'restart' };

/** 服务端 -> 客户端 消息 */
export type ServerMessage =
  | { type: 'joined'; room: PublicRoom; you: PublicPlayer }
  | { type: 'roomUpdate'; room: PublicRoom }
  | { type: 'error'; message: string }
  | { type: 'phaseChange'; phase: GamePhase; round: number }
  | { type: 'yourRole'; role: RoleId }
  | { type: 'appraisalResult'; round: number; results: AppraisalResult[] }
  | { type: 'fangzhenResult'; round: number; targetId: string; targetName: string; faction: Faction }
  | { type: 'sealNotify'; round: number; targetId: string }  // 被封印通知（仅目标收到）
  | { type: 'speechUpdate'; playerId: string; content: string }
  | { type: 'voteResult'; round: number; hiddenId: number; revealedId: number; revealedIsReal: boolean; xuyuanScore: number }
  | { type: 'gameEnd'; winner: Faction; xuyuanScore: number; log: string[]; roles: Record<string, RoleId> };

/** 对外公开的房间视图（隐藏敏感信息） */
export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isAI: boolean;
  connected: boolean;
  role?: RoleId;          // 仅游戏结束时公开
  hasSpoken?: boolean;
  betArtifactId?: number; // 仅在押币阶段后可见（兽首 id）
  /** 当前轮是否被公开封印（药不然封印对全员可见其效果） */
  visiblySealed?: boolean;
}

export interface PublicRoom {
  code: string;
  players: PublicPlayer[];
  maxPlayers: number;
  game: {
    phase: GamePhase;
    currentRound: number;
    xuyuanScore: number;
    targetScore: number;
    winner?: Faction;
    endLog: string[];
    /** 当前轮可见的兽首列表（不包含真假，除非 reveal） */
    artifacts: { id: number; name: ZodiacName; locked?: boolean }[];
    /** 揭示阶段公开的兽首信息 */
    revealedArtifacts: { id: number; name: ZodiacName; isReal?: boolean; betCount: number; hidden: boolean }[];
    speechOrder: string[];
    currentSpeakerIndex: number;
    speeches: Record<string, string>;
    events: string[];
    /** 当前轮老朝奉是否已使用颠倒（全员可见「已使用」但不告知是谁用） */
    flipUsedThisRound: boolean;
    /** 当前鉴宝玩家 id */
    currentAppraiserId?: string;
    /** 已完成鉴宝的玩家 id 列表 */
    finishedAppraisers: string[];
  };
}

/** 目标分数（许愿阵营需要达到） */
export const TARGET_SCORE = 5;
