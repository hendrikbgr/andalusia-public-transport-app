'use client';

import { useEffect } from 'react';

export default function Confetti() {
  useEffect(() => {
    if (sessionStorage.getItem('showUpdateConfetti') !== '1') return;
    sessionStorage.removeItem('showUpdateConfetti');

    const COUNT = 120;
    const COLORS = ['#1a6fdb', '#f0c040', '#e05c5c', '#4caf7d', '#9c6fdb', '#f07840'];
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
    document.body.appendChild(canvas);

    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d')!;

    const pieces = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * -H,
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 6,
      r: Math.random() * Math.PI * 2,
      dr: (Math.random() - 0.5) * 0.2,
      dx: (Math.random() - 0.5) * 2,
      dy: 3 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    let frame: number;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      pieces.forEach(p => {
        if (p.y < H + 20) alive = true;
        p.x += p.dx; p.y += p.dy; p.r += p.dr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (alive) frame = requestAnimationFrame(draw);
      else canvas.remove();
    }

    const timer = setTimeout(() => { draw(); }, 200);
    const killer = setTimeout(() => { cancelAnimationFrame(frame); canvas.remove(); }, 4200);

    return () => {
      clearTimeout(timer);
      clearTimeout(killer);
      cancelAnimationFrame(frame);
      canvas.remove();
    };
  }, []);

  return null;
}
