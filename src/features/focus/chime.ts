let context: AudioContext | null = null;

/** A soft two-note chime, synthesised so the app ships no audio files. Silent if audio is unavailable. */
export function playChime(): void {
  try {
    context ??= new AudioContext();
    const start = context.currentTime;
    for (const [i, frequency] of [659.25, 880].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const at = start + i * 0.16;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.75);
    }
  } catch {
    /* no audio device, or the browser has not allowed sound yet */
  }
}
