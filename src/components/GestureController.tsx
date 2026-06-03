import { useEffect, useRef, useState } from 'react';
import { Camera, Play, VideoOff, RefreshCw, Sparkles, HelpCircle } from 'lucide-react';

interface GestureControllerProps {
  onGestureDetected: (gesture: string) => void;
  onHandMove?: (deltaX: number, handX: number) => void;
  enabled?: boolean;
  compact?: boolean;
  onCameraChange?: (active: boolean) => void;
}

export default function GestureController({ onGestureDetected, onHandMove, enabled = true, compact = false, onCameraChange }: GestureControllerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [loadingMediaPipe, setLoadingMediaPipe] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [detectedGesture, setDetectedGesture] = useState<string>('等待手势感应...');
  const [showTutorial, setShowTutorial] = useState(false);

  const cameraInstanceRef = useRef<any>(null);
  const handsInstanceRef = useRef<any>(null);
  const lastGestureTimeRef = useRef<number>(0);
  const prevXRef = useRef<number | null>(null);

  const stopCamera = () => {
    if (cameraInstanceRef.current) {
      try { cameraInstanceRef.current.stop(); } catch (err) {}
      cameraInstanceRef.current = null;
    }
    if (handsInstanceRef.current) {
      try { handsInstanceRef.current.close(); } catch (err) {}
      handsInstanceRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setLoadingMediaPipe(false);
    if (onCameraChange) onCameraChange(false);
  };

  const startCamera = async () => {
    stopCamera();
    setLoadingMediaPipe(true);
    setHasCamera(true);

    const HandsCtor = (window as any).Hands;
    const CameraCtor = (window as any).Camera;

    if (!HandsCtor) {
      setLoadingMediaPipe(false);
      alert('MediaPipe 脚本加载延迟，请稍后重试。');
      return;
    }

    try {
      const hands = new HandsCtor({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
      });
      hands.onResults((results: any) => handleResults(results));
      handsInstanceRef.current = hands;

      if (!videoRef.current) return;

      const camera = new CameraCtor(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) await hands.send({ image: videoRef.current });
        },
        width: 320,
        height: 240
      });

      await camera.start();
      cameraInstanceRef.current = camera;
      setCameraActive(true);
      setLoadingMediaPipe(false);
      if (onCameraChange) onCameraChange(true);

    } catch (err) {
      console.error('Camera init failed:', err);
      setHasCamera(false);
      setLoadingMediaPipe(false);
    }
  };

  const handleResults = (results: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Subtle dark overlay to prevent flicker between frames
    ctx.fillStyle = 'rgba(2, 6, 23, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      const wrist = landmarks[0];

      if (prevXRef.current !== null && onHandMove && enabled) {
        const deltaX = wrist.x - prevXRef.current;
        onHandMove(deltaX, wrist.x);
      }
      prevXRef.current = wrist.x;

      drawLandmarks(ctx, landmarks);
      classifyGesture(landmarks);
    } else {
      setDetectedGesture('未检测到手势');
      prevXRef.current = null;
    }
  };

  const drawLandmarks = (ctx: CanvasRenderingContext2D, landmarks: any[]) => {
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#06b6d4';

    const connections = [
      [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
      [0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],
      [0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]
    ];

    connections.forEach(([s, e]) => {
      ctx.beginPath();
      ctx.moveTo(landmarks[s].x * ctx.canvas.width, landmarks[s].y * ctx.canvas.height);
      ctx.lineTo(landmarks[e].x * ctx.canvas.width, landmarks[e].y * ctx.canvas.height);
      ctx.stroke();
    });

    landmarks.forEach((pt: any, idx: number) => {
      const isTip = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20;
      ctx.fillStyle = isTip ? '#f43f5e' : '#e0f2fe';
      ctx.beginPath();
      ctx.arc(pt.x * ctx.canvas.width, pt.y * ctx.canvas.height, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.shadowBlur = 0;
  };

  const classifyGesture = (landmarks: any[]) => {
    const indexTip = landmarks[8];
    const indexMcp = landmarks[5];
    const middleTip = landmarks[12];
    const middleMcp = landmarks[9];
    const ringTip = landmarks[16];
    const ringMcp = landmarks[13];
    const pinkyTip = landmarks[20];
    const pinkyMcp = landmarks[17];

    const isIndexExtended = indexTip.y < indexMcp.y - 0.05;
    const isMiddleExtended = middleTip.y < middleMcp.y - 0.05;
    const isRingExtended = ringTip.y < ringMcp.y - 0.05;
    const isPinkyExtended = pinkyTip.y < pinkyMcp.y - 0.05;

    let gestureName = '观察手势中...';
    let gestureKey = '';

    if (isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended) {
      gestureName = '✋ 掌心张开 — 扒动牌阵';
      gestureKey = 'OPEN_PALM';
    } else if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      gestureName = '👆 食指指向 — 选中卡牌！';
      gestureKey = 'INDEX_POINT';
    } else if (!isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      gestureName = '✊ 握拳 — 确认抽取';
      gestureKey = 'FIST';
    } else if (!isIndexExtended && !isMiddleExtended && !isRingExtended && isPinkyExtended) {
      gestureName = '🤙 摇滚手势 — 返回牌阵';
      gestureKey = 'ROCK_SIGN';
    } else {
      gestureName = '手势识别中...';
    }

    if (gestureKey) {
      setDetectedGesture(gestureName);
      triggerGesture(gestureKey);
    }
  };

  const triggerGesture = (gestureKey: string) => {
    const now = Date.now();
    // Debounce: 800ms for most gestures, shorter for continuous ones
    const debounceTime = gestureKey === 'OPEN_PALM' ? 400 : 800;
    if (now - lastGestureTimeRef.current > debounceTime) {
      onGestureDetected(gestureKey);
      lastGestureTimeRef.current = now;
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Compact PIP mode: small floating orb
  if (compact) {
    return (
      <>
        <video ref={videoRef} playsInline muted className="hidden" width="320" height="240" />
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-cyan-400/60 shadow-[0_0_12px_rgba(34,211,238,0.3)] bg-slate-950">
          <canvas ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover z-20 scale-x-[-1]"
            width="128" height="128" />
          {cameraActive ? (
            <video autoPlay playsInline muted
              className="absolute inset-0 w-full h-full object-cover z-10 scale-x-[-1]"
              ref={(el) => { if (el && videoRef.current) el.srcObject = videoRef.current.srcObject; }} />
          ) : null}
          {loadingMediaPipe && (
            <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center z-30">
              <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
            </div>
          )}
          {!cameraActive && !loadingMediaPipe && (
            <div className="absolute inset-0 flex items-center justify-center z-30">
              <Sparkles className="w-5 h-5 text-slate-600" />
            </div>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          {cameraActive ? (
            <button onClick={stopCamera} className="text-[9px] text-rose-400 hover:text-rose-300 transition">关闭</button>
          ) : (
            <button onClick={startCamera} disabled={loadingMediaPipe} className="text-[9px] text-cyan-400 hover:text-cyan-300 transition">开启手势</button>
          )}
          <span className="text-[9px] text-slate-600">|</span>
          <button onClick={() => setShowTutorial(!showTutorial)} className="text-[9px] text-slate-500 hover:text-slate-400 transition">
            <HelpCircle className="w-2.5 h-2.5 inline" />
          </button>
        </div>
        {showTutorial && (
          <div className="absolute bottom-full right-0 mb-2 w-44 bg-slate-950/95 rounded-xl p-2.5 border border-slate-800 text-[10px] text-slate-300 space-y-1.5 animate-fade-in z-50">
            <p className="text-cyan-400 font-bold text-[11px]">手势说明</p>
            <div><span className="text-rose-400">✋ 掌心</span> 扒动牌阵</div>
            <div><span className="text-rose-400">👆 食指</span> 减速选中</div>
            <div><span className="text-rose-400">✊ 握拳</span> 抽牌</div>
            <div><span className="text-rose-400">🤙 摇滚</span> 返回</div>
          </div>
        )}
      </>
    );
  }

  // Full panel mode
  return (
    <div className="flex flex-col items-center bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-cyan-500/30 w-full max-w-sm shadow-xl">
      <div className="relative w-52 h-52 rounded-full overflow-hidden border-2 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] bg-slate-950 group">
        <video ref={videoRef} playsInline muted className="hidden" width="320" height="240" />
        <canvas ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover z-20 scale-x-[-1]"
          width="208" height="208" />
        {cameraActive ? (
          <video autoPlay playsInline muted
            className="absolute inset-0 w-full h-full object-cover z-10 scale-x-[-1]"
            ref={(el) => { if (el && videoRef.current) el.srcObject = videoRef.current.srcObject; }} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 px-4 text-center z-10 gap-2">
            <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse" />
            <span className="text-xs font-medium text-slate-300">命运晶球</span>
            <span className="text-[10px] text-slate-500">点击开启手势感应</span>
          </div>
        )}
        {loadingMediaPipe && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center z-30">
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin mb-2" />
            <p className="text-[11px] text-cyan-300">连通星轨...</p>
          </div>
        )}
      </div>
    </div>
  );
}
