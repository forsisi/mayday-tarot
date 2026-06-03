import { FLAC_PATH_MAP } from '../data';
import { FLACDecoder } from '@wasm-audio-decoders/flac';

let wasmDecoder: FLACDecoder | null = null;
async function getWasmDecoder(): Promise<FLACDecoder> {
  if (!wasmDecoder) {
    wasmDecoder = new FLACDecoder();
    await wasmDecoder.ready;
  }
  return wasmDecoder;
}

const NOTE_FREQS: Record<string, number> = {
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
  'C6': 1046.50, 'D6': 1174.66, 'E6': 1318.51
};

interface ToneNote { n: string; d: number; }
interface SynthSong { id: string; title: string; bpms: number; melody: ToneNote[]; chords: string[][]; }

const SYNTH_SONGS: Record<string, SynthSong> = {
  'a1s2': { id: 'a1s2', title: '拥抱', bpms: 84, chords: [['F3','A3','C4','E4'],['G3','B3','D4','G4'],['E3','G3','B3','D4'],['A3','C4','E4','A4']], melody: [{n:'C5',d:1},{n:'A4',d:1},{n:'G4',d:1},{n:'A4',d:1},{n:'C5',d:1},{n:'A4',d:1},{n:'G4',d:1},{n:'A4',d:1},{n:'D5',d:1.5},{n:'C5',d:0.5},{n:'C5',d:2}] },
  'a2s8': { id: 'a2s8', title: '温柔', bpms: 78, chords: [['F3','A3','C4'],['G3','B3','D4'],['E3','G3','B3'],['A3','C4','E4']], melody: [{n:'E5',d:1},{n:'D5',d:1},{n:'C5',d:1},{n:'D5',d:1},{n:'E5',d:1},{n:'D5',d:1},{n:'C5',d:1},{n:'D5',d:1},{n:'E5',d:1.5},{n:'D5',d:0.5},{n:'C5',d:2}] },
  'a3s1': { id: 'a3s1', title: 'OK啦', bpms: 100, chords: [['C3','E3','G3'],['F3','A3','C4'],['G3','B3','D4'],['C3','E3','G3']], melody: [{n:'G4',d:0.5},{n:'G4',d:0.5},{n:'C5',d:1},{n:'C5',d:1},{n:'D5',d:1},{n:'E5',d:2},{n:'D5',d:1},{n:'C5',d:2}] },
  'a3s2': { id: 'a3s2', title: '一颗苹果', bpms: 82, chords: [['C3','E3','G3'],['G3','B3','D4'],['A3','C4','E4'],['F3','A3','C4']], melody: [{n:'G4',d:1},{n:'C5',d:1},{n:'D5',d:1},{n:'E5',d:2},{n:'D5',d:1},{n:'C5',d:1},{n:'G4',d:4}] },
  'a3s3': { id: 'a3s3', title: '人生海海', bpms: 80, chords: [['C3','E3','G3'],['G3','B3','D4'],['A3','C4','E4'],['F3','A3','C4']], melody: [{n:'C5',d:1},{n:'C5',d:1},{n:'B4',d:1},{n:'A4',d:1},{n:'G4',d:2},{n:'G4',d:2},{n:'A4',d:1},{n:'A4',d:1},{n:'G4',d:1},{n:'F4',d:1},{n:'E4',d:4}] },
  'a3s4': { id: 'a3s4', title: '候鸟', bpms: 78, chords: [['A3','C4','E4'],['F3','A3','C4'],['G3','B3','D4'],['C3','E3','G3']], melody: [{n:'E5',d:2},{n:'D5',d:1},{n:'C5',d:1},{n:'A4',d:2},{n:'C5',d:1},{n:'D5',d:1},{n:'E5',d:4}] },
  'a3s11': { id: 'a3s11', title: '纯真', bpms: 76, chords: [['C3','E3','G3'],['A3','C4','E4'],['F3','A3','C4'],['G3','B3','D4']], melody: [{n:'E5',d:1},{n:'D5',d:1},{n:'C5',d:2},{n:'G4',d:2},{n:'A4',d:1},{n:'C5',d:1},{n:'D5',d:4}] },
  'a5s1': { id: 'a5s1', title: '倔强', bpms: 82, chords: [['C3','E3','G3'],['G3','B3','D4'],['A3','C4','E4'],['F3','A3','C4']], melody: [{n:'C5',d:0.5},{n:'D5',d:0.5},{n:'E5',d:1},{n:'E5',d:1},{n:'E5',d:1},{n:'D5',d:0.5},{n:'C5',d:0.5},{n:'D5',d:1},{n:'E5',d:1},{n:'D5',d:1},{n:'C5',d:3}] },
  'a7s1': { id: 'a7s1', title: '突然好想你', bpms: 74, chords: [['C3','E3','G3'],['G3','B3','D4'],['A3','C4','E4'],['F3','A3','C4']], melody: [{n:'G4',d:1},{n:'C5',d:1.5},{n:'B4',d:0.5},{n:'A4',d:1},{n:'B4',d:1},{n:'C5',d:2}] },
  'a8s7': { id: 'a8s7', title: '干杯', bpms: 92, chords: [['G3','B3','D4'],['D3','F#3','A3'],['E3','G3','B3'],['C3','E3','G3']], melody: [{n:'G4',d:1},{n:'A4',d:1},{n:'B4',d:1},{n:'B4',d:1},{n:'B4',d:0.5},{n:'A4',d:0.5},{n:'G4',d:1},{n:'A4',d:1},{n:'B4',d:4}] },
  'a9s6': { id: 'a9s6', title: '后来的我们', bpms: 76, chords: [['C3','E3','G3'],['G3','B3','D4'],['A3','C4','E4'],['F3','A3','C4']], melody: [{n:'E5',d:1},{n:'E5',d:0.5},{n:'D5',d:0.5},{n:'C5',d:1},{n:'G4',d:1},{n:'A4',d:1},{n:'C5',d:1},{n:'D5',d:2}] }
};

export class MaydaySynthPlayer {
  private ctx: AudioContext | null = null;
  private primaryGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;

  private isRunning = false;
  private isPaused = false;
  private currentSongId: string | null = null;
  private beatTimer: ReturnType<typeof setTimeout> | null = null;
  private melodyIndex = 0;
  private chordIndex = 0;
  private activeNodes: AudioNode[] = [];

  private audioEl: HTMLAudioElement | null = null;
  private audioSrc: MediaElementAudioSourceNode | null = null;
  private playingRealAudio = false;
  private bufStart = 0;
  private bufDur = 0;
  private pausedAt = 0; // position where paused (seconds)
  private audioBuffer: AudioBuffer | null = null; // cached for resume

  private onProgressCb: ((t: number, d: number) => void) | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private onEndedCb: (() => void) | null = null;

  private initCtx() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AC();
    this.primaryGain = this.ctx.createGain();
    this.primaryGain.gain.value = 0.3;
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 1600;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.filter.connect(this.analyser);
    this.analyser.connect(this.primaryGain);
    this.primaryGain.connect(this.ctx.destination);
  }

  private wireAudio(): HTMLAudioElement | null {
    if (!this.ctx || !this.filter) return null;
    if (this.audioSrc) { try { this.audioSrc.disconnect(); } catch (e) {} this.audioSrc = null; }
    if (this.audioEl) { try { this.audioEl.pause(); this.audioEl.src = ''; } catch (e) {} this.audioEl = null; }
    try {
      const el = new Audio();
      el.crossOrigin = 'anonymous';
      const src = this.ctx.createMediaElementSource(el);
      src.connect(this.filter);
      el.addEventListener('ended', () => { if (this.onEndedCb && this.playingRealAudio) this.onEndedCb(); });
      this.audioEl = el;
      this.audioSrc = src;
      return el;
    } catch (err) { return null; }
  }

  public getAnalyser(): AnalyserNode | null { this.initCtx(); return this.analyser; }
  public setOnProgress(cb: ((t: number, d: number) => void) | null) { this.onProgressCb = cb; }
  public setOnEnded(cb: (() => void) | null) { this.onEndedCb = cb; }

  private startProgress() {
    this.stopProgress();
    this.progressTimer = setInterval(() => {
      if (!this.onProgressCb || !this.playingRealAudio) return;
      if (this.bufDur > 0) {
        this.onProgressCb((this.ctx?.currentTime || 0) - this.bufStart, this.bufDur);
      } else if (this.audioEl) {
        this.onProgressCb(this.audioEl.currentTime, this.audioEl.duration || 0);
      }
    }, 250);
  }
  private stopProgress() { if (this.progressTimer) { clearInterval(this.progressTimer); this.progressTimer = null; } }

  public get isPausedState(): boolean { return this.isPaused; }
  public getCurrentTime(): number { return this.audioEl?.currentTime || 0; }
  public getDuration(): number { return this.audioEl?.duration || 0; }
  public isRealAudioPlaying(): boolean { return this.playingRealAudio; }
  public seekTo(time: number) { if (this.audioEl) this.audioEl.currentTime = time; }
  public toggleMute(muted: boolean) {
    if (this.primaryGain) this.primaryGain.gain.value = muted ? 0.0 : 0.3;
  }

  private audioUrl(songId: string): string {
    const p = FLAC_PATH_MAP[songId];
    return p ? `/${p}` : `/audio/${songId}.flac`;
  }

  public async play(songId: string, songTitle?: string, albumTitle?: string, onNote?: (n: string) => void) {
    this.initCtx();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
    this.stop();

    this.currentSongId = songId;
    this.isRunning = true;
    this.isPaused = false;
    this.pausedAt = 0;
    this.melodyIndex = 0;
    this.chordIndex = 0;

    const localUrl = this.audioUrl(songId);
    let bestUrl = localUrl;
    let settled = false;

    const synth = (reason: string) => {
      if (settled) return;
      settled = true;
      this.playingRealAudio = false;
      this.playSynth(songId, onNote);
    };

    const flacOk = () => {
      if (settled) return;
      settled = true;
      this.playingRealAudio = true;
      this.startProgress();
      const s = SYNTH_SONGS[songId];
      if (s && onNote) this.scheduleVisuals(s, onNote);
    };

    const timer = setTimeout(() => synth('timeout'), 20000);

    // Try Netease API first (with cookie for full song)
    if (songTitle) {
      try {
        const params = new URLSearchParams();
        params.set('title', songTitle);
        if (albumTitle) params.set('album', albumTitle);
        const resp = await fetch(`/api/music/play?${params}`);
        const data = await resp.json();
        if (data.url) bestUrl = data.url;
      } catch {}
    }

    if (settled) return;

    // Play via Audio element
    const el = this.wireAudio();
    if (el) {
      let aDone = false;
      el.onerror = () => {
        if (aDone || settled) return;
        aDone = true;
        if (bestUrl !== localUrl) {
          // Netease failed, fallback to local
          el.src = localUrl;
        } else {
          this.decodeViaFetch(localUrl, settled, flacOk, synth, timer);
        }
      };
      el.oncanplay = () => {
        if (aDone || settled) return;
        aDone = true;
        el.play().then(() => { clearTimeout(timer); flacOk(); }).catch(() => synth('play-rejected'));
      };
      el.src = bestUrl;
      return;
    }
    this.decodeViaFetch(bestUrl, settled, flacOk, synth, timer);
  }

  private async decodeViaFetch(
    url: string, settled: boolean,
    ok: () => void, fail: (r: string) => void,
    timer: ReturnType<typeof setTimeout>
  ) {
    if (settled) return;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const buf = await resp.arrayBuffer();
      if (settled) return;

      // Try browser native decoder first
      try {
        const audioBuffer = await this.ctx!.decodeAudioData(buf.slice(0));
        if (settled) return;
        this.playBuffer(audioBuffer);
        clearTimeout(timer);
        ok();
        return;
      } catch (_nativeErr) {
        // Native failed — use WASM decoder
        if (settled) return;
        const decoder = await getWasmDecoder();
        const result = await decoder.decode(new Uint8Array(buf));
        if (settled) return;
        const channels = result.channelData.length;
        const audioBuffer = this.ctx!.createBuffer(channels, result.samplesDecoded, result.sampleRate);
        for (let ch = 0; ch < channels; ch++) {
          audioBuffer.copyToChannel(result.channelData[ch], ch);
        }
        this.playBuffer(audioBuffer);
        clearTimeout(timer);
        ok();
      }
    } catch (_err: any) {
      if (!settled) fail('decode');
    }
  }

  private playBuffer(audioBuffer: AudioBuffer) {
    this.audioBuffer = audioBuffer;
    const source = this.ctx!.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.filter!);
    this.bufStart = this.ctx!.currentTime;
    this.bufDur = audioBuffer.duration;
    source.start();
    source.addEventListener('ended', () => { if (this.onEndedCb && this.playingRealAudio) this.onEndedCb(); });
    this.activeNodes.push(source);
  }

  private scheduleVisuals(song: SynthSong, cb: (n: string) => void) {
    if (!this.isRunning || !this.playingRealAudio) return;
    const beat = 60 / song.bpms;
    const note = song.melody[this.melodyIndex % song.melody.length];
    if (note.n !== '0') cb(note.n);
    this.melodyIndex++;
    this.beatTimer = setTimeout(() => this.scheduleVisuals(song, cb), note.d * beat * 1000);
  }

  private playSynth(songId: string, onNote?: (n: string) => void) {
    this.playingRealAudio = false;
    const song = SYNTH_SONGS[songId] || SYNTH_SONGS['a1s2'];
    if (!song) return;
    const beat = 60 / song.bpms;
    const schedule = () => {
      if (!this.isRunning || !this.ctx || this.playingRealAudio) return;
      const now = this.ctx.currentTime;
      if (this.melodyIndex % 4 === 0) {
        song.chords[this.chordIndex % song.chords.length].forEach(n => {
          const f = NOTE_FREQS[n]; if (!f) return;
          const o = this.ctx!.createOscillator(), g = this.ctx!.createGain();
          o.type = 'triangle'; o.frequency.setValueAtTime(f, now);
          g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.07, now + 0.6);
          g.gain.exponentialRampToValueAtTime(0.001, now + beat * 4);
          o.connect(g); g.connect(this.filter!); o.start(now); o.stop(now + beat * 4);
          this.activeNodes.push(o);
        });
        this.chordIndex++;
      }
      const n = song.melody[this.melodyIndex % song.melody.length];
      if (n.n !== '0') {
        const f = NOTE_FREQS[n.n]; if (!f) return;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(f, now);
        g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.16, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + n.d * beat);
        o.connect(g); g.connect(this.filter);
        o.start(now); o.stop(now + n.d * beat);
        this.activeNodes.push(o);
        if (onNote) onNote(n.n);
      }
      this.melodyIndex++;
      this.beatTimer = setTimeout(schedule, n.d * beat * 1000);
    };
    schedule();
  }

  public pause() {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.stopProgress();

    if (this.audioEl) {
      this.pausedAt = this.audioEl.currentTime;
      this.audioEl.pause();
    } else if (this.playingRealAudio && this.ctx) {
      this.pausedAt = (this.ctx.currentTime - this.bufStart);
      // Stop active buffer sources
      this.activeNodes.forEach(n => { try { (n as AudioBufferSourceNode).stop(); } catch (e) {} });
      this.activeNodes = [];
    }
    if (this.beatTimer) { clearTimeout(this.beatTimer); this.beatTimer = null; }
  }

  public resume() {
    if (!this.isRunning || !this.isPaused || !this.currentSongId) return;
    this.isPaused = false;

    if (this.audioEl) {
      this.audioEl.currentTime = this.pausedAt;
      this.audioEl.play().then(() => {
        this.playingRealAudio = true;
        this.startProgress();
        const s = SYNTH_SONGS[this.currentSongId!];
        if (s && this.melodyIndex < s.melody.length) this.scheduleVisuals(s, () => {});
      }).catch(() => {});
    } else if (this.audioBuffer && this.ctx) {
      this.playBufferFrom(this.audioBuffer, this.pausedAt);
      this.playingRealAudio = true;
      this.bufStart = this.ctx.currentTime - this.pausedAt;
      this.startProgress();
    }
  }

  private playBufferFrom(audioBuffer: AudioBuffer, offset: number) {
    const source = this.ctx!.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.filter!);
    this.bufStart = this.ctx!.currentTime - offset;
    this.bufDur = audioBuffer.duration;
    source.start(0, offset);
    source.addEventListener('ended', () => { if (this.onEndedCb && this.playingRealAudio) this.onEndedCb(); });
    this.activeNodes.push(source);
  }

  public stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.pausedAt = 0;
    this.audioBuffer = null;
    this.stopProgress();
    if (this.beatTimer) { clearTimeout(this.beatTimer); this.beatTimer = null; }
    this.activeNodes.forEach(n => { try { (n as OscillatorNode).stop(); } catch (e) {} });
    this.activeNodes = [];
    if (this.audioEl) { try { this.audioEl.pause(); } catch (e) {} }
    this.playingRealAudio = false;
    this.bufDur = 0;
    this.bufStart = 0;
    this.currentSongId = null;
  }
}

export const maydaySynth = new MaydaySynthPlayer();
