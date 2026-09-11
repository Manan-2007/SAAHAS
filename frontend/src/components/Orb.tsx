import { motion, Variants } from 'motion/react';
import { useEffect, useState } from 'react';

// Adapted from reference/orb (self-contained; no Gemini Live dependency).
// Re-skinned from the original purple/blue palette into the SAAHAS calm-teal
// language so the listening orb feels like part of the sanctuary.
export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'confused' | 'happy';

interface OrbProps {
  state: OrbState;
  /** 0-255, drives the listening pulse. */
  micVolume?: number;
  /** 0-255, drives the speaking pulse. */
  speakerVolume?: number;
  /** Overall pixel size of the orb container (default 224). */
  size?: number;
}

export function Orb({ state, micVolume = 0, speakerVolume = 0, size = 224 }: OrbProps) {
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    if (state !== 'idle' && state !== 'listening') return;

    let timeout: number;
    const scheduleBlink = () => {
      timeout = window.setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
        scheduleBlink();
      }, Math.random() * 3000 + 3000);
    };

    scheduleBlink();
    return () => clearTimeout(timeout);
  }, [state]);

  const containerVariants: Variants = {
    idle: {
      y: [0, -12, 0],
      scale: 1,
      rotate: 0,
      transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
    },
    listening: {
      y: 0,
      scale: 1.05 + (micVolume / 255) * 0.1,
      rotate: 0,
      transition: { type: 'spring', stiffness: 100, damping: 10 },
    },
    thinking: {
      y: [0, -5, 0],
      scale: 1,
      rotate: 0,
      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
    },
    speaking: {
      y: 0,
      scale: 1 + (speakerVolume / 255) * 0.15,
      rotate: 0,
      transition: { type: 'spring', stiffness: 200, damping: 15 },
    },
    confused: {
      y: 0,
      scale: 1,
      rotate: [-4, 4, -4, 4, 0],
      transition: { duration: 0.5, ease: 'easeInOut' },
    },
    happy: {
      y: [0, -16, 0],
      scale: 1.08,
      rotate: 0,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  };

  const leftEyeVariants: Variants = {
    idle: { scaleY: isBlinking ? 0.1 : 1, scaleX: 1, y: 0, x: 0, rotate: 0 },
    listening: { scaleY: isBlinking ? 0.1 : 1.2, scaleX: 1.1, y: 0, x: 0, rotate: 0 },
    thinking: { scaleY: 1, scaleX: 1, y: -8, x: 8, rotate: 0 },
    speaking: { scaleY: 1 + (speakerVolume / 255) * 0.2, scaleX: 1, y: 0, x: 0, rotate: 0 },
    confused: { scaleY: 0.8, scaleX: 1, y: 0, x: 0, rotate: 15 },
    happy: { scaleY: 1.3, scaleX: 1.2, y: -4, x: 0, rotate: 0 },
  };

  const rightEyeVariants: Variants = {
    idle: { scaleY: isBlinking ? 0.1 : 1, scaleX: 1, y: 0, x: 0, rotate: 0 },
    listening: { scaleY: isBlinking ? 0.1 : 1.2, scaleX: 1.1, y: 0, x: 0, rotate: 0 },
    thinking: { scaleY: 1, scaleX: 1, y: -8, x: 8, rotate: 0 },
    speaking: { scaleY: 1 + (speakerVolume / 255) * 0.2, scaleX: 1, y: 0, x: 0, rotate: 0 },
    confused: { scaleY: 0.5, scaleX: 1, y: 0, x: 0, rotate: -10 },
    happy: { scaleY: 1.3, scaleX: 1.2, y: -4, x: 0, rotate: 0 },
  };

  // Warm sand/clay glow palette (voice_emotion inspired).
  const getGlow = () => {
    const idleColor = 'rgba(156, 103, 67, 0.38)'; // warm sienna
    const listeningColor = 'rgba(200, 169, 126, 0.62)'; // sand
    const speakingColor = 'rgba(179, 101, 74, 0.58)'; // terracotta
    const confusedColor = 'rgba(154, 91, 19, 0.42)'; // muted amber
    const happyColor = 'rgba(231, 211, 181, 0.72)'; // pale sand

    let color = idleColor;
    let glowSize = 40;

    switch (state) {
      case 'listening':
        color = listeningColor;
        glowSize = 50 + (micVolume / 255) * 40;
        break;
      case 'speaking':
        color = speakingColor;
        glowSize = 60 + (speakerVolume / 255) * 50;
        break;
      case 'thinking':
        color = idleColor;
        glowSize = 45;
        break;
      case 'confused':
        color = confusedColor;
        glowSize = 30;
        break;
      case 'happy':
        color = happyColor;
        glowSize = 80;
        break;
      default:
        glowSize = 40;
    }

    return `0 0 ${glowSize}px ${glowSize / 2}px ${color}, inset 0 0 ${glowSize / 2}px ${color}`;
  };

  const bodyPx = Math.round(size * 0.75);
  const eyeW = Math.max(3, Math.round(size * 0.014));
  const eyeH = Math.round(size * 0.055);
  const eyeGap = Math.round(size * 0.13);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Aura / Glow */}
      <motion.div
        className="absolute inset-0 rounded-full blur-xl"
        animate={{
          boxShadow: getGlow(),
          rotate: state === 'thinking' ? 360 : 0,
        }}
        transition={{
          boxShadow: { type: 'spring', stiffness: 50, damping: 10 },
          rotate: { duration: 3, repeat: Infinity, ease: 'linear' },
        }}
      />

      {/* Main Orb Body */}
      <motion.div
        variants={containerVariants}
        animate={state}
        className="relative rounded-full backdrop-blur-md border border-white/40 shadow-2xl overflow-hidden flex items-center justify-center"
        style={{
          width: bodyPx,
          height: bodyPx,
          gap: eyeGap,
          background:
            state === 'thinking'
              ? 'conic-gradient(from 0deg, rgba(236,220,191,0.9), rgba(217,191,151,0.9), rgba(179,101,74,0.9), rgba(236,220,191,0.9))'
              : 'linear-gradient(135deg, #ecdcbf 0%, #d9bf97 45%, #b3654a 100%)',
        }}
      >
        {/* Glassy reflection */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/10 to-white/35 pointer-events-none" />
        <div className="absolute top-4 left-8 w-16 h-8 bg-white/40 rounded-full blur-md transform -rotate-45 pointer-events-none" />

        {/* Left Eye */}
        <motion.div
          variants={leftEyeVariants}
          animate={state}
          className="rounded-full bg-[#3a2c1e] shadow-[0_0_10px_rgba(0,51,46,0.35)]"
          style={{ width: eyeW, height: eyeH }}
        />

        {/* Right Eye */}
        <motion.div
          variants={rightEyeVariants}
          animate={state}
          className="rounded-full bg-[#3a2c1e] shadow-[0_0_10px_rgba(0,51,46,0.35)]"
          style={{ width: eyeW, height: eyeH }}
        />
      </motion.div>
    </div>
  );
}
