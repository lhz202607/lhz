import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * 低调的循环背景音乐（古风）：用 Web Audio API 程序化生成，
 * 无需外部音频文件、不依赖网络，音量极低不吵。
 * 浏览器要求用户交互后才能播放，故首次进入时点击任意按钮即可发声。
 */
export default function BackgroundMusic() {
  const [muted, setMuted] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);

  // 古风音阶（宫商角徵羽），频率较低显得沉静
  const scale = [196.0, 220.0, 261.63, 293.66, 329.63, 392.0];

  useEffect(() => {
    const start = () => {
      if (ctxRef.current) return;
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = new Ctx();
      const master = ctx.createGain();
      master.gain.value = 0.06; // 极低音量
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = master;

      let step = 0;
      const playNote = () => {
        if (!ctxRef.current || !gainRef.current) return;
        const c = ctxRef.current;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        // 在音阶内缓慢游走，偶尔跳音，营造悠远感
        const idx = (step * 2 + (step % 3)) % scale.length;
        osc.frequency.value = scale[idx];
        g.gain.setValueAtTime(0, c.currentTime);
        g.gain.linearRampToValueAtTime(0.9, c.currentTime + 0.8);
        g.gain.linearRampToValueAtTime(0, c.currentTime + 2.4);
        osc.connect(g);
        g.connect(gainRef.current);
        osc.start();
        osc.stop(c.currentTime + 2.5);
        step++;
      };
      playNote();
      timerRef.current = window.setInterval(playNote, 2600);
    };

    // 浏览器策略：等待首次用户交互
    const onFirst = () => {
      start();
      window.removeEventListener('pointerdown', onFirst);
      window.removeEventListener('keydown', onFirst);
    };
    window.addEventListener('pointerdown', onFirst);
    window.addEventListener('keydown', onFirst);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (ctxRef.current) ctxRef.current.close();
      window.removeEventListener('pointerdown', onFirst);
      window.removeEventListener('keydown', onFirst);
    };
  }, []);

  // 静音开关
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = muted ? 0 : 0.06;
    }
  }, [muted]);

  return (
    <button
      onClick={() => setMuted(m => !m)}
      title={muted ? '开启背景音乐' : '关闭背景音乐'}
      className="fixed top-2 right-2 z-50 w-9 h-9 rounded-full bg-black/40 border border-bronze/40 flex items-center justify-center text-bronze hover:text-gold-glow transition-colors"
    >
      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-2.5" />}
    </button>
  );
}
