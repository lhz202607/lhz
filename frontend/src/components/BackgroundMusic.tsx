import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * 古风探索主题背景音乐：用 Web Audio API 程序化生成，
 * 一段有起伏的五声音阶小调旋律（节奏明快、带低音垫），
 * 无需外部音频文件、不依赖网络，整体音量保持克制不吵。
 * 浏览器要求用户交互后才能播放，故首次进入时点击任意按钮即可发声。
 */
export default function BackgroundMusic() {
  const [muted, setMuted] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);

  // 五声音阶（宫商角徵羽）两个八度，便于旋律走向起伏
  const scale = [
    261.63, 293.66, 329.63, 392.0, 440.0,   // C D E G A（中音区）
    523.25, 587.33, 659.25, 783.99, 880.0,   // C D E G A（高音区）
  ];
  // 一段明快的探秘旋律（音阶索引序列，重复循环）
  const melody = [0, 2, 3, 4, 3, 2, 0, 5, 4, 3, 2, 1, 0, 2, 4, 5];
  const bass = [0, 0, 3, 3, 5, 5, 2, 2]; // 低音垫（取中低音区）

  useEffect(() => {
    const start = () => {
      if (ctxRef.current) return;
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = new Ctx();
      const master = ctx.createGain();
      master.gain.value = 0.07; // 克制音量
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = master;

      let step = 0;
      const beat = 300; // 每拍间隔（毫秒），节奏明快

      const playTone = (freq: number, when: number, dur: number, vol: number, type: OscillatorType = 'triangle') => {
        if (!ctxRef.current || !gainRef.current) return;
        const c = ctxRef.current;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(vol, when + 0.03);
        g.gain.linearRampToValueAtTime(0, when + dur);
        osc.connect(g);
        g.connect(gainRef.current);
        osc.start(when);
        osc.stop(when + dur + 0.02);
      };

      const playNote = () => {
        if (!ctxRef.current) return;
        const now = ctxRef.current.currentTime;
        const idx = melody[step % melody.length];
        // 主旋律：中高音区，明亮
        playTone(scale[idx], now, 0.26, 0.9, 'triangle');
        // 每两拍加一个轻快高音点缀
        if (step % 2 === 0) playTone(scale[(idx + 4) % scale.length] * 2, now + 0.12, 0.16, 0.4, 'sine');
        // 低音垫：每两拍一次，增强古风厚重感
        if (step % 2 === 0) {
          const b = bass[(step / 2) % bass.length];
          playTone(scale[b] / 2, now, 0.5, 0.6, 'sine');
        }
        step++;
      };
      playNote();
      timerRef.current = window.setInterval(playNote, beat);
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
      gainRef.current.gain.value = muted ? 0 : 0.07;
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
