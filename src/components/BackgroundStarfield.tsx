import { useEffect, useRef } from 'react';

interface StarfieldProps {
  isPlaying: boolean;
  intensity?: number; // 1 standard, 2 higher warp speed
}

export default function BackgroundStarfield({ isPlaying, intensity = 1 }: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Dynamic scale helper
    const handleResize = () => {
      if (canvas) {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    // Initialize stars
    const stars: Array<{
      x: number;
      y: number;
      size: number;
      speed: number;
      alpha: number;
      color: string;
    }> = [];

    const colors = ['rgba(255,255,255,', 'rgba(173,216,230,', 'rgba(255,192,203,', 'rgba(224,255,255,'];

    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.5 + 0.5,
        speed: (Math.random() * 0.4 + 0.1) * intensity,
        alpha: Math.random(),
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    // Shooting stars
    const shootingStars: Array<{
      x: number;
      y: number;
      dx: number;
      dy: number;
      length: number;
      speed: number;
      life: number;
      maxLife: number;
    }> = [];

    const draw = () => {
      // Clear canvas with subtle radial depth overlay
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        10,
        width / 2,
        height / 2,
        Math.max(width, height)
      );
      gradient.addColorStop(0, '#0c0f1e');
      gradient.addColorStop(0.5, '#05070f');
      gradient.addColorStop(1, '#000002');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Stars floating / warping
      for (const star of stars) {
        // Adjust speed depending on whether audio is playing
        const speedModifier = isPlaying ? 2.5 : 1;
        star.y += star.speed * speedModifier;
        if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }

        // Star twinkle
        star.alpha += (Math.random() * 0.04 - 0.02);
        if (star.alpha < 0.1) star.alpha = 0.1;
        if (star.alpha > 0.8) star.alpha = 0.8;

        ctx.fillStyle = `${star.color}${star.alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Handle shooting stars occasionally
      if (Math.random() < 0.008 && shootingStars.length < 3) {
        shootingStars.push({
          x: Math.random() * width * 0.8,
          y: Math.random() * height * 0.3,
          dx: Math.random() * 4 + 4,
          dy: Math.random() * 2 + 2,
          length: Math.random() * 80 + 40,
          speed: Math.random() * 8 + 6,
          life: 0,
          maxLife: Math.random() * 20 + 20
        });
      }

      // Draw and tick shooting stars
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += ss.dx;
        ss.y += ss.dy;
        ss.life++;

        if (ss.life >= ss.maxLife) {
          shootingStars.splice(i, 1);
          continue;
        }

        // Draw streak line
        ctx.strokeStyle = `rgba(147, 197, 253, ${1 - ss.life / ss.maxLife})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(ss.x - ss.dx * 3, ss.y - ss.dy * 3);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, intensity]);

  return (
    <canvas
      id="starfield_canvas"
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none -z-10"
    />
  );
}
