'use client';

/**
 * Phase 9: Shelters Page
 *
 * Public page to search and browse shelter animals.
 */

import { useState } from 'react';
import ShelterSearch from '@/app/components/ShelterSearch';

export default function SheltersPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Find Shelter Pets
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl">
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
      <div className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Comprehensive Search
              </h3>
              <p className="text-gray-600">
                We aggregate data from PetFinder, RescueGroups, and local shelters
                to give you the widest selection of adoptable pets.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Location-Based
              </h3>
              <p className="text-gray-600">
                Find pets near you with our distance-based search. Filter by
                miles to see animals in shelters close to home.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Lost Pet Matching
              </h3>
              <p className="text-gray-600">
                If you've lost a pet, we automatically search shelter databases
                to help find potential matches for your lost companion.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-blue-50">
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Lost a Pet?
          </h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            If you've lost a pet, create a case on PetRecovery and we'll automatically
            search shelter databases to help find potential matches.
          </p>
          <a
            href="/cases/new"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Report a Lost Pet
          </a>
        </div>
      </div>
    </div>
  );
}
