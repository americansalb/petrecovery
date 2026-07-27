'use client';

/**
 * MyPetsStep - logged-in owners pick which pet is missing.
 *
 * Selecting a saved pet short-circuits the name/size/colors steps (data comes
 * from the Pet record); "A different pet" falls through to the species step.
 */

import { PawPrint, ChevronRight } from 'lucide-react';
import { SPECIES_ICONS } from '../wizardTheme';

export default function MyPetsStep({ pets = [], onSelectPet, onNewPet }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {pets.map((pet) => {
          const SpeciesIcon = SPECIES_ICONS[(pet.species || 'other').toLowerCase()] || SPECIES_ICONS.other;
          return (
            <button
              key={pet.id}
              type="button"
              onClick={() => onSelectPet(pet)}
              className="group text-left p-3.5 rounded-2xl border-2 border-midnight-100 bg-white hover:border-flash-400 hover:-translate-y-0.5 hover:shadow-card-hover active:translate-y-0 transition-all"
            >
              <div className="w-full aspect-square rounded-xl bg-midnight-100 overflow-hidden mb-3">
                {pet.primaryPhotoUrl ? (
                  <img
                    src={pet.primaryPhotoUrl}
                    alt={pet.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <SpeciesIcon size={32} className="text-midnight-300" />
                  </div>
                )}
              </div>
              <p className="font-bold text-midnight-900 truncate">{pet.name}</p>
              <p className="text-xs text-midnight-400 capitalize">{(pet.species || '').toLowerCase()}</p>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onNewPet}
        className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-midnight-200 text-left hover:border-midnight-400 hover:bg-midnight-50 transition-all"
      >
        <span className="w-10 h-10 rounded-xl bg-midnight-100 flex items-center justify-center shrink-0">
          <PawPrint size={19} className="text-midnight-500" />
        </span>
        <span className="flex-1 font-semibold text-midnight-700">A different pet</span>
        <ChevronRight size={18} className="text-midnight-300" />
      </button>
    </div>
  );
}
