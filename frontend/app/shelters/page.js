'use client';

/**
 * Phase 9: Shelters Page
 *
 * Public page to search and browse shelter animals.
 */

import { useState } from 'react';
import { Search, MapPin, Heart, AlertTriangle } from 'lucide-react';
import ShelterSearch from '@/app/components/ShelterSearch';
import { Card, Button } from '@/components/ui';

export default function SheltersPage() {
  return (
    <div className="min-h-screen bg-midnight-50">
      {/* Header */}
      <div className="bg-midnight-900 text-white border-b border-midnight-800">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Find Shelter Pets
          </h1>
          <p className="text-xl text-midnight-300 max-w-2xl">
            Search for adoptable pets from shelters and rescue organizations near you.
            Our database is connected to thousands of shelters across the country.
          </p>
        </div>
      </div>

      {/* Search Section */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <ShelterSearch />
      </div>

      {/* Info Section */}
      <div className="bg-white border-t border-midnight-200">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-flash-100 rounded-2xl mb-4">
                <Search className="w-8 h-8 text-flash-500" />
              </div>
              <h3 className="text-lg font-semibold text-midnight-900 mb-2">
                Comprehensive Search
              </h3>
              <p className="text-midnight-600">
                We aggregate data from PetFinder, RescueGroups, and local shelters
                to give you the widest selection of adoptable pets.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
                <MapPin className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-midnight-900 mb-2">
                Location-Based
              </h3>
              <p className="text-midnight-600">
                Find pets near you with our distance-based search. Filter by
                miles to see animals in shelters close to home.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-flash-100 rounded-2xl mb-4">
                <Heart className="w-8 h-8 text-flash-500" />
              </div>
              <h3 className="text-lg font-semibold text-midnight-900 mb-2">
                Lost Pet Matching
              </h3>
              <p className="text-midnight-600">
                If you've lost a pet, we automatically search shelter databases
                to help find potential matches for your lost companion.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-flash-50 border-t border-flash-100">
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold text-midnight-900 mb-4">
            Lost a Pet?
          </h2>
          <p className="text-midnight-600 mb-6 max-w-2xl mx-auto">
            If you've lost a pet, create a case on PetRecovery and we'll automatically
            search shelter databases to help find potential matches.
          </p>
          <Button
            variant="primary"
            href="/missions/new"
            size="lg"
          >
            <AlertTriangle size={18} />
            Report a Lost Pet
          </Button>
        </div>
      </div>
    </div>
  );
}
