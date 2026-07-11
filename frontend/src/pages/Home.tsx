import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/lib/api-client';
import { ZODIAC_NAMES } from '@/lib/game/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('请输入你的名号'); return; }
    setCreating(true);
    try {
      const res = await apiClient.post('/game/rooms', { name: name.trim(), maxPlayers });
      navigate(`/room/${res.data.code}?name=${encodeURIComponent(name.trim())}&pid=${res.data.playerId}`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || '创建房间失败');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) { toast.error('请输入你的名号'); return; }
    if (!joinCode.trim()) { toast.error('请输入房间码'); return; }
    setJoining(true);
    try {
      const res = await apiClient.get(`/game/rooms/${joinCode.trim().toUpperCase()}`);
      if (!res.data) { toast.error('房间不存在'); return; }
      navigate(`/room/${joinCode.trim().toUpperCase()}?name=${encodeURIComponent(name.trim())}`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || '房间不存在');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-antique flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        {/* 左侧：标题与介绍 */}
        <div className="space-y-6 animate-float-in">
          <div className="text-center lg:text-left">
            <div className="inline-block text-vermilion text-sm tracking-[0.4em] mb-3 font-brush">— 民国·鉴宝录 —</div>
            <h1 className="font-brush text-6xl lg:text-7xl text-bronze leading-tight mb-2" style={{textShadow: '0 2px 12px rgba(201,169,97,0.3)'}}>
              古董局中局
            </h1>
            <h2 className="font-antique text-2xl text-ivory-dim tracking-[0.3em]">十 二 兽 首</h2>
          </div>

          <div className="divider-antique"></div>

          <p className="text-ivory-dim leading-relaxed text-center lg:text-left">
            圆明园十二兽首重现江湖，真伪难辨。<br/>
            许愿阵营欲辨真伪护国宝，老朝奉一党暗藏其中搅弄风云。<br/>
            <span className="text-bronze">鉴古易，鉴人难。</span>三轮鉴宝，押币揭真，谁主沉浮？
          </p>

          {/* 十二兽首环绕展示 */}
          <div className="grid grid-cols-6 gap-2 mt-4">
            {ZODIAC_NAMES.map((z, i) => (
              <div key={z} className="aspect-square card-antique flex flex-col items-center justify-center text-bronze hover:text-gold-glow transition-colors"
                   style={{animationDelay: `${i*60}ms`}}>
                <span className="font-brush text-xl">{z[0]}</span>
                <span className="text-[10px] text-ivory-dim mt-0.5">首</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-center lg:justify-start text-xs text-ivory-dim">
            <span className="px-3 py-1 border-bronze rounded-full">6-8 人联机</span>
            <span className="px-3 py-1 border-bronze rounded-full">八大角色</span>
            <span className="px-3 py-1 border-bronze rounded-full">AI 补位</span>
          </div>
        </div>

        {/* 右侧：创建/加入房间 */}
        <div className="card-antique-glow p-8 space-y-6 animate-float-in" style={{animationDelay: '0.2s'}}>
          <div className="text-center">
            <div className="font-brush text-3xl text-bronze mb-1">入局</div>
            <div className="text-ivory-dim text-sm">报上名号，方能入席鉴宝</div>
          </div>

          <div className="space-y-3">
            <label className="text-sm text-ivory-dim">你的名号</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入昵称"
              maxLength={12}
              className="input-antique h-12 text-lg"
            />
          </div>

          <div className="divider-antique"></div>

          {/* 创建房间 */}
          <div className="space-y-3">
            <label className="text-sm text-ivory-dim">开设新局 · 选择人数</label>
            <div className="grid grid-cols-3 gap-2">
              {[6, 7, 8].map(n => (
                <button
                  key={n}
                  onClick={() => setMaxPlayers(n)}
                  className={`py-3 rounded-md font-antique font-bold transition-all ${
                    maxPlayers === n
                      ? 'btn-bronze'
                      : 'btn-ghost'
                  }`}
                >
                  {n} 人局
                </button>
              ))}
            </div>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="btn-seal w-full h-12 text-lg"
            >
              {creating ? '开席中…' : '开 设 鉴 宝 局'}
            </Button>
          </div>

          <div className="divider-antique">
            <span className="bg-antique px-3 text-ivory-dim text-xs">或</span>
          </div>

          {/* 加入房间 */}
          <div className="space-y-3">
            <label className="text-sm text-ivory-dim">凭码入局</label>
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="输入 5 位房间码"
              maxLength={5}
              className="input-antique h-12 text-lg tracking-[0.3em] text-center font-mono"
            />
            <Button
              onClick={handleJoin}
              disabled={joining}
              className="btn-ghost w-full h-12 text-lg"
            >
              {joining ? '寻局中…' : '加 入 房 间'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
