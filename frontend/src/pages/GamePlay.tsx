import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { connectGame, disconnectGame, send, useGameState } from '@/lib/game/client';
import { ROLE_INFO } from '@/lib/game/roles';
import { RoleId } from '@/shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Crown, Bot, Send, Lock, Eye, Sparkles, ScrollText, Coins } from 'lucide-react';
import { toast } from 'sonner';

export default function GamePlay() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const name = searchParams.get('name') || '匿名玩家';
  const pid = searchParams.get('pid') || undefined;
  const navigate = useNavigate();
  const game = useGameState();
  const [connecting, setConnecting] = useState(true);
  const [speech, setSpeech] = useState('');
  const [showRoleCard, setShowRoleCard] = useState(false);

  useEffect(() => {
    if (!code) return;
    setConnecting(true);
    connectGame(code, name, pid)
      .then(() => setConnecting(false))
      .catch(() => navigate('/'));
    return () => disconnectGame();
  }, [code]);

  const room = game.room;
  const me = game.me;
  const myRole = game.myRole;
    // @ts-ignore 7053
  const roleInfo = myRole ? ROLE_INFO[myRole as any] : null;

  // 游戏结束时显示角色卡
  useEffect(() => {
    if (room?.game.phase === 'ended') setShowRoleCard(false);
  }, [room?.game.phase]);

  // 首次拿到角色时弹卡
  useEffect(() => {
    if (myRole && !showRoleCard && room?.game.phase === 'appraise' && room?.game.currentRound === 1) {
      setShowRoleCard(true);
    }
  }, [myRole, room?.game.phase, room?.game.currentRound]);

  if (connecting || !room || !me) {
    return (
      <div className="min-h-screen bg-antique flex items-center justify-center">
        <div className="text-bronze font-brush text-2xl animate-pulse">正在入席…</div>
      </div>
    );
  }

  // 游戏结束返回大厅
  const handleRestart = () => send({ type: 'restart' });
  const handleBackToLobby = () => {
    disconnectGame();
    navigate('/');
  };

  const g = room.game;

  return (
    <div className="min-h-screen bg-antique p-3 lg:p-5">
      <div className="max-w-7xl mx-auto">
        {/* 顶部状态栏 */}
        <header className="card-antique px-3 py-2 sm:px-4 sm:py-3 mb-3 sm:mb-4 flex items-center justify-between flex-wrap gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="font-brush text-xl sm:text-2xl text-bronze">古董局中局</div>
            <div className="text-ivory-dim text-[10px] sm:text-xs">房间 {room.code}</div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-center">
              <div className="text-ivory-dim text-[10px] sm:text-xs">轮次</div>
              <div className="text-bronze font-bold text-sm sm:text-base">{g.currentRound} / 3</div>
            </div>
            <div className="w-px h-6 sm:h-8 bg-bronze/30"></div>
            <div className="text-center">
              <div className="text-ivory-dim text-[10px] sm:text-xs">许愿阵营</div>
              <div className="text-gold-glow font-bold text-sm sm:text-lg">{g.xuyuanScore} / {g.targetScore}</div>
            </div>
            <div className="w-px h-6 sm:h-8 bg-bronze/30"></div>
            <div className="text-center">
              <div className="text-ivory-dim text-[10px] sm:text-xs">阶段</div>
              <PhaseBadge phase={g.phase} />
            </div>
          </div>
        </header>

        {/* 主体网格 */}
        <div className="grid lg:grid-cols-[260px_1fr_280px] gap-3 sm:gap-4">
          {/* 左侧：玩家列表（桌面端 sticky，移动端水平滚动） */}
          <aside className="card-antique p-3 sm:p-4 lg:sticky lg:top-5 lg:self-start lg:max-h-[calc(100vh-6rem)] overflow-y-auto">
            <div className="text-bronze font-antique font-bold mb-3 flex items-center gap-2 text-sm sm:text-base">
              <ScrollText className="w-4 h-4" /> 入席名册
            </div>
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0">
              {room.players.map((p, i) => {
                const isMe = p.id === me.id;
                const isCurrentSpeaker = g.phase === 'discuss' && g.speechOrder[g.currentSpeakerIndex] === p.id;
                const isCurrentAppraiser = g.phase === 'appraise' && g.currentAppraiserId === p.id;
                const hasFinishedAppraise = (g.finishedAppraisers || []).includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={`p-2 rounded-md border transition-all min-w-[140px] lg:min-w-0 shrink-0 lg:shrink ${
                      (isCurrentSpeaker || isCurrentAppraiser) ? 'border-gold-glow animate-glow' : 'border-bronze/20'
                    } ${isMe ? 'bg-bronze/10' : 'bg-black/20'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="player-token w-7 h-7 sm:w-8 sm:h-8 text-sm shrink-0" style={{fontSize: '12px'}}>
                        {p.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className={`text-xs sm:text-sm truncate ${isMe ? 'text-bronze font-bold' : 'text-ivory'}`}>
                            {p.name}{isMe ? '（我）' : ''}
                          </span>
                          {p.isHost && <Crown className="w-3 h-3 text-gold-glow shrink-0" />}
                          {p.isAI && <Bot className="w-3 h-3 text-ivory-dim shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {p.visiblySealed && (
                            <span className="text-[10px] text-vermilion flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" />被封
                            </span>
                          )}
                          {isCurrentSpeaker && (
                            <span className="text-[10px] text-gold-glow">发言中</span>
                          )}
                          {isCurrentAppraiser && (
                            <span className="text-[10px] text-gold-glow">鉴宝中</span>
                          )}
                          {g.phase === 'appraise' && hasFinishedAppraise && !isCurrentAppraiser && (
                            <span className="text-[10px] text-jade">已鉴完</span>
                          )}
                          {g.phase === 'vote' && p.betArtifactId !== undefined && (
                            <span className="text-[10px] text-jade flex items-center gap-0.5">
                              <Coins className="w-2.5 h-2.5" />已押
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {g.phase === 'ended' && (
              <div className="mt-4 space-y-2">
                {me.isHost ? (
                  <>
                    <Button onClick={handleRestart} className="btn-bronze w-full h-10 text-sm sm:text-base">再 开 一 局</Button>
                    <Button onClick={handleBackToLobby} className="btn-ghost w-full h-10 text-sm sm:text-base">返回大厅</Button>
                  </>
                ) : (
                  <Button onClick={handleBackToLobby} className="btn-ghost w-full h-10 text-sm sm:text-base">返回大厅</Button>
                )}
              </div>
            )}
          </aside>

          {/* 中间：主游戏区 */}
          <main className="space-y-4">
            {g.phase === 'ended' ? (
              <EndScreen room={room} game={game} onRestart={handleRestart} onLeave={handleBackToLobby} isHost={!!me.isHost} />
            ) : (
              <>
                {/* 兽首展示区 */}
                <ZodiacBoard room={room} game={game} />

                {/* 阶段操作区 */}
                <PhaseAction room={room} game={game} speech={speech} setSpeech={setSpeech} />
              </>
            )}
          </main>

          {/* 右侧：我的角色 + 日志 */}
          <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start lg:max-h-[calc(100vh-6rem)] overflow-y-auto">
            {/* 角色卡 */}
            {roleInfo && (
              <div className="card-antique-glow p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-ivory-dim text-xs">我的身份</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    roleInfo.faction === 'xuyuan' ? 'text-jade border border-jade/40' : 'text-vermilion border border-vermilion/40'
                  }`}>
                    {roleInfo.faction === 'xuyuan' ? '许愿阵营' : '老朝奉阵营'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-14 h-14 rounded-lg flex items-center justify-center font-brush text-3xl"
                    style={{background: `${roleInfo.color}33`, color: roleInfo.color, border: `1px solid ${roleInfo.color}80`}}
                  >
                    {roleInfo.glyph}
                  </div>
                  <div>
                    <div className="font-brush text-2xl" style={{color: roleInfo.color}}>{roleInfo.name}</div>
                    <div className="text-ivory-dim text-xs">{roleInfo.title}</div>
                  </div>
                </div>
                <div className="text-xs text-ivory leading-relaxed bg-black/20 p-2 rounded">
                  {roleInfo.ability}
                </div>

                {/* 方震查验结果 */}
                {myRole === 'fangzhen' && game.fangzhenResults.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-ivory-dim text-xs flex items-center gap-1"><Eye className="w-3 h-3" /> 查验记录</div>
                    {game.fangzhenResults.map(r => (
                      <div key={r.round} className="text-xs bg-black/20 p-1.5 rounded">
                        第{r.round}轮 · <span className="text-ivory">{r.targetName}</span>：
                        <span className={r.faction === 'xuyuan' ? 'text-jade' : 'text-vermilion'}>
                          {r.faction === 'xuyuan' ? ' 好人' : ' 坏人'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 我的鉴宝结果 */}
                {myRole && (ROLE_INFO as any)[myRole].appraiseCount > 0 && game.myAppraisals[g.currentRound] && game.myAppraisals[g.currentRound].length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-ivory-dim text-xs">本轮鉴定</div>
                    {game.myAppraisals[g.currentRound].map((a: any, i: number) => {
                      const art = g.artifacts.find(x => x.id === a.artifactId);
                      return (
                        <div key={i} className="text-xs bg-black/20 p-1.5 rounded flex justify-between">
                          <span className="text-ivory">{art?.name}</span>
                          <span className={a.appearsReal ? 'text-jade' : 'text-vermilion'}>
                            {a.appearsReal ? '看似真品' : '看似赝品'}
                          </span>
                        </div>
                      );
                    })}
                    {g.flipUsedThisRound && roleInfo.faction === 'xuyuan' && roleInfo.id !== 'jiyunfu' && (
                      <div className="text-[10px] text-vermilion mt-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> 老朝奉已用颠倒，结果真假难辨！
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 事件日志 */}
            <div className="card-antique p-4">
              <div className="text-bronze font-antique font-bold mb-2 text-sm flex items-center gap-1">
                <ScrollText className="w-4 h-4" /> 鉴宝纪事
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {g.events.length === 0 ? (
                  <div className="text-ivory-dim text-xs">尚无记录</div>
                ) : (
                  g.events.map((e, i) => (
                    <div key={i} className="text-xs text-ivory-dim leading-relaxed border-l-2 border-bronze/30 pl-2">
                      {e}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 发言记录 */}
            {g.phase !== 'waiting' && Object.keys(g.speeches).length > 0 && (
              <div className="card-antique p-4">
                <div className="text-bronze font-antique font-bold mb-2 text-sm">诸位发言</div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {g.speechOrder.map(pid => {
                    const p = room.players.find(x => x.id === pid);
                    const sp = g.speeches[pid];
                    if (!sp) return null;
                    return (
                      <div key={pid} className="text-xs">
                        <span className="text-bronze font-bold">{p?.name}：</span>
                        <span className="text-ivory">{sp}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* 角色揭示弹窗 */}
      {showRoleCard && roleInfo && (
        <RoleRevealModal roleInfo={roleInfo} onClose={() => setShowRoleCard(false)} />
      )}

      {game.error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-vermilion/90 text-ivory px-4 py-2 rounded-md text-sm animate-float-in z-50">
          {game.error}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 阶段标签
// ============================================================
function PhaseBadge({ phase }: { phase: string }) {
  const map: Record<string, { label: string; color: string }> = {
    waiting: { label: '等候', color: 'text-ivory-dim' },
    roleReveal: { label: '揭身份', color: 'text-gold-glow' },
    appraise: { label: '鉴宝', color: 'text-bronze' },
    discuss: { label: '发言', color: 'text-jade' },
    vote: { label: '押币', color: 'text-vermilion' },
    reveal: { label: '揭示', color: 'text-gold-glow' },
    ended: { label: '终局', color: 'text-vermilion' },
  };
  const m = map[phase] || map.waiting;
  return <span className={`font-bold ${m.color}`}>{m.label}</span>;
}

// ============================================================
// 兽首展示板
// ============================================================
function ZodiacBoard({ room, game }: { room: any; game: any }) {
  const g = room.game;
  if (!g.artifacts.length) {
    return <div className="card-antique p-8 text-center text-ivory-dim">等待开局…</div>;
  }

  const isReveal = g.phase === 'reveal';
  const me = game.me;
  const myRole = game.myRole;

  return (
    <div className="card-antique p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-bronze font-antique font-bold flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> 十二兽首
        </div>
        <div className="text-ivory-dim text-xs">
          {isReveal ? '押币结果揭示中' : g.phase === 'vote' ? '选择押币目标' : '点击鉴定真伪'}
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {g.revealedArtifacts.length > 0 ? g.revealedArtifacts.map((a: any) => (
          <ZodiacTile
            key={a.id}
            name={a.name}
            state={
              a.hidden ? 'hidden' :
              a.isReal === true ? 'real' :
              a.isReal === false ? 'fake' :
              'normal'
            }
            betCount={a.betCount}
          />
        )) : g.artifacts.map((a: any) => {
          const myAppraisal = game.myAppraisals[g.currentRound]?.find((r: any) => r.artifactId === a.id);
          return (
            <ZodiacTile
              key={a.id}
              name={a.name}
              state={a.locked ? 'locked' : myAppraisal ? (myAppraisal.appearsReal ? 'appraised-real' : 'appraised-fake') : 'normal'}
              myView={myAppraisal?.appearsReal}
              showMyView={!!myAppraisal}
            />
          );
        })}
      </div>
    </div>
  );
}

function ZodiacTile({ name, state, betCount, myView, showMyView }: {
  name: string;
  state: 'normal' | 'locked' | 'real' | 'fake' | 'hidden' | 'appraised-real' | 'appraised-fake';
  betCount?: number;
  myView?: boolean;
  showMyView?: boolean;
}) {
  const cls = {
    normal: '',
    locked: 'locked',
    real: 'revealed-real',
    fake: 'revealed-fake',
    hidden: 'hidden-card',
    'appraised-real': 'selected',
    'appraised-fake': 'selected',
  }[state];

  return (
    <div className={`zodiac-card ${cls} aspect-[3/4] flex flex-col items-center justify-center p-2`}>
      <div className="font-brush text-2xl text-bronze mb-0.5">{name[0]}</div>
      <div className="text-[10px] text-ivory-dim">{name[1]}</div>
      {state === 'locked' && <Lock className="w-3 h-3 text-vermilion mt-1" />}
      {showMyView && (
        <div className={`text-[10px] mt-1 ${myView ? 'text-jade' : 'text-vermilion'}`}>
          {myView ? '似真' : '似假'}
        </div>
      )}
      {betCount !== undefined && betCount > 0 && (
        <div className="text-[10px] text-gold-glow mt-1 flex items-center gap-0.5">
          <Coins className="w-2.5 h-2.5" /> {betCount}
        </div>
      )}
      {state === 'real' && <div className="text-[10px] text-jade mt-1 font-bold">真品</div>}
      {state === 'fake' && <div className="text-[10px] text-vermilion mt-1 font-bold">赝品</div>}
      {state === 'hidden' && <div className="text-[10px] text-ivory-dim mt-1">已隐</div>}
    </div>
  );
}

// ============================================================
// 阶段操作区
// ============================================================
function PhaseAction({ room, game, speech, setSpeech }: { room: any; game: any; speech: string; setSpeech: (s: string) => void }) {
  const g = room.game;
  const me = game.me;
  const myRole = game.myRole;
    // @ts-ignore 7053
  const roleInfo = myRole ? ROLE_INFO[myRole as any] : null;
  const round = g.currentRound;

  // 鉴宝阶段
  if (g.phase === 'appraise') {
    return <AppraisePanel room={room} game={game} />;
  }

  // 发言阶段
  if (g.phase === 'discuss') {
    const currentSpeakerId = g.speechOrder[g.currentSpeakerIndex];
    const isMyTurn = currentSpeakerId === me.id;
    const currentSpeaker = room.players.find((p: any) => p.id === currentSpeakerId);

    return (
      <div className="card-antique p-4">
        <div className="text-bronze font-antique font-bold mb-3">发言环节</div>
        {isMyTurn ? (
          <div className="space-y-3">
            <div className="text-ivory-dim text-sm">轮到你发言，陈述你的鉴宝所见与推断：</div>
            <div className="flex gap-2">
              <Input
                value={speech}
                onChange={(e) => setSpeech(e.target.value)}
                placeholder="畅所欲言…"
                maxLength={200}
                className="input-antique"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && speech.trim()) {
                    send({ type: 'speech', content: speech.trim() });
                    setSpeech('');
                  }
                }}
              />
              <Button
                onClick={() => {
                  if (speech.trim()) {
                    send({ type: 'speech', content: speech.trim() });
                    setSpeech('');
                  }
                }}
                className="btn-bronze"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-ivory-dim text-sm">
            等待 <span className="text-bronze font-bold">{currentSpeaker?.name}</span> 发言…
          </div>
        )}
      </div>
    );
  }

  // 押币阶段
  if (g.phase === 'vote') {
    return <VotePanel room={room} game={game} />;
  }

  // 揭示阶段
  if (g.phase === 'reveal') {
    return <RevealPanel room={room} game={game} />;
  }

  return null;
}

// ============================================================
// 鉴宝面板
// ============================================================
function AppraisePanel({ room, game }: { room: any; game: any }) {
  const g = room.game;
  const me = game.me;
  const myRole = game.myRole;
    // @ts-ignore 7053
  const roleInfo = myRole ? ROLE_INFO[myRole as any] : null;
  const myAppraisals = game.myAppraisals[g.currentRound] || [];
  const sealedRound = game.sealedRounds.includes(g.currentRound);

  if (!roleInfo) return <div className="card-antique p-4">等待角色分配…</div>;

  const canAppraise = roleInfo.appraiseCount > 0 && !sealedRound;
  const appraisedCount = game.myAppraisals[g.currentRound]?.length || 0;
  const remaining = roleInfo.appraiseCount - appraisedCount;

  const handleAppraise = (artifactId: number) => {
    if (remaining <= 0) { toast.error('本轮鉴宝次数已用完'); return; }
    send({ type: 'appraise', artifactId });
  };

  return (
    <div className="card-antique p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-bronze font-antique font-bold">鉴宝阶段 · 第{g.currentRound}轮</div>
        {canAppraise ? (
          <div className="text-sm text-ivory-dim">
            剩余鉴定次数：<span className="text-gold-glow font-bold">{remaining}</span> / {roleInfo.appraiseCount}
          </div>
        ) : (
          <div className="text-sm text-vermilion">
            {sealedRound ? '本轮已被封印' : roleInfo.appraiseCount === 0 ? '本角色不擅鉴宝' : '无法鉴宝'}
          </div>
        )}
      </div>

      {/* 技能操作区 */}
      <SkillPanel room={room} game={game} />

      {/* 兽首选择鉴宝 */}
      {canAppraise && remaining > 0 && (
        <div>
          <div className="text-ivory-dim text-sm mb-2">点击兽首进行鉴定：</div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {g.artifacts.map((a: any) => {
              const appraised = myAppraisals.some((r: any) => r.artifactId === a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => handleAppraise(a.id)}
                  disabled={appraised || a.locked}
                  className={`zodiac-card aspect-square flex items-center justify-center p-1 ${
                    appraised || a.locked ? 'disabled' : ''
                  }`}
                >
                  <span className="font-brush text-lg text-bronze">{a.name[0]}</span>
                  {a.locked && <Lock className="w-3 h-3 text-vermilion absolute top-1 right-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 完成鉴宝按钮（房主） */}
      {me.isHost && (
        <div className="pt-2 border-t border-bronze/20">
          <Button
            onClick={() => send({ type: 'finishAppraise' })}
            className="btn-bronze w-full h-10"
          >
            所有人鉴宝完毕 · 进入发言
          </Button>
          <div className="text-ivory-dim text-xs text-center mt-1">
            确认全员完成鉴宝与技能后点击推进
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 指定下一个鉴宝玩家面板
// ============================================================
function PassTurnPanel({ room, game, finishedAppraisers, onPass }: {
  room: any;
  game: any;
  finishedAppraisers: string[];
  onPass: (nextPlayerId: string) => void;
}) {
  const me = game.me;
  const candidates = room.players.filter((p: any) =>
    p.id !== me.id && !finishedAppraisers.includes(p.id)
  );

  return (
    <div className="bg-gold-glow/5 p-3 rounded-md border border-gold-glow/30 animate-float-in">
      <div className="text-gold-glow text-sm font-bold mb-2 flex items-center gap-1">
        <Sparkles className="w-4 h-4" /> 你的鉴宝已完毕
      </div>
      <div className="text-ivory-dim text-xs mb-3">请指定下一位鉴宝玩家：</div>
      <div className="flex flex-wrap gap-2">
        {candidates.map((p: any) => (
          <button
            key={p.id}
            onClick={() => onPass(p.id)}
            className="btn-bronze px-3 py-1.5 rounded text-sm flex items-center gap-1.5"
          >
            <span className="player-token w-6 h-6 text-[10px]">{p.name[0]}</span>
            {p.name}
          </button>
        ))}
      </div>
      {candidates.length === 0 && (
        <div className="text-ivory-dim text-xs">所有人已鉴宝完毕</div>
      )}
    </div>
  );
}

// ============================================================
// 技能面板
// ============================================================
function SkillPanel({ room, game }: { room: any; game: any }) {
  const me = game.me;
  const myRole = game.myRole;
  const g = room.game;
  if (!myRole) return null;

  // 老朝奉：颠倒乾坤
  if (myRole === 'laochaofeng') {
    const used = g.flipUsedThisRound;
    return (
      <div className="bg-black/20 p-3 rounded-md border border-bronze/20">
        <div className="text-sm text-bronze font-bold mb-1 flex items-center gap-1">
          <Sparkles className="w-4 h-4" /> 颠倒乾坤
        </div>
        <div className="text-xs text-ivory-dim mb-2">使用后，所有好人本轮的鉴宝结果真假互换。</div>
        <Button
          onClick={() => send({ type: 'laochaofengFlip', use: !used })}
          className={used ? 'btn-seal' : 'btn-ghost'}
          disabled={used}
        >
          {used ? '已施展颠倒' : '施展颠倒乾坤'}
        </Button>
      </div>
    );
  }

  // 药不然：封印
  if (myRole === 'yaoburan') {
    const targets = room.players.filter((p: any) => p.id !== me.id && !p.visiblySealed);
    return (
      <div className="bg-black/20 p-3 rounded-md border border-bronze/20">
        <div className="text-sm text-bronze font-bold mb-1 flex items-center gap-1">
          <Lock className="w-4 h-4" /> 封印之术
        </div>
        <div className="text-xs text-ivory-dim mb-2">选择一名玩家封印，使其本轮无法鉴宝且技能失效。</div>
        <div className="flex flex-wrap gap-1.5">
          {targets.map((p: any) => (
            <button
              key={p.id}
              onClick={() => send({ type: 'yaoburanSeal', targetId: p.id })}
              className="btn-ghost px-3 py-1 rounded text-xs"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 郑国渠：封存兽首
  if (myRole === 'zhengguoqu') {
    const locked = g.artifacts.find((a: any) => a.locked);
    return (
      <div className="bg-black/20 p-3 rounded-md border border-bronze/20">
        <div className="text-sm text-bronze font-bold mb-1 flex items-center gap-1">
          <Lock className="w-4 h-4" /> 封存兽首
        </div>
        <div className="text-xs text-ivory-dim mb-2">选择一件兽首封存，使其本轮无法被任何人鉴定。</div>
        {locked ? (
          <div className="text-xs text-vermilion">已封存【{locked.name}】</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {g.artifacts.map((a: any) => (
              <button
                key={a.id}
                onClick={() => send({ type: 'zhengguoquLock', artifactId: a.id })}
                className="btn-ghost px-2.5 py-1 rounded text-xs"
              >
                {a.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 方震：查验阵营
  if (myRole === 'fangzhen') {
    const checked = game.fangzhenResults.find((r: any) => r.round === g.currentRound);
    const targets = room.players.filter((p: any) => p.id !== me.id);
    return (
      <div className="bg-black/20 p-3 rounded-md border border-bronze/20">
        <div className="text-sm text-bronze font-bold mb-1 flex items-center gap-1">
          <Eye className="w-4 h-4" /> 明察秋毫
        </div>
        <div className="text-xs text-ivory-dim mb-2">查验一名玩家所属阵营。</div>
        {checked ? (
          <div className="text-xs">
            已查验 <span className="text-ivory">{checked.targetName}</span>：
            <span className={checked.faction === 'xuyuan' ? 'text-jade' : 'text-vermilion'}>
              {checked.faction === 'xuyuan' ? ' 好人阵营' : ' 坏人阵营'}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {targets.map((p: any) => (
              <button
                key={p.id}
                onClick={() => send({ type: 'fangzhenCheck', targetId: p.id })}
                className="btn-ghost px-3 py-1 rounded text-xs"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ============================================================
// 押币面板
// ============================================================
function VotePanel({ room, game }: { room: any; game: any }) {
  const g = room.game;
  const me = game.me;
  const myBet = me.betArtifactId;

  // 实时统计每件兽首的押币数
  const betCounts: Record<number, number> = {};
  for (const p of room.players) {
    if (p.betArtifactId !== undefined) {
      betCounts[p.betArtifactId] = (betCounts[p.betArtifactId] || 0) + 1;
    }
  }
  const betPlayerCount = room.players.filter((p: any) => p.betArtifactId !== undefined).length;
  const maxBet = Math.max(1, ...Object.values(betCounts) as number[]);

  return (
    <div className="card-antique p-4 space-y-3">
      <div className="text-bronze font-antique font-bold flex items-center gap-2">
        <Coins className="w-4 h-4" /> 押币环节 · 第{g.currentRound}轮
      </div>
      <div className="text-ivory-dim text-sm leading-relaxed">
        {myBet !== undefined
          ? <>已押币，等待其他玩家… <span className="text-jade">（可重新选择）</span></>
          : '选择一件你认为值得关注的兽首进行押币。押币最多者将被隐藏，第二多者予以揭露。'}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {g.artifacts.map((a: any) => {
          const count = betCounts[a.id] || 0;
          const isMyBet = myBet === a.id;
          const isTopBet = count === maxBet && count > 0;
          return (
            <button
              key={a.id}
              onClick={() => send({ type: 'bet', artifactId: a.id })}
              className={`zodiac-card aspect-[3/4] flex flex-col items-center justify-center p-2 relative ${
                isMyBet ? 'selected' : ''
              } ${a.locked ? 'locked' : ''}`}
              disabled={a.locked}
            >
              <div className="font-brush text-2xl text-bronze mb-0.5">{a.name[0]}</div>
              <div className="text-[10px] text-ivory-dim">{a.name[1]}</div>
              {a.locked && <Lock className="w-3 h-3 text-vermilion mt-1" />}
              {/* 实时押币数 */}
              <div className={`mt-1 flex items-center gap-0.5 text-[11px] font-bold ${
                isTopBet ? 'text-gold-glow' : 'text-ivory-dim'
              }`}>
                <Coins className="w-3 h-3" />
                <span>{count}</span>
              </div>
              {/* 押币进度条 */}
              {count > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30 rounded-b overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isTopBet ? 'bg-gold-glow' : 'bg-bronze'
                    }`}
                    style={{ width: `${(count / maxBet) * 100}%` }}
                  />
                </div>
              )}
              {/* 我的押币标记 */}
              {isMyBet && (
                <div className="absolute top-1 right-1 text-[9px] text-gold-glow font-bold bg-black/50 rounded px-1">
                  我
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 押币进度 */}
      <div className="flex items-center gap-2 text-xs text-ivory-dim">
        <div className="flex-1 bg-black/30 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-bronze transition-all duration-500"
            style={{ width: `${(betPlayerCount / room.players.length) * 100}%` }}
          />
        </div>
        <span>{betPlayerCount} / {room.players.length} 已押</span>
      </div>
    </div>
  );
}

// ============================================================
// 揭示面板
// ============================================================
function RevealPanel({ room, game }: { room: any; game: any }) {
  const g = room.game;
  const me = game.me;
  const revealed = g.revealedArtifacts || [];
  const hiddenArtifact = revealed.find((a: any) => a.hidden);
  const exposedArtifact = revealed.find((a: any) => !a.hidden);
  const scoreReached = g.xuyuanScore >= g.targetScore;
  const isLastRound = g.currentRound >= 3;

  return (
    <div className="card-antique-glow p-4 sm:p-6 space-y-4">
      <div className="text-center">
        <div className="text-gold-glow font-brush text-2xl sm:text-3xl mb-1">本轮揭示</div>
        <div className="text-ivory-dim text-xs sm:text-sm">第{g.currentRound}轮 · 押币结果揭晓</div>
      </div>

      {/* 揭示的兽首卡片 */}
      {revealed.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-lg mx-auto">
          {/* 隐藏的兽首（押币最多） */}
          <div className="text-center">
            <div className="text-ivory-dim text-xs mb-2 flex items-center justify-center gap-1">
              <Eye className="w-3 h-3" /> 隐藏兽首（押币最多）
            </div>
            {hiddenArtifact ? (
              <div className="zodiac-card hidden-card aspect-[3/4] flex flex-col items-center justify-center p-3 mx-auto max-w-[140px]">
                <div className="font-brush text-3xl sm:text-4xl text-bronze mb-1">{hiddenArtifact.name[0]}</div>
                <div className="text-[10px] text-ivory-dim">{hiddenArtifact.name[1]}</div>
                <div className="text-[10px] text-ivory-dim mt-2 flex items-center gap-0.5">
                  <Coins className="w-2.5 h-2.5" /> {hiddenArtifact.betCount} 押
                </div>
                <div className="text-[10px] text-ivory-dim mt-1">真相隐于迷雾</div>
              </div>
            ) : (
              <div className="text-ivory-dim text-xs">—</div>
            )}
          </div>

          {/* 揭露的兽首（押币第二多） */}
          <div className="text-center">
            <div className="text-ivory-dim text-xs mb-2 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3" /> 揭露兽首（押币次多）
            </div>
            {exposedArtifact ? (
              <div className={`zodiac-card aspect-[3/4] flex flex-col items-center justify-center p-3 mx-auto max-w-[140px] ${
                exposedArtifact.isReal ? 'revealed-real' : 'revealed-fake'
              }`}>
                <div className="font-brush text-3xl sm:text-4xl text-bronze mb-1">{exposedArtifact.name[0]}</div>
                <div className="text-[10px] text-ivory-dim">{exposedArtifact.name[1]}</div>
                <div className={`text-sm font-bold mt-2 ${
                  exposedArtifact.isReal ? 'text-jade' : 'text-vermilion'
                }`}>
                  {exposedArtifact.isReal ? '真品' : '赝品'}
                </div>
                <div className="text-[10px] text-ivory-dim mt-1 flex items-center gap-0.5">
                  <Coins className="w-2.5 h-2.5" /> {exposedArtifact.betCount} 押
                </div>
              </div>
            ) : (
              <div className="text-ivory-dim text-xs">—</div>
            )}
          </div>
        </div>
      )}

      {/* 得分动画 */}
      <div className="text-center py-2">
        {exposedArtifact && (
          <div className="animate-float-in">
            {exposedArtifact.isReal ? (
              <div className="text-jade font-antique text-base sm:text-lg">
                真品现世 · 许愿阵营 <span className="font-brush text-xl sm:text-2xl">+1</span> 分
              </div>
            ) : (
              <div className="text-vermilion font-antique text-base sm:text-lg">
                赝品混淆 · 好人未能得分
              </div>
            )}
          </div>
        )}
      </div>

      {/* 当前总分 */}
      <div className="flex items-center justify-center gap-4">
        <div className="text-center">
          <div className="text-ivory-dim text-xs">许愿阵营</div>
          <div className="text-gold-glow font-brush text-2xl sm:text-3xl">{g.xuyuanScore}</div>
        </div>
        <div className="text-ivory-dim text-sm">/</div>
        <div className="text-center">
          <div className="text-ivory-dim text-xs">目标</div>
          <div className="text-bronze font-brush text-2xl sm:text-3xl">{g.targetScore}</div>
        </div>
      </div>

      {/* 事件日志 */}
      {g.events.length > 0 && (
        <div className="bg-black/20 rounded-md p-3 max-h-32 overflow-y-auto">
          <div className="space-y-1">
            {g.events.slice(-4).map((e: string, i: number) => (
              <div key={i} className="text-xs text-ivory-dim leading-relaxed border-l-2 border-bronze/30 pl-2">
                {e}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 房主操作 */}
      {me.isHost && !scoreReached && (
        <div className="pt-2 border-t border-bronze/20 text-center">
          <Button
            onClick={() => send({ type: 'nextRound' })}
            className="btn-bronze w-full sm:w-auto h-11 px-8 text-base"
          >
            {isLastRound ? '查看终局' : '进入下一轮'}
          </Button>
          <div className="text-ivory-dim text-xs mt-1">
            {isLastRound ? '三轮结束，查看最终结果' : '确认后进入下一轮鉴宝'}
          </div>
        </div>
      )}
      {scoreReached && (
        <div className="pt-2 border-t border-bronze/20 text-center">
          <div className="text-gold-glow font-antique text-lg mb-2">目标分数已达！</div>
          {me.isHost && (
            <Button
              onClick={() => send({ type: 'nextRound' })}
              className="btn-bronze w-full sm:w-auto h-11 px-8"
            >
              查看终局
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 角色揭示弹窗
// ============================================================
function RoleRevealModal({ roleInfo, onClose }: { roleInfo: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="card-antique-glow p-8 max-w-md w-full animate-seal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <div className="text-ivory-dim text-sm mb-1">你的身份是</div>
          <div className={`text-xs px-3 py-1 rounded-full inline-block mb-4 ${
            roleInfo.faction === 'xuyuan' ? 'text-jade border border-jade/40' : 'text-vermilion border border-vermilion/40'
          }`}>
            {roleInfo.faction === 'xuyuan' ? '许愿阵营 · 好人' : '老朝奉阵营 · 坏人'}
          </div>
        </div>

        <div className="flex flex-col items-center mb-4">
          <div
            className="w-24 h-24 rounded-xl flex items-center justify-center font-brush text-5xl mb-3 animate-glow"
            style={{background: `${roleInfo.color}22`, color: roleInfo.color, border: `2px solid ${roleInfo.color}`}}
          >
            {roleInfo.glyph}
          </div>
          <div className="font-brush text-4xl mb-1" style={{color: roleInfo.color}}>{roleInfo.name}</div>
          <div className="text-ivory-dim text-sm">{roleInfo.title}</div>
        </div>

        <div className="bg-black/30 p-3 rounded-md mb-3">
          <div className="text-bronze text-xs mb-1">技能</div>
          <div className="text-ivory text-sm leading-relaxed">{roleInfo.ability}</div>
        </div>

        <div className="bg-black/20 p-3 rounded-md mb-4">
          <div className="text-ivory-dim text-xs">{roleInfo.bio}</div>
        </div>

        <Button onClick={onClose} className="btn-seal w-full h-12 text-lg">
          入 局
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// 终局画面
// ============================================================
function EndScreen({ room, game, onRestart, onLeave, isHost }: any) {
  const g = room.game;
  const winner = g.winner;
  const isXuyuanWin = winner === 'xuyuan';
  const myRole = game.myRole;
  // @ts-ignore 7053
  const myRoleInfo = myRole ? ROLE_INFO[myRole as any] : null;
  const myFaction = myRoleInfo?.faction;
  const iWon = myFaction === winner;

  // 按阵营分组玩家
  const xuyuanPlayers = room.players.filter((p: any) => {
    // @ts-ignore 7053
    const r = p.role ? ROLE_INFO[p.role as any] : null;
    return r?.faction === 'xuyuan';
  });
  const laochaofengPlayers = room.players.filter((p: any) => {
    // @ts-ignore 7053
    const r = p.role ? ROLE_INFO[p.role as any] : null;
    return r?.faction === 'laochaofeng';
  });

  return (
    <div className="card-antique-glow p-4 sm:p-8 text-center animate-seal">
      {/* 胜利公告 */}
      <div className="mb-4">
        <div className={`font-brush text-4xl sm:text-5xl mb-2 ${isXuyuanWin ? 'text-jade' : 'text-vermilion'}`}>
          {isXuyuanWin ? '许愿阵营 · 胜' : '老朝奉阵营 · 胜'}
        </div>
        <div className="text-ivory-dim text-sm sm:text-base mb-1">
          {isXuyuanWin ? '鉴破真伪，护得国宝' : '真伪混淆，国宝蒙尘'}
        </div>
        {myRoleInfo && (
          <div className={`text-xs sm:text-sm font-bold ${iWon ? 'text-gold-glow' : 'text-ivory-dim'}`}>
            {iWon ? '★ 你所属阵营获胜 ★' : '你所属阵营败北'}
          </div>
        )}
      </div>

      <div className="divider-antique"></div>

      {/* 最终比分 */}
      <div className="flex items-center justify-center gap-6 sm:gap-8 mb-6">
        <div className="text-center">
          <div className="text-jade text-xs mb-1">许愿阵营</div>
          <div className={`font-brush text-3xl sm:text-4xl ${isXuyuanWin ? 'text-jade' : 'text-ivory-dim'}`}>
            {g.xuyuanScore}
          </div>
        </div>
        <div className="text-ivory-dim text-xl">vs</div>
        <div className="text-center">
          <div className="text-vermilion text-xs mb-1">目标分数</div>
          <div className="font-brush text-3xl sm:text-4xl text-bronze">{g.targetScore}</div>
        </div>
      </div>

      <div className="divider-antique"></div>

      {/* 终局日志 */}
      {g.endLog.length > 0 && (
        <>
          <div className="text-bronze font-antique font-bold mb-2 text-sm">终局纪事</div>
          <div className="text-left max-w-md mx-auto space-y-1.5 mb-6 bg-black/20 p-3 rounded-md">
            {g.endLog.map((line: string, i: number) => (
              <div key={i} className="text-xs text-ivory-dim leading-relaxed">{line}</div>
            ))}
          </div>
          <div className="divider-antique"></div>
        </>
      )}

      {/* 身份揭晓 — 按阵营分组 */}
      <div className="text-bronze font-antique font-bold mb-3 text-sm sm:text-base">身份揭晓</div>

      {/* 许愿阵营 */}
      <div className="mb-4">
        <div className="text-jade text-xs font-bold mb-2 flex items-center justify-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-jade"></span>
          许愿阵营（{xuyuanPlayers.length}人）
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {xuyuanPlayers.map((p: any) => {
            // @ts-ignore 7053
            const r = p.role ? ROLE_INFO[p.role as any] : null;
            const isMe = p.id === game.me?.id;
            return (
              <div key={p.id} className={`p-2 rounded-md border ${
                isMe ? 'bg-bronze/10 border-gold-glow/50' : 'bg-black/20 border-jade/20'
              }`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="player-token w-6 h-6 text-[10px]">{p.name[0]}</div>
                  <div className="text-ivory text-xs font-bold truncate">
                    {p.name}{isMe ? '（我）' : ''}
                  </div>
                </div>
                {r && (
                  <div className="font-brush text-base" style={{color: r.color}}>{r.name}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 老朝奉阵营 */}
      <div className="mb-6">
        <div className="text-vermilion text-xs font-bold mb-2 flex items-center justify-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-vermilion"></span>
          老朝奉阵营（{laochaofengPlayers.length}人）
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {laochaofengPlayers.map((p: any) => {
            // @ts-ignore 7053
            const r = p.role ? ROLE_INFO[p.role as any] : null;
            const isMe = p.id === game.me?.id;
            return (
              <div key={p.id} className={`p-2 rounded-md border ${
                isMe ? 'bg-bronze/10 border-gold-glow/50' : 'bg-black/20 border-vermilion/20'
              }`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="player-token w-6 h-6 text-[10px]">{p.name[0]}</div>
                  <div className="text-ivory text-xs font-bold truncate">
                    {p.name}{isMe ? '（我）' : ''}
                  </div>
                </div>
                {r && (
                  <div className="font-brush text-base" style={{color: r.color}}>{r.name}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="divider-antique"></div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {isHost && (
          <Button onClick={onRestart} className="btn-bronze h-12 px-8 text-base">
            再 开 一 局
          </Button>
        )}
        <Button onClick={onLeave} className="btn-ghost h-12 px-8 text-base">
          返回大厅
        </Button>
      </div>
    </div>
  );
}
