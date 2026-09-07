import { useCallback, useEffect, useRef, useState } from 'react';

export type SoundName = 'button' | 'cardDraw' | 'cardPlay' | 'shuffle' | 'reverse' | 'skip' | 'drawTwo' | 'drawFour' | 'wild' | 'uno' | 'victory';
const notes: Record<SoundName, number[]> = {
  button: [600], cardDraw: [280, 420], cardPlay: [480, 320], shuffle: [210, 310, 210, 400],
  reverse: [650, 500, 350], skip: [260, 180], drawTwo: [220, 330], drawFour: [160, 220, 330, 440],
  wild: [330, 440, 660], uno: [523, 659, 784], victory: [523, 659, 784, 1047]
};
export const useAudio = (soundVolume: number, musicVolume: number) => {
  const context = useRef<AudioContext | null>(null);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const volumes = useRef({ soundVolume, musicVolume });
  volumes.current = { soundVolume, musicVolume };
  const getContext = useCallback(() => {
    try {
      context.current ??= new AudioContext();
      if (context.current.state === 'suspended') void context.current.resume().catch(() => {});
      return context.current;
    } catch { return null; }
  }, []);
  const tone = useCallback((frequency: number, start: number, volume: number, duration = .13, type: OscillatorType = 'sine') => {
    const ctx = context.current;
    if (!ctx || ctx.state === 'closed' || volume <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type; osc.frequency.value = frequency;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, volume * .1), start + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start); osc.stop(start + duration + .02);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }, []);
  const play = useCallback((name: SoundName) => {
    if (!volumes.current.soundVolume) return;
    const ctx = getContext();
    if (!ctx) return;
    notes[name].forEach((frequency, i) => tone(frequency, ctx.currentTime + i * .07, volumes.current.soundVolume, .12, name === 'victory' ? 'triangle' : 'sine'));
  }, [getContext, tone]);
  useEffect(() => {
    if (!musicEnabled) return;
    let beat = 0;
    const melody = [261.63, 329.63, 392, 329.63, 220, 261.63, 329.63, 261.63, 174.61, 220, 261.63, 220, 196, 246.94, 293.66, 246.94];
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const ctx = getContext();
      if (ctx) tone(melody[beat++ % melody.length], ctx.currentTime, volumes.current.musicVolume * .25, .42, 'triangle');
    }, 400);
    return () => window.clearInterval(timer);
  }, [musicEnabled, getContext, tone]);
  useEffect(() => () => { void context.current?.close(); context.current = null; }, []);
  return { play, musicEnabled, toggleMusic: () => { getContext(); setMusicEnabled((enabled) => !enabled); } };
};
