'use client';

import { useEffect, useRef } from 'react';

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hub: boolean;
  pulse: number;
  pulseSpeed: number;
};

type Particle = { edge: number; t: number; speed: number };

const PALETTE = ['#FF6B35', '#FF8A5C', '#FBCFB8', '#FAFAFA'];

/**
 * Live creator-economy network: creator nodes (hubs glow brighter), soft
 * connections, and particles that travel the edges like orders/follows
 * flowing through the network. Canvas 2D for high performance — caps DPR,
 * pauses when off-screen, and freezes for reduced-motion users.
 */
export default function NetworkGraph({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
    // Explicitly-typed non-null aliases so closures keep the narrowing.
    const cv: HTMLCanvasElement = canvas;
    const ctx: CanvasRenderingContext2D = context;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    let edges: [number, number][] = [];
    let particles: Particle[] = [];
    let raf = 0;
    let running = true;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function build() {
      const rect = cv.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.floor(width * dpr);
      cv.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const density = width < 640 ? 14 : width < 1024 ? 20 : 28;
      nodes = Array.from({ length: density }, () => {
        const hub = Math.random() < 0.22;
        return {
          x: rand(0, width),
          y: rand(0, height),
          vx: rand(-0.12, 0.12),
          vy: rand(-0.12, 0.12),
          r: hub ? rand(4, 6.5) : rand(1.6, 3),
          hub,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: rand(0.01, 0.03),
        };
      });

      // Build edges by proximity (computed once; geometry drifts slowly).
      edges = [];
      const maxDist = width < 640 ? 150 : 210;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          if (Math.hypot(dx, dy) < maxDist) edges.push([i, j]);
        }
      }
      particles = Array.from({ length: Math.min(edges.length, density) }, () => ({
        edge: Math.floor(Math.random() * edges.length),
        t: Math.random(),
        speed: rand(0.0025, 0.006),
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      // Edges
      for (const [a, b] of edges) {
        const na = nodes[a];
        const nb = nodes[b];
        const dist = Math.hypot(na.x - nb.x, na.y - nb.y);
        const alpha = Math.max(0, 1 - dist / 230) * 0.5;
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(nb.x, nb.y);
        ctx.strokeStyle = `rgba(255, 138, 92, ${alpha})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // Particles travelling along edges
      for (const p of particles) {
        const [a, b] = edges[p.edge] || edges[0];
        if (!a && a !== 0) continue;
        const na = nodes[a];
        const nb = nodes[b];
        const x = na.x + (nb.x - na.x) * p.t;
        const y = na.y + (nb.y - na.y) * p.t;
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE[p.edge % PALETTE.length];
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Nodes
      for (const n of nodes) {
        const glow = (Math.sin(n.pulse) + 1) / 2;
        if (n.hub) {
          const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 5);
          grd.addColorStop(0, `rgba(255, 107, 53, ${0.32 + glow * 0.25})`);
          grd.addColorStop(1, 'rgba(255, 107, 53, 0)');
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 5, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + (n.hub ? glow * 1.2 : 0), 0, Math.PI * 2);
        ctx.fillStyle = n.hub
          ? `rgba(250, 250, 250, ${0.85 + glow * 0.15})`
          : `rgba(255, 138, 92, ${0.55 + glow * 0.35})`;
        ctx.fill();
      }
    }

    function step() {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += n.pulseSpeed;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }
      for (const p of particles) {
        p.t += p.speed;
        if (p.t > 1) {
          p.t = 0;
          p.edge = Math.floor(Math.random() * edges.length);
        }
      }
    }

    function loop() {
      if (!running) return;
      step();
      draw();
      raf = requestAnimationFrame(loop);
    }

    build();
    if (reduced) {
      draw();
    } else {
      loop();
    }

    const onResize = () => {
      cancelAnimationFrame(raf);
      build();
      if (reduced) draw();
      else loop();
    };
    window.addEventListener('resize', onResize, { passive: true });

    // Pause when off-screen to save battery / CPU.
    const io = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting && !reduced;
        if (running) loop();
        else cancelAnimationFrame(raf);
      },
      { threshold: 0 }
    );
    io.observe(cv);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      io.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
