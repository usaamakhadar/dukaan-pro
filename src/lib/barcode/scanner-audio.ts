/**
 * DUKAAN PRO BARCODE ENGINE - SCANNER AUDIO FEEDBACK
 * High-quality beep sounds utilizing Web Audio API directly in the browser.
 */

let audioContextInstance: AudioContext | null = null;

/**
 * Lazily retrieves or instantiates a single AudioContext.
 * Handles browser Autoplay Policies by initializing on interaction.
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContextInstance) {
      audioContextInstance = new AudioContextClass();
    }

    // Resume if suspended (common browser behavior)
    if (audioContextInstance.state === 'suspended') {
      audioContextInstance.resume().catch(err => {
        console.warn('AudioContext failed to resume:', err);
      });
    }

    return audioContextInstance;
  } catch (e) {
    console.error('Failed to initialize AudioContext:', e);
    return null;
  }
}

/**
 * Plays a short, high-quality POS scanner beep.
 * Frequency: 950Hz (sharp beep), Duration: 120ms.
 */
export function playSuccessBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, now); // Sharp high-quality beep

    // Gain node shaping to prevent popping sound (attack/decay curve)
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.01); // Quick attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12); // Smooth decay

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  } catch (err) {
    console.warn('Success beep sound execution failed:', err);
  }
}

/**
 * Plays a low double-beep warning/error sound.
 */
export function playErrorBeep(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    
    // First error tone (lower frequency)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(220, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second error tone delayed by 180ms
    setTimeout(() => {
      const delayedCtx = getAudioContext();
      if (!delayedCtx) return;
      try {
        const delayedNow = delayedCtx.currentTime;
        const osc2 = delayedCtx.createOscillator();
        const gain2 = delayedCtx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(200, delayedNow);
        gain2.gain.setValueAtTime(0, delayedNow);
        gain2.gain.linearRampToValueAtTime(0.12, delayedNow + 0.01);
        gain2.gain.exponentialRampToValueAtTime(0.001, delayedNow + 0.15);
        osc2.connect(gain2);
        gain2.connect(delayedCtx.destination);
        osc2.start(delayedNow);
        osc2.stop(delayedNow + 0.15);
      } catch {}
    }, 180);
  } catch (err) {
    console.warn('Error beep sound execution failed:', err);
  }
}
