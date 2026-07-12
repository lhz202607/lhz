import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { connectGame, disconnectGame, send, addAI, useGameState } from '@/lib/game/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Crown, LogOut, Users, UserX, Bot, Trash2, Share2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RoomLobby() {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const urlName = searchParams.get('name') || '';
  const pid = searchParams.get('pid') || undefined;
  const navigate = useNavigate();
  const game = useGameState();
  const [connecting, setConnecting] = useState(false);
  // 如果 URL 没有 name 参数（好友通过分享链接进入），需要先输入昵称
  const [nickname, setNickname] = useState('');
  const [needsName, setNeedsName] = useState(!urlName);

  const doConnect = async (name: string) => {
    if (!code) return;
    setConnecting(true);
    try {
      await connectGame(code, name, pid);
      setConnecting(false);
    } catch {
      toast.error('连接房间失败');
      navigate('/');
    }
  };

  useEffect(() => {
    if (!code) return;
    // URL 有 name 参数 → 直接连接
    if (urlName) {
      doConnect(urlName);
    }
    return () => disconnectGame();
  }, [code]);

  const room = game.room;
  const me = game.me;
  const isHost = me?.isHost;
  const canStart = (room?.players.length || 0) >= 6;

  const copyCode = () => {
    navigator.clipboard?.writeText(code || '');
    toast.success('房间码已复制');
  };

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${code}` : '';

  const copyLink = () => {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      toast.success('邀请链接已复制，发送给微信好友即可加入');
    }).catch(() => {
      // clipboard 不可用则退而复制房间码
      navigator.clipboard?.writeText(code || '');
      toast.success(`房间码 ${code} 已复制，好友输入即可加入`);
    });
  };

  const shareRoom = async () => {
    const shareData = {
      title: '古董局中局·十二兽首',
      text: `来加入我的鉴宝局「${code}」，共鉴十二兽首真伪！`,
      url: shareUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        // 其他错误降级
      }
    }
    // 降级：复制链接
    copyLink();
  };

  const handleStart = async () => {
    if (!canStart) { toast.error('至少需要 6 名玩家'); return; }
    send({ type: 'startGame' });
  };

  const handleLeave = () => {
    disconnectGame();
    navigate('/');
  };

  const handleAddAI = async () => {
    try {
      await addAI();
    } catch {
      toast.error('添加失败');
    }
  };

  const handleDisband = () => {
    if (!confirm('确定要解散房间吗？所有玩家将被移出。')) return;
    send({ type: 'disbandRoom' });
    disconnectGame();
    navigate('/');
  };

  // 游戏开始后跳转到游戏页
  useEffect(() => {
    if (room && room.game.phase !== 'waiting' && room.game.phase !== 'ended') {
      navigate(`/play/${code}?name=${encodeURIComponent(urlName || nickname)}&pid=${pid || ''}`, { replace: true });
    }
  }, [room?.game.phase]);

  // 好友通过分享链接进入，先报上名号
  if (needsName) {
    return (
      <div className="min-h-screen bg-antique flex items-center justify-center p-4">
        <div className="card-antique-glow p-8 max-w-sm w-full space-y-6">
          <div className="text-center">
            <div className="font-brush text-3xl text-bronze mb-1">入局</div>
            <div className="text-ivory-dim text-sm">请输入你的名号加入鉴宝局</div>
            <div className="mt-2 font-mono text-xl tracking-[0.3em] text-gold-glow">房间：{code}</div>
          </div>
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="请输入昵称"
            maxLength={12}
            className="input-antique h-12 text-lg"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && nickname.trim()) {
                setNeedsName(false);
                doConnect(nickname.trim());
              }
            }}
          />
          <Button
            onClick={() => {
              if (!nickname.trim()) { toast.error('请输入昵称'); return; }
              setNeedsName(false);
              doConnect(nickname.trim());
            }}
            disabled={connecting || !nickname.trim()}
            className="btn-seal w-full h-12 text-lg"
          >
            {connecting ? '加入中…' : '加入房间'}
          </Button>
        </div>
      </div>
    );
  }

  if (connecting || !room) {
    return (
      <div className="min-h-screen bg-antique flex items-center justify-center">
        <div className="text-bronze font-brush text-2xl animate-pulse">正在连通鉴宝局…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-antique p-4 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-ivory-dim text-sm">鉴宝局 · 等候厅</div>
            <h1 className="font-brush text-4xl text-bronze">十二兽首</h1>
          </div>
          <div className="flex items-center gap-2">
            {isHost && (
              <button
                onClick={handleDisband}
                className="btn-ghost px-3 py-2 rounded-md text-sm text-vermilion hover:bg-vermilion/10 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> 解散
              </button>
            )}
            <button
              onClick={handleLeave}
              className="btn-ghost px-4 py-2 rounded-md text-sm flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> 离开
            </button>
          </div>
        </div>

        {/* 房间码卡片 */}
        <div className="card-antique-glow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-ivory-dim text-sm mb-1">房间邀请码</div>
              <div className="font-mono text-4xl tracking-[0.3em] text-bronze font-bold">{room.code}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={shareRoom}
                className="btn-ghost px-4 py-3 rounded-md flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" /> 分享
              </button>
              <button
                onClick={copyCode}
                className="btn-ghost px-4 py-3 rounded-md flex items-center gap-2"
              >
                <Copy className="w-4 h-4" /> 复制
              </button>
            </div>
          </div>

          {/* 邀请链接 — 直观显示 */}
          <div className="bg-black/30 rounded-md p-3 border border-bronze/20">
            <div className="text-ivory-dim text-[10px] mb-1">邀请链接（点击复制）</div>
            <button
              onClick={copyLink}
              className="w-full text-left text-xs text-gold-glow font-mono truncate hover:text-bronze transition-colors"
              title="点击复制邀请链接"
            >
              {shareUrl}
            </button>
          </div>

          <div className="text-ivory-dim text-xs mt-3 flex items-center gap-2">
            <span>分享链接给微信好友，好友点击即可加入对局</span>
          </div>
        </div>

        {/* 玩家列表 */}
        <div className="card-antique p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-bronze">
              <Users className="w-5 h-5" />
              <span className="font-antique font-bold">入席玩家 ({room.players.length}/{room.maxPlayers})</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {room.players.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-md bg-black/20 border-bronze"
              >
                <div className="player-token w-10 h-10 text-bronze">
                  {p.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-ivory font-antique truncate ${p.id === me?.id ? 'text-bronze font-bold' : ''}`}>
                      {p.name}{p.id === me?.id ? '（我）' : ''}
                    </span>
                    {p.isHost && <Crown className="w-3.5 h-3.5 text-gold-glow flex-shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ivory-dim">
                    {p.isHost && <span>房主</span>}
                    {!p.connected && <span className="text-vermilion">已断线</span>}
                  </div>
                </div>
                {isHost && !p.isHost && p.id !== me?.id && (
                  <button
                    onClick={() => {
                      send({ type: 'kickPlayer', targetId: p.id });
                      toast.success(`已踢出 ${p.name}`);
                    }}
                    className="btn-ghost px-2 py-1.5 rounded text-vermilion hover:bg-vermilion/10"
                    title="踢出房间"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {/* 空位 */}
            {Array.from({ length: (room.maxPlayers - room.players.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-md border border-dashed border-bronze/20 opacity-50">
                <div className="w-10 h-10 rounded-full border border-dashed border-bronze/30"></div>
                <span className="text-ivory-dim text-sm">虚位以待</span>
              </div>
            ))}
          </div>
        </div>

        {/* 操作区 */}
        <div className="card-antique p-6 space-y-4">
          <div className="text-ivory-dim text-sm leading-relaxed">
            <div className="text-bronze font-bold mb-2">入局须知</div>
            <ul className="space-y-1 text-xs">
              <li>· 本局为 <span className="text-bronze">{room.maxPlayers} 人局</span>，需满 6 人方可开局</li>
              <li>· 开局后将随机分配角色，分属许愿/老朝奉两大阵营</li>
              <li>· 共三轮鉴宝押币，许愿阵营累计 5 分获胜</li>
            </ul>
          </div>

          <div className="flex gap-3">
            {isHost && (
              <>
                {room.players.length < room.maxPlayers && (
                  <Button
                    onClick={handleAddAI}
                    className="btn-ghost h-12 px-4 flex items-center gap-2"
                  >
                    <Bot className="w-5 h-5" /> 添加机器人
                  </Button>
                )}
                <Button
                  onClick={handleStart}
                  disabled={!canStart}
                  className="btn-seal flex-1 h-12 text-lg"
                >
                  {canStart ? '开 设 鉴 宝' : `还需 ${6 - room.players.length} 人`}
                </Button>
              </>
            )}
            {!isHost && (
              <div className="flex-1 text-center py-4 text-ivory-dim text-sm">
                等待房主 <span className="text-bronze">{room.players.find(p => p.isHost)?.name}</span> 开设鉴宝局…
              </div>
            )}
          </div>
        </div>

        {game.error && (
          <div className="mt-4 text-vermilion text-sm text-center">{game.error}</div>
        )}
      </div>
    </div>
  );
}
