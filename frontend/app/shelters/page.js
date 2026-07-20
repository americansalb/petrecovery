'use client';

/**
 * Shelter Search Page
 *
 * Public page for finding animal shelters, humane societies,
 * and rescue organizations near a location.
 */

import Link from 'next/link';
import { Building2, Heart, Phone, MapPin, ArrowRight } from 'lucide-react';
import ShelterSearch from '@/app/components/ShelterSearch';

export default function SheltersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-midnight-50">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-flash-100 mb-4">
            <Building2 className="w-8 h-8 text-flash-600" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-midnight-900 mb-3">
            Find Animal Shelters
          </h1>
          <p className="text-lg text-midnight-600 max-w-2xl mx-auto">
            Search for animal shelters, humane societies, and rescue organizations near you.
            Check if your lost pet has been brought in, or find resources to help a found pet.
          </p>
        </div>

        {/* Tips */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-midnight-100 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <Heart className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-midnight-900 mb-1">Lost Your Pet?</h3>
                <p className="text-sm text-midnight-600">
                  Call shelters within 25 miles daily. Pets can travel far or be transported.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-midnight-100 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-midnight-900 mb-1">Call Ahead</h3>
                <p className="text-sm text-midnight-600">
                  Phone before visiting. Ask about intake procedures and viewing hours.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-midnight-100 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-midnight-900 mb-1">Visit In Person</h3>
                <p className="text-sm text-midnight-600">
                  Photos don't always match. Visit shelters to check for your pet yourself.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Shelter Search Component */}
        <ShelterSearch />

        {/* Run a shelter? */}
        <div className="mt-10 rounded-2xl bg-midnight-900 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Run a shelter or rescue?</h2>
            <p className="text-midnight-300">
              Free pet management, lost-pet matching, and your own page. Forever free.
            </p>
          </div>
          <Link
            href="/for-shelters"
            className="inline-flex items-center gap-2 bg-flash-400 hover:bg-flash-300 text-midnight-900 font-bold px-6 py-3 rounded-xl transition shrink-0"
          >
            Learn more <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
