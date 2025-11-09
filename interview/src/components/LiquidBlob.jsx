import { useEffect, useRef } from 'react';

const POINTS = 96;

export default function LiquidBlob({ level }) {
  const canvasRef = useRef(null);
  const levelRef = useRef(level);
  const frameRef = useRef(null);
  const phasesRef = useRef(new Array(POINTS).fill(0).map(() => Math.random() * Math.PI * 2));

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let t = 0;

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const baseR = Math.min(width, height) * 0.33;
      const reactive = Math.min(1, Math.max(0, levelRef.current));
      const totalAmp = baseR * (0.12 + reactive * 0.4);
      const rotation = t * 0.12;

      // soft outer glows
      drawAura(ctx, cx, cy, baseR * 1.8, '#c9b6ff', 0.18);
      drawAura(ctx, cx - baseR * 1.4, cy + baseR * 0.6, baseR * 1.4, '#84a0ff', 0.14);
      drawAura(ctx, cx + baseR * 1.2, cy - baseR * 0.3, baseR * 1.2, '#f2b5ff', 0.12);

      const blobPath = new Path2D();
      const points = [];
      const phases = phasesRef.current;

      for (let i = 0; i < POINTS; i += 1) {
        const angle = (i / POINTS) * Math.PI * 2;
        const harmonics =
          Math.sin(angle * 3 + t * 0.8 + phases[i]) * 0.35 +
          Math.sin(angle * 2 - t * 0.6 + phases[i] * 1.2) * 0.22 +
          Math.sin(angle * 5 + t * 1.35) * 0.25 * (0.4 + reactive) +
          Math.sin(angle * 7 - t * 0.25 + phases[i] * 0.8) * 0.1;
        const radius = baseR + totalAmp * harmonics;
        const x = cx + radius * Math.cos(angle + rotation * 0.3);
        const y = cy + radius * Math.sin(angle + rotation * 0.3);
        points.push({ x, y });
      }

      blobPath.moveTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length; i += 1) {
        const next = points[(i + 1) % points.length];
        const nextNext = points[(i + 2) % points.length];
        const cpx = next.x + (nextNext.x - points[i].x) * 0.12;
        const cpy = next.y + (nextNext.y - points[i].y) * 0.12;
        blobPath.quadraticCurveTo(next.x, next.y, cpx, cpy);
      }
      blobPath.closePath();

      ctx.save();
      ctx.filter = 'blur(24px)';
      ctx.fillStyle = `rgba(140, 118, 255, ${0.3 + reactive * 0.3})`;
      ctx.fill(blobPath);

      ctx.filter = 'blur(12px)';
      ctx.fillStyle = `rgba(178, 146, 255, ${0.4 + reactive * 0.4})`;
      ctx.fill(blobPath);

      ctx.filter = 'blur(4px)';
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 1.05);
      gradient.addColorStop(0, `rgba(255, 254, 255, ${0.9})`);
      gradient.addColorStop(0.35, `rgba(206, 190, 255, ${0.85})`);
      gradient.addColorStop(0.7, `rgba(143, 123, 255, ${0.65})`);
      gradient.addColorStop(1, `rgba(87, 90, 255, ${0.35})`);
      ctx.fillStyle = gradient;
      ctx.fill(blobPath);
      ctx.restore();

      ctx.save();
      ctx.clip(blobPath);
      ctx.globalCompositeOperation = 'screen';
      const beams = 3 + Math.round(reactive * 5);
      for (let i = 0; i < beams; i += 1) {
        const beamAngle = (i / beams) * Math.PI * 2 + t * 0.5;
        const beamRadius = baseR * (0.3 + Math.sin(t + i) * 0.2);
        const bx = cx + beamRadius * Math.cos(beamAngle);
        const by = cy + beamRadius * Math.sin(beamAngle);
        const beamGradient = ctx.createRadialGradient(bx, by, 0, bx, by, baseR * 0.6);
        beamGradient.addColorStop(0, `rgba(255, 255, 255, ${0.75})`);
        beamGradient.addColorStop(0.4, `rgba(189, 173, 255, ${0.35})`);
        beamGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.filter = `blur(${6 + reactive * 6}px)`;
        ctx.fillStyle = beamGradient;
        ctx.beginPath();
        ctx.arc(bx, by, baseR * (0.25 + reactive * 0.35), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      t += 0.01 + reactive * 0.15;
    };

    draw();
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="blob-surface" aria-hidden="true">
      <canvas ref={canvasRef} className="blob-canvas" />
    </div>
  );
}

function drawAura(ctx, x, y, radius, color, opacity) {
  const gradient = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius);
  gradient.addColorStop(0, `${hexToRgba(color, opacity)}`);
  gradient.addColorStop(1, `${hexToRgba(color, 0)}`);
  ctx.save();
  ctx.filter = 'blur(18px)';
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function hexToRgba(hex, alpha) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
