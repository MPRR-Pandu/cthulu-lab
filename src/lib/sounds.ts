// Sound effects for Command Center events
// Uses Web Audio API — works in Tauri webview

let audioContext: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Cache decoded audio buffers
const bufferCache = new Map<string, AudioBuffer>();

async function loadSound(url: string): Promise<AudioBuffer> {
  const cached = bufferCache.get(url);
  if (cached) return cached;

  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const ctx = getContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  bufferCache.set(url, audioBuffer);
  return audioBuffer;
}

async function play(url: string, volume = 0.3): Promise<void> {
  try {
    const ctx = getContext();
    const buffer = await loadSound(url);
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = buffer;
    gainNode.gain.value = volume;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(0);
  } catch (e) {
    // Silently fail — sound is non-critical
    console.debug("Sound failed:", e);
  }
}

// Generate simple tones for quick feedback sounds
function playTone(frequency: number, duration: number, volume = 0.1): void {
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // silent
  }
}

// ─── PUBLIC API ───

/** Play hallelujah sound — for mission complete, ship success */
export function playHallelujah(): void {
  play("/sounds/hallelujah-sound.flac", 0.4);
}

/** Short blip — agent selected, context switch */
export function playSwitch(): void {
  playTone(800, 0.08, 0.08);
}

/** Two-tone up — message sent */
export function playSend(): void {
  playTone(600, 0.06, 0.06);
  setTimeout(() => playTone(900, 0.06, 0.06), 70);
}

/** Soft ding — agent responded */
export function playReceive(): void {
  playTone(1200, 0.12, 0.05);
}

/** Warning buzz — loop detection alert */
export function playAlert(): void {
  playTone(300, 0.15, 0.1);
  setTimeout(() => playTone(300, 0.15, 0.1), 200);
}

/** Rising chime — mission progress bump */
export function playProgress(): void {
  playTone(500, 0.08, 0.06);
  setTimeout(() => playTone(700, 0.08, 0.06), 80);
  setTimeout(() => playTone(900, 0.08, 0.06), 160);
}
