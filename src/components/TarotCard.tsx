/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Album, Song } from '../types';
import { Disc, Play, Star, BookOpen, Layers, Flame, ArrowRightLeft, Sparkles } from 'lucide-react';

interface TarotCardProps {
  album: Album;
  isFlipped: boolean;
  onFlipToggle?: () => void;
  onPlaySong?: (song: Song) => void;
  activeSongId?: string;
  isPlaying?: boolean;
  faceDown?: boolean;
  large?: boolean;
}

export default function TarotCard({
  album,
  isFlipped,
  onFlipToggle,
  onPlaySong,
  activeSongId,
  isPlaying,
  faceDown = false,
  large = false
}: TarotCardProps) {
  // Graceful visual fallbacks in case asset files aren't created yet in local folders
  const [frontImageErr, setFrontImageErr] = useState(false);
  const [backImageErr, setBackImageErr] = useState(false);

  useEffect(() => {
    setFrontImageErr(false);
  }, [album.id]);

  const frontImgUrl = `/images/${album.id}.png`;
  const backImgUrl = `/images/tarot_back.png`;

  // --- 1. CAROUSEL STATE: FACE-DOWN CARD (ALL CARDS LOOK THE SAME) ---
  if (faceDown) {
    return (
      <div className="relative w-[340px] h-[520px] rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6 flex flex-col justify-between overflow-hidden shadow-2xl shadow-slate-950/80 select-none">
        {/* If the user has uploaded tarot_back.png, render it full size */}
        {!backImageErr ? (
          <img
            src={backImgUrl}
            onError={() => {
              console.warn('tarot_back.png missing, launching custom astrological procedural canvas fallback.');
              setBackImageErr(true);
            }}
            alt="Tarot Back"
            className="absolute inset-0 w-full h-full object-cover rounded-xl pointer-events-none z-0 hover:scale-105 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
        ) : null}

        {/* Subtle filigree border frame */}
        <div className="absolute inset-2 border border-amber-500/15 rounded-xl pointer-events-none z-10" />

        {/* Corner star ornaments — minimal, elegant */}
        <div className="absolute top-3 left-3 text-[10px] text-amber-500/40 z-10">✦</div>
        <div className="absolute top-3 right-3 text-[10px] text-amber-500/40 z-10">✦</div>
        <div className="absolute bottom-3 left-3 text-[10px] text-amber-500/40 z-10">✦</div>
        <div className="absolute bottom-3 right-3 text-[10px] text-amber-500/40 z-10">✦</div>

        {/* Bottom brand line */}
        <div className="absolute bottom-4 left-0 right-0 text-center text-[8px] font-mono tracking-[0.4em] text-amber-500/30 uppercase z-20">
          MAYDAY TAROT
        </div>
      </div>
    );
  }

  // --- 2. ACTIVE REVEALED TAROT STATE (Flippable Front/Back revelation cards) ---
  return (
    <div
      className={`relative cursor-pointer perspective-1000 group mx-auto select-none ${
        large ? 'w-[220px] h-[360px] sm:w-[300px] sm:h-[500px] lg:w-[380px] lg:h-[640px]' : 'w-[220px] h-[340px] sm:w-[300px] sm:h-[460px] lg:w-[340px] lg:h-[520px]'
      }`}
      onClick={onFlipToggle}
    >
      {/* 3D Rotator Inner */}
      <div 
        className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        
        {/* --- FRONT OF THE TAROT CARD (ALBUM THEME & DISCOVER CARD) --- */}
        <div className={`absolute inset-0 backface-hidden rounded-2xl border-2 border-amber-400/50 bg-gradient-to-b from-slate-900 to-slate-950 p-5 ${
          isFlipped ? 'pointer-events-none' : ''
        } flex flex-col justify-between overflow-hidden shadow-2xl shadow-cyan-950/40 select-none`}>
          
          {/* Fill the card background completely with the high quality album cover if loaded */}
          {!frontImageErr ? (
            <div className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden rounded-xl">
              <img
                src={frontImgUrl}
                onError={() => {
                  console.warn(`Album art for ${album.id} missing in /images/ folder, using procedurals fallback.`);
                  setFrontImageErr(true);
                }}
                alt={album.title}
                className="w-full h-full object-cover opacity-35 filter blur-[2px] scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-900/40 to-slate-950/60" />
            </div>
          ) : null}

          {/* Aesthetic mysticism corner brackets */}
          <div className="absolute top-2 left-2 text-[10px] text-amber-500/60 z-10">★</div>
          <div className="absolute top-2 right-2 text-[10px] text-amber-500/60 z-10">★</div>
          <div className="absolute bottom-2 left-2 text-[10px] text-amber-500/60 z-10">★</div>
          <div className="absolute bottom-2 right-2 text-[10px] text-amber-500/60 z-10">★</div>

          {/* Border Filigree Overlay */}
          <div className="absolute inset-2 border border-amber-500/30 rounded-xl pointer-events-none z-10" />
          <div className="absolute inset-3 border border-amber-500/10 rounded-lg pointer-events-none z-10" />

          {/* Roman Numeral Indicator */}
          <div className="text-center font-serif text-amber-400 tracking-widest text-xl font-bold mt-2 z-10">
            {album.romanNumeral}
          </div>

          {/* Tarot Styled Artwork Illustration Box */}
          <div className="relative flex-1 my-4 flex flex-col items-center justify-center z-10">
            {/* Custom abstract gradient matching the album's mood */}
            <div className={`absolute inset-0 rounded-xl bg-gradient-to-tr ${album.primaryColor} opacity-20 blur-xl scale-75 animate-pulse`} />
            
            {/* Album cover — full proportion, no square crop */}
            <div className={`relative mx-auto flex-shrink-0 w-full ${large ? 'max-w-[180px] sm:max-w-[260px] lg:max-w-[340px]' : 'max-w-[180px] sm:max-w-[220px] lg:max-w-[240px]'}`}>
              {!frontImageErr ? (
                <div className="relative rounded-lg overflow-hidden shadow-lg">
                  <img
                    src={frontImgUrl}
                    alt={album.title}
                    className="w-full h-auto object-contain block"
                    referrerPolicy="no-referrer"
                    style={{ maxHeight: 'min(220px, 40vh)' }}
                  />
                  </div>
                ) : (
                  <div className="w-full h-40 rounded-xl bg-slate-950 border-2 border-amber-400/40 shadow-lg flex items-center justify-center">
                    <div className="absolute inset-2 rounded-full border border-dashed border-amber-200/30 animate-spin-slow" />
                    <Disc className="w-16 h-16 text-white/95 animate-spin-very-slow z-10" />
                  </div>
                )}
            </div>

            {/* Title display */}
            <div className="mt-4 text-center px-4">
              <h3 className={`text-base sm:text-lg lg:text-xl font-serif text-amber-100 tracking-wide font-black truncate ${large ? 'max-w-[200px] sm:max-w-[280px] lg:max-w-[360px]' : 'max-w-[180px] sm:max-w-[240px] lg:max-w-[260px]'}`}>
                {album.title}
              </h3>
              <p className="text-xs font-serif text-amber-400 font-semibold tracking-widest uppercase mt-1">
                {album.tarotCardEnglish}
              </p>
            </div>
          </div>

          {/* Bottom Card Labels */}
          <div className="text-center z-10 pb-2">
            <div className="flex flex-wrap justify-center gap-1.5 px-2 mb-2">
              {album.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 bg-amber-400/10 border border-amber-400/30 rounded text-[9px] text-amber-200/90 font-serif"
                >
                  {kw}
                </span>
              ))}
            </div>

            <div className="text-[10px] text-slate-400 border-t border-slate-800/60 pt-2 font-mono flex items-center justify-between px-3">
              <span>RELEASE · {album.year}</span>
              <span className="text-amber-400">MAYDAY TAROT</span>
            </div>
          </div>
        </div>


        {/* --- BACK OF THE TAROT CARD (SONG LISTS & STORIES) --- */}
        <div className={`absolute inset-0 backface-hidden rotate-y-180 rounded-2xl border-2 border-cyan-400/50 bg-gradient-to-b from-slate-950 to-slate-900 p-5 ${
          !isFlipped ? 'pointer-events-none' : ''
        } flex flex-col overflow-hidden shadow-2xl shadow-cyan-950/60 select-none`}>
          
          {/* Border filigree and overlays for mystic dark themed back */}
          <div className="absolute inset-2 border border-cyan-400/20 rounded-xl pointer-events-none" />
          <div className="absolute inset-3 border border-cyan-400/5 rounded-lg pointer-events-none" />

          {/* Heading with Card Meta */}
          <div className="text-center z-10 mt-1 border-b border-cyan-500/20 pb-2">
            <span className="text-[10px] text-cyan-400 tracking-widest font-bold block mb-0.5">
              THE REVELATION
            </span>
            <h4 className="text-base font-serif text-slate-100 font-extrabold tracking-wide">
              {album.tarotCardName} · 《{album.title}》
            </h4>
          </div>

          {/* Story — fixed */}
          <div className="shrink-0 my-1 px-1 z-10 text-left">
            <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-bold mb-1 border-b border-slate-800 pb-1">
                <BookOpen className="w-3.5 h-3.5" />
                <span>命运释义 · 专辑前言</span>
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed text-justify">
                {album.backgroundStory}
              </p>
            </div>
          </div>

          {/* Track list — header fixed, songs scroll */}
          <div className="flex-1 min-h-0 my-1 px-1 z-10 text-left">
            <div className="flex flex-col h-full bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden">
              <div className="shrink-0 flex items-center gap-1.5 text-[11px] text-pink-400 font-bold px-3 pt-2 pb-1.5 border-b border-slate-800">
                <Layers className="w-3.5 h-3.5" />
                <span>收录曲目 (点击卡片上歌名播放)</span>
              </div>

              <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1 scrollbar-cosmic">
                {album.songs.map((song) => {
                  const isActive = song.id === activeSongId;
                  return (
                    <button
                      key={song.id}
                      id={`song_${song.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onPlaySong) onPlaySong(song);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all text-left ${
                        isActive
                          ? 'bg-pink-500/20 text-pink-200 font-bold border border-pink-500/40 shadow-sm'
                          : 'hover:bg-slate-900 text-slate-300 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {isActive && isPlaying ? (
                          <span className="flex gap-0.5 items-end h-2.5 mb-0.5 shrink-0">
                            <span className="w-0.5 bg-pink-400 h-2 animate-bounce" />
                            <span className="w-0.5 bg-pink-400 h-3 animate-bounce [animation-delay:0.2s]" />
                            <span className="w-0.5 bg-pink-400 h-1 animate-bounce [animation-delay:0.4s]" />
                          </span>
                        ) : (
                          <Play className={`w-3 h-3 shrink-0 ${isActive ? 'text-pink-400' : 'text-slate-500 grayscale'}`} />
                        )}
                        <span className="truncate">{song.title}</span>
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono shrink-0">
                        {song.duration}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Card flip indicator */}
          <div className="text-center pb-3 pt-1.5 border-t border-cyan-500/10 flex items-center justify-center gap-1 text-[10px] text-cyan-400/80 z-10">
            <ArrowRightLeft className="w-3 h-3 animate-pulse" />
            <span>点击可再次翻面</span>
          </div>
        </div>

      </div>
    </div>
  );
}
