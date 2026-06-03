import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { MAYDAY_ALBUMS } from '../data';
import { Album } from '../types';
import { Wand2, RefreshCw, Sparkles } from 'lucide-react';

interface TarotScrollBoardProps {
  onSelectAlbum: (album: Album) => void;
  onCardCenterChange?: (album: Album | null) => void;
  onSelectionStart?: () => void;
}

export interface TarotScrollBoardHandle {
  setVelocity: (v: number) => void;
  addVelocity: (dv: number) => void;
  beginDecelerate: () => void;
  getCurrentAlbum: () => Album | null;
}

const CARD_WIDTH = 300;
const BASE_SPEED = 0.003;
const FRICTION = 0.92;
const STOP_FRICTION = 0.85;
const MAX_SPEED = 1.0;
const ALBUM_COUNT = MAYDAY_ALBUMS.length;
const STOP_THRESHOLD = 0.008; // below this, consider stopped

function wrapOffset(offset: number): number {
  return ((offset % ALBUM_COUNT) + ALBUM_COUNT) % ALBUM_COUNT;
}

function shortestDist(index: number, offset: number): number {
  let d = index - offset;
  d = ((d % ALBUM_COUNT) + ALBUM_COUNT * 1.5) % ALBUM_COUNT - ALBUM_COUNT / 2;
  return d;
}

const TarotScrollBoard = forwardRef<TarotScrollBoardHandle, TarotScrollBoardProps>(
  function TarotScrollBoard({ onSelectAlbum, onCardCenterChange, onSelectionStart }, ref) {
    const [isDrawing, setIsDrawing] = useState(false);
    const [isPullingToLight, setIsPullingToLight] = useState(false);
    const [showAllFronts, setShowAllFronts] = useState(false);
    const [hoveredCard, setHoveredCard] = useState<string | null>(null);
    const [offsetRender, setOffsetRender] = useState(0);
    const [centerAlbumId, setCenterAlbumId] = useState<string>(MAYDAY_ALBUMS[0].id);

    const offsetRef = useRef(0);
    const velocityRef = useRef(BASE_SPEED);
    const rafRef = useRef<number>(0);
    const lastTimeRef = useRef(0);
    const prevCenterRef = useRef(MAYDAY_ALBUMS[0].id);
    const isUserInteracting = useRef(false);
    const interactionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeRef = useRef(true);
    const isDragging = useRef(false);
    const dragStartX = useRef(0);
    const dragStartOffset = useRef(0);
    const dragLastX = useRef(0);
    const dragLastTime = useRef(0);

    // Anti-duplicate
    const isSelecting = useRef(false);
    const selectingCallback = useRef<((album: Album) => void) | null>(null);
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSelectTime = useRef(0);
    const SELECT_COOLDOWN = 3000; // 3s cooldown between selections

    const getCenterAlbum = useCallback((): Album => {
      const idx = Math.round(offsetRef.current);
      const safe = ((idx % ALBUM_COUNT) + ALBUM_COUNT) % ALBUM_COUNT;
      return MAYDAY_ALBUMS[safe];
    }, []);

    // rAF loop
    useEffect(() => {
      activeRef.current = true;
      lastTimeRef.current = 0;
      velocityRef.current = BASE_SPEED;
      isSelecting.current = false;

      const loop = (timestamp: number) => {
        if (!activeRef.current) return;

        if (lastTimeRef.current === 0) {
          lastTimeRef.current = timestamp;
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        const rawDt = Math.min(timestamp - lastTimeRef.current, 50);
        const dt = rawDt / 16.67;
        lastTimeRef.current = timestamp;

        if (!isDrawing) {
          const v = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, velocityRef.current));
          offsetRef.current += v * dt;
        }

        if (Math.abs(offsetRef.current) > ALBUM_COUNT * 100) {
          offsetRef.current = wrapOffset(offsetRef.current);
        }

        // Gradual stop for selection (skip during drawCard spin)
        if (isSelecting.current && !isDrawing) {
          velocityRef.current *= STOP_FRICTION;
          if (Math.abs(velocityRef.current) < STOP_THRESHOLD) {
            velocityRef.current = 0;
            // Snap to nearest card
            const rounded = Math.round(offsetRef.current);
            offsetRef.current = rounded;
            setOffsetRender(rounded);
            // Show light suction for a moment before firing callback
            if (!holdTimerRef.current) {
              const album = getCenterAlbum();
              prevCenterRef.current = album.id;
              setCenterAlbumId(album.id);
              setIsPullingToLight(true);
              holdTimerRef.current = setTimeout(() => {
                isSelecting.current = false;
                isUserInteracting.current = false;
                setIsPullingToLight(false);
                holdTimerRef.current = null;
                if (selectingCallback.current) {
                  selectingCallback.current(album);
                  selectingCallback.current = null;
                }
              }, 1800);
            }
          }
        } else {
          // Normal decay
          if (!isUserInteracting.current && !isDrawing) {
            const diff = BASE_SPEED - velocityRef.current;
            velocityRef.current += diff * 0.02;
          } else if (Math.abs(velocityRef.current) > BASE_SPEED + 0.05) {
            velocityRef.current *= FRICTION;
          }
        }

        // Center change
        const center = getCenterAlbum();
        if (center.id !== prevCenterRef.current) {
          prevCenterRef.current = center.id;
          setCenterAlbumId(center.id);
          if (onCardCenterChange) onCardCenterChange(center);
        }

        if (!isDrawing) {
          setOffsetRender(offsetRef.current);
        }
        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
      return () => {
        activeRef.current = false;
        cancelAnimationFrame(rafRef.current);
      };
    }, []);

    const markInteraction = useCallback(() => {
      if (isSelecting.current) return;
      isUserInteracting.current = true;
      if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
      interactionTimeout.current = setTimeout(() => {
        isUserInteracting.current = false;
      }, 800);
    }, []);

    useImperativeHandle(ref, () => ({
      setVelocity: (v: number) => {
        if (!activeRef.current || isSelecting.current) return;
        const clamped = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, v));
        if (isNaN(clamped) || !isFinite(clamped)) return;
        velocityRef.current = clamped;
        markInteraction();
      },
      addVelocity: (dv: number) => {
        if (!activeRef.current || isSelecting.current) return;
        const next = velocityRef.current + dv;
        const clamped = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, next));
        if (isNaN(clamped) || !isFinite(clamped)) return;
        velocityRef.current = clamped;
        markInteraction();
      },
      beginDecelerate: () => {
        if (isSelecting.current || isDrawing) return;
        if (Date.now() - lastSelectTime.current < SELECT_COOLDOWN) return;
        lastSelectTime.current = Date.now();
        onSelectionStart?.();
        if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
        setIsPullingToLight(false);
        isSelecting.current = true;
        isUserInteracting.current = false;
        selectingCallback.current = (album: Album) => {
          onSelectAlbum(album);
        };
      },
      getCurrentAlbum: () => getCenterAlbum()
    }), [getCenterAlbum, markInteraction, isDrawing, onSelectAlbum, onSelectionStart]);

    const movePrevious = () => {
      if (isSelecting.current) return;
      velocityRef.current = 0;
      offsetRef.current -= 1;
      const c = getCenterAlbum();
      prevCenterRef.current = c.id;
      setCenterAlbumId(c.id);
      setOffsetRender(offsetRef.current);
    };

    const moveNext = () => {
      if (isSelecting.current) return;
      velocityRef.current = 0;
      offsetRef.current += 1;
      const c = getCenterAlbum();
      prevCenterRef.current = c.id;
      setCenterAlbumId(c.id);
      setOffsetRender(offsetRef.current);
    };

    const handleCardClick = (album: Album, cardIndex: number) => {
      if (isDrawing || isSelecting.current) return;
      if (Date.now() - lastSelectTime.current < SELECT_COOLDOWN) return;
      lastSelectTime.current = Date.now();
      onSelectionStart?.();
      setShowAllFronts(false);
      isSelecting.current = true;
      velocityRef.current = 0;
      isUserInteracting.current = false;
      offsetRef.current = cardIndex;
      prevCenterRef.current = album.id;
      setCenterAlbumId(album.id);
      setOffsetRender(cardIndex);
      setIsPullingToLight(true);
      holdTimerRef.current = setTimeout(() => {
        isSelecting.current = false;
        setIsPullingToLight(false);
        holdTimerRef.current = null;
        onSelectAlbum(album);
      }, 1500);
    };

    const drawCard = () => {
      if (isDrawing || isSelecting.current) return;
      if (Date.now() - lastSelectTime.current < SELECT_COOLDOWN) return;
      lastSelectTime.current = Date.now();
      onSelectionStart?.();
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
      setIsPullingToLight(false);
      setShowAllFronts(false);
      velocityRef.current = 0;
      isUserInteracting.current = false;
      isSelecting.current = true;
      setIsDrawing(true);

      let spinVelocity = 18.0;
      const startTime = performance.now();
      const duration = 5500; // 5.5s spin then light

      const spin = (now: number) => {
        const elapsed = now - startTime;
        if (elapsed >= duration) {
          // Light turns on as wheel slows into final pull
          setIsPullingToLight(true);
          const target = Math.round(offsetRef.current);
          const pullStart = offsetRef.current;
          const pullStartTime = performance.now();
          const pullDuration = 1200;
          const pullToLight = (now: number) => {
            const p = Math.min((now - pullStartTime) / pullDuration, 1);
            const ease = 1 - Math.pow(1 - p, 4);
            offsetRef.current = pullStart + (target - pullStart) * ease;
            setOffsetRender(offsetRef.current);
            if (p < 1) {
              requestAnimationFrame(pullToLight);
            } else {
              offsetRef.current = target;
              prevCenterRef.current = getCenterAlbum().id;
              setOffsetRender(target);
              setIsDrawing(false);
              setIsPullingToLight(false);
              isSelecting.current = false;
              onSelectAlbum(getCenterAlbum());
            }
          };
          requestAnimationFrame(pullToLight);
          return;
        }
        const progress = elapsed / duration;
        const eased = 1 - Math.pow(1 - progress, 3);
        offsetRef.current += spinVelocity * (1 - eased) * 0.028;
        if (progress > 0.6) {
          const nearest = Math.round(offsetRef.current);
          offsetRef.current += (nearest - offsetRef.current) * 0.01;
        }
        setOffsetRender(offsetRef.current);
        requestAnimationFrame(spin);
      };
      requestAnimationFrame(spin);
    };

    const cards = MAYDAY_ALBUMS.map((album, index) => {
      const rawDist = shortestDist(index, offsetRender);
      const isCenter = Math.abs(rawDist) < 0.5;
      const absDist = Math.abs(rawDist);
      const translateX = rawDist * CARD_WIDTH;
      const opacity = Math.max(0.35, 0.7 - absDist * 0.12);
      const zIndex = 20 - Math.floor(absDist);

      return { album, index, translateX, opacity, zIndex, isCenter, absDist };
    });

    return (
      <div className="relative w-full flex flex-col items-center select-none" id="tarot_scroll_board">

        <div className="text-center mb-2 max-w-xl px-4 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-[10px] text-amber-300/90 font-semibold mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>五月的盛夏 · 命运起伏的牌阵</span>
          </div>
          <h2 className="text-2xl font-serif text-slate-100 font-extrabold tracking-wider">
            抽取你的「生命自传」首章
          </h2>
        </div>

        {/* Cards — fit viewport, mouse draggable */}
        <div className="relative w-full" style={{ height: 'calc(100vh - 260px)' }}>
          {/* === LIGHTING SYSTEM === */}
          {/* Main warm beam */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[50%] h-full pointer-events-none z-26"
            style={{
              background: `
                radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.08) 25%, rgba(245,158,11,0.02) 50%, transparent 72%)
              `,
              clipPath: 'polygon(28% 0%, 72% 0%, 88% 100%, 12% 100%)',
              mixBlendMode: 'screen' as any,
            }}
          />
          {/* Hotspot core — brighter narrow beam */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[30%] h-[60%] pointer-events-none z-26"
            style={{
              background: 'radial-gradient(ellipse at 50% 0%, rgba(255,215,150,0.12) 0%, rgba(245,158,11,0.04) 30%, transparent 65%)',
              clipPath: 'polygon(35% 0%, 65% 0%, 78% 100%, 22% 100%)',
            }}
          />
          {/* Light rays */}
          {[-15, -8, 0, 8, 15].map((angle, i) => (
            <div key={i} className="absolute top-0 left-1/2 h-[70%] w-px pointer-events-none z-26 origin-top transition-opacity duration-700"
              style={{
                background: `linear-gradient(to bottom, rgba(245,158,11,${0.15 - Math.abs(angle)*0.008}), transparent)`,
                transform: `translateX(-50%) rotate(${angle}deg)`,
                opacity: isPullingToLight ? 0.9 : 0.55 + i * 0.08,
              }}
            />
          ))}
          {/* Suction beam — intensifies when card is being pulled to light */}
          {isPullingToLight && (
            <>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[20%] h-full pointer-events-none z-28 animate-pulse"
                style={{
                  background: 'radial-gradient(ellipse at 50% 0%, rgba(255,215,100,0.35) 0%, rgba(245,158,11,0.15) 25%, transparent 60%)',
                  clipPath: 'polygon(38% 0%, 62% 0%, 70% 100%, 30% 100%)',
                  mixBlendMode: 'screen' as any,
                }}
              />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[10%] h-[50%] pointer-events-none z-29"
                style={{
                  background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,220,0.4) 0%, rgba(255,215,100,0.2) 20%, transparent 55%)',
                  clipPath: 'polygon(42% 0%, 58% 0%, 62% 100%, 38% 100%)',
                  mixBlendMode: 'screen' as any,
                }}
              />
            </>
          )}
          {/* Lamp fixture */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none z-27 flex flex-col items-center">
            {/* Housing */}
            <div className="w-8 h-3 rounded-t-full bg-gradient-to-b from-amber-400/30 to-amber-500/10 border border-amber-400/20 border-b-0" />
            {/* Bulb glow */}
            <div className={`w-4 h-4 rounded-full bg-amber-200/80 -mt-1 transition-all duration-700 ${isPullingToLight ? 'shadow-[0_0_24px_rgba(255,200,100,1),0_0_60px_rgba(245,158,11,0.8),0_0_120px_rgba(245,158,11,0.4)] scale-125' : 'shadow-[0_0_16px_rgba(245,158,11,0.9),0_0_40px_rgba(245,158,11,0.5),0_0_80px_rgba(245,158,11,0.2)]'}`} />
            {/* Lens flare */}
            <div className="w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.8)] -mt-3.5" />
          </div>
          <div className="relative w-full h-full overflow-hidden py-2 flex items-center justify-center cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => {
            if (isDrawing || isSelecting.current) return;
            isDragging.current = true;
            dragStartX.current = e.clientX;
            dragStartOffset.current = offsetRef.current;
            dragLastX.current = e.clientX;
            dragLastTime.current = Date.now();
            velocityRef.current = 0;
            isUserInteracting.current = true;
          }}
          onMouseMove={(e) => {
            if (!isDragging.current) return;
            const dx = e.clientX - dragStartX.current;
            offsetRef.current = dragStartOffset.current - dx / CARD_WIDTH;
            const now = Date.now();
            const dt = now - dragLastTime.current;
            if (dt > 0) {
              const moveX = e.clientX - dragLastX.current;
              velocityRef.current = -(moveX / CARD_WIDTH) * (16.67 / dt) * 0.5;
            }
            dragLastX.current = e.clientX;
            dragLastTime.current = now;
            setOffsetRender(offsetRef.current);
          }}
          onMouseUp={() => {
            if (!isDragging.current) return;
            isDragging.current = false;
            if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
            interactionTimeout.current = setTimeout(() => {
              isUserInteracting.current = false;
            }, 800);
          }}
          onMouseLeave={() => {
            if (isDragging.current) {
              isDragging.current = false;
              if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
              interactionTimeout.current = setTimeout(() => { isUserInteracting.current = false; }, 800);
            }
          }}
        >
          <div className="relative flex items-center justify-center w-full max-w-6xl h-full">
            {cards.map(({ album, index, translateX, opacity, zIndex, isCenter, absDist }) => {
              if (absDist > 4) return null;
              return (
                <div
                  key={album.id}
                  className="absolute cursor-pointer"
                  style={{
                    transform: `translateX(${translateX}px)`,
                    opacity, zIndex,
                    willChange: 'transform',
                  }}
                  onClick={() => handleCardClick(album, index)}
                  onMouseEnter={() => setHoveredCard(album.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div style={{ perspective: '800px' }}>
                    <div
                      className={`
                        relative w-[198px] h-[352px] sm:w-[234px] sm:h-[416px]
                        rounded-xl border-2 transition-all duration-300
                        border-slate-700/30 shadow-xl shadow-slate-950/60
                        hover:scale-105 hover:border-amber-400/50 hover:shadow-[0_0_25px_rgba(245,158,11,0.2)] hover:z-30
                      `}
                      style={{
                        transformStyle: 'preserve-3d',
                        transition: `transform 0.7s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.12}s`,
                        transform: showAllFronts ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      }}
                    >
                      {/* Back face — tarot_back.png */}
                      <div
                        className="absolute inset-0 rounded-xl overflow-hidden"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <img
                          src="/images/tarot_back.png"
                          alt=""
                          className="w-full h-full object-contain"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                        <div className="absolute top-2 left-2 text-[9px] text-amber-500/40 pointer-events-none">✦</div>
                        <div className="absolute top-2 right-2 text-[9px] text-amber-500/40 pointer-events-none">✦</div>
                        <div className="absolute bottom-2 left-2 text-[9px] text-amber-500/40 pointer-events-none">✦</div>
                        <div className="absolute bottom-2 right-2 text-[9px] text-amber-500/40 pointer-events-none">✦</div>
                      </div>
                      {/* Front face — album cover */}
                      <div
                        className="absolute inset-0 rounded-xl overflow-hidden"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                      >
                        <img
                          src={`/images/${album.id}.png`}
                          alt={album.title}
                          className="w-full h-full object-contain"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                        {/* Title — appears on hover */}
                        <div className={`absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent transition-opacity duration-500 rounded-xl flex items-end justify-center pb-3 ${hoveredCard === album.id ? 'opacity-100' : 'opacity-0'}`}>
                          <span className="text-[11px] font-serif text-amber-200 tracking-wider bg-slate-950/80 px-2.5 py-1 rounded-full border border-amber-500/20">
                            {album.tarotCardName} · {album.title}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 -mt-6 mb-4 shrink-0">
          <button id="btn_trigger_draw" onClick={drawCard} disabled={isDrawing || isSelecting.current}
            className="relative px-12 py-3.5 min-w-[220px] justify-center group rounded-full font-semibold text-sm tracking-[0.15em] transition-all duration-500 ease-out transform active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-3"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(168,85,247,0.1), rgba(34,211,238,0.08), rgba(245,158,11,0.12))',
              backgroundSize: '300% 300%',
              animation: 'cosmic-shift 6s ease-in-out infinite',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              boxShadow: '0 0 24px rgba(245, 158, 11, 0.12), 0 0 48px rgba(34, 211, 238, 0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.55)';
              e.currentTarget.style.boxShadow = '0 0 40px rgba(245, 158, 11, 0.3), 0 0 80px rgba(245, 158, 11, 0.12), 0 0 100px rgba(34, 211, 238, 0.1), inset 0 1px 0 rgba(255,255,255,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.25)';
              e.currentTarget.style.boxShadow = '0 0 24px rgba(245, 158, 11, 0.12), 0 0 48px rgba(34, 211, 238, 0.06), inset 0 1px 0 rgba(255,255,255,0.04)';
            }}
          >
            {isDrawing ? (
              <><RefreshCw className="w-4 h-4 animate-spin text-amber-300" /> <span className="text-amber-200/80">星轨裁决中...</span></>
            ) : (
              <>
                <Wand2 className="w-4 h-4 text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-50 to-amber-200">念力抽牌</span>
              </>
            )}
          </button>
          <button
            onClick={() => setShowAllFronts(!showAllFronts)}
            disabled={isDrawing}
            className="relative px-12 py-3.5 group rounded-full text-sm font-medium tracking-[0.12em] transition-all duration-500 flex items-center gap-2.5"
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
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-200/80">
              {showAllFronts ? '收回卡面' : '翻开全部卡面'}
            </span>
          </button>
        </div>
      </div>
      </div>
    );
  }
);

export default TarotScrollBoard;
