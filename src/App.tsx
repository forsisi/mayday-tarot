import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Album, AppState, Song, TarotReadingResponse } from './types';
import { MAYDAY_ALBUMS } from './data';
import { maydaySynth } from './utils/maydaySynth';
import BackgroundStarfield from './components/BackgroundStarfield';
import GestureController from './components/GestureController';
import TarotScrollBoard, { TarotScrollBoardHandle } from './components/TarotScrollBoard';
import TarotCard from './components/TarotCard';
import AudioVisualizer from './components/AudioVisualizer';
import LyricsViewer from './components/LyricsViewer';
import {
  Sparkles, Volume2, VolumeX, Play, Pause, SkipForward,
  Wand2, RefreshCw, X, Music, ArrowLeft, Disc,
  Shuffle, Repeat1, List, Settings, LayoutGrid, Camera, CameraOff, BookOpen, LogIn
} from 'lucide-react';

type AppScreen = 'INTRO' | 'CARD_SCROLL' | 'SELECTING' | 'CARD_DETAIL';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('INTRO');
  const [selectedAlbum, setSelectedAlbum] = useState<Album>(MAYDAY_ALBUMS[0]);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [activeSong, setActiveSong] = useState<Song>(MAYDAY_ALBUMS[0].songs[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Selecting animation phases
  const [selectingPhase, setSelectingPhase] = useState<'fly' | 'reveal' | 'hold' | 'morph'>('fly');

  // Progress
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Playlist
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const [playMode, setPlayMode] = useState<'shuffle' | 'sequential' | 'single'>('sequential');
  const [showLyrics, setShowLyrics] = useState(false);
  const [apiLyrics, setApiLyrics] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [neteaseLoggedIn, setNeteaseLoggedIn] = useState(false);
  const [neteaseNickname, setNeteaseNickname] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginMsg, setLoginMsg] = useState('');

  // Check login status on mount
  useEffect(() => {
    fetch('/api/music/status').then(r => r.json()).then(d => {
      if (d.loggedIn) { setNeteaseLoggedIn(true); setNeteaseNickname(d.nickname || ''); }
    }).catch(() => {});
  }, []);

  // Gesture speed setting
  const [gestureSpeed, setGestureSpeed] = useState(1.0); // 0.2=慢, 0.5=中, 1.0=快
  const [showSpeedSettings, setShowSpeedSettings] = useState(false);

  // Refs
  const scrollBoardRef = useRef<TarotScrollBoardHandle>(null);
  const gestureStateRef = useRef<'idle' | 'swiping' | 'pointing'>('idle');

  // Camera / gesture
  const [cameraActive, setCameraActive] = useState(false);

  // Collection modal
  const [showCollection, setShowCollection] = useState(false);
  const [collectionFlipped, setCollectionFlipped] = useState<Record<string, boolean>>({});

  // Fortune
  const [fortuneQuestion, setFortuneQuestion] = useState('');
  const [fortuneResponse, setFortuneResponse] = useState<TarotReadingResponse | null>(null);
  const [isQueryingOracle, setIsQueryingOracle] = useState(false);
  const [showOracleModal, setShowOracleModal] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');

  const ALBUM_QUESTIONS: Record<string, string[]> = {
    'album_1': ['我开始怀疑自己，该怎么找回最初的勇气？', '刚刚踏入社会，如何才能疯狂地活出自己？', '二十岁的迷惘，未来的方向到底在哪里？', '如何在这个疯狂世界里保持纯真？'],
    'album_2': ['爱情中最重要的是什么？', '为什么总是放不下那个人？', '该如何在爱里学会温柔地放手？', '怎样才算是真正爱过一个人？'],
    'album_3': ['人生像海浪一样起起落落，我该如何面对低谷？', '二十多岁的人生，到底该怎么活才对得起自己？', '觉得自己很平凡，怎样才能找到属于自己的光芒？', '如何在迷茫中相信潮落之后一定有潮起？'],
    'album_4': ['如果能回到过去，我会做出不同的选择吗？', '为什么我们总在失去后才懂得珍惜？', '童年的梦想越来越远，我该继续追吗？', '面对遗憾，该如何跟自己和解？'],
    'album_5': ['坚持了那么久，值得吗？', '当所有人都反对我的梦想，我该怎么扛下去？', '怎样才能像孙悟空一样勇敢活出真我？', '如何在平凡的生活中找到不平凡的力量？'],
    'album_6': ['爱一个人可以为TA放弃什么？', '为了重要的人，我该如何变得更好？', '什么是生命中最重要的小事？', '如何在爱情中既温柔又勇敢？'],
    'album_7': ['为什么长大之后，快乐变得越来越难？', '那些回不去的青春，我该如何好好告别？', '三十岁以后，人生还能重新开始吗？', '如何面对突然袭来的孤独和想念？'],
    'album_8': ['现在不做，是不是一辈子都不会做了？', '站在人生的岔路口，第二人生该怎么开始？', '朋友渐行渐远，该如何珍惜每一段相遇？', '时间一天天过去，我到底在等什么？'],
    'album_9': ['如果可以回到过去，我会对年少的自己说什么？', '三十五岁了，这些年我活成了自己想要的样子吗？', '如何与过去的自己和解，与未来的自己相遇？', '人生走到这里，下一站会是什么？'],
  };

  // Sound
  const playTransitionSound = (freq = 440, type: OscillatorType = 'sine', dur = 0.3) => {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(0.04, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch (e) {}
  };

  // Build playlist
  const buildPlaylist = useCallback((album: Album, startIdx = 0) => {
    const songs = playMode === 'shuffle'
      ? [...album.songs].sort(() => Math.random() - 0.5)
      : [...album.songs];
    setPlaylist(songs);
    setPlaylistIndex(startIdx);
  }, [playMode]);

  // Play song
  const playSong = useCallback((song: Song, albumTitle?: string) => {
    setActiveSong(song);
    setApiLyrics(null);
    maydaySynth.play(song.id, song.title, albumTitle, (note) => {
      const badge = document.getElementById('playing_note_badge');
      if (!badge) return;
      badge.innerText = `MUSIC: ${note}`;
      badge.classList.add('scale-110', 'text-cyan-400');
      setTimeout(() => badge.classList.remove('scale-110', 'text-cyan-400'), 150);
    });
    setIsPlaying(true);
  }, []);

  const playAtIndex = useCallback((idx: number) => {
    if (idx >= 0 && idx < playlist.length) {
      setPlaylistIndex(idx);
      playSong(playlist[idx]);
    }
  }, [playlist, playSong]);

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    if (playMode === 'single') {
      playSong(activeSong);
      return;
    }
    if (playMode === 'shuffle') {
      let next = Math.floor(Math.random() * playlist.length);
      if (playlist.length > 1 && next === playlistIndex) {
        next = (next + 1) % playlist.length;
      }
      playAtIndex(next);
      return;
    }
    playAtIndex((playlistIndex + 1) % playlist.length);
  }, [playlist, playlistIndex, playAtIndex, playMode, activeSong, playSong]);

  const skipToNext = useCallback(() => {
    if (playlist.length === 0) return;
    if (playMode === 'shuffle') {
      let next = Math.floor(Math.random() * playlist.length);
      if (playlist.length > 1 && next === playlistIndex) {
        next = (next + 1) % playlist.length;
      }
      playAtIndex(next);
      return;
    }
    playAtIndex((playlistIndex + 1) % playlist.length);
  }, [playlist, playlistIndex, playAtIndex, playMode]);

  // Synth callbacks
  useEffect(() => {
    maydaySynth.setOnProgress((t, d) => { setCurrentTime(t); setDuration(d); });
    maydaySynth.setOnEnded(() => playNext());
  }, [playNext]);

  // Controls
  const togglePlayback = () => {
    if (isPlaying) {
      maydaySynth.pause();
      setIsPlaying(false);
    } else {
      if (maydaySynth.isPausedState) {
        maydaySynth.resume();
        setIsPlaying(true);
      } else {
        playSong(activeSong);
      }
    }
  };

  const toggleMute = () => {
    const m = !isMuted; setIsMuted(m); maydaySynth.toggleMute(m);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    setCurrentTime(t); maydaySynth.seekTo(t);
  };

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const parseDuration = (d: string): number => {
    const parts = d.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 240;
  };

  // === SELECTING TRANSITION SEQUENCE ===
  const startSelectingSequence = useCallback((album: Album) => {
    setSelectedAlbum(album);
    setScreen('SELECTING');
    setSelectingPhase('fly');
    setIsCardFlipped(false);

    // Phase 1: card back drifts to center (1.2s)
    playTransitionSound(440, 'sine', 0.6);

    // Phase 2: card back fades → album cover emerges with glow (at 1.4s)
    setTimeout(() => {
      setSelectingPhase('reveal');
      playTransitionSound(587, 'triangle', 0.6);
    }, 1400);

    // Phase 3: cover holds at full size, appreciation pause (at 2.8s)
    setTimeout(() => {
      setSelectingPhase('hold');
      playTransitionSound(698, 'sine', 0.4);
    }, 2800);

    // Phase 4: morph cover into player card (at 5.5s)
    setTimeout(() => {
      setSelectingPhase('morph');
    }, 5500);

    // Phase 5: transition to player after morph (at 6.3s)
    setTimeout(() => {
      const song = album.songs[Math.floor(Math.random() * album.songs.length)];
      try {
        buildPlaylist(album);
        if (song) playSong(song);
      } catch (e) {}
      setScreen('CARD_DETAIL');
    }, 6300);
  }, [buildPlaylist, playSong]);

  // === GESTURE HANDLING ===
  const handleHandMove = useCallback((deltaX: number, handX: number) => {
    if (screen !== 'CARD_SCROLL') return;
    if (gestureStateRef.current === 'pointing') return;
    if (!scrollBoardRef.current) return;

    if (handX < 0.1 || handX > 0.9) return;

    // Dead zone: ignore tiny jitter
    if (Math.abs(deltaX) < 0.015) return;

    gestureStateRef.current = 'swiping';
    const targetVelocity = deltaX * 0.8 * gestureSpeed;
    scrollBoardRef.current.setVelocity(targetVelocity);
  }, [screen, gestureSpeed]);

  const handleGestureDetected = useCallback((gestureKey: string) => {
    switch (gestureKey) {
      case 'INDEX_POINT':
        if (screen === 'CARD_SCROLL') {
          gestureStateRef.current = 'pointing';
          // Trigger gradual deceleration → auto-select when stopped
          if (scrollBoardRef.current) {
            scrollBoardRef.current.beginDecelerate();
          }
        } else if (screen === 'CARD_DETAIL') {
          setIsCardFlipped(prev => !prev);
          playTransitionSound(587, 'sine', 0.25);
        }
        break;

      case 'FIST':
        if (screen === 'CARD_SCROLL' && scrollBoardRef.current) {
          // Fist = draw card ceremony
          const btn = document.getElementById('btn_trigger_draw');
          if (btn) btn.click();
        } else if (screen === 'CARD_DETAIL') {
          returnToScrollBoard();
        }
        break;

      case 'ROCK_SIGN':
        if (screen === 'CARD_DETAIL') {
          returnToScrollBoard();
        }
        break;

      case 'OPEN_PALM':
        if (screen === 'CARD_SCROLL') {
          gestureStateRef.current = 'idle';
        }
        break;
    }
  }, [screen, startSelectingSequence]);

  // === CARD SCROLL: select album directly (button draw) ===
  const handleSelectAlbumFromBoard = useCallback((album: Album) => {
    startSelectingSequence(album);
  }, [startSelectingSequence]);

  const returnToScrollBoard = () => {
    setScreen('CARD_SCROLL');
    setShowLyrics(false);
    setIsCardFlipped(false);
    gestureStateRef.current = 'idle';
    playTransitionSound(349, 'sine', 0.4);
  };

  // === Netease Login ===
  const [qrUrl, setQrUrl] = useState('');
  const [qrPolling, setQrPolling] = useState(false);

  const generateQR = async () => {
    setLoginMsg('生成二维码...');
    try {
      const res = await fetch('/api/music/qrcode');
      const data = await res.json();
      if (data.qrUrl) {
        setQrUrl(data.qrUrl);
        setLoginMsg('请用网易云音乐App扫码');
        setQrPolling(true);
      } else {
        setLoginMsg('二维码生成失败');
      }
    } catch { setLoginMsg('网络错误'); }
  };

  useEffect(() => {
    if (!qrPolling) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/music/qrcode/check');
        const data = await res.json();
        if (data.code === 800) { setLoginMsg('二维码已过期，重新生成...'); setQrPolling(false); setQrUrl(''); generateQR(); }
        else if (data.code === 802) setLoginMsg('扫码成功！请在手机上确认');
        else if (data.loggedIn) {
          setNeteaseLoggedIn(true);
          setNeteaseNickname(data.nickname || '');
          setLoginMsg('登录成功！');
          setQrPolling(false);
          setShowLogin(false);
          setLoginMsg('');
          setQrUrl('');
          // Immediately restart current song from beginning with full version
          if (isPlaying && activeSong) {
            maydaySynth.stop();
            playSong(activeSong, selectedAlbum.title);
          }
        }
      } catch {}
    }, 2000);
    return () => clearInterval(timer);
  }, [qrPolling]);

  const handleNeteaseLogin = async () => {
    if (!loginPhone || !loginPassword) return;
    setLoginMsg('登录中...');
    try {
      const res = await fetch('/api/music/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone, password: loginPassword })
      });
      const data = await res.json();
      if (data.success) {
        setNeteaseLoggedIn(true);
        setNeteaseNickname(data.nickname || '');
        setLoginMsg('登录成功！');
        setTimeout(() => { setShowLogin(false); setLoginMsg(''); setLoginPhone(''); setLoginPassword(''); }, 800);
      } else {
        setLoginMsg(data.message || '登录失败');
      }
    } catch { setLoginMsg('网络错误'); }
  };

  // === AI ORACLE ===
  const handleQueryOracleAnswer = async () => {
    if (isQueryingOracle) return;
    setIsQueryingOracle(true); setTypedAnswer(''); setFortuneResponse(null);
    playTransitionSound(880, 'triangle', 0.6);
    try {
      const res = await fetch('/api/oracle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId: selectedAlbum.id, userQuestion: fortuneQuestion })
      });
      const data: TarotReadingResponse = await res.json();
      if (!res.ok) {
        setTypedAnswer(data.answer || '星轨连通异常，请稍后重试。');
        setIsQueryingOracle(false);
        return;
      }
      setFortuneResponse(data);
      let curr = '', i = 0;
      const full = data.answer;
      const print = () => {
        if (i < full.length) { curr += full.charAt(i); setTypedAnswer(curr); i++; setTimeout(print, 35); }
        else setIsQueryingOracle(false);
      };
      print();
    } catch (err: any) {
      setTypedAnswer(`旋律连线中断：${err.message || '请稍后重试'}。`);
      setIsQueryingOracle(false);
    }
  };

  // Escape to go back
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && screen !== 'INTRO') {
        if (showOracleModal) { setShowOracleModal(false); return; }
        if (showLyrics) { setShowLyrics(false); return; }
        if (screen === 'CARD_DETAIL') returnToScrollBoard();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [screen, showOracleModal, showLyrics]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative h-screen text-slate-100 flex flex-col overflow-hidden select-none font-sans">
      <BackgroundStarfield isPlaying={isPlaying} />

      {/* HEADER */}
      <header className="relative w-full max-w-7xl mx-auto flex items-center justify-between pt-3 pb-1.5 px-4 border-b border-slate-800/60 z-30 shrink-0">
        <div onClick={() => { if (screen !== 'INTRO') returnToScrollBoard(); }}
          className="flex items-center gap-3 cursor-pointer group">
          {/* Logo mark — animated geometric */}
          <div className="relative w-9 h-9 flex items-center justify-center group-hover:scale-110 transition-transform duration-700">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-amber-500/20 to-transparent border border-amber-500/25 animate-[logo-spin_12s_linear_infinite] group-hover:border-amber-400/50 transition-colors duration-500" />
            <div className="absolute inset-1 rounded-md bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-400/15 animate-[logo-spin_8s_linear_infinite_reverse] transition-colors duration-500" />
            <span className="relative text-lg font-serif font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-300 to-amber-500 animate-pulse">✦</span>
          </div>
          <div>
            <h1 className="text-sm md:text-base font-serif font-black tracking-[0.12em] text-slate-100 group-hover:text-amber-200 transition-colors duration-500">五月天 · 九张自传</h1>
            <p className="text-[9px] text-slate-500 font-serif tracking-[0.2em] leading-none mt-0.5 group-hover:text-amber-400/50 transition-colors duration-500">MAYDAY · INTERACTIVE TAROT</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPlaying && (
            <button
              onClick={() => { if (screen !== 'CARD_DETAIL') { setScreen('CARD_DETAIL'); setShowLyrics(false); } }}
              className="hidden sm:flex items-center gap-2 bg-pink-500/10 hover:bg-pink-500/20 px-2.5 py-1 rounded-full border border-pink-500/20 hover:border-pink-500/40 text-[10px] text-pink-300 transition cursor-pointer"
              title="返回播放器">
              <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
              <Music className="w-3 h-3" />
              <span className="truncate max-w-[100px]">《{activeSong.title}》</span>
            </button>
          )}
          <button onClick={() => setShowCollection(true)}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:text-amber-400 transition"
            aria-label="卡牌集">
            <LayoutGrid className="w-4 h-4 text-amber-400" />
          </button>
          <button onClick={() => setCameraActive(!cameraActive)}
            className={`p-2 rounded-xl border transition ${cameraActive ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-slate-900/80 border-slate-800 hover:text-cyan-400 text-slate-400'}`}
            aria-label="切换摄像头手势">
            {cameraActive ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
          </button>
          <button onClick={toggleMute} className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:text-cyan-400 transition">
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
          <div className="relative flex items-center gap-1.5">
            {!neteaseLoggedIn && isPlaying && (
              <span className="hidden sm:inline text-[10px] text-red-400/80 animate-pulse whitespace-nowrap">登录网易云听完整版 →</span>
            )}
            <button onClick={() => setShowLogin(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition text-xs ${
                neteaseLoggedIn ? 'bg-red-500/15 border-red-500/30 text-red-300' : 'bg-red-500/15 border-red-500/30 text-red-300 animate-pulse'
              }`}
              title={neteaseLoggedIn ? `已登录: ${neteaseNickname}` : '登录网易云音乐'}>
              <LogIn className="w-3.5 h-3.5" />
              {neteaseLoggedIn && <span className="hidden sm:inline truncate max-w-[60px]">{neteaseNickname}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="relative flex-1 w-full max-w-7xl mx-auto flex flex-col items-center justify-center z-20 px-2 overflow-hidden">

        {/* === INTRO === */}
        {screen === 'INTRO' && (
          <div className="max-w-sm w-full text-center bg-slate-950/60 backdrop-blur-lg border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl animate-fade-in">
            <div className="absolute top-0 left-1/4 w-32 h-32 rounded-full bg-amber-500/10 blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-32 h-32 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="relative w-20 h-20 mx-auto rounded-full bg-slate-900/90 border border-amber-400/30 flex items-center justify-center shadow-lg mb-4">
              <div className="absolute inset-1 rounded-full border border-dashed border-cyan-400/20 animate-spin-slow" />
              <Disc className="w-8 h-8 text-amber-400 animate-spin-very-slow" />
            </div>
            <h1 className="text-2xl font-serif font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-slate-100 to-cyan-300">五月天 · 命运自传</h1>
            <p className="text-xs uppercase font-mono tracking-widest text-amber-400 font-bold mt-2">INTERACTIVE TAROT PLAYER</p>
            <p className="text-[11px] text-slate-300 leading-relaxed mt-3">
              如果五月天的九张专辑是一段段璀璨的人生乐章<br />
              <span className="text-cyan-400">开启摄像头，手掌扒动专辑阵列、食指指向选中命运！</span>
            </p>
            <button onClick={() => { playTransitionSound(523, 'triangle', 0.4); setScreen('CARD_SCROLL'); }}
              className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-cyan-500 hover:from-amber-400 hover:via-rose-400 hover:to-cyan-400 text-slate-950 font-black tracking-widest text-xs transition duration-300 active:scale-95 shadow-[0_4px_20px_rgba(236,72,153,0.3)] uppercase cursor-pointer relative z-10">
              开启命运音乐星环
            </button>
          </div>
        )}

        {/* === CARD SCROLL === */}
        {screen === 'CARD_SCROLL' && (
          <div className="w-full h-full relative">
            <TarotScrollBoard
              ref={scrollBoardRef}
              onSelectAlbum={handleSelectAlbumFromBoard}
              onSelectionStart={() => { maydaySynth.stop(); setIsPlaying(false); }}
            />
            {/* Floating camera PIP + gesture processor */}
            {cameraActive && (
              <div className="absolute bottom-3 right-3 z-40">
                <GestureController
                  onGestureDetected={handleGestureDetected}
                  onHandMove={handleHandMove}
                  enabled={screen === 'CARD_SCROLL'}
                  compact
                />
                {/* Speed settings */}
                <button
                  onClick={() => setShowSpeedSettings(!showSpeedSettings)}
                  className="mt-1 flex items-center gap-1 text-[9px] text-slate-500 hover:text-amber-400 transition mx-auto"
                >
                  <Settings className="w-2.5 h-2.5" />
                  {showSpeedSettings ? '收起' : '灵敏度'}
                </button>
                {showSpeedSettings && (
                  <div className="mt-1 bg-slate-900/90 rounded-lg p-1.5 border border-slate-800 w-28">
                    <div className="flex gap-0.5">
                      {[{ label: '慢', val: 0.5 }, { label: '中', val: 1.0 }, { label: '快', val: 1.8 }].map(({ label, val }) => (
                        <button key={label} onClick={() => setGestureSpeed(val)}
                          className={`flex-1 py-1 rounded text-[9px] font-semibold transition ${gestureSpeed === val ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>{label}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* === SELECTING TRANSITION === */}
        {screen === 'SELECTING' && (
          <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center h-full">
            {/* Fly phase: tarot back with pulse */}
            {selectingPhase === 'fly' && (
              <>
                <img
                  src="/images/tarot_back.png"
                  alt=""
                  className="w-[200px] sm:w-[260px] rounded-xl shadow-2xl animate-pulse"
                />
                <p className="mt-8 text-2xl font-serif text-amber-300/80 tracking-[0.2em] animate-pulse">
                  命运之轮正在停驻...
                </p>
              </>
            )}

            {/* Reveal + Hold: 3D flip from tarot back to album cover */}
            {selectingPhase !== 'fly' && (
              <div className={`flex flex-col items-center transition-all duration-700 ease-in-out ${
                selectingPhase === 'morph' ? 'scale-75 opacity-40 translate-y-4' : ''
              }`}>
                <div className="relative w-[200px] sm:w-[260px]">
                  <div style={{
                    transformStyle: 'preserve-3d',
                    animation: selectingPhase === 'reveal' ? 'card-flip-in 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'none',
                    transform: selectingPhase === 'hold' || selectingPhase === 'morph' ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}>
                    <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
                      <img src="/images/tarot_back.png" alt="" className="w-full object-contain rounded-xl shadow-2xl" />
                    </div>
                    <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }} className="relative">
                      <img src={`/images/${selectedAlbum.id}.png`} alt={selectedAlbum.title} className="w-[200px] sm:w-[260px] max-h-[55vh] object-contain rounded-lg relative z-10" />
                      <span className="absolute inset-0 rounded-lg bg-amber-400/5 blur-xl scale-110 animate-pulse z-0" />
                    </div>
                  </div>
                </div>
                <div className="mt-6 text-center">
                  <p className="text-2xl font-serif tracking-[0.15em] animate-fade-in-up">
                    <span className="text-amber-200/60">你抽中了</span>
                    <span className="text-amber-100 font-black mx-2 relative">
                      · {selectedAlbum.tarotCardName} ·
                      <span className="absolute -inset-2 bg-amber-400/10 blur-md rounded-full animate-pulse" />
                    </span>
                  </p>
                  <p className="text-lg font-serif tracking-wider mt-1 animate-fade-in-up relative inline-block"
                    style={{ animationDelay: '0.2s' }}>
                    <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300">
                      《{selectedAlbum.title}》
                    </span>
                    <span className="absolute -inset-1 bg-amber-400/8 blur-md rounded-full animate-pulse z-0" />
                  </p>
                  <p className="text-sm font-serif text-amber-400/50 tracking-wider mt-1.5 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                    {selectedAlbum.tarotCardEnglish}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === CARD DETAIL / PLAYER === */}
        {screen === 'CARD_DETAIL' && (
          <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center h-full py-4" style={{ animation: 'player-enter 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards' }}>
            {/* LEFT: Card */}
            <div className="flex flex-col items-center shrink-0">
              <button onClick={returnToScrollBoard}
                className="self-start px-5 py-2.5 group rounded-full text-xs font-medium tracking-[0.12em] transition-all duration-500 flex items-center gap-2 mb-3"
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.45)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-200/80">返回重新抽牌</span>
              </button>
              <TarotCard
                album={selectedAlbum}
                isFlipped={isCardFlipped}
                onFlipToggle={() => { setIsCardFlipped(!isCardFlipped); playTransitionSound(440, 'sine', 0.2); }}
                onPlaySong={playSong}
                activeSongId={activeSong.id}
                isPlaying={isPlaying}
                large
              />
              <p className="text-[11px] text-slate-500 mt-4 tracking-wide text-center max-w-[320px]">
                {isCardFlipped ? '点击歌名切歌。再次点击翻回封面。' : '点击卡片翻面，查阅创作背景与曲目。'}
              </p>
            </div>

            {/* RIGHT: Player */}
            <div className="flex-1 min-w-0 flex flex-col justify-between bg-slate-950/40 border border-slate-900 rounded-3xl p-6 relative overflow-hidden mt-12 ml-10" style={{ height: '680px', maxWidth: '520px' }}>
              <div className="absolute top-0 right-0 w-36 h-36 rounded-full bg-cyan-400/5 blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full bg-pink-400/5 blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between border-b border-slate-900 pb-4 z-10">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full bg-pink-500 ${isPlaying ? 'animate-ping' : ''}`} />
                  <h3 className="text-xs text-cyan-400 tracking-widest font-mono uppercase font-bold">MAYDAY TAROT VISUALIZER</h3>
                </div>
                <div id="playing_note_badge" className="px-2.5 py-1 rounded bg-slate-900 text-[10px] text-pink-300 font-mono tracking-wide border border-pink-500/20">
                  MUSIC STANDBY
                </div>
              </div>

              <div className="relative flex-1 w-full flex items-center justify-center my-2 z-10 min-h-0">
                {showLyrics && (activeSong.lyrics || apiLyrics) ? (
                  <div className="absolute inset-0 cursor-pointer" onClick={() => setShowLyrics(false)}>
                    <LyricsViewer lyrics={(activeSong.lyrics || apiLyrics)!} songTitle={activeSong.title} isPlaying={isPlaying} currentTime={currentTime} durationSeconds={parseDuration(activeSong.duration)} onSeek={(t) => { setCurrentTime(t); maydaySynth.seekTo(t); }} />
                  </div>
                ) : (
                  <>
                    <AudioVisualizer isPlaying={isPlaying} colorPreset={selectedAlbum.primaryColor} />
                    <div onClick={async () => {
                      if (!activeSong.lyrics && !apiLyrics) {
                        try {
                          const params = new URLSearchParams();
                          params.set('title', activeSong.title);
                          params.set('album', selectedAlbum.title);
                          const res = await fetch(`/api/music/lyric?${params}`);
                          const data = await res.json();
                          if (data.lyric) setApiLyrics(data.lyric);
                        } catch {}
                      }
                      setShowLyrics(true);
                    }}
                      style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                      className="absolute w-44 h-44 rounded-full bg-slate-950 border-[6px] border-slate-900 shadow-xl overflow-hidden flex items-center justify-center cursor-pointer select-none z-20 animate-spin-slow hover:scale-105 transition duration-300"
                      title={activeSong.lyrics ? '点击查看歌词' : ''}>
                      <div className={`w-16 h-16 rounded-full bg-gradient-to-tr ${selectedAlbum.primaryColor} p-1 flex flex-col items-center justify-center`}>
                        <Disc className="w-5 h-5 text-white animate-spin-very-slow mb-0.5" />
                        <span className="text-[7px] text-white/95 truncate w-12 font-serif font-black">{selectedAlbum.tarotCardName}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-900 mb-3 z-10">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 font-serif font-bold mr-1.5">{selectedAlbum.tarotCardName}</span>
                    <span className="text-xs text-slate-400 font-semibold uppercase font-mono tracking-widest">TRACK {playlistIndex + 1} OF {playlist.length}</span>
                    <h4 className="text-lg font-bold text-slate-100 mt-1 flex items-center gap-2"><Music className="w-4 h-4 text-cyan-400" />{activeSong.title}</h4>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono w-10 text-right">{formatTime(currentTime)}</span>
                  <input type="range" min="0" max={duration || 100} value={currentTime} onChange={handleSeek}
                    className="flex-1 cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #06b6d4 0%, #22d3ee ${progressPct}%, rgba(51, 65, 85, 0.5) ${progressPct}%)`,
                    } as React.CSSProperties}
                  />
                  <span className="text-[10px] text-slate-500 font-mono w-10">{formatTime(duration)}</span>
                </div>
                <div className="mt-3 bg-slate-900/40 rounded-xl p-3 border border-slate-800/80 text-center min-h-[44px] flex items-center justify-center">
                  <p className="text-xs italic text-amber-200/90 leading-relaxed font-serif">{activeSong.lyricSnippet || '纯音乐，无歌词'}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 z-10">
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-center">
                  <button onClick={togglePlayback} className="p-3.5 rounded-full bg-pink-500 hover:bg-pink-400 text-slate-950 shadow-md transform active:scale-95 transition-all">
                    {isPlaying ? <Pause className="w-5 h-5 fill-slate-950" /> : <Play className="w-5 h-5 fill-slate-950" />}
                  </button>
                  <button onClick={skipToNext} className="p-3.5 rounded-full bg-slate-900 border border-slate-800 hover:text-cyan-400 transition">
                    <SkipForward className="w-4 h-4" />
                  </button>
                  <button onClick={() => {
                    const modes: Array<'shuffle' | 'sequential' | 'single'> = ['sequential', 'shuffle', 'single'];
                    const idx = modes.indexOf(playMode);
                    setPlayMode(modes[(idx + 1) % 3]);
                  }}
                    className={`p-3.5 rounded-full border transition ${playMode !== 'sequential' ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-cyan-400'}`}
                    title={playMode === 'shuffle' ? '随机播放' : playMode === 'single' ? '单曲循环' : '顺序播放'}>
                    {playMode === 'shuffle' ? <Shuffle className="w-4 h-4" />
                      : playMode === 'single' ? <Repeat1 className="w-4 h-4" />
                      : <List className="w-4 h-4" />}
                  </button>
                </div>
                <button onClick={() => { setShowOracleModal(true); setFortuneQuestion((ALBUM_QUESTIONS[selectedAlbum.id] || ALBUM_QUESTIONS['album_1'])[0]); playTransitionSound(880, 'triangle', 0.5); }}
                  className="w-full flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs tracking-wider shadow-lg flex items-center justify-center gap-2 group">
                  <Wand2 className="w-4 h-4 animate-pulse group-hover:rotate-12 transition-transform" />
                  <span>阿信的回复</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* COLLECTION MODAL — 9 cards gallery */}
      {showCollection && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-start z-50 p-2 animate-fade-in overflow-y-auto scrollbar-cosmic">
          {/* Header */}
          <div className="w-full max-w-6xl flex items-center justify-between py-3 px-4 shrink-0">
            <div className="flex items-center gap-3">
              <LayoutGrid className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-serif text-amber-200 font-black tracking-wider">卡牌集 · 五月天九张专辑</h2>
            </div>
            <button onClick={() => { setShowCollection(false); setCollectionFlipped({}); }}
              className="p-2 rounded-xl bg-slate-900/80 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* 3x3 Grid */}
          <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {MAYDAY_ALBUMS.map((album) => {
              const isFlipped = collectionFlipped[album.id] || false;
              return (
                <div key={album.id} className="flex justify-center">
                  <TarotCard
                    album={album}
                    isFlipped={isFlipped}
                    onFlipToggle={() => setCollectionFlipped(prev => ({ ...prev, [album.id]: !prev[album.id] }))}
                    onPlaySong={(song) => {
                      setSelectedAlbum(album);
                      setShowCollection(false);
                      setCollectionFlipped({});
                      buildPlaylist(album, album.songs.findIndex(s => s.id === song.id));
                      playSong(song);
                      setScreen('CARD_DETAIL');
                    }}
                    activeSongId={activeSong.id}
                    isPlaying={isPlaying}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ORACLE MODAL */}
      {showOracleModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => { setShowOracleModal(false); setIsQueryingOracle(false); }}>
          <div className="relative max-w-lg w-full bg-slate-950 border border-amber-400/40 rounded-3xl p-6 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between border-b border-amber-400/20 pb-3 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400 animate-pulse" />
                <h4 className="text-sm font-serif font-black tracking-widest text-[#fef08a]">阿信 · 旋律回复</h4>
              </div>
              <button onClick={() => { setShowOracleModal(false); setIsQueryingOracle(false); }}
                className="p-1 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-left">
              <p className="text-[11px] text-slate-400 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800">
                针对第{selectedAlbum.romanNumeral}张专辑【{selectedAlbum.title}】，写下心中的迷茫与愿景。
              </p>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-amber-500 block">输入问题：</label>
                <input type="text" maxLength={120} value={fortuneQuestion} onChange={(e) => setFortuneQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !isQueryingOracle && fortuneQuestion.trim()) { e.preventDefault(); e.stopPropagation(); handleQueryOracleAnswer(); } }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400 transition"
                  readOnly={isQueryingOracle} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(ALBUM_QUESTIONS[selectedAlbum.id] || ALBUM_QUESTIONS['album_1']).map((pq, i) => (
                  <button key={i} onClick={() => setFortuneQuestion(pq)} disabled={isQueryingOracle}
                    className={`px-2 py-1 rounded text-[9.5px] border transition truncate ${fortuneQuestion === pq ? 'bg-amber-400/10 text-amber-300 border-amber-400/40 font-bold' : 'bg-slate-900/60 text-slate-400 border-slate-800/80'}`}>{pq}</button>
                ))}
              </div>
              <button onClick={handleQueryOracleAnswer} disabled={isQueryingOracle || !fortuneQuestion.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs tracking-wider disabled:opacity-40 flex items-center justify-center gap-1.5">
                {isQueryingOracle ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> 等待阿信回复...</> : <><Wand2 className="w-3.5 h-3.5" /> 询问阿信</>}
              </button>
              {typedAnswer && (
                <div className="bg-gradient-to-b from-slate-950 to-slate-900 p-4 rounded-xl border border-amber-500/30 text-amber-100 font-serif shadow-inner">
                  <div className="flex items-center gap-1.5 border-b border-amber-500/20 pb-1.5 mb-2 text-amber-400">
                    <Sparkles className="w-4 h-4 animate-pulse" /><span className="text-[11px] tracking-widest uppercase font-extrabold">阿信的旋律回复</span>
                  </div>
                  <p className="text-xs leading-relaxed whitespace-pre-line text-amber-100/90">{typedAnswer}</p>
                  {fortuneResponse && !isQueryingOracle && (
                    <div className="mt-4 pt-3 border-t border-amber-500/20 space-y-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-amber-400 font-bold shrink-0">推荐聆听:</span>
                        {fortuneResponse.recommendedSongs.map((sn, i) => {
                          const match = selectedAlbum.songs.find(s => s.title.includes(sn) || sn.includes(s.title));
                          return <button key={i} onClick={() => { if (match) { playSong(match); setShowOracleModal(false); } }}
                            className="px-2 py-0.5 rounded bg-pink-500/10 hover:bg-pink-500/25 text-pink-300 border border-pink-500/30 text-[9.5px] transition">《{sn}》</button>;
                        })}
                      </div>
                      <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-center">
                        <span className="text-[8px] uppercase text-slate-500 font-bold block mb-0.5">歌词箴言</span>
                        <p className="text-[11px] italic font-serif text-amber-300">" {fortuneResponse.divineInsight} "</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLogin && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => { setShowLogin(false); setLoginMsg(''); setQrPolling(false); }}>
          <div className="relative max-w-sm w-full bg-slate-950 border border-red-500/30 rounded-3xl p-6 overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <LogIn className="w-4 h-4 text-red-400" />
                <h4 className="text-sm font-serif font-black tracking-widest text-red-300">登录网易云音乐</h4>
              </div>
              <button onClick={() => { setShowLogin(false); setLoginMsg(''); setQrPolling(false); }} className="p-1 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition"><X className="w-4 h-4" /></button>
            </div>
            {/* QR Code */}
            <div className="text-center mb-4">
              {qrUrl ? (
                <img src={qrUrl} alt="QR Code" className="w-48 h-48 mx-auto rounded-xl border border-slate-800" />
              ) : (
                <button onClick={generateQR} className="px-6 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition text-sm">
                  扫码登录
                </button>
              )}
              {loginMsg && <p className={`text-xs text-center mt-2 ${loginMsg.includes('成功') ? 'text-green-400' : loginMsg.includes('过期') || loginMsg.includes('失败') ? 'text-red-400' : 'text-amber-400'}`}>{loginMsg}</p>}
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-[10px] text-slate-600">或</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>
            <input type="text" placeholder="手机号" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-red-400 transition mb-3" />
            <input type="password" placeholder="密码" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleNeteaseLogin(); } }}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-red-400 transition mb-3" />
            <div className="flex gap-2">
              <button onClick={handleNeteaseLogin}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white font-bold text-sm tracking-wider transition">
                密码登录
              </button>
              {neteaseLoggedIn && (
                <button onClick={async () => {
                  await fetch('/api/music/logout', { method: 'POST' });
                  setNeteaseLoggedIn(false); setNeteaseNickname(''); setShowLogin(false);
                  setScreen('INTRO'); setIsPlaying(false); maydaySynth.stop();
                }}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 text-sm transition">
                  退出
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="relative w-full max-w-7xl mx-auto py-1.5 border-t border-slate-900 text-center z-30 shrink-0 px-2">
        <p className="text-[10px] text-slate-600 font-mono tracking-widest">
          五月天 · 命运唱片行 · 9 ALBUMS · {MAYDAY_ALBUMS.reduce((s, a) => s + a.songs.length, 0)} SONGS
        </p>
      </footer>
    </div>
  );
}
