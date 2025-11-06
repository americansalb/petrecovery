'use client';

import { useMode } from '../contexts/ModeContext';
import { theme } from '../lib/theme';

export default function ModeSwitcher() {
  const { mode, switchMode } = useMode();

  const containerStyle = {
    display: 'inline-flex',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(10px)',
    borderRadius: theme.radius.full,
    padding: '4px',
    boxShadow: theme.shadows.sm,
    border: '1px solid rgba(255, 255, 255, 0.5)',
  };

  const buttonBaseStyle = {
    padding: '10px 24px',
    borderRadius: theme.radius.full,
    border: 'none',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const getButtonStyle = (buttonMode) => {
    const isActive = mode === buttonMode;

    if (buttonMode === 'pet-owner') {
      return {
        ...buttonBaseStyle,
        background: isActive ? theme.gradients.sunset : 'transparent',
        color: isActive ? 'white' : theme.colors.gray[700],
        boxShadow: isActive ? '0 4px 12px rgba(250, 112, 154, 0.4)' : 'none',
      };
    } else {
      return {
        ...buttonBaseStyle,
        background: isActive ? theme.gradients.ocean : 'transparent',
        color: isActive ? 'white' : theme.colors.gray[700],
        boxShadow: isActive ? '0 4px 12px rgba(102, 126, 234, 0.4)' : 'none',
      };
    }
  };

  return (
    <div style={containerStyle}>
      <button
        onClick={() => switchMode('pet-owner')}
        style={getButtonStyle('pet-owner')}
      >
        <span style={{ fontSize: '1.2rem' }}>🐾</span>
        <span>Pet Owner</span>
      </button>
      <button
        onClick={() => switchMode('patrol')}
        style={getButtonStyle('patrol')}
      >
        <span style={{ fontSize: '1.2rem' }}>🦸</span>
        <span>Patrol Hero</span>
      </button>
    </div>
  );
}
