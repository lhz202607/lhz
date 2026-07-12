import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * 古墓探秘氛围背景音乐：用 Web Audio API 程序化生成，
 * 低沉幽暗的五声小调旋律、缓慢节奏、轻微失谐双音叠加营造空旷回响感，
 * 音量较之前略大但仍柔和；无需外部音频文件、不依赖网络。
 * 浏览器要求用户交互后才能播放，故首次进入时点击任意按钮即可发声。
 */
export default function BackgroundMusic() {
  const [muted, setMuted] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);

  // 低沉五声音阶（小调式，营造幽暗感）：以低八度为主
  const scale = [
    130.81, 146.83, 174.61, 196.0, 233.08,  // C3 D3 F3 G3 A#3（低音区，小调色彩）
    261.63, 293.66, 311.13, 349.23, 392.0,  // C4 D4 E#4 F4 G4
  ];
  // 幽暗、徘徊的旋律走向（音阶索引序列，重复循环）
  const melody = [0, 2, 3, 2, 4, 3, 1, 0, 3, 4, 5, 4, 3, 2, 0, 1];
  const bassLine = [0, 0, 2, 2, 3, 3, 1, 1]; // 持续低音垫

  useEffect(() => {
    const start = () => {
      if (ctxRef.current) return;
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = new Ctx();
      const master = ctx.createGain();
      master.gain.value = 0.12; // 略大但仍柔和
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = master;

      let step = 0;
      const beat = 620; // 每拍间隔（毫秒），缓慢营造神秘感

      const playTone = (freq: number, when: number, dur: number, vol: number, type: OscillatorType = 'sine', detune = 0) => {
        if (!ctxRef.current || !gainRef.current) return;
        const c = ctxRef.current;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune; // 失谐叠加，制造空旷回响
        // 缓慢渐入渐出，更幽远
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(vol, when + dur * 0.4);
        g.gain.linearRampToValueAtTime(0, when + dur);
        osc.connect(g);
        g.connect(gainRef.current);
        osc.start(when);
        osc.stop(when + dur + 0.05);
      };

      const playNote = () => {
        if (!ctxRef.current) return;
        const now = ctxRef.current.currentTime;
        const idx = melody[step % melody.length];
        // 主旋律：低沉 sine 波，叠加轻微失谐双音营造空间感
        playTone(scale[idx], now, 1.1, 0.8, 'sine', 0);
        playTone(scale[idx], now, 1.1, 0.35, 'sine', 7); // 失谐 +7 音分
        // 缓慢延后的高八度幽光点缀
        if (step % 4 === 2) playTone(scale[(idx + 5) % scale.length] * 2, now + 0.3, 0.9, 0.22, 'triangle', 0);
        // 持续低音垫：每拍铺底，增强墓道厚重感
        const b = bassLine[step % bassLine.length];
        playTone(scale[b] / 1, now, 1.4, 0.5, 'sine', 0);
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
      gainRef.current.gain.value = muted ? 0 : 0.12;
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
