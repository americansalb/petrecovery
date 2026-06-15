'use client';

import { ToastProvider } from './ui/Toast';
import CapacitorBootstrap from './CapacitorBootstrap';
import StandaloneHome from './StandaloneHome';

export default function ClientProviders({ children }) {
  return (
    <ToastProvider>
      <CapacitorBootstrap />
      <StandaloneHome />
      {children}
    </ToastProvider>
  );
}
