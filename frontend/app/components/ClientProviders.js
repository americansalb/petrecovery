'use client';

import { ToastProvider } from './ui/Toast';
import CapacitorBootstrap from './CapacitorBootstrap';

export default function ClientProviders({ children }) {
  return (
    <ToastProvider>
      <CapacitorBootstrap />
      {children}
    </ToastProvider>
  );
}
