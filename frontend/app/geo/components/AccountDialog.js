'use client';

import { useEffect, useRef } from 'react';
import { Users, X } from 'lucide-react';
import SignInCard from './SignInCard';
import Card from './ui/Card';

export default function AccountDialog({ onClose, returnTo, name, onNameChange, onAuthenticated }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { node.close(); document.body.style.overflow = previous; };
  }, []);
  return (
    <dialog ref={dialog} onCancel={onClose} className="pe-account-dialog" aria-labelledby="account-dialog-title">
      <Card className="pe-account-sheet">
        <button type="button" onClick={onClose} className="pe-account-close" aria-label="Close"><X size={22} /></button>
        <span className="pe-account-symbol"><Users size={30} aria-hidden="true" /></span>
        <h2 id="account-dialog-title">Play together.</h2>
        <p>Your free player account keeps your games.</p>
        <SignInCard requireName playerName={name} onPlayerNameChange={onNameChange} returnTo={returnTo} onAuthenticated={onAuthenticated} compact />
      </Card>
    </dialog>
  );
}
