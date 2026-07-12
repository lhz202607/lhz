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
  title: string;
  ability: string;
  appraiseCount: number;
  bio: string;
}

export const ROLES: Record<RoleId, RoleDef> = {
  xuyuan: {
    id: 'xuyuan', name: '许愿', faction: 'xuyuan', title: '好人主公',
    ability: '每轮可鉴定 2 件兽首。被药不然锁定则鉴宝能力丧失。',
    appraiseCount: 2,
    bio: '古董世家许家传人，五脉之首，鉴宝眼力超群。',
  },
  fangzhen: {
    id: 'fangzhen', name: '方震', faction: 'xuyuan', title: '好人老二 · 预言家',
    ability: '不会鉴宝。每轮可查验一名玩家所属阵营。若被封印，许愿同时丧失鉴宝能力。',
    appraiseCount: 0,
    bio: '刑警出身，心思缜密，专司鉴人。',
  },
  jiyunfu: {
    id: 'jiyunfu', name: '姬云浮', faction: 'xuyuan', title: '山林隐士',
    ability: '每轮可鉴定 1 件兽首，不受老朝奉技能影响（所见即真）。被封印则永久失能。',
    appraiseCount: 1,
    bio: '博学多才的隐士，眼力通天，但身娇体弱。',
  },
  huangyanyan: {
    id: 'huangyanyan', name: '黄烟烟', faction: 'xuyuan', title: '好人平民',
    ability: '每轮可鉴定 1 件兽首，但三轮中随机一轮无法鉴宝。',
    appraiseCount: 1,
    bio: '黄家后人，与许愿关系匪浅。',
  },
  muhujianai: {
    id: 'muhujianai', name: '木户加奈', faction: 'xuyuan', title: '好人平民',
    ability: '每轮可鉴定 1 件兽首，但三轮中随机一轮无法鉴宝。',
    appraiseCount: 1,
    bio: '日本学者，对中国古董颇有研究。',
  },
  laochaofeng: {
    id: 'laochaofeng', name: '老朝奉', faction: 'laochaofeng', title: '坏人主公',
    ability: '每轮可鉴定 1 件兽首，可使用「颠倒乾坤」：好人鉴宝结果真假互换。',
    appraiseCount: 1,
    bio: '潜伏古董界的黑暗势力首脑，神出鬼没。',
  },
  yaoburan: {
    id: 'yaoburan', name: '药不然', faction: 'laochaofeng', title: '坏人老二 · 刺客',
    ability: '每轮可鉴定 1 件兽首。每轮可封印一名玩家使其本轮无法鉴宝。',
    appraiseCount: 1,
    bio: '药家传人，表面吊儿郎当，实则深不可测。',
  },
  zhengguoqu: {
    id: 'zhengguoqu', name: '郑国渠', faction: 'laochaofeng', title: '坏人小弟',
    ability: '每轮可鉴定 1 件兽首，可封存一件兽首。不知晓队友身份。',
    appraiseCount: 1,
    bio: '郑家后人，行事低调，暗中搅局。',
  },
};

export const ROLE_CONFIGS: Record<number, RoleId[]> = {
  6: ['xuyuan', 'fangzhen', 'huangyanyan', 'muhujianai', 'laochaofeng', 'yaoburan'],
  7: ['xuyuan', 'fangzhen', 'huangyanyan', 'muhujianai', 'laochaofeng', 'yaoburan', 'zhengguoqu'],
  8: ['xuyuan', 'fangzhen', 'jiyunfu', 'huangyanyan', 'muhujianai', 'laochaofeng', 'yaoburan', 'zhengguoqu'],
};

export const REAL_COUNT = 6;
export const ARTIFACTS_PER_ROUND = 4; // 每轮鉴定4个兽首

export type GamePhase =
  | 'waiting'
  | 'roleReveal'
  | 'appraise'
  | 'discuss'
  | 'vote'
  | 'reveal'
  | 'identify'     // 鉴人环节（三轮后）
  | 'ended';

export interface Artifact {
  id: number;
  name: ZodiacName;
  isReal: boolean;
}

export interface AppraisalResult {
  artifactId: number;
  appearsReal: boolean;
}

export interface PlayerRoundState {
  sealed: boolean;
  randomlyBlocked: boolean;
  /** 许愿专属：因方震（预言家）被封印，连带丧失本轮鉴宝能力 */
  fangzhenSealPenalty?: boolean;
  appraisals: AppraisalResult[];
}

/** 房间内一名玩家 */
export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isAI: boolean;
  /** 座位号（落座顺序，游戏开始后绑定） */
  seatNumber: number;
  role?: RoleId;
  connected: boolean;
  permanentlyDisabled?: boolean;
  fangzhenCheckTarget?: string;
  fangzhenCheckResult?: Faction;
  yaoburanSealTarget?: string;
  zhengguoquLockedArtifact?: number;
  laochaofengUsedFlip?: boolean;
  speech?: string;
  hasSpoken?: boolean;
  /** 押币选择（可多个兽首 id） */
  betArtifactIds: number[];
  /** 本轮剩余投票次数 */
  remainingVotes: number;
  /** 玩家手动结束投票（未用完票数顺延） */
  finishedVote?: boolean;
  /** 鉴人环节的投票目标 */
  identifyTargetId?: string;
}

export interface GameRound {
  roundNumber: number;
  phase: GamePhase;
  speechOrder: string[];
  currentSpeakerIndex: number;
  /** 本轮可用兽首（仅4个） */
  artifacts: Artifact[];
  lockedArtifactId?: number;
  laochaofengUsedFlip: boolean;
  betCounts: Record<number, number>;
  hiddenArtifactId?: number;
  revealedArtifactId?: number;
  revealedArtifactName?: string;
  revealedIsReal?: boolean;
  hiddenArtifactName?: string;
  /** 本轮许愿阵营得分增量（揭示真品+1，鉴人环节另计） */
  roundScore?: number;
  events: string[];
  /** 机密事件（仅老朝奉阵营可见，如药不然偷袭目标） */
  secretEvents?: string[];
  currentAppraiserId?: string;
  /** 鉴宝行动顺序（所有玩家随机排列，初始顺序） */
  appraiseOrder: string[];
  /** 本轮实际发生鉴宝行动的玩家顺序（按发生先后，动态累加） */
  actualOrder: string[];
  finishedAppraisers: string[];
  /** 投票明细（投票结束后记录每位玩家投了哪些兽首） */
  playerVotes?: Record<string, number[]>;
  /** 药不然本轮是否已发动过偷袭（每轮仅一次） */
  yaoburanSealUsedThisRound?: boolean;
}

export interface GameState {
  phase: GamePhase;
  currentRound: number;
  rounds: GameRound[];
  xuyuanScore: number;
  /** 目标改为 6 分 */
  targetScore: number;
  winner?: Faction;
  endLog: string[];
  playerRoundStates: Record<string, Record<number, PlayerRoundState>>;
  /** 鉴人环节投票：playerId -> targetId */
  identifyVotes: Record<string, string>;
  /** 预先设定的跳过轮次：playerId -> roundNumber（木户加奈/黄烟烟随机一轮无法鉴宝） */
  skipRoundsMap: Record<string, number>;
  /** 药不然对前置位玩家的延迟封印：targetId -> 生效轮次（本轮不生效，下轮生效） */
  pendingSeals: Record<string, number>;
}

export interface Room {
  code: string;
  players: Player[];
  maxPlayers: number;
  game: GameState;
  createdAt: number;
  _roleDeck?: RoleId[];
}

// ============================================================================
// 消息协议
// ============================================================================

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
  | { type: 'finishAppraise' }
  | { type: 'passAppraiseTurn'; nextPlayerId: string }
  | { type: 'speech'; content: string }
  | { type: 'bet'; artifactId: number }
  | { type: 'finishVote' }  // 玩家结束投票
  | { type: 'nextRound' }
  | { type: 'identifyVote'; targetId: string }  // 鉴人环节投票
  | { type: 'disbandRoom' }
  | { type: 'restart' }
  | { type: 'changeSeat'; targetId: string };  // 落座阶段与某玩家交换座位

export type ServerMessage =
  | { type: 'joined'; room: PublicRoom; you: PublicPlayer }
  | { type: 'roomUpdate'; room: PublicRoom }
  | { type: 'error'; message: string }
  | { type: 'phaseChange'; phase: GamePhase; round: number }
  | { type: 'yourRole'; role: RoleId }
  | { type: 'gameEnd'; winner: Faction; xuyuanScore: number; log: string[]; roles: Record<string, RoleId> };

export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isAI: boolean;
  connected: boolean;
  /** 座位号（全员可见，用于落座辨认） */
  seatNumber: number;
  role?: RoleId;
  hasSpoken?: boolean;
  betArtifactIds?: number[];
  visiblySealed?: boolean;
  /** 是否已完成投票 */
  finishedVote?: boolean;
  /** 鉴人环节的投票目标 */
  identifyTargetId?: string;
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
    artifacts: { id: number; name: ZodiacName; locked?: boolean }[];
    revealedArtifacts: { id: number; name: ZodiacName; isReal?: boolean; betCount: number; hidden: boolean }[];
    speechOrder: string[];
    currentSpeakerIndex: number;
    speeches: Record<string, string>;
    events: string[];
    flipUsedThisRound: boolean;
    currentAppraiserId?: string;
    finishedAppraisers: string[];
    /** 鉴宝行动顺序（初始随机/轮转顺序，全员可见） */
    appraiseOrder: string[];
    /** 本轮实际发生鉴宝行动的玩家顺序（按发生先后动态累加） */
    actualOrder: string[];
    /** 鉴人环节投票状态 */
    identifyVotes: Record<string, string>;
    /** 历史轮次数据（行动顺序等） */
    rounds: {
      appraiseOrder: string[];
      actualOrder: string[];
      finishedAppraisers: string[];
      playerVotes?: Record<string, number[]>;
      hiddenArtifactName?: string;
      revealedArtifactName?: string;
      revealedIsReal?: boolean;
      roundScore?: number;
    }[];
  };
}

export const TARGET_SCORE = 6;
