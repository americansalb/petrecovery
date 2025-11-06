'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const ModeContext = createContext();

export function ModeProvider({ children }) {
  const [mode, setMode] = useState('pet-owner'); // 'pet-owner' or 'patrol'

  // Load from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('petrecovery_mode');
    if (savedMode) {
      setMode(savedMode);
    }
  }, []);

  const switchMode = (newMode) => {
    setMode(newMode);
    localStorage.setItem('petrecovery_mode', newMode);
  };

  return (
    <ModeContext.Provider value={{ mode, switchMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within ModeProvider');
  }
  return context;
}
