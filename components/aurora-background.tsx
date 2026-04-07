'use client';

import { useEffect, useState, useRef } from 'react';

export function AuroraBackground() {
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setMounted(true);
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.75;
    }
  }, []);

  if (!mounted) {
    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute inset-0 bg-[#0a0f1a]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 gpu-layer">
      {/* ═══ Local Video Background (GPU-Accelerated) ═══ */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover transform-gpu"
        style={{
          willChange: 'transform',
          transform: 'translateZ(0)',
        }}
      >
        <source src="/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4" type="video/mp4" />
      </video>

      {/* ═══ Dark Overlay (GPU-Accelerated) ═══ */}
      <div className="absolute inset-0 bg-black/40 transform-gpu" />
    </div>
  );
}
