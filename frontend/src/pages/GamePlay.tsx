import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { connectGame, disconnectGame, send, useGameState } from '@/lib/game/client';
import { ROLE_INFO } from '@/lib/game/roles';
import { RoleId } from '@/shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Crown, Bot, Send, Lock, Eye, Sparkles, ScrollText, Coins, Users, Target, Vote, History } from 'lucide-react';
import { toast } from 'sonner';

export default function GamePlay() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const name = searchParams.get('name') || '匿名玩家';
  const pid = searchParams.get('pid') || undefined;
  const navigate = useNavigate();
  const game = useGameState();
  const knownAllies = game.knownAllies || [];
  const remainingVotes = game.remainingVotes || 0;
  const [connecting, setConnecting] = useState(true);
  const [speech, setSpeech] = useState('');
  const [showRoleCard, setShowRoleCard] = useState(false);
  const [seatSwapMode, setSeatSwapMode] = useState(false);
  const [showRole, setShowRole] = useState(false); // 身份卡默认折叠，点击按钮展开
  const [showHistory, setShowHistory] = useState(false); // 历史行动弹窗

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
              {[...room.players]
                .sort((a: any, b: any) => (a.seatNumber || 99) - (b.seatNumber || 99))
                .map((p: any) => {
                const isMe = p.id === me.id;
                const isCurrentSpeaker = g.phase === 'discuss' && g.speechOrder[g.currentSpeakerIndex] === p.id;
                const isCurrentAppraiser = g.phase === 'appraise' && g.currentAppraiserId === p.id;
                const hasFinishedAppraise = (g.finishedAppraisers || []).includes(p.id);
                const appraiseIdx = (g.appraiseOrder || []).indexOf(p.id);
                const canSwapTarget = seatSwapMode && !isMe;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (canSwapTarget) { send({ type: 'changeSeat', targetId: p.id }); setSeatSwapMode(false); }
                    }}
                    className={`p-2 rounded-md border transition-all min-w-[140px] lg:min-w-0 shrink-0 lg:shrink ${
                      (isCurrentSpeaker || isCurrentAppraiser) ? 'border-gold-glow animate-glow' : 'border-bronze/20'
                    } ${isMe ? 'bg-bronze/10' : 'bg-black/20'} ${canSwapTarget ? 'cursor-pointer ring-2 ring-gold-glow/60' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="player-token w-7 h-7 sm:w-8 sm:h-8 text-sm shrink-0 flex items-center justify-center" style={{fontSize: '12px'}}>
                        {p.seatNumber && p.seatNumber > 0 ? p.seatNumber : p.name[0]}
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
                          {p.seatNumber > 0 && (
                            <span className="text-[10px] text-bronze/70">座位 {p.seatNumber}</span>
                          )}
                          {g.phase === 'appraise' && appraiseIdx >= 0 && (
                            <span className="text-[10px] text-ivory-dim">#{appraiseIdx + 1}</span>
                          )}
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
                          {g.phase === 'vote' && p.betArtifactIds !== undefined && p.betArtifactIds.length > 0 && (
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

            {/* 落座阶段：可调整座位 */}
            {g.phase === 'waiting' && (
              <div className="mt-3">
                {!seatSwapMode ? (
                  <button
                    onClick={() => setSeatSwapMode(true)}
                    className="btn-ghost w-full h-9 text-xs border border-bronze/30"
                  >
                    调整座位（与某人交换）
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="text-[10px] text-gold-glow text-center">点击其他玩家与其交换座位</div>
                    <button
                      onClick={() => setSeatSwapMode(false)}
                      className="btn-bronze w-full h-9 text-xs"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            )}

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
            {/* 角色卡（默认折叠，点击按钮展开） */}
            {roleInfo && (
              showRole ? (
              <div className="card-antique-glow p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-ivory-dim text-xs">我的身份</span>
                  <button
                    onClick={() => setShowRole(false)}
                    className="text-[10px] text-ivory-dim hover:text-bronze border border-bronze/30 rounded px-2 py-0.5"
                  >
                    收起
                  </button>
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

                {/* 已知队友（老朝奉阵营） */}
                {knownAllies.length > 0 && (
                  <div className="mt-3 bg-vermilion/10 border border-vermilion/20 p-2 rounded">
                    <div className="text-vermilion text-xs font-bold mb-1 flex items-center gap-1">
                      <Eye className="w-3 h-3" /> 已知队友
                    </div>
                    <div className="space-y-1">
                      {knownAllies.map((ally: any) => {
                        const allyRole = (ROLE_INFO as any)[ally.roleId];
                        return (
                          <div key={ally.playerId} className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded">
                            <div className="player-token w-5 h-5 text-[9px]">{ally.playerName[0]}</div>
                            <span className="text-xs text-ivory">{ally.playerName}</span>
                            <span className="text-xs text-vermilion font-bold">·</span>
                            <span className="text-xs text-vermilion">{allyRole?.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                        <Sparkles className="w-3 h-3" /> 本轮鉴定结果或有颠倒，真假难辨！
                      </div>
                    )}
                  </div>
                )}
              </div>
              ) : (
                <button
                  onClick={() => setShowRole(true)}
                  className="card-antique-glow p-4 w-full text-left hover:border-gold-glow/50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-bronze font-antique font-bold text-sm">我的身份</span>
                    <span className="text-[10px] text-ivory-dim">点击查看 ▸</span>
                  </div>
                  <div className="text-ivory-dim text-[11px] mt-1">角色与队友信息已隐藏</div>
                </button>
              )
            )}

            {/* 历史行动按钮 */}
            {roleInfo && (
              <button
                onClick={() => setShowHistory(true)}
                className="btn-ghost w-full h-10 text-sm border border-bronze/30 flex items-center justify-center gap-2"
              >
                <History className="w-4 h-4" /> 我的历史行动
              </button>
            )}

            {/* 行动顺序 */}
            {(g.phase === 'appraise' || g.phase === 'discuss' || g.phase === 'vote' || g.phase === 'reveal') && (
              <AppraiseOrderPanel room={room} game={game} />
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
        <RoleRevealModal roleInfo={roleInfo} knownAllies={knownAllies} onClose={() => setShowRoleCard(false)} />
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
  return <span className={`phase-badge ${m.color}`}>{m.label}</span>;
}

// ============================================================
// 兽首展示板
// ============================================================
function ZodiacBoard({ room, game }: { room: any; game: any }) {
  const g = room.game;
  if (!g.artifacts.length) {
    return <div className="card-antique p-8 text-center text-ivory-dim">等待开局…</div>;
  }

  const isReveal = g.phase === 'reveal' || g.phase === 'ended';
  const me = game.me;
  const myRole = game.myRole;
  const myTurn = g.phase === 'appraise' && g.currentAppraiserId === me.id;

  // 获取当前轮的投票明细
  const currentRoundData = (g.rounds || [])[g.currentRound - 1];
  const playerVotes: Record<string, number[]> = currentRoundData?.playerVotes || {};

  return (
    <div className={`card-antique p-4 ${myTurn ? 'ring-active' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-bronze font-antique font-bold flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> 十二兽首
        </div>
        <div className="text-ivory-dim text-xs">
          {isReveal ? '押币结果揭示中' : g.phase === 'vote' ? '选择押币目标' : myTurn ? '轮到你，点击鉴宝' : '点击鉴定真伪'}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {g.revealedArtifacts.length > 0
          ? g.revealedArtifacts.map((a: any) => {
              // 找到投了这个兽首的玩家
              const voters = Object.entries(playerVotes)
                .filter(([_, votes]) => (votes as number[]).includes(a.id))
                .map(([pid]) => room.players.find((p: any) => p.id === pid))
                .filter(Boolean);
              // 统计每个玩家投了几票
              const voterCounts: Record<string, number> = {};
              for (const [pid, votes] of Object.entries(playerVotes)) {
                const count = (votes as number[]).filter(id => id === a.id).length;
                if (count > 0) voterCounts[pid] = count;
              }
              return (
                <div key={a.id} className="card-antique p-2 flex flex-col items-center">
                  <div className="zodiac-card aspect-[3/4] w-full flex flex-col items-center justify-center p-2 relative">
                    <ZodiacTileInner
                      name={a.name}
                      state={
                        a.hidden ? 'hidden' :
                        a.isReal === true ? 'real' :
                        a.isReal === false ? 'fake' :
                        'normal'
                      }
                      betCount={a.betCount}
                    />
                  </div>
                  {/* 投票玩家列表 */}
                  {voters.length > 0 && (
                    <div className="w-full mt-1.5 space-y-0.5">
                      <div className="text-[10px] text-ivory-dim text-center mb-0.5">投票者</div>
                      {voters.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between bg-black/20 px-1.5 py-0.5 rounded">
                          <span className="text-[10px] text-gold-glow truncate">{p.name}</span>
                          {voterCounts[p.id] > 1 && (
                            <span className="text-[9px] text-bronze font-bold">x{voterCounts[p.id]}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {voters.length === 0 && (
                    <div className="text-[10px] text-ivory-dim mt-1">无人投票</div>
                  )}
                </div>
              );
            })
          : g.artifacts.map((a: any) => {
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
            })
        }
      </div>
    </div>
  );
}

function ZodiacTileInner({ name, state, betCount, myView, showMyView }: {
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
    <>
      <div className="zodiac-glyph text-4xl text-bronze">{name[0]}</div>
      {state === 'locked' && <Lock className="w-3 h-3 text-vermilion absolute bottom-1.5" />}
      {showMyView && (
        <div className={`text-[10px] mt-1 ${myView ? 'text-jade' : 'text-vermilion'}`}>
          {myView ? '似真' : '似假'}
        </div>
      )}
      {betCount !== undefined && betCount > 0 && (
        <div className="count-badge">{betCount}</div>
      )}
      {state === 'real' && <div className="seal-tag real">真品</div>}
      {state === 'fake' && <div className="seal-tag fake">赝品</div>}
      {state === 'hidden' && <div className="seal-tag hidden-tag">已隐匿</div>}
    </>
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
    <div className={`zodiac-card ${cls} aspect-[3/4] flex flex-col items-center justify-center p-2 overflow-hidden`}>
      <ZodiacTileInner name={name} state={state} betCount={betCount} myView={myView} showMyView={showMyView} />
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

  // 鉴人阶段
  if (g.phase === 'identify') {
    return <IdentifyPanel room={room} game={game} />;
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
  const fangzhenPenalty = !!(game.fangzhenSealPenaltyRounds || []).includes(g.currentRound);
  const myRS = game.playerRoundStates?.[me.id]?.[g.currentRound];
  const randomlyBlockedRound = !!(myRS && myRS.randomlyBlocked && !myRS.sealed);
  const [turnEnded, setTurnEnded] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [popupResult, setPopupResult] = useState<any>(null);

  const isMyTurn = g.currentAppraiserId === me.id;

  // 当不再是当前鉴宝者时，重置状态
  useEffect(() => {
    if (!isMyTurn) { setTurnEnded(false); setPendingId(null); setPopupResult(null); }
  }, [isMyTurn]);

  // 点击鉴宝后，待心跳返回结果时弹出结果弹窗
  useEffect(() => {
    if (pendingId === null) return;
    const res = (game.myAppraisals[g.currentRound] || []).find((r: any) => r.artifactId === pendingId);
    if (res) {
      setPopupResult(res);
      setPendingId(null);
    }
  }, [game.myAppraisals, pendingId, g.currentRound]);

  if (!roleInfo) return <div className="card-antique p-4">等待角色分配…</div>;

  const canAppraise = roleInfo.appraiseCount > 0 && !sealedRound && !fangzhenPenalty;
  const appraisedCount = game.myAppraisals[g.currentRound]?.length || 0;
  const remaining = roleInfo.appraiseCount - appraisedCount;
  const finishedAppraisers = g.finishedAppraisers || [];

  // 判断鉴宝是否完成（次数用完或无法鉴宝）
  const appraiseDone = !canAppraise || remaining <= 0;

  const handleAppraise = (artifactId: number) => {
    if (sealedRound) { toast.error(randomlyBlockedRound ? '你本轮心神不宁，无法鉴宝' : '你被药不然封印，本轮无法鉴宝'); return; }
    if (remaining <= 0) { toast.error('本轮鉴宝次数已用完'); return; }
    // 非郑国渠尝试鉴定被隐藏的兽首
    const art = g.artifacts.find((a: any) => a.id === artifactId);
    if (art?.locked && roleInfo.id !== 'zhengguoqu') {
      toast.error('此兽首鉴定结果已被隐藏');
      return;
    }
    setPendingId(artifactId);
    send({ type: 'appraise', artifactId });
  };

  const handleEndTurn = () => {
    setTurnEnded(true);
  };

  const handlePassTurn = (nextPlayerId: string) => {
    send({ type: 'passAppraiseTurn', nextPlayerId });
  };

  const handleFinish = () => {
    send({ type: 'finishAppraise' });
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
            {sealedRound ? (randomlyBlockedRound ? '本轮心神不宁' : '本轮已被封印')
              : fangzhenPenalty ? '你本轮丧失鉴宝能力'
                : roleInfo.appraiseCount === 0 ? '本角色不擅鉴宝' : '无法鉴宝'}
          </div>
        )}

      {/* 当前鉴宝者提示 */}
      {isMyTurn && (
        (sealedRound || fangzhenPenalty) ? (
          <div className="bg-vermilion/10 border border-vermilion/30 rounded-md px-3 py-2 text-vermilion text-sm font-bold text-center">
            {sealedRound
              ? (randomlyBlockedRound ? '轮到你，但本轮心神不宁，无法鉴宝' : '轮到你，但本轮已被封印')
              : '轮到你，但你本轮丧失鉴宝能力'}
          </div>
        ) : (
          <div className="bg-gold-glow/10 border border-gold-glow/30 rounded-md px-3 py-2 text-gold-glow text-sm font-bold text-center">
            轮到你鉴宝
          </div>
        )
      )}
      {!isMyTurn && g.currentAppraiserId && (
        <div className="text-ivory-dim text-sm text-center">
          当前鉴宝：<span className="text-bronze font-bold">{room.players.find((p: any) => p.id === g.currentAppraiserId)?.name || '—'}</span>
        </div>
      )}

      {/* 技能操作区（回合结束前可见，封印/心神不宁时不可用） */}
      {isMyTurn && !turnEnded && !sealedRound && !fangzhenPenalty && <SkillPanel room={room} game={game} />}

      {/* 兽首选择鉴宝（回合结束前可见） */}
      {isMyTurn && !turnEnded && canAppraise && remaining > 0 && (
        <div>
          <div className="text-ivory-dim text-sm mb-2">点击兽首进行鉴定：</div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {g.artifacts.map((a: any) => {
              const appraised = myAppraisals.some((r: any) => r.artifactId === a.id);
              // 只有郑国渠本人能看到被锁定的兽首
              const isLockedVisible = a.locked && roleInfo.id === 'zhengguoqu';
              return (
                <button
                  key={a.id}
                  onClick={() => handleAppraise(a.id)}
                  disabled={appraised || isLockedVisible}
                  className={`zodiac-card aspect-square flex items-center justify-center p-1 ${
                    appraised || isLockedVisible ? 'disabled' : ''
                  }`}
                >
                  <span className="font-brush text-lg text-bronze">{a.name[0]}</span>
                  {isLockedVisible && <Lock className="w-3 h-3 text-vermilion absolute top-1 right-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 是否发动技能提示 + 结束回合按钮 */}
      {isMyTurn && !turnEnded && (
        <div className="bg-bronze/5 border border-bronze/20 rounded-md p-3">
          <div className="text-ivory-dim text-xs mb-2">
            完成鉴宝和技能操作后，请点击"结束回合"按钮。
            {roleInfo.id === 'fangzhen' && ' 是否已发动【明察秋毫】技能？'}
            {roleInfo.id === 'yaoburan' && ' 是否已发动【封印之术】技能？'}
            {roleInfo.id === 'zhengguoqu' && ' 是否已发动【封存兽首】技能？'}
            {roleInfo.id === 'laochaofeng' && ' 是否已发动【颠倒乾坤】技能？'}
          </div>
          <Button onClick={handleEndTurn} className="btn-bronze w-full h-10">
            结束回合
          </Button>
        </div>
      )}

      {/* 回合结束后的操作区 */}
      {isMyTurn && turnEnded && (
        <>
          {/* 无法鉴宝弹窗提示 */}
          {appraiseDone && !canAppraise && (
            <div className="bg-vermilion/10 border border-vermilion/30 rounded-md p-3 animate-float-in">
              <div className="text-vermilion text-sm font-bold mb-1">本回合无法鉴宝</div>
              <div className="text-ivory-dim text-xs mb-3">
                {sealedRound
                  ? (randomlyBlockedRound
                      ? '你本轮心神不宁，无法鉴宝或发动技能，请指定下一位玩家。'
                      : '你被药不然封印，本回合无法鉴宝或发动技能，请指定下一位玩家。')
                  : fangzhenPenalty
                  ? '你本轮丧失鉴宝能力，请指定下一位玩家。'
                  : roleInfo.appraiseCount === 0
                  ? '你的角色不擅鉴宝，请指定下一位玩家。'
                  : '你的鉴宝次数已用完，请指定下一位玩家。'}
              </div>
            </div>
          )}

          {/* 传递回合面板 */}
          <PassTurnPanel
            room={room}
            game={game}
            finishedAppraisers={finishedAppraisers}
            onPass={handlePassTurn}
            onFinish={handleFinish}
          />
        </>
      )}

      {/* 完成鉴宝按钮（房主） */}
      {me.isHost && (() => {
        const curR = g.currentRound;
        const rnd = g.rounds?.[curR - 1];
        const finishedSet = rnd?.finishedAppraisers || [];
        const allAppraised = room.players.every((p: any) => {
          const rs = game.playerRoundStates?.[p.id]?.[curR];
          const cannot = rs && (rs.sealed || rs.randomlyBlocked);
          const noAppraise = p.role && (ROLE_INFO as any)[p.role]?.appraiseCount === 0;
          return finishedSet.includes(p.id) || cannot || noAppraise;
        });
        const doneCount = room.players.filter((p: any) => {
          const rs = game.playerRoundStates?.[p.id]?.[curR];
          const cannot = rs && (rs.sealed || rs.randomlyBlocked);
          const noAppraise = p.role && (ROLE_INFO as any)[p.role]?.appraiseCount === 0;
          return finishedSet.includes(p.id) || cannot || noAppraise;
        }).length;
        return (
          <div className="pt-2 border-t border-bronze/20">
            <Button
              onClick={() => send({ type: 'finishAppraise' })}
              className="btn-bronze w-full h-10"
              disabled={!allAppraised}
            >
              {allAppraised ? '进入发言环节' : `待鉴宝完成 ${doneCount}/${room.players.length}`}
            </Button>
            <div className="text-ivory-dim text-xs text-center mt-1">
              {allAppraised ? '全员已完成鉴宝' : '需所有玩家完成鉴宝（或本轮无法鉴宝）后方可进入发言'}
            </div>
          </div>
        );
      })()}

      {/* 鉴宝结果弹窗 */}
      {popupResult && (() => {
        const art = g.artifacts.find((a: any) => a.id === popupResult.artifactId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPopupResult(null)}>
            <div
              className="card-antique-glow p-6 w-full max-w-xs text-center animate-seal"
              onClick={e => e.stopPropagation()}
            >
              <div className="font-brush text-2xl text-bronze mb-1">鉴定结果</div>
              <div className="text-ivory mb-4">
                你鉴定了 <span className="text-gold-glow font-bold">{art?.name}</span>
              </div>
              <div className={`text-3xl font-brush mb-5 ${popupResult.appearsReal ? 'text-jade' : 'text-vermilion'}`}>
                {popupResult.appearsReal ? '看似真品' : '看似赝品'}
              </div>
              <Button onClick={() => setPopupResult(null)} className="btn-seal w-full h-11 text-base">
                确认
              </Button>
            </div>
          </div>
        );
      })()}

      {/* 我的历史行动弹窗 */}
      {showHistory && (() => {
        const rounds = [1, 2, 3].filter(r => (game.myAppraisals?.[r]?.length || 0) > 0 || r <= g.currentRound);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowHistory(false)}>
            <div
              className="card-antique p-5 w-full max-w-sm max-h-[80vh] overflow-y-auto animate-seal"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="font-brush text-xl text-bronze flex items-center gap-1">
                  <History className="w-4 h-4" /> 我的历史行动
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-ivory-dim hover:text-bronze text-sm border border-bronze/30 rounded px-2 py-0.5"
                >关闭</button>
              </div>

              {rounds.length === 0 && (
                <div className="text-ivory-dim text-sm">尚未有行动记录。</div>
              )}

              {rounds.map(r => {
                const apps: any[] = game.myAppraisals?.[r] || [];
                const fz = (myRole === 'fangzhen') ? game.fangzhenResults.find((x: any) => x.round === r) : null;
                const isCurrent = r === g.currentRound;
                return (
                  <div key={r} className="mb-3 last:mb-0 border border-bronze/20 rounded-md p-2.5 bg-black/20">
                    <div className="text-gold-glow text-xs font-bold mb-1.5">
                      第{r}轮{isCurrent ? ' · 当前' : ''}
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] text-ivory-dim">鉴宝结果：</div>
                      {apps.length > 0 ? apps.map((a: any, i: number) => {
                        const art = g.artifacts.find((x: any) => x.id === a.artifactId);
                        return (
                          <div key={i} className="text-xs bg-black/30 px-2 py-1 rounded flex justify-between">
                            <span className="text-ivory">{art?.name || '兽首'}</span>
                            <span className={a.appearsReal ? 'text-jade' : 'text-vermilion'}>
                              {a.appearsReal ? '看似真品' : '看似赝品'}
                            </span>
                          </div>
                        );
                      }) : (
                        <div className="text-[11px] text-ivory-dim/70">（本轮未鉴宝或未行动）</div>
                      )}
                    </div>

                    {/* 技能发动情况 */}
                    <div className="mt-2 space-y-1">
                      <div className="text-[11px] text-ivory-dim">技能发动：</div>
                      {myRole === 'fangzhen' && fz && (
                        <div className="text-xs bg-black/30 px-2 py-1 rounded">
                          查验 <span className="text-ivory">{fz.targetName}</span>：
                          <span className={fz.faction === 'xuyuan' ? 'text-jade' : 'text-vermilion'}>
                            {fz.faction === 'xuyuan' ? ' 好人' : ' 坏人'}
                          </span>
                        </div>
                      )}
                      {r === g.currentRound && (
                        <>
                          {myRole === 'yaoburan' && me.yaoburanSealTarget && (
                            <div className="text-xs bg-black/30 px-2 py-1 rounded text-vermilion">
                              封印之术：已偷袭一名玩家
                            </div>
                          )}
                          {myRole === 'zhengguoqu' && me.zhengguoquLockedArtifact != null && (
                            <div className="text-xs bg-black/30 px-2 py-1 rounded text-vermilion">
                              封存兽首：本轮已封锁一只兽首
                            </div>
                          )}
                          {myRole === 'laochaofeng' && me.laochaofengUsedFlip && (
                            <div className="text-xs bg-black/30 px-2 py-1 rounded text-vermilion">
                              颠倒乾坤：本轮已施展
                            </div>
                          )}
                        </>
                      )}
                      {myRole === 'fangzhen' && !fz && (
                        <div className="text-[11px] text-ivory-dim/70">（本轮未发动查验）</div>
                      )}
                      {(['xuyuan','huangyanyan','muhujianai','jiyunfu'].includes(myRole)) && (
                        <div className="text-[11px] text-ivory-dim/70">（无主动技能）</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ============================================================
// 行动顺序面板（显示当前轮及历史轮次，按实际发生先后排列）
// ============================================================
function AppraiseOrderPanel({ room, game }: { room: any; game: any }) {
  const g = room.game;
  const currentRound = g.currentRound;

  return (
    <div className="card-antique p-3">
      <div className="text-bronze font-antique font-bold mb-2 text-sm flex items-center gap-1">
        <Target className="w-4 h-4" /> 行动顺序
      </div>
      {[1, 2, 3].map(roundNum => {
        const roundData = roundNum <= currentRound ? (g.rounds || [])[roundNum - 1] : null;
        if (!roundData) return null;
        const isCurrent = roundNum === currentRound;
        // 实际发生的行动顺序（动态累加）；本轮还包含尚未行动者的占位提示
        const actual: string[] = roundData.actualOrder || roundData.appraiseOrder || [];
        // 本轮尚未行动、但实际顺序中还不存在的玩家（补在末尾作"待行动"）
        const pending = isCurrent
          ? (roundData.appraiseOrder || []).filter((pid: string) => !actual.includes(pid) && !(roundData.finishedAppraisers || []).includes(pid))
          : [];
        const order = [...actual, ...pending];
        if (order.length === 0) return null;

        return (
          <div key={roundNum} className={`mb-3 last:mb-0 ${!isCurrent ? 'opacity-50' : ''}`}>
            <div className="text-ivory-dim text-[11px] mb-1.5 flex items-center gap-1.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-gold-glow animate-glow' : 'bg-bronze/40'}`}></span>
              第{roundNum}轮{isCurrent ? ' · 当前' : ' · 已完成'}
            </div>
            <div className="flex flex-col gap-0.5">
              {order.map((pid: string, idx: number) => {
                const player = room.players.find((p: any) => p.id === pid);
                const isFinished = (roundData.finishedAppraisers || []).includes(pid);
                const isCurrentAppraiser = isCurrent && g.currentAppraiserId === pid;
                const isMe = pid === game.me?.id;
                const isPending = isCurrent && !actual.includes(pid) && !isFinished;
                const showArrow = idx < order.length - 1;
                return (
                  <div key={pid}>
                    <div
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all ${
                        isCurrentAppraiser
                          ? 'bg-gold-glow/15 text-gold-glow border border-gold-glow/50 ring-active'
                          : isFinished
                          ? 'bg-black/20 text-ivory-dim line-through decoration-jade/40'
                          : isPending
                          ? 'bg-black/30 text-ivory-dim/50 border border-dashed border-bronze/20'
                          : 'bg-black/30 text-ivory'
                      }`}
                    >
                      <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isCurrentAppraiser ? 'bg-gold-glow text-ink' : isFinished ? 'bg-jade/30 text-jade' : isPending ? 'bg-bronze/20 text-bronze/60' : 'bg-bronze/30 text-bronze'
                      }`}>
                        {isFinished && !isCurrentAppraiser ? '✓' : idx + 1}
                      </span>
                      <span className={`flex-1 truncate ${isMe ? 'font-bold' : ''}`}>{player?.name || '?'}{isMe ? '（我）' : ''}</span>
                      {isCurrentAppraiser && <span className="text-[10px] font-bold animate-pulse">鉴宝中</span>}
                      {isPending && <span className="text-[10px] text-ivory-dim/50">待行动</span>}
                    </div>
                    {showArrow && (
                      <div className="flex justify-center my-0.5 text-bronze/40 text-[10px] leading-none">↓</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// 指定下一个鉴宝玩家面板
// ============================================================
function PassTurnPanel({ room, game, finishedAppraisers, onPass, onFinish }: {
  room: any;
  game: any;
  finishedAppraisers: string[];
  onPass: (nextPlayerId: string) => void;
  onFinish: () => void;
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
        <Button onClick={onFinish} className="btn-bronze w-full h-10 mt-1 text-sm">
          进入发言环节
        </Button>
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
    const usedTargetId = me.yaoburanSealTarget;
    const usedTarget = usedTargetId ? room.players.find((p: any) => p.id === usedTargetId) : null;
    const usedThisRound = !!usedTargetId;
    const targets = room.players.filter((p: any) => p.id !== me.id && !p.visiblySealed);
    return (
      <div className="bg-black/20 p-3 rounded-md border border-bronze/20">
        <div className="text-sm text-bronze font-bold mb-1 flex items-center gap-1">
          <Lock className="w-4 h-4" /> 封印之术
        </div>
        <div className="text-xs text-ivory-dim mb-2">选择一名玩家封印，使其本轮无法鉴宝且技能失效（每轮仅一次）。</div>
        {usedThisRound ? (
          <div className="pill pill-danger flex items-center gap-1.5 w-full justify-center py-1.5">
            <Lock className="w-3 h-3" /> 本轮已偷袭：{usedTarget?.name || '—'}
          </div>
        ) : (
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
        )}
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
    return <FangzhenSkillPanel room={room} game={game} me={me} g={g} />;
  }

  return null;
}

// ============================================================
// 方震技能面板（独立组件，支持 useEffect 弹窗）
// ============================================================
function FangzhenSkillPanel({ room, game, me, g }: { room: any; game: any; me: any; g: any }) {
  const [showPopup, setShowPopup] = useState(false);
  const checked = game.fangzhenResults.find((r: any) => r.round === g.currentRound);
  const targets = room.players.filter((p: any) => p.id !== me.id);

  // 当查验结果出现时弹出弹窗
  useEffect(() => {
    if (checked) {
      setShowPopup(true);
    }
  }, [checked?.round, checked?.targetId]);

  const factionName = checked?.faction === 'xuyuan' ? '好人阵营' : '坏人阵营';
  const factionColor = checked?.faction === 'xuyuan' ? 'text-jade border-jade' : 'text-vermilion border-vermilion';

  return (
    <>
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

      {/* 查验结果弹窗 */}
      {showPopup && checked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowPopup(false)}>
          <div className="card-antique p-6 max-w-xs w-full mx-4 text-center animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="text-bronze font-antique font-bold text-sm mb-3">明察秋毫 · 查验结果</div>
            <Eye className="w-10 h-10 mx-auto mb-3 text-gold-glow" />
            <div className="text-ivory font-brush text-2xl mb-2">{checked.targetName}</div>
            <div className={`text-lg font-bold px-4 py-2 rounded border-2 ${factionColor} bg-black/30`}>
              {factionName}
            </div>
            <button
              onClick={() => setShowPopup(false)}
              className="mt-4 btn-ghost px-4 py-1.5 text-xs rounded"
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// 押币面板
// ============================================================
function VotePanel({ room, game }: { room: any; game: any }) {
  const g = room.game;
  const me = game.me;
  const myBets: number[] = me.betArtifactIds || [];
  const remainingVotes = game.remainingVotes || 0;
  const voteFinished = me.finishedVote;

  // 投票结束前不显示票数统计，结束后显示
  const showCounts = g.phase === 'reveal' || g.phase === 'ended';

  // 统计票数（仅揭示阶段可见）
  const betCounts: Record<number, number> = {};
  if (showCounts) {
    for (const p of room.players) {
      const bets: number[] = p.betArtifactIds || [];
      for (const id of bets) {
        betCounts[id] = (betCounts[id] || 0) + 1;
      }
    }
  }
  const totalBets = Object.values(betCounts).reduce((a, b) => a + b, 0);
  const maxBet = Math.max(1, ...Object.values(betCounts));

  // 已投票玩家列表：与后端 isVoteDone 口径一致（结束投票 / 票已用完 / 机器人）
  const votedPlayers = room.players.filter((p: any) => p.finishedVote || p.remainingVotes <= 0 || p.isAI);
  const totalPlayers = room.players.length;

  return (
    <div className="card-antique p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-bronze font-antique font-bold flex items-center gap-2">
          <Coins className="w-4 h-4" /> 押币环节 · 第{g.currentRound}轮
        </div>
        <div className="text-sm text-gold-glow font-bold">
          剩余 <span className="text-lg">{remainingVotes}</span> 票
        </div>
      </div>
      <div className="text-ivory-dim text-sm leading-relaxed">
        {voteFinished
          ? '你已完成投票，等待其他玩家…'
          : remainingVotes <= 0
          ? '你的投票次数已用完，请点击结束投票'
          : `每轮 2 票，可投同一兽首多票。押币最多者将被隐藏，第二多者予以揭露。`}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {g.artifacts.map((a: any) => {
          const count = betCounts[a.id] || 0;
          const myBetCount = myBets.filter(id => id === a.id).length;
          const isMyBet = myBetCount > 0;
          const isTopBet = count === maxBet && count > 0;
          return (
            <button
              key={a.id}
              onClick={() => send({ type: 'bet', artifactId: a.id })}
              className={`zodiac-card aspect-[3/4] flex flex-col items-center justify-center p-2 relative overflow-hidden ${
                isMyBet ? 'selected' : ''
              }`}
              disabled={voteFinished || remainingVotes <= 0}
            >
              <div className="zodiac-glyph text-4xl text-bronze">{a.name[0]}</div>
              {showCounts && count > 0 && <div className="count-badge"><Coins className="w-2.5 h-2.5 mr-0.5" />{count}</div>}
              {showCounts && count > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/30">
                  <div className={`h-full ${isTopBet ? 'bg-gold-glow' : 'bg-bronze'}`}
                    style={{ width: `${(count / maxBet) * 100}%` }} />
                </div>
              )}
              {isMyBet && (
                <div className="absolute top-1 left-1 text-[9px] text-gold-glow font-bold bg-black/60 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                  <Coins className="w-2.5 h-2.5" />{myBetCount > 1 ? `x${myBetCount}` : '已投'}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 结束投票按钮 */}
      {!voteFinished && (
        <div className="pt-2 border-t border-bronze/20">
          <Button
            onClick={() => send({ type: 'finishVote' })}
            className="btn-bronze w-full h-10"
          >
            {remainingVotes > 0 ? `结束投票（剩余 ${remainingVotes} 票顺延至下轮）` : '结束投票'}
          </Button>
        </div>
      )}

      {/* 投票进度 */}
      <div className="flex items-center gap-2 text-xs text-ivory-dim">
        <div className="flex-1 bg-black/30 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-bronze" style={{ width: `${(votedPlayers.length / totalPlayers) * 100}%` }} />
        </div>
        <span>{votedPlayers.length} / {totalPlayers} 已投票</span>
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
  const exposedArtifact = revealed.find((a: any) => a.isReal !== undefined);
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
function RoleRevealModal({ roleInfo, knownAllies, onClose }: { roleInfo: any; knownAllies: any[]; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="card-antique-glow p-8 max-w-md w-full animate-seal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <div className="font-brush text-2xl text-gold-glow mb-2">身份已分配</div>
          <div className="text-ivory-dim text-xs">你的角色与队友信息已隐藏，点击下方按钮查看</div>
        </div>

        {revealed ? (
          <>
            <div className="text-center mb-4">
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

            {/* 已知队友（老朝奉阵营） */}
            {knownAllies && knownAllies.length > 0 && (
              <div className="bg-vermilion/10 border border-vermilion/20 p-3 rounded-md mb-3">
                <div className="text-vermilion text-xs font-bold mb-1 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> 已知队友
                </div>
                <div className="space-y-1">
                  {knownAllies.map((ally: any) => {
                    const allyRole = (ROLE_INFO as any)[ally.roleId];
                    return (
                      <div key={ally.playerId} className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded">
                        <div className="player-token w-5 h-5 text-[9px]">{ally.playerName[0]}</div>
                        <span className="text-xs text-ivory">{ally.playerName}</span>
                        <span className="text-xs text-vermilion font-bold">·</span>
                        <span className="text-xs text-vermilion">{allyRole?.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-black/20 p-3 rounded-md mb-4">
              <div className="text-ivory-dim text-xs">{roleInfo.bio}</div>
            </div>

            <Button onClick={onClose} className="btn-seal w-full h-12 text-lg">
              入 局
            </Button>
          </>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="btn-bronze w-full h-12 text-lg"
          >
            点击查看身份 ▸
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 鉴人面板
// ============================================================
function IdentifyPanel({ room, game }: { room: any; game: any }) {
  const g = room.game;
  const me = game.me;
  const myRole = game.myRole;
  // @ts-ignore
  const roleInfo = myRole ? ROLE_INFO[myRole as any] : null;
  const myFaction = roleInfo?.faction;
  const myVote = me.identifyTargetId;

  const targets = room.players.filter((p: any) => p.id !== me.id);
  const isHost = !!me.isHost;
  const isZhengguoqu = myRole === 'zhengguoqu';
  // 郑国渠不参与指认，统计已投票人数时排除郑国渠
  const needVotePlayers = room.players.filter((p: any) => p.role && p.role !== 'zhengguoqu');
  const allVoted = needVotePlayers.filter((p: any) => g.identifyVotes?.[p.id]).length;
  const totalNeedVote = needVotePlayers.length;

  return (
    <div className="card-antique-glow p-4 sm:p-6 space-y-4">
      <div className="text-center">
        <div className="text-gold-glow font-brush text-2xl sm:text-3xl mb-1">鉴人环节</div>
        <div className="text-ivory-dim text-xs sm:text-sm">三轮鉴宝结束，指认身份的时刻到了</div>
      </div>

      {/* 前三轮行动顺序回顾 */}
      <div className="card-antique p-3">
        <div className="text-bronze font-antique font-bold mb-2 text-sm flex items-center gap-1">
          <Target className="w-4 h-4" /> 三轮行动顺序回顾
        </div>
        {[1, 2, 3].map(roundNum => {
          const roundData = (g.rounds || [])[roundNum - 1];
          const order = roundData?.actualOrder || roundData?.appraiseOrder || [];
          if (!order.length) return null;
          return (
            <div key={roundNum} className="mb-2 last:mb-0">
              <div className="text-ivory-dim text-[10px] mb-1">第{roundNum}轮</div>
              <div className="flex flex-wrap gap-1">
                {order.map((pid: string, idx: number) => {
                  const player = room.players.find((p: any) => p.id === pid);
                  return (
                    <div key={pid} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-black/20 text-ivory-dim">
                      <span className="text-ivory-dim">#{idx + 1}</span>
                      <span className="truncate max-w-[50px]">{player?.name || '?'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-black/20 p-3 rounded-md">
        {myFaction === 'xuyuan' ? (
          <div className="text-ivory text-sm leading-relaxed">
            请指认你认为是<span className="text-vermilion font-bold">老朝奉</span>的玩家。许愿阵营多数指认成功即可 +1 分。
          </div>
        ) : myRole === 'laochaofeng' ? (
          <div className="text-ivory text-sm leading-relaxed">
            请指认你认为是<span className="text-jade font-bold">许愿</span>的玩家。若指认失败，许愿阵营 +2 分。
          </div>
        ) : myRole === 'yaoburan' ? (
          <div className="text-ivory text-sm leading-relaxed">
            请指认你认为是<span className="text-jade font-bold">方震</span>的玩家。若指认失败，许愿阵营 +1 分。
          </div>
        ) : (
          <div className="text-ivory text-sm leading-relaxed">
            请指认你认为是<span className="text-vermilion font-bold">老朝奉</span>的玩家。
          </div>
        )}
      </div>

      {isZhengguoqu ? (
        <div className="text-center text-bronze text-sm py-2">
          你为局外人，无需参与终局指认，静观其变。
        </div>
      ) : myVote ? (
        <div className="text-center text-jade text-sm">
          已指认，等待其他玩家…
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {targets.map((p: any) => (
            <button
              key={p.id}
              onClick={() => send({ type: 'identifyVote', targetId: p.id })}
              className="btn-bronze px-3 py-3 rounded-md text-sm flex flex-col items-center gap-1"
            >
              <span className="player-token w-8 h-8 text-xs">{p.name[0]}</span>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-ivory-dim">
        <div className="flex-1 bg-black/30 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-bronze" style={{ width: `${(allVoted / totalNeedVote) * 100}%` }} />
        </div>
        <span>{allVoted} / {totalNeedVote} 已投票</span>
      </div>

      {isHost && allVoted >= totalNeedVote && totalNeedVote > 0 && (
        <Button onClick={() => send({ type: 'nextRound' })} className="btn-seal w-full h-12 text-lg">
          揭晓结果
        </Button>
      )}
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
          <div className="text-left max-w-md mx-auto space-y-1.5 mb-6 bg-black/20 p-3 rounded-md max-h-60 overflow-y-auto">
            {g.endLog.map((line: string, i: number) => {
              // 解析指认票型行
              if (line.startsWith('VOTE:')) {
                const parts = line.split(':');
                const voterName = parts[2] || '';
                const targetName = parts[3] || '';
                return (
                  <div key={i} className="text-xs leading-relaxed border-l-2 pl-2 text-ivory border-bronze/30 flex items-center gap-1.5">
                    <span className="text-ivory-dim">{voterName}</span>
                    <span className="text-ivory-dim">→</span>
                    <span className="text-gold-glow font-bold">{targetName}</span>
                  </div>
                );
              }
              return (
                <div key={i} className={`text-xs leading-relaxed border-l-2 pl-2 ${
                  line.includes('+') ? 'text-jade border-jade/30' :
                  line.includes('老朝奉') || line.includes('败') ? 'text-vermilion border-vermilion/30' :
                  'text-ivory-dim border-bronze/30'
                }`}>{line}</div>
              );
            })}
          </div>
          <div className="divider-antique"></div>
        </>
      )}

      {/* 每轮鉴宝回顾 */}
      <div className="text-bronze font-antique font-bold mb-3 text-sm sm:text-base">每轮鉴宝回顾</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
        {[1, 2, 3].map(roundNum => {
          const rd = (g.rounds || [])[roundNum - 1];
          if (!rd) return null;
          const revealedName = rd.revealedArtifactName;
          const hiddenName = rd.hiddenArtifactName;
          const isReal = rd.revealedIsReal;
          const score = rd.roundScore || 0;
          const hasVotes = Object.keys(rd.playerVotes || {}).some(pid => (rd.playerVotes![pid]?.length || 0) > 0);
          return (
            <div key={roundNum} className="card-antique p-3 text-left">
              <div className="text-gold-glow text-xs font-bold mb-2 flex items-center justify-between">
                <span>第 {roundNum} 轮</span>
                <span className={score > 0 ? 'text-jade' : 'text-ivory-dim'}>
                  {score > 0 ? '+1 分' : '0 分'}
                </span>
              </div>
              {hasVotes ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between bg-black/20 px-2 py-1 rounded">
                    <span className="text-ivory-dim">揭示</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-ivory">{revealedName}</span>
                      <span className={isReal ? 'text-jade font-bold' : 'text-vermilion font-bold'}>
                        {isReal ? '真' : '假'}
                      </span>
                    </span>
                  </div>
                  {hiddenName && (
                    <div className="flex items-center justify-between bg-black/20 px-2 py-1 rounded">
                      <span className="text-ivory-dim">隐藏</span>
                      <span className="text-ivory">{hiddenName}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-ivory-dim text-xs">本轮无投票记录</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="divider-antique"></div>

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
