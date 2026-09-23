'use client';

import { useEffect, useRef } from 'react';
import { Users, X } from 'lucide-react';
import SignInCard from './SignInCard';
import Card from './ui/Card';
import { prefersReducedMotion } from '../lib/motion';

/** How long the sheet takes to leave: pe-dialog-out in motion.css. */
export const DIALOG_EXIT_MS = 180;

export default function AccountDialog({ onClose, returnTo, name, onNameChange, onAuthenticated }) {
  const dialog = useRef(null);
  const leaving = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(leaving.current); node.close(); document.body.style.overflow = previous; };
  }, []);
  // The sheet leaves the way it arrived, then the page removes it. It
  // used to vanish in the frame after the click, which is the whole
  // difference between a dialog and a page that blinks.
  const leave = () => {
    if (leaving.current) return;
    if (prefersReducedMotion()) {
      leaving.current = true;
      onCloseRef.current?.();
      return;
    }
    dialog.current?.classList.add('pe-dialog-leaving');
    leaving.current = setTimeout(() => onCloseRef.current?.(), DIALOG_EXIT_MS);
  };
  return (
    <dialog
      ref={dialog}
      onCancel={(event) => { event.preventDefault(); leave(); }}
      className="pe-account-dialog pointer-events-auto"
      aria-labelledby="account-dialog-title"
    >
      <Card className="pe-account-sheet">
        <button type="button" onClick={leave} className="pe-account-close" aria-label="Close"><X size={22} /></button>
        <span className="pe-account-symbol"><Users size={30} aria-hidden="true" /></span>
        <h2 id="account-dialog-title">Sign in to play together</h2>
        <p>Your email is all it takes. Played before? The same address brings your player back. Free, no card.</p>
        <SignInCard requireName playerName={name} onPlayerNameChange={onNameChange} returnTo={returnTo} onAuthenticated={onAuthenticated} compact />
      </Card>
    </dialog>
  );
}
