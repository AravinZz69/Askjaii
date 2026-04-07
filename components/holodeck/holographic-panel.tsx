'use client';

import { ReactNode, memo } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface HolographicPanelProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly title?: string;
  readonly variant?: 'primary' | 'secondary' | 'accent';
  readonly animate?: boolean;
  readonly delay?: number;
  readonly isActive?: boolean;
}

function HolographicPanelComponent({
  children,
  className,
  title,
  variant = 'primary',
  animate = true,
  delay = 0,
  isActive = false,
}: HolographicPanelProps) {
  const variantStyles = {
    primary: {
      border: 'border-cyan-500/30',
      glow: 'shadow-[0_0_30px_rgba(0,217,255,0.1),inset_0_0_30px_rgba(0,217,255,0.05)]',
      activeGlow: 'shadow-[0_0_40px_rgba(0,217,255,0.25),inset_0_0_40px_rgba(0,217,255,0.1)]',
      titleColor: 'text-cyan-400',
      bg: 'bg-slate-900/60',
    },
    secondary: {
      border: 'border-violet-500/30',
      glow: 'shadow-[0_0_30px_rgba(139,92,246,0.1),inset_0_0_30px_rgba(139,92,246,0.05)]',
      activeGlow: 'shadow-[0_0_40px_rgba(139,92,246,0.25),inset_0_0_40px_rgba(139,92,246,0.1)]',
      titleColor: 'text-violet-400',
      bg: 'bg-slate-900/60',
    },
    accent: {
      border: 'border-pink-500/30',
      glow: 'shadow-[0_0_30px_rgba(255,0,110,0.1),inset_0_0_30px_rgba(255,0,110,0.05)]',
      activeGlow: 'shadow-[0_0_40px_rgba(255,0,110,0.25),inset_0_0_40px_rgba(255,0,110,0.1)]',
      titleColor: 'text-pink-400',
      bg: 'bg-slate-900/60',
    },
  };

  const style = variantStyles[variant];

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 20, scale: 0.95 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative rounded-2xl overflow-hidden backdrop-blur-xl',
        style.bg,
        style.border,
        'border',
        isActive ? style.activeGlow : style.glow,
        'transition-shadow duration-500',
        className
      )}
    >
      {/* Holographic scan line effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
          animate={{ y: ['0%', '100%', '0%'] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-cyan-500/50 rounded-tl-lg" />
      <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-cyan-500/50 rounded-tr-lg" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-cyan-500/50 rounded-bl-lg" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-cyan-500/50 rounded-br-lg" />

      {/* Title bar */}
      {title && (
        <div className="absolute top-0 left-0 right-0 px-4 py-2 border-b border-white/5">
          <span className={cn('text-xs font-mono tracking-wider uppercase', style.titleColor)}>
            {title}
          </span>
        </div>
      )}

      {/* Content */}
      <div className={cn('relative z-10', title ? 'pt-10' : '')}>
        {children}
      </div>

      {/* Breathing border effect */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          boxShadow: isActive
            ? `0 0 20px rgba(0,217,255,0.3), inset 0 0 20px rgba(0,217,255,0.1)`
            : 'none',
        }}
        animate={isActive ? { opacity: [0.5, 1, 0.5] } : { opacity: 0 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}

export const HolographicPanel = memo(HolographicPanelComponent);
