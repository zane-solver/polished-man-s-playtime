import { useEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';

interface ParticleConfig {
  count?: number;
  duration?: number;
  spread?: number;
  velocity?: number;
  color?: string;
  size?: number;
}

export function useParticleBurst(config: ParticleConfig = {}) {
  const {
    count = 12,
    duration = 0.8,
    spread = 360,
    velocity = 300,
    color = '#C8A96A', // golden
    size = 4,
  } = config;

  const containerRef = useRef<HTMLDivElement | null>(null);

  const createParticles = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e as any).clientX - rect.left;
    const y = (e as any).clientY - rect.top;

    // Create particle container
    const particleContainer = document.createElement('div');
    particleContainer.style.position = 'absolute';
    particleContainer.style.left = `${x}px`;
    particleContainer.style.top = `${y}px`;
    particleContainer.style.pointerEvents = 'none';
    containerRef.current.appendChild(particleContainer);

    // Generate particles
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * spread * (Math.PI / 180);
      const particle = document.createElement('div');
      
      particle.style.position = 'absolute';
      particle.style.left = '0px';
      particle.style.top = '0px';
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.borderRadius = '50%';
      particle.style.backgroundColor = color;
      particle.style.boxShadow = `0 0 ${size * 2}px ${color}`;
      particle.style.opacity = '1';
      particle.style.pointerEvents = 'none';

      particleContainer.appendChild(particle);

      // Calculate trajectory
      const vx = Math.cos(angle) * velocity;
      const vy = Math.sin(angle) * velocity;

      // Animate particle
      gsap.to(particle, {
        x: vx * duration,
        y: vy * duration,
        opacity: 0,
        duration,
        ease: 'power2.out',
        onComplete: () => {
          particle.remove();
        },
      });
    }

    // Clean up container after animation
    gsap.delayedCall(duration, () => {
      if (particleContainer.children.length === 0) {
        particleContainer.remove();
      }
    });
  }, [count, duration, spread, velocity, color, size]);

  const handleClick = useCallback((e: MouseEvent) => {
    createParticles(e);
  }, [createParticles]);

  return {
    containerRef,
    handleClick,
  };
}
