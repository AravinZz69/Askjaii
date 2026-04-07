'use client';

import { memo, useMemo } from 'react';
import { motion } from 'motion/react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

interface ParticleFieldProps {
  readonly count?: number;
  readonly className?: string;
}

function ParticleFieldComponent({ count = 50, className = '' }: ParticleFieldProps) {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 20 + 30,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.3 + 0.1,
    }));
  }, [count]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none gpu-layer ${className}`}>
      {/* Geometric grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.03] transform-gpu">
        <defs>
          <pattern id="holodeck-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-cyan-400"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#holodeck-grid)" />
      </svg>

      {/* Floating particles (GPU-accelerated) */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full transform-gpu"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, rgba(0,217,255,${p.opacity}) 0%, transparent 70%)`,
            willChange: 'transform, opacity',
          }}
          animate={{
            x: [0, Math.random() * 100 - 50, Math.random() * 100 - 50, 0],
            y: [0, Math.random() * 100 - 50, Math.random() * 100 - 50, 0],
            opacity: [p.opacity, p.opacity * 1.5, p.opacity * 0.5, p.opacity],
            scale: [1, 1.2, 0.8, 1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}

      {/* Ambient glow orbs (GPU-accelerated) */}
      <motion.div
        className="absolute w-96 h-96 rounded-full opacity-20 transform-gpu"
        style={{
          background: 'radial-gradient(circle, rgba(0,217,255,0.15) 0%, transparent 70%)',
          left: '10%',
          top: '20%',
          filter: 'blur(60px)',
          willChange: 'transform',
        }}
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -50, 100, 0],
          scale: [1, 1.3, 0.9, 1],
        }}
        transition={{
          duration: 45,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      <motion.div
        className="absolute w-80 h-80 rounded-full opacity-15 transform-gpu"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
          right: '15%',
          bottom: '30%',
          filter: 'blur(50px)',
          willChange: 'transform',
        }}
        animate={{
          x: [0, -80, 60, 0],
          y: [0, 80, -40, 0],
          scale: [1, 0.8, 1.2, 1],
        }}
        transition={{
          duration: 50,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
}

export const ParticleField = memo(ParticleFieldComponent);
