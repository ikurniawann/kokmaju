/**
 * Efek suara struk kasir mobile (owner KoMa 2026-10-19): bunyi printer thermal
 * selama kertas keluar + bunyi pisau & kertas sobek saat dipotong. Disintesis
 * dengan Web Audio API (tanpa file audio). Jadwal disamakan dengan
 * pay-receipt-animation.css — ubah keduanya bersamaan.
 *
 * Browser HP hanya mengizinkan audio setelah gestur pengguna: panggil
 * `unlockReceiptAudio()` di handler klik (konfirmasi bayar / Cetak struk),
 * lalu `playReceiptSounds()` saat animasi mulai.
 */

/** Kertas mulai keluar (detik) — `prx-feed` delay. */
export const FEED_START = 0.7;
/** Lama kertas keluar — `prx-feed` duration. */
export const FEED_DURATION = 1.75;
/** Jumlah hentakan kertas — `steps(14)`. */
export const FEED_STEPS = 14;
/** Pisau menyapu celah — `prx-blade` delay. */
export const CUT_AT = 2.45;

export const SOUND_STORAGE_KEY = "kokmaju-kasir-sound";

/** Waktu (detik dari mulai) tiap hentakan motor printer. */
export function printStepTimes(): number[] {
  const step = FEED_DURATION / FEED_STEPS;
  return Array.from({ length: FEED_STEPS }, (_, index) => Number((FEED_START + index * step).toFixed(4)));
}

/** Preferensi suara tersimpan di HP kasir (default nyala). */
export function readSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeSoundEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // mode privat — pilihan berlaku sampai halaman ditutup
  }
}

type AudioCtor = typeof AudioContext;
let shared: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (shared) return shared;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  shared = new Ctor();
  return shared;
}

/** Panggil di dalam handler klik supaya audio diizinkan browser HP. */
export function unlockReceiptAudio() {
  const ctx = audioContext();
  if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Satu hentakan printer thermal: derik motor stepper + desis kepala cetak. */
function scheduleStep(ctx: AudioContext, out: AudioNode, at: number, length: number, noise: AudioBuffer) {
  const gate = ctx.createGain();
  gate.gain.setValueAtTime(0, at);
  gate.gain.linearRampToValueAtTime(1, at + 0.006);
  gate.gain.setValueAtTime(1, at + length * 0.7);
  gate.gain.exponentialRampToValueAtTime(0.0001, at + length);
  gate.connect(out);

  // Motor stepper: gelombang kotak bernada tinggi yang sedikit naik.
  const motor = ctx.createOscillator();
  motor.type = "square";
  motor.frequency.setValueAtTime(560, at);
  motor.frequency.linearRampToValueAtTime(640, at + length);
  const motorTone = ctx.createBiquadFilter();
  motorTone.type = "lowpass";
  motorTone.frequency.value = 1800;
  const motorGain = ctx.createGain();
  motorGain.gain.value = 0.05;
  motor.connect(motorTone).connect(motorGain).connect(gate);
  motor.start(at);
  motor.stop(at + length + 0.02);

  // Desis kepala cetak thermal: noise band-pass.
  const hiss = ctx.createBufferSource();
  hiss.buffer = noise;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 3200;
  band.Q.value = 1.2;
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.3;
  hiss.connect(band).connect(hissGain).connect(gate);
  hiss.start(at, Math.random() * 0.5);
  hiss.stop(at + length + 0.02);
}

/** Pisau cutter "cekrek" + kertas sobek (noise berkeretak, nada turun). */
function scheduleCut(ctx: AudioContext, out: AudioNode, at: number, noise: AudioBuffer) {
  // Klik pisau.
  const click = ctx.createBufferSource();
  click.buffer = noise;
  const clickFilter = ctx.createBiquadFilter();
  clickFilter.type = "highpass";
  clickFilter.frequency.value = 2500;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.0001, at);
  clickGain.gain.exponentialRampToValueAtTime(0.9, at + 0.003);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
  click.connect(clickFilter).connect(clickGain).connect(out);
  click.start(at);
  click.stop(at + 0.06);

  // Sobekan: band-pass menyapu turun, amplitudo acak tiap 7 ms (kresek).
  const tearAt = at + 0.03;
  const tearLength = 0.3;
  const tear = ctx.createBufferSource();
  tear.buffer = noise;
  const sweep = ctx.createBiquadFilter();
  sweep.type = "bandpass";
  sweep.Q.value = 0.9;
  sweep.frequency.setValueAtTime(4200, tearAt);
  sweep.frequency.exponentialRampToValueAtTime(1300, tearAt + tearLength);
  const crackle = ctx.createGain();
  crackle.gain.setValueAtTime(0.0001, tearAt);
  for (let t = 0; t < tearLength; t += 0.007) {
    const fade = 1 - t / tearLength;
    crackle.gain.setValueAtTime((0.25 + Math.random() * 0.75) * fade * 0.8, tearAt + t);
  }
  crackle.gain.exponentialRampToValueAtTime(0.0001, tearAt + tearLength + 0.03);
  tear.connect(sweep).connect(crackle).connect(out);
  tear.start(tearAt, 0.2);
  tear.stop(tearAt + tearLength + 0.05);
}

/**
 * Jadwalkan suara cetak + potong mulai sekarang. `instant` (animasi dilewati /
 * reduced motion) = langsung bunyi potong saja. Kembalikan fungsi penghenti.
 */
export function playReceiptSounds({ instant = false }: { instant?: boolean } = {}): () => void {
  const ctx = audioContext();
  if (!ctx || ctx.state === "closed") return () => {};
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    const noise = noiseBuffer(ctx, 1);
    const start = ctx.currentTime + 0.02;
    if (!instant) {
      const stepLength = (FEED_DURATION / FEED_STEPS) * 0.78;
      for (const offset of printStepTimes()) scheduleStep(ctx, master, start + offset, stepLength, noise);
    }
    scheduleCut(ctx, master, start + (instant ? 0 : CUT_AT), noise);
  };
  // Baru dibuka di gestur yang sama (resume masih berjalan) → tunggu dulu.
  if (ctx.state === "running") schedule();
  else void ctx.resume().then(schedule, () => {});

  return () => {
    stopped = true;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.05);
    window.setTimeout(() => master.disconnect(), 120);
  };
}
