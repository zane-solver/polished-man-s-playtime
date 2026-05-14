import { useParticleBurst } from '@/hooks/useParticleBurst';
import { CSSProperties } from 'react';

export function ParticleBurstDemo() {
  const { containerRef, handleClick } = useParticleBurst({
    count: 12,
    duration: 0.8,
    spread: 360,
    velocity: 300,
    color: '#C8A96A', // golden
    size: 4,
  });

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100vh',
    overflow: 'hidden',
    cursor: 'pointer',
    background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f1e 100%)',
  };

  const textStyle: CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#C8A96A',
    fontSize: '2rem',
    fontWeight: 'bold',
    textAlign: 'center',
    pointerEvents: 'none',
    userSelect: 'none',
  };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onClick={(e) => handleClick(e as any)}
    >
      <div style={textStyle}>
        <p>✨ Click anywhere for golden particle effect</p>
      </div>
    </div>
  );
}
