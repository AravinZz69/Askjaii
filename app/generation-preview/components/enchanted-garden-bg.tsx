'use client';

import { useEffect, useRef } from 'react';

// ─── Utility helpers ────────────────────────────────────────────────────────
const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const randInt = (min: number, max: number) => Math.floor(rand(min, max));
const TAU = Math.PI * 2;

// ─── Colour palette ─────────────────────────────────────────────────────────
const SKY_TOP = '#000408';
const SKY_MID = '#042520';
const SKY_GLOW = '#0a4a3a';
const GROUND = '#010f08';
const STEM = '#1a3320';

// ─── Star ───────────────────────────────────────────────────────────────────
class Star {
  x: number = 0;
  y: number = 0;
  r: number = 0;
  phase: number = 0;
  speed: number = 0;
  bright: number = 0;

  constructor(w: number, h: number) {
    this.reset(w, h);
  }
  reset(w: number, h: number) {
    this.x = rand(0, w);
    this.y = rand(0, h * 0.55);
    this.r = rand(0.4, 1.6);
    this.phase = rand(0, TAU);
    this.speed = rand(0.008, 0.025);
    this.bright = rand(0.4, 1.0);
  }
  draw(ctx: CanvasRenderingContext2D, t: number) {
    const a = this.bright * (0.5 + 0.5 * Math.sin(this.phase + t * this.speed * 60));
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.fillStyle = `rgba(220,240,255,${a})`;
    ctx.fill();
  }
}

// ─── Floating dandelion seed ─────────────────────────────────────────────────
class Seed {
  w: number;
  h: number;
  x: number = 0;
  y: number = 0;
  vx: number = 0;
  vy: number = 0;
  life: number = 0;
  decay: number = 0;
  size: number = 0;
  rot: number = 0;
  rotSpeed: number = 0;
  sway: number = 0;
  swaySpeed: number = 0;
  swayAmp: number = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.reset();
  }
  reset() {
    this.x = rand(0, this.w);
    this.y = rand(this.h * 0.1, this.h * 0.75);
    this.vx = rand(-0.4, 0.4);
    this.vy = rand(-0.6, -0.1);
    this.life = 1;
    this.decay = rand(0.0012, 0.003);
    this.size = rand(3, 7);
    this.rot = rand(0, TAU);
    this.rotSpeed = rand(-0.02, 0.02);
    this.sway = rand(0, TAU);
    this.swaySpeed = rand(0.01, 0.03);
    this.swayAmp = rand(0.2, 0.6);
  }
  update() {
    this.sway += this.swaySpeed;
    this.x += this.vx + Math.sin(this.sway) * this.swayAmp;
    this.y += this.vy;
    this.rot += this.rotSpeed;
    this.life -= this.decay;
    if (this.life <= 0 || this.y < -20) this.reset();
  }
  draw(ctx: CanvasRenderingContext2D) {
    const a = Math.min(1, this.life * 3) * 0.85;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.globalAlpha = a;
    // stem
    ctx.strokeStyle = 'rgba(220,220,200,0.7)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, this.size * 1.2);
    ctx.stroke();
    // filaments
    const n = 6;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * TAU;
      const len = this.size;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
      ctx.strokeStyle = 'rgba(240,240,220,0.6)';
      ctx.lineWidth = 0.4;
      ctx.stroke();
      // tip dot
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * len, Math.sin(angle) * len, 1.2, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,240,0.8)';
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

// ─── Firefly / sparkle ───────────────────────────────────────────────────────
class Firefly {
  w: number;
  h: number;
  x: number = 0;
  y: number = 0;
  phase: number = 0;
  speed: number = 0;
  r: number = 0;
  color: string = '';
  vx: number = 0;
  vy: number = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.reset();
  }
  reset() {
    this.x = rand(this.w * 0.15, this.w * 0.85);
    this.y = rand(this.h * 0.3, this.h * 0.75);
    this.phase = rand(0, TAU);
    this.speed = rand(0.015, 0.04);
    this.r = rand(2, 4);
    this.color = Math.random() > 0.5 ? 'rgba(180,255,200,' : 'rgba(255,240,150,';
    this.vx = rand(-0.3, 0.3);
    this.vy = rand(-0.2, 0.2);
  }
  update() {
    this.phase += this.speed;
    this.x += this.vx;
    this.y += this.vy;
    this.vx += rand(-0.02, 0.02);
    this.vy += rand(-0.02, 0.02);
    this.vx = Math.max(-0.8, Math.min(0.8, this.vx));
    this.vy = Math.max(-0.5, Math.min(0.5, this.vy));
    if (this.x < 0 || this.x > this.w || this.y < 0 || this.y > this.h) this.reset();
  }
  draw(ctx: CanvasRenderingContext2D) {
    const a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.phase));
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.fillStyle = `${this.color}${a})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 3, 0, TAU);
    ctx.fillStyle = `${this.color}${a * 0.12})`;
    ctx.fill();
  }
}

// ─── Plant config type ───────────────────────────────────────────────────────
interface PlantConfig {
  x?: number;
  height?: number;
  headType?: 'daisy' | 'dandelion' | 'spiky' | 'globe' | 'bush';
  headColor?: string;
  headSize?: number;
  stemWidth?: number;
  swayAmp?: number;
  segments?: number;
  color?: string;
}

interface LeafConfig {
  t: number;
  side: number;
  len: number;
  angle: number;
}

// ─── Stem / plant ────────────────────────────────────────────────────────────
class Plant {
  x: number;
  groundY: number;
  config: PlantConfig;
  phase: number;
  swaySpeed: number;
  swayAmp: number;
  height: number;
  segments: number;
  color: string;
  headColor: string;
  headType: string;
  headSize: number;
  leafCount: number;
  leaves: LeafConfig[];

  constructor(x: number, groundY: number, h: number, config: PlantConfig) {
    this.x = x;
    this.groundY = groundY;
    this.config = config;
    this.phase = rand(0, TAU);
    this.swaySpeed = rand(0.005, 0.015);
    this.swayAmp = config.swayAmp || rand(1.5, 3.5);
    this.height = config.height || rand(h * 0.25, h * 0.55);
    this.segments = config.segments || randInt(6, 14);
    this.color = config.color || STEM;
    this.headColor = config.headColor || 'rgba(255,255,220,0.9)';
    this.headType = config.headType || 'daisy';
    this.headSize = config.headSize || rand(8, 20);
    this.leafCount = randInt(1, 3);
    this.leaves = Array.from({ length: this.leafCount }, () => ({
      t: rand(0.3, 0.8),
      side: Math.random() > 0.5 ? 1 : -1,
      len: rand(12, 28),
      angle: rand(0.3, 0.9),
    }));
  }

  _stemPoint(t: number, sway: number) {
    const x = this.x + sway * t * t;
    const y = this.groundY - t * this.height;
    return { x, y };
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    const sway = this.swayAmp * Math.sin(this.phase + t * this.swaySpeed * 60);

    // Draw stem
    ctx.beginPath();
    ctx.moveTo(this.x, this.groundY);
    const steps = this.segments;
    for (let i = 1; i <= steps; i++) {
      const pt = this._stemPoint(i / steps, sway);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.config.stemWidth || rand(1, 2.5);
    ctx.stroke();

    // Draw leaves
    this.leaves.forEach((leaf) => {
      const base = this._stemPoint(leaf.t, sway);
      const leafSway = sway * leaf.t;
      const lx = base.x + leaf.side * leaf.len * Math.cos(leaf.angle) + leafSway * 0.3;
      const ly = base.y - leaf.len * Math.sin(leaf.angle);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.quadraticCurveTo(
        base.x + leaf.side * leaf.len * 0.5 + leafSway * 0.2,
        base.y - leaf.len * 0.3,
        lx,
        ly
      );
      ctx.strokeStyle = 'rgba(30,80,40,0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw flower head
    const tip = this._stemPoint(1, sway);
    this._drawHead(ctx, tip.x, tip.y, t, sway);
  }

  _drawHead(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, sway: number) {
    const pulse = 1 + 0.04 * Math.sin(this.phase + t * 0.02 * 60);
    const s = this.headSize * pulse;
    const type = this.headType;

    if (type === 'daisy') {
      const petals = 12;
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * TAU + sway * 0.02;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * s * 0.65, y + Math.sin(a) * s * 0.65, s * 0.35, s * 0.18, a, 0, TAU);
        ctx.fillStyle = this.headColor;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, s * 0.32, 0, TAU);
      ctx.fillStyle = 'rgba(255,235,100,0.9)';
      ctx.fill();
    } else if (type === 'dandelion') {
      const rays = 18;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * TAU + sway * 0.01;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const ex = x + Math.cos(a) * s;
        const ey = y + Math.sin(a) * s;
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = 'rgba(230,230,210,0.6)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ex, ey, 1.5, 0, TAU);
        ctx.fillStyle = 'rgba(245,245,225,0.8)';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, TAU);
      ctx.fillStyle = 'rgba(200,200,180,0.7)';
      ctx.fill();
    } else if (type === 'spiky') {
      const petals = 14;
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * TAU + sway * 0.015;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * s * 1.1, y + Math.sin(a) * s * 0.9);
        ctx.strokeStyle = this.headColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, s * 0.25, 0, TAU);
      ctx.fillStyle = 'rgba(200,140,40,0.85)';
      ctx.fill();
    } else if (type === 'globe') {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.7, 0, TAU);
      ctx.fillStyle = 'rgba(210,210,190,0.15)';
      ctx.strokeStyle = 'rgba(210,210,190,0.5)';
      ctx.lineWidth = 0.8;
      ctx.fill();
      ctx.stroke();
      const dots = 20;
      for (let i = 0; i < dots; i++) {
        const a = (i / dots) * TAU;
        const r = s * 0.55;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.5, 0, TAU);
        ctx.fillStyle = 'rgba(230,230,210,0.7)';
        ctx.fill();
      }
    } else if (type === 'bush') {
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(x + i * s * 0.4, y + Math.abs(i) * s * 0.15, s * 0.5, 0, TAU);
        ctx.fillStyle = 'rgba(30,90,40,0.55)';
        ctx.fill();
      }
    }
  }
}

// ─── Cloud ───────────────────────────────────────────────────────────────────
class Cloud {
  w: number;
  h: number;
  x: number = 0;
  y: number = 0;
  vx: number = 0;
  scale: number = 0;
  alpha: number = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.reset(true);
  }
  reset(init: boolean) {
    this.x = init ? rand(0, this.w) : -300;
    this.y = rand(this.h * 0.05, this.h * 0.38);
    this.vx = rand(0.05, 0.18);
    this.scale = rand(0.6, 1.4);
    this.alpha = rand(0.04, 0.13);
  }
  update() {
    this.x += this.vx;
    if (this.x > this.w + 300) this.reset(false);
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale * 0.6);
    const blobs: [number, number, number][] = [
      [0, 0, 80],
      [-70, 15, 55],
      [70, 15, 55],
      [-35, -20, 50],
      [35, -20, 50],
      [0, -30, 45],
    ];
    blobs.forEach(([bx, by, br]) => {
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, TAU);
      ctx.fillStyle = '#1a6655';
      ctx.fill();
    });
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

// ─── Ground glow ─────────────────────────────────────────────────────────────
function drawGroundGlow(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number, t: number) {
  const pulse = 0.85 + 0.15 * Math.sin(t * 0.012 * 60);
  const grd = ctx.createRadialGradient(w * 0.5, groundY, 10, w * 0.5, groundY, w * 0.32);
  grd.addColorStop(0, `rgba(180,255,200,${0.22 * pulse})`);
  grd.addColorStop(0.4, `rgba(100,200,140,${0.08 * pulse})`);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, groundY - h * 0.1, w, h * 0.25);
}

// ─── Sky gradient ────────────────────────────────────────────────────────────
function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number) {
  const grd = ctx.createLinearGradient(0, 0, 0, groundY);
  grd.addColorStop(0, SKY_TOP);
  grd.addColorStop(0.5, SKY_MID);
  grd.addColorStop(0.85, SKY_GLOW);
  grd.addColorStop(1, '#062e1e');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, groundY);
}

// ─── Ground ──────────────────────────────────────────────────────────────────
function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number) {
  const grd = ctx.createLinearGradient(0, groundY, 0, h);
  grd.addColorStop(0, '#0a2010');
  grd.addColorStop(0.3, '#071508');
  grd.addColorStop(1, GROUND);
  ctx.fillStyle = grd;
  ctx.fillRect(0, groundY, w, h - groundY);

  // bumpy silhouette
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const px = (i / steps) * w;
    const py = groundY + Math.sin(i * 0.7) * 6 + Math.sin(i * 1.3) * 4;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = '#061208';
  ctx.fill();
}

// ─── Scene state type ────────────────────────────────────────────────────────
interface SceneState {
  groundY: number;
  stars: Star[];
  seeds: Seed[];
  flies: Firefly[];
  clouds: Cloud[];
  plants: Plant[];
}

// ─── Main component ──────────────────────────────────────────────────────────
interface EnchantedGardenBgProps {
  children?: React.ReactNode;
}

export function EnchantedGardenBg({ children }: EnchantedGardenBgProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SceneState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    let t = 0;

    function buildScene(w: number, h: number): SceneState {
      const groundY = h * 0.62;

      // Stars
      const stars = Array.from({ length: 90 }, () => new Star(w, h));

      // Seeds
      const seeds = Array.from({ length: 28 }, () => new Seed(w, h));

      // Fireflies
      const flies = Array.from({ length: 18 }, () => new Firefly(w, h));

      // Clouds
      const clouds = Array.from({ length: 5 }, () => new Cloud(w, h));

      // Plants
      const plantConfigs: (PlantConfig & { x: number; height: number })[] = [
        // tall spiky orange (left)
        { x: 0.1, height: 0.42, headType: 'spiky', headColor: 'rgba(220,120,30,0.9)', headSize: 16, stemWidth: 2, swayAmp: 3 },
        { x: 0.13, height: 0.38, headType: 'spiky', headColor: 'rgba(200,100,20,0.85)', headSize: 12, stemWidth: 1.5, swayAmp: 2.5 },
        // globe/dandelion left
        { x: 0.08, height: 0.48, headType: 'globe', headColor: 'rgba(210,210,190,0.7)', headSize: 18, stemWidth: 1.2, swayAmp: 4 },
        { x: 0.18, height: 0.52, headType: 'dandelion', headSize: 20, stemWidth: 1, swayAmp: 4.5 },
        // tall center-left white glowing
        { x: 0.3, height: 0.55, headType: 'daisy', headColor: 'rgba(240,255,240,0.95)', headSize: 14, stemWidth: 1.5, swayAmp: 2 },
        { x: 0.34, height: 0.48, headType: 'daisy', headColor: 'rgba(255,255,255,0.9)', headSize: 10, stemWidth: 1.2, swayAmp: 2.5 },
        // center
        { x: 0.5, height: 0.58, headType: 'daisy', headColor: 'rgba(255,255,255,0.95)', headSize: 13, stemWidth: 1.5, swayAmp: 1.8 },
        { x: 0.45, height: 0.38, headType: 'globe', headColor: 'rgba(200,200,180,0.6)', headSize: 15, stemWidth: 1, swayAmp: 3 },
        { x: 0.55, height: 0.44, headType: 'daisy', headColor: 'rgba(240,250,240,0.85)', headSize: 11, stemWidth: 1.2, swayAmp: 2.2 },
        // right cluster
        { x: 0.65, height: 0.5, headType: 'daisy', headColor: 'rgba(255,255,255,0.9)', headSize: 16, stemWidth: 1.8, swayAmp: 2 },
        { x: 0.7, height: 0.38, headType: 'daisy', headColor: 'rgba(230,245,230,0.8)', headSize: 10, stemWidth: 1.2, swayAmp: 3 },
        { x: 0.78, height: 0.46, headType: 'bush', headSize: 18, stemWidth: 2.5, swayAmp: 1.5 },
        { x: 0.85, height: 0.52, headType: 'bush', headSize: 22, stemWidth: 2.8, swayAmp: 1.2 },
        { x: 0.92, height: 0.36, headType: 'spiky', headColor: 'rgba(180,200,150,0.7)', headSize: 14, stemWidth: 1.5, swayAmp: 2.5 },
        // extra filler
        { x: 0.22, height: 0.3, headType: 'daisy', headColor: 'rgba(255,255,220,0.7)', headSize: 8, stemWidth: 1, swayAmp: 3.5 },
        { x: 0.4, height: 0.32, headType: 'dandelion', headSize: 12, stemWidth: 0.8, swayAmp: 5 },
        { x: 0.6, height: 0.28, headType: 'globe', headSize: 10, stemWidth: 0.8, swayAmp: 4 },
        { x: 0.75, height: 0.35, headType: 'daisy', headColor: 'rgba(255,250,230,0.75)', headSize: 9, stemWidth: 1, swayAmp: 3 },
        { x: 0.04, height: 0.6, headType: 'bush', headSize: 24, stemWidth: 3, swayAmp: 1 },
        { x: 0.96, height: 0.6, headType: 'bush', headSize: 26, stemWidth: 3.2, swayAmp: 1 },
      ];

      const plants = plantConfigs.map(
        (cfg) =>
          new Plant(cfg.x * w, groundY, h, {
            ...cfg,
            height: cfg.height * h,
            color: STEM,
          })
      );

      return { groundY, stars, seeds, flies, clouds, plants };
    }

    function resize() {
      if (!canvas || !ctx) return;
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      stateRef.current = buildScene(w, h);
    }

    resize();
    window.addEventListener('resize', resize);

    function loop() {
      if (!canvas || !ctx || !stateRef.current) return;

      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const { groundY, stars, seeds, flies, clouds, plants } = stateRef.current;

      ctx.clearRect(0, 0, w, h);

      // Sky
      drawSky(ctx, w, h, groundY);

      // Clouds
      clouds.forEach((c) => {
        c.update();
        c.draw(ctx);
      });

      // Stars
      stars.forEach((s) => s.draw(ctx, t));

      // Ground glow
      drawGroundGlow(ctx, w, h, groundY, t);

      // Ground
      drawGround(ctx, w, h, groundY);

      // Plants (back layer — slightly dim)
      ctx.globalAlpha = 0.55;
      plants.slice(0, 8).forEach((p) => p.draw(ctx, t));
      ctx.globalAlpha = 1;

      // Plants (front layer)
      plants.slice(8).forEach((p) => p.draw(ctx, t));

      // Fireflies
      flies.forEach((f) => {
        f.update();
        f.draw(ctx);
      });

      // Seeds
      seeds.forEach((s) => {
        s.update();
        s.draw(ctx);
      });

      t++;
      raf = requestAnimationFrame(loop);
    }

    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="relative w-full min-h-[100dvh] overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'block' }} />
      {children && (
        <div className="relative z-10 flex items-center justify-center w-full min-h-[100dvh] p-4">{children}</div>
      )}
    </div>
  );
}

export default EnchantedGardenBg;
