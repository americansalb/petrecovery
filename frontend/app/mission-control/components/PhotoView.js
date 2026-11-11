'use client';

/** The pet's photo, large: what a person checks against the animal in front of them. */
import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function PhotoView({ pet, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!pet?.photoUrl) return null;
  return (
    <div className="fixed inset-0 z-[900] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={`Photo of ${pet.name || 'the pet'}`}>
      <div className="flex justify-end p-3 pt-[calc(12px+env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the photo"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flash-400"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <button type="button" onClick={onClose} className="flex min-h-0 flex-1 items-center justify-center px-3 pb-6" aria-label="Close the photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pet.photoUrl} alt={`${pet.name || 'The pet'}${pet.color ? `, ${String(pet.color).toLowerCase()}` : ''}`} className="max-h-full max-w-full rounded-2xl object-contain" />
      </button>
    </div>
  );
}
