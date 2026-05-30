'use client';

import { ToastProvider } from './ui/Toast';

export default function ClientProviders({ children }) {
  return <ToastProvider>{children}</ToastProvider>;
}
