'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import SignInCard from './SignInCard';
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
      <div className="pe-account-sheet ui-card">
        <button type="button" onClick={leave} className="pe-account-close ui-btn ui-btn--ghost ui-btn--sm" aria-label="Close"><X size={20} /></button>
        <h2 id="account-dialog-title" className="ui-h2 pr-10">Sign in to play together</h2>
        <p className="mt-1 text-sm text-pe-muted">Other players see who they are playing, so multiplayer needs an account. It&apos;s free: your email and a code.</p>
        <div className="mt-5">
          <SignInCard requireName playerName={name} onPlayerNameChange={onNameChange} returnTo={returnTo} onAuthenticated={onAuthenticated} />
        </div>
      </div>
    </dialog>
  );
}
