import { useEffect, useRef, useState, useMemo } from 'react';
import { parseLRC, currentLyricIndex } from '../utils/lrcParser';
import { LyricLine } from '../types';

interface LyricsViewerProps {
  lyrics: string;
  songTitle: string;
  isPlaying: boolean;
  currentTime: number;
  durationSeconds?: number;
  onSeek?: (time: number) => void;
}

export default function LyricsViewer({ lyrics, songTitle, isPlaying, currentTime, durationSeconds, onSeek }: LyricsViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [manualOverride, setManualOverride] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const manualTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lines: LyricLine[] = useMemo(() => parseLRC(lyrics, durationSeconds), [lyrics, durationSeconds]);
  const activeIndex = useMemo(() => currentLyricIndex(lines, currentTime), [lines, currentTime]);

  // Scroll to active line
  useEffect(() => {
    if (manualOverride || !scrollRef.current || activeIndex < 0) return;
    const el = scrollRef.current.querySelector(`[data-line-index="${activeIndex}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex, manualOverride]);

  const handleUserScroll = () => {
    if (manualTimeoutRef.current) clearTimeout(manualTimeoutRef.current);
    setManualOverride(true);
    manualTimeoutRef.current = setTimeout(() => setManualOverride(false), 4000);
  };

  const handleLineClick = (e: { stopPropagation: () => void }, line: LyricLine) => {
    e.stopPropagation();
    if (onSeek) onSeek(line.time);
    setManualOverride(true);
    if (manualTimeoutRef.current) clearTimeout(manualTimeoutRef.current);
    manualTimeoutRef.current = setTimeout(() => setManualOverride(false), 5000);
  };

  return (
    <div className="relative w-full h-full flex flex-col rounded-2xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-950" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-amber-500/5 blur-3xl" />
      <div className="absolute top-0 left-1/4 w-32 h-32 rounded-full bg-cyan-400/3 blur-2xl" />

      <div className="absolute top-2 left-3 text-amber-500/40 text-xs select-none z-10">◆</div>
      <div className="absolute top-2 right-3 text-amber-500/40 text-xs select-none z-10">◆</div>
      <div className="absolute bottom-2 left-3 text-amber-500/40 text-xs select-none z-10">◆</div>
      <div className="absolute bottom-2 right-3 text-amber-500/40 text-xs select-none z-10">◆</div>

      <div className="absolute inset-1 border border-amber-500/10 rounded-2xl pointer-events-none z-10" />
      <div className="absolute inset-2 border border-dashed border-amber-500/5 rounded-xl pointer-events-none z-10" />

      <div className="relative z-20 shrink-0 px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-amber-500/60 font-mono tracking-[0.3em] uppercase">Lyrics</span>
            <span className="w-1 h-1 rounded-full bg-amber-500/60" />
            <span className="text-xs text-slate-400 font-serif italic truncate max-w-[160px]">{songTitle}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isPlaying && (
              <span className="flex gap-0.5 items-end h-3">
                <span className="w-0.5 bg-amber-400 h-2 animate-bounce" />
                <span className="w-0.5 bg-amber-400 h-3 animate-bounce [animation-delay:0.15s]" />
                <span className="w-0.5 bg-amber-400 h-1.5 animate-bounce [animation-delay:0.3s]" />
              </span>
            )}
            <span className="text-[9px] text-amber-500/40 font-mono uppercase">{isPlaying ? 'LIVE' : 'PAUSED'}</span>
          </div>
        </div>
        <div className="mt-2 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>

      <div
        ref={scrollRef}
        onScroll={handleUserScroll}
        className="relative z-20 flex-1 overflow-y-auto px-3 sm:px-6 py-2 sm:py-4 space-y-1.5 sm:space-y-3 scrollbar-thin"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(245, 158, 11, 0.15) transparent',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)'
        }}
      >
        {lines.map((line, index) => {
          const isHighlighted = index === activeIndex;
          const isHovered = index === hoveredIndex && !isHighlighted;
          const distance = Math.abs(index - activeIndex);
          const baseOpacity = distance === 0 ? 1 : distance === 1 ? 0.7 : distance === 2 ? 0.45 : 0.25;
          const opacity = isHovered ? Math.min(1, baseOpacity + 0.25) : baseOpacity;

          return (
            <div
              key={index}
              data-line-index={index}
              data-time={line.time}
              className={`relative transition-all duration-300 ease-out px-2 sm:px-3 py-1.5 sm:py-2.5 rounded-xl cursor-pointer ${
                isHighlighted
                  ? 'bg-amber-500/8 border border-amber-500/20 scale-[1.02]'
                  : 'border border-transparent'
              }`}
              style={{ opacity }}
              onClick={(e) => handleLineClick(e, line)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {isHighlighted && (
                <>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/0 via-amber-400/5 to-amber-500/0" />
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                  <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                </>
              )}

              <p
                className={`text-center leading-relaxed font-serif tracking-wide transition-all duration-300 ${
                  isHighlighted || isHovered
                    ? 'text-amber-100 text-sm sm:text-base font-bold drop-shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                    : 'text-slate-400 text-xs sm:text-sm'
                }`}
              >
                {line.text}
              </p>
            </div>
          );
        })}
        <div className="h-6" />
      </div>

      <div className="relative z-20 shrink-0 px-5 pb-4 pt-1 text-center">
        <div className={`flex items-center justify-center gap-1.5 transition-opacity duration-500 ${!manualOverride ? 'opacity-60' : 'opacity-20'}`}>
          <span className="text-[9px] text-amber-500/50 font-mono tracking-wider">
            {!manualOverride ? 'AUTO-SCROLL' : 'MANUAL'}
          </span>
        </div>
      </div>
    </div>
  );
}
