'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { AvatarDisplay } from '@/components/ui/avatar-display';

interface AgentPodProps {
  readonly id: string;
  readonly name: string;
  readonly avatar: string;
  readonly role?: string;
  readonly isActive?: boolean;
  readonly isSpeaking?: boolean;
  readonly index?: number;
  readonly onClick?: () => void;
}

function AgentPodComponent({
  id,
  name,
  avatar,
  role,
  isActive = false,
  isSpeaking = false,
  index = 0,
  onClick,
}: AgentPodProps) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        y: 0,
        // Subtle floating animation
        translateY: isSpeaking ? [0, -4, 0] : 0,
      }}
      transition={{
        opacity: { duration: 0.4, delay: index * 0.1 },
        scale: { duration: 0.4, delay: index * 0.1 },
        y: { duration: 0.4, delay: index * 0.1 },
        translateY: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
      }}
      onClick={onClick}
      className={cn(
        'relative group cursor-pointer',
        'transition-all duration-300',
      )}
    >
      {/* Outer glow ring */}
      <motion.div
        className={cn(
          'absolute -inset-1.5 rounded-full',
          'bg-gradient-to-r',
          isSpeaking 
            ? 'from-cyan-500/40 via-violet-500/40 to-cyan-500/40' 
            : isActive 
              ? 'from-cyan-500/20 via-transparent to-cyan-500/20'
              : 'from-transparent via-transparent to-transparent',
        )}
        animate={isSpeaking ? {
          rotate: [0, 360],
          scale: [1, 1.1, 1],
        } : {}}
        transition={{
          rotate: { duration: 3, repeat: Infinity, ease: 'linear' },
          scale: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
        }}
        style={{ filter: 'blur(4px)' }}
      />

      {/* Glass pod container */}
      <div
        className={cn(
          'relative w-14 h-14 rounded-full',
          'backdrop-blur-xl',
          'border',
          isSpeaking 
            ? 'border-cyan-400/60 shadow-[0_0_20px_rgba(0,217,255,0.4)]' 
            : isActive
              ? 'border-cyan-400/30 shadow-[0_0_15px_rgba(0,217,255,0.2)]'
              : 'border-white/10 shadow-[0_0_10px_rgba(0,0,0,0.3)]',
          'bg-slate-800/60',
          'transition-all duration-300',
          'group-hover:border-cyan-400/40 group-hover:shadow-[0_0_20px_rgba(0,217,255,0.3)]',
        )}
      >
        {/* Avatar */}
        <div className="absolute inset-1 rounded-full overflow-hidden">
          <AvatarDisplay src={avatar} alt={name} />
        </div>

        {/* Speaking indicator - animated ring */}
        {isSpeaking && (
          <motion.div
            className="absolute -inset-0.5 rounded-full border-2 border-cyan-400"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.8, 0.3, 0.8],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        {/* Active indicator dot */}
        {(isActive || isSpeaking) && (
          <motion.div
            className={cn(
              'absolute -bottom-0.5 left-1/2 -translate-x-1/2',
              'w-2 h-2 rounded-full',
              isSpeaking ? 'bg-cyan-400' : 'bg-green-400',
            )}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [1, 0.7, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </div>

      {/* Name label */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 + 0.2 }}
        className={cn(
          'absolute -bottom-6 left-1/2 -translate-x-1/2',
          'px-2 py-0.5 rounded-full',
          'bg-slate-800/80 backdrop-blur-sm',
          'border border-white/5',
          'text-[10px] font-mono tracking-wide',
          isSpeaking ? 'text-cyan-300' : 'text-slate-400',
          'whitespace-nowrap',
          'opacity-0 group-hover:opacity-100',
          'transition-opacity duration-200',
        )}
      >
        {name}
      </motion.div>

      {/* Role badge */}
      {role && (
        <div
          className={cn(
            'absolute -top-1 -right-1',
            'w-4 h-4 rounded-full',
            'flex items-center justify-center',
            'bg-violet-500/80 backdrop-blur-sm',
            'border border-violet-400/50',
            'text-[8px] font-bold text-white',
          )}
        >
          {role.charAt(0).toUpperCase()}
        </div>
      )}
    </motion.div>
  );
}

export const AgentPod = memo(AgentPodComponent);
