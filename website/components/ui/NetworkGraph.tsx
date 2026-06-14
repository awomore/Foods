'use client';

import { useEffect, useRef } from 'react';

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hub: boolean;
  glyph?: string;
  pulse: number;
  pulseSpeed: number;
};

// An "order" or "follow" travelling a connection. kind drives the colour/shape.
type Particle = { edge: number; t: number; speed: number; kind: 'order' | 'follow' };

// Food glyphs ride the creator hubs so the graph reads as a *food* creator
// network, not an abstract data viz. Pan-African home-cooking cues.
const FOOD = ['🍲', '🥘', '🍛', '🍞', '🍰', '🍗', '🫓', '🥟', '🍢', '🧆'];

/**
 * Live creator-economy network for the hero. Creator "kitchen" hubs carry a
 * food glyph and glow; smaller nodes are community followers; particles travel
 * the connections like orders (spice dots) and follows (hearts) flowing through
 * the network. Canvas 2D for performance — caps DPR, pauses off-screen, and
 * freezes for reduced-motion users.
 */
export default function NetworkGraph({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;
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

      // Fewer, more intentional nodes than a generic graph — creators stand out.
      const density = width < 640 ? 13 : width < 1024 ? 18 : 24;
      let glyphIdx = 0;
      nodes = Array.from({ length: density }, () => {
        const hub = Math.random() < 0.32;
        return {
          x: rand(0, width),
          y: rand(0, height),
          vx: rand(-0.1, 0.1),
          vy: rand(-0.1, 0.1),
          r: hub ? rand(5, 7) : rand(1.6, 3),
          hub,
          glyph: hub ? FOOD[glyphIdx++ % FOOD.length] : undefined,
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: rand(0.012, 0.03),
        };
      });

      // Connect by proximity, biasing toward links that touch a creator hub so
      // the structure reads as creators ↔ community.
      edges = [];
      const maxDist = width < 640 ? 165 : 230;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const touchesHub = nodes[i].hub || nodes[j].hub;
          if (Math.hypot(dx, dy) < (touchesHub ? maxDist : maxDist * 0.7)) edges.push([i, j]);
        }
      }
      particles = Array.from({ length: Math.min(edges.length, density) }, () => ({
        edge: Math.floor(Math.random() * edges.length),
        t: Math.random(),
        speed: rand(0.0025, 0.0055),
        kind: Math.random() < 0.78 ? 'order' : 'follow',
      }));
    }

    function drawHeart(x: number, y: number, s: number, alpha: number) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#FF6B35';
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.3);
      ctx.bezierCurveTo(x, y, x - s, y - s * 0.1, x - s, y - s * 0.6);
      ctx.bezierCurveTo(x - s, y - s * 1.1, x, y - s * 1.1, x, y - s * 0.7);
      ctx.bezierCurveTo(x, y - s * 1.1, x + s, y - s * 1.1, x + s, y - s * 0.6);
      ctx.bezierCurveTo(x + s, y - s * 0.1, x, y, x, y + s * 0.3);
      ctx.fill();
      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Connections
      for (const [a, b] of edges) {
        const na = nodes[a];
        const nb = nodes[b];
        const dist = Math.hypot(na.x - nb.x, na.y - nb.y);
        const alpha = Math.max(0, 1 - dist / 250) * 0.45;
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(nb.x, nb.y);
        ctx.strokeStyle = `rgba(255, 138, 92, ${alpha})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // Orders & follows travelling the connections
      for (const p of particles) {
        const e = edges[p.edge] || edges[0];
        if (!e) continue;
        const na = nodes[e[0]];
        const nb = nodes[e[1]];
        const x = na.x + (nb.x - na.x) * p.t;
        const y = na.y + (nb.y - na.y) * p.t;
        if (p.kind === 'follow') {
          drawHeart(x, y, 3.4, 0.85);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fillStyle = '#FF6B35';
          ctx.globalAlpha = 0.9;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // Nodes: creator kitchens (food glyph + glow) and community followers
      for (const n of nodes) {
        const glow = (Math.sin(n.pulse) + 1) / 2;
        if (n.hub) {
          const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 6);
          grd.addColorStop(0, `rgba(255, 107, 53, ${0.3 + glow * 0.25})`);
          grd.addColorStop(1, 'rgba(255, 107, 53, 0)');
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 6, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();

          // Soft disc behind the glyph so it stays legible on any backdrop
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 7, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(26, 18, 8, 0.55)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 7, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 138, 92, ${0.45 + glow * 0.3})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          const size = (n.r + 7) * 1.5;
          ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
          ctx.fillText(n.glyph ?? '🍽️', n.x, n.y + 0.5);
        } else {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 138, 92, ${0.5 + glow * 0.35})`;
          ctx.fill();
        }
      }
    }

    function step() {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += n.pulseSpeed;
        const margin = n.hub ? 24 : 4;
        if (n.x < margin || n.x > width - margin) n.vx *= -1;
        if (n.y < margin || n.y > height - margin) n.vy *= -1;
      }
      for (const p of particles) {
        p.t += p.speed;
        if (p.t > 1) {
          p.t = 0;
          p.edge = Math.floor(Math.random() * edges.length);
          p.kind = Math.random() < 0.78 ? 'order' : 'follow';
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
    if (reduced) draw();
    else loop();

    const onResize = () => {
      cancelAnimationFrame(raf);
      build();
      if (reduced) draw();
      else loop();
    };
    window.addEventListener('resize', onResize, { passive: true });

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
