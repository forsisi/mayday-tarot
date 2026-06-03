/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { Play, Pause, Disc } from 'lucide-react';
import { maydaySynth } from '../utils/maydaySynth';

interface AudioVisualizerProps {
  isPlaying: boolean;
  colorPreset: string; // Tailwind bg-gradient classes like 'from-amber-500 to-orange-700'
}

export default function AudioVisualizer({ isPlaying, colorPreset }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 280);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 280);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        width = canvas.width = entry.contentRect.width || 280;
        height = canvas.height = entry.contentRect.height || 280;
      }
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    const analyser = maydaySynth.getAnalyser();
    const bufferLength = analyser ? analyser.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufferLength);

    // Particle system orbiting the spinning record
    const particles: Array<{
      angle: number;
      radius: number;
      speed: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
    }> = [];

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.32;

      // 1. Fetch audio spectrum data
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Fallback idling ambient waves when music is paused
        for (let i = 0; i < dataArray.length; i++) {
          dataArray[i] = Math.sin(Date.now() * 0.003 + i * 0.1) * 15 + 15;
        }
      }

      // 2. Draw glowing background nebula circle
      const avgFreq = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
      const beatMultiplier = 1 + (avgFreq / 255) * 0.18;

      const auraGradient = ctx.createRadialGradient(
        centerX, centerY, baseRadius * 0.8,
        centerX, centerY, baseRadius * beatMultiplier * 1.5
      );
      
      // Extract color hints or use default magic pinks and cyans
      auraGradient.addColorStop(0, 'rgba(6, 182, 212, 0.08)');
      auraGradient.addColorStop(0.5, 'rgba(236, 72, 153, 0.05)');
      auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = auraGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * beatMultiplier * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // 3. Draw live magical mandala/frequency ring waves
      ctx.beginPath();
      const sliceAngle = (Math.PI * 2) / (bufferLength * 0.8);
      
      for (let i = 0; i < bufferLength * 0.8; i++) {
        const val = dataArray[i];
        const amp = (val / 255) * 45; // amplitude of scale
        
        const angle = i * sliceAngle;
        const radius = baseRadius * beatMultiplier + amp;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        // Spawn interactive stardust particles when beat is energetic
        if (isPlaying && val > 140 && Math.random() < 0.2) {
          particles.push({
            angle: angle,
            radius: radius,
            speed: Math.random() * 2 + 1,
            size: Math.random() * 2.5 + 1,
            color: i % 2 === 0 ? 'rgba(34, 211, 238,' : 'rgba(244, 63, 94,',
            alpha: 1.0,
            decay: Math.random() * 0.03 + 0.015
          });
        }
      }
      ctx.closePath();
      ctx.strokeStyle = isPlaying ? 'rgba(6, 182, 212, 0.75)' : 'rgba(100, 116, 139, 0.35)';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(6, 182, 212, 0.5)';
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // 4. Update and draw stardust particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.radius += p.speed;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const px = centerX + Math.cos(p.angle) * p.radius;
        const py = centerY + Math.sin(p.angle) * p.radius;

        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Draw outer vinyl vinyl track grooves for vintage aesthetic look
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let r = baseRadius * 0.4; r < baseRadius; r += 12) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [isPlaying, colorPreset]);

  return (
    <div className="relative w-full h-full flex items-center justify-center min-h-[280px]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />
    </div>
  );
}
