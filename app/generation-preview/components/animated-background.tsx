'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface AnimatedBackgroundProps {
  isGenerating: boolean;
  children: React.ReactNode;
}

/**
 * AnimatedBackground - A "lava lamp" style animated background for the generation preview page.
 * 
 * Features:
 * - 4 floating orbs with pastel colors (cyan, purple, mint, rose)
 * - Organic "liquid" movement with morphing border-radius
 * - Glass overlay with heavy backdrop blur for soft cloud effect
 * - Conditional animation: active during generation, dims when complete/error
 * - GPU-accelerated with will-change-transform for 60fps performance
 */
export function AnimatedBackground({ isGenerating, children }: AnimatedBackgroundProps) {
  // Common transition for when generation stops
  const slowDownTransition = {
    duration: 2,
    ease: 'easeOut' as const,
  };

  return (
    <div 
      className="min-h-[100dvh] w-full relative overflow-hidden"
      style={{
        background: `linear-gradient(
          135deg,
          hsl(210deg 100% 95%) 0%,
          hsl(220deg 100% 96%) 25%,
          hsl(250deg 100% 97%) 50%,
          hsl(180deg 100% 96%) 75%,
          hsl(150deg 100% 94%) 100%
        )`,
      }}
    >
      {/* ═══ Floating Orbs Layer ═══ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        
        {/* Orb 1: Soft Cyan - Top Left */}
        <motion.div
          className="absolute will-change-transform"
          style={{
            width: 600,
            height: 600,
            left: '-5%',
            top: '-10%',
            background: 'rgba(103, 232, 249, 0.4)', // cyan-300
            filter: 'blur(120px)',
          }}
          animate={isGenerating ? {
            x: [0, 120, 60, 0],
            y: [0, 80, -40, 0],
            scale: [1, 1.15, 0.95, 1],
            borderRadius: [
              '40% 60% 70% 30% / 40% 50% 60% 50%',
              '50% 60% 30% 70% / 60% 40% 70% 40%',
              '60% 40% 50% 50% / 40% 60% 50% 60%',
              '40% 60% 70% 30% / 40% 50% 60% 50%',
            ],
          } : {
            x: 60,
            y: 40,
            scale: 1,
            borderRadius: '50% 50% 50% 50%',
          }}
          transition={isGenerating ? {
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          } : slowDownTransition}
        />

        {/* Orb 2: Pale Purple - Top Right */}
        <motion.div
          className="absolute will-change-transform"
          style={{
            width: 550,
            height: 550,
            right: '-8%',
            top: '5%',
            background: 'rgba(196, 181, 253, 0.45)', // violet-300
            filter: 'blur(100px)',
          }}
          animate={isGenerating ? {
            x: [0, -100, -50, 0],
            y: [0, 60, 120, 0],
            scale: [1, 0.9, 1.1, 1],
            borderRadius: [
              '60% 40% 30% 70% / 50% 60% 40% 50%',
              '40% 60% 70% 30% / 60% 40% 60% 40%',
              '50% 50% 50% 50% / 50% 50% 50% 50%',
              '60% 40% 30% 70% / 50% 60% 40% 50%',
            ],
          } : {
            x: -50,
            y: 60,
            scale: 1,
            borderRadius: '50% 50% 50% 50%',
          }}
          transition={isGenerating ? {
            duration: 22,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          } : slowDownTransition}
        />

        {/* Orb 3: Mint Green - Bottom Left */}
        <motion.div
          className="absolute will-change-transform"
          style={{
            width: 500,
            height: 500,
            left: '10%',
            bottom: '-15%',
            background: 'rgba(167, 243, 208, 0.4)', // emerald-200
            filter: 'blur(110px)',
          }}
          animate={isGenerating ? {
            x: [0, 80, -60, 0],
            y: [0, -100, -50, 0],
            scale: [1, 1.2, 0.85, 1],
            borderRadius: [
              '30% 70% 70% 30% / 30% 30% 70% 70%',
              '70% 30% 30% 70% / 70% 70% 30% 30%',
              '50% 50% 70% 30% / 50% 70% 30% 50%',
              '30% 70% 70% 30% / 30% 30% 70% 70%',
            ],
          } : {
            x: 40,
            y: -50,
            scale: 1,
            borderRadius: '50% 50% 50% 50%',
          }}
          transition={isGenerating ? {
            duration: 28,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 4,
          } : slowDownTransition}
        />

        {/* Orb 4: Soft Rose - Bottom Right */}
        <motion.div
          className="absolute will-change-transform"
          style={{
            width: 450,
            height: 450,
            right: '15%',
            bottom: '5%',
            background: 'rgba(253, 164, 175, 0.35)', // rose-300
            filter: 'blur(100px)',
          }}
          animate={isGenerating ? {
            x: [0, -70, 40, 0],
            y: [0, -80, 30, 0],
            scale: [1, 1.1, 0.9, 1],
            borderRadius: [
              '50% 50% 30% 70% / 70% 30% 70% 30%',
              '30% 70% 50% 50% / 30% 70% 30% 70%',
              '70% 30% 70% 30% / 50% 50% 50% 50%',
              '50% 50% 30% 70% / 70% 30% 70% 30%',
            ],
          } : {
            x: -30,
            y: -40,
            scale: 1,
            borderRadius: '50% 50% 50% 50%',
          }}
          transition={isGenerating ? {
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          } : slowDownTransition}
        />
      </div>

      {/* ═══ Glass Overlay - Creates soft cloud effect ═══ */}
      <motion.div 
        className="fixed inset-0 pointer-events-none"
        style={{
          backdropFilter: 'blur(100px)',
          WebkitBackdropFilter: 'blur(100px)',
        }}
        animate={{
          opacity: isGenerating ? 1 : 0.85,
        }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      />

      {/* ═══ Dimming overlay when generation stops ═══ */}
      <motion.div 
        className="fixed inset-0 pointer-events-none bg-white"
        animate={{
          opacity: isGenerating ? 0 : 0.3,
        }}
        transition={{ duration: 2, ease: 'easeOut' }}
      />

      {/* ═══ Content Layer ═══ */}
      <div className="relative z-10 min-h-[100dvh] w-full flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}

export default AnimatedBackground;
