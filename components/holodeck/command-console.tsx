'use client';

import { ReactNode, memo } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface CommandConsoleProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly visible?: boolean;
}

function CommandConsoleComponent({ children, className, visible = true }: CommandConsoleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={visible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 30, scale: 0.95 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative',
        'px-1 py-1',
        'rounded-full',
        'backdrop-blur-2xl',
        'bg-slate-900/70',
        'border border-white/10',
        'shadow-[0_8px_40px_rgba(0,0,0,0.4),0_0_20px_rgba(0,217,255,0.1)]',
        className
      )}
    >
      {/* Inner glow border */}
      <div className="absolute inset-0 rounded-full pointer-events-none">
        <div className="absolute inset-0 rounded-full border border-cyan-500/10" />
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(180deg, rgba(0,217,255,0.05) 0%, transparent 50%)',
          }}
        />
      </div>

      {/* Corner indicators */}
      <div className="absolute top-1/2 -translate-y-1/2 -left-2 w-1 h-8 rounded-full bg-gradient-to-b from-cyan-500/50 to-transparent" />
      <div className="absolute top-1/2 -translate-y-1/2 -right-2 w-1 h-8 rounded-full bg-gradient-to-b from-cyan-500/50 to-transparent" />

      {/* Content */}
      <div className="relative z-10 flex items-center gap-1">
        {children}
      </div>

      {/* Ambient glow underneath */}
      <div 
        className="absolute -bottom-4 left-1/4 right-1/4 h-8 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0,217,255,0.15) 0%, transparent 70%)',
          filter: 'blur(8px)',
        }}
      />
    </motion.div>
  );
}

export const CommandConsole = memo(CommandConsoleComponent);

// Subcomponent for console buttons
interface ConsoleButtonProps {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly variant?: 'default' | 'primary' | 'danger';
  readonly className?: string;
  readonly title?: string;
}

function ConsoleButtonComponent({
  children,
  onClick,
  active = false,
  disabled = false,
  variant = 'default',
  className,
  title,
}: ConsoleButtonProps) {
  const variantStyles = {
    default: {
      base: 'text-slate-400 hover:text-white',
      active: 'text-cyan-400 bg-cyan-500/20',
    },
    primary: {
      base: 'text-cyan-400 hover:text-cyan-300',
      active: 'text-cyan-300 bg-cyan-500/30',
    },
    danger: {
      base: 'text-red-400 hover:text-red-300',
      active: 'text-red-300 bg-red-500/30',
    },
  };

  const style = variantStyles[variant];

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      title={title}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'relative',
        'w-9 h-9 rounded-full',
        'flex items-center justify-center',
        'transition-all duration-200',
        disabled 
          ? 'text-slate-600 cursor-not-allowed opacity-50' 
          : active 
            ? style.active 
            : style.base,
        'hover:bg-white/5',
        className
      )}
    >
      {children}
      
      {/* Active indicator */}
      {active && !disabled && (
        <motion.div
          layoutId="console-active"
          className="absolute inset-0 rounded-full border border-cyan-500/30"
          transition={{ duration: 0.2 }}
        />
      )}
    </motion.button>
  );
}

export const ConsoleButton = memo(ConsoleButtonComponent);

// Divider component
export function ConsoleDivider() {
  return <div className="w-px h-6 bg-white/10 mx-1" />;
}
