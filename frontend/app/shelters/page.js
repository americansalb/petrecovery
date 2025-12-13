'use client';

/**
 * Shelters Page
 *
 * Public page to search for nearby animal shelters, humane societies,
 * and rescue organizations. Helps lost pet owners find places to check.
 */

import { Search, MapPin, Phone, Building2 } from 'lucide-react';
import ShelterSearch from '@/app/components/ShelterSearch';
import { Button } from '@/components/ui';

export default function SheltersPage() {
  return (
    <div className="min-h-screen bg-midnight-50">
      {/* Header */}
      <div className="bg-midnight-900 text-white border-b border-midnight-800">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Find Nearby Shelters
          </h1>
          <p className="text-xl text-midnight-300 max-w-2xl">
            Search for animal shelters, humane societies, and rescue organizations near you.
            Lost pets are often brought to local shelters - check these places first.
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
                <Search className="w-8 h-8 text-flash-600" />
              </div>
              <h3 className="text-lg font-semibold text-midnight-900 mb-2">
                Apple Maps Powered
              </h3>
              <p className="text-midnight-600">
                We use Apple Maps to find animal shelters, humane societies, SPCAs,
                and animal control facilities in your area.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-2xl mb-4">
                <MapPin className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-midnight-900 mb-2">
                Check Nearby First
              </h3>
              <p className="text-midnight-600">
                Lost pets are often found within a few miles of home. Start by calling
                shelters closest to where your pet went missing.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
                <Phone className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-midnight-900 mb-2">
                Call & Visit
              </h3>
              <p className="text-midnight-600">
                Call shelters to ask about recent intakes, then visit in person.
                Some pets aren't immediately added to online listings.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tips Section */}
      <div className="bg-amber-50 border-t border-amber-100">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-midnight-900 mb-6 text-center">
              Tips for Checking Shelters
            </h2>
            <div className="space-y-4">
              <div className="flex gap-4 items-start bg-white rounded-xl p-4 shadow-sm">
                <span className="flex-shrink-0 w-8 h-8 bg-flash-400 rounded-full flex items-center justify-center font-bold text-midnight-900">1</span>
                <div>
                  <h3 className="font-semibold text-midnight-900">Call first, then visit</h3>
                  <p className="text-midnight-600 text-sm">Ask about recent intakes matching your pet's description. But always visit in person too - descriptions can be inaccurate.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start bg-white rounded-xl p-4 shadow-sm">
                <span className="flex-shrink-0 w-8 h-8 bg-flash-400 rounded-full flex items-center justify-center font-bold text-midnight-900">2</span>
                <div>
                  <h3 className="font-semibold text-midnight-900">Bring a photo and flyer</h3>
                  <p className="text-midnight-600 text-sm">Leave a flyer with shelter staff. New animals come in daily, and having your pet's photo on file helps.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start bg-white rounded-xl p-4 shadow-sm">
                <span className="flex-shrink-0 w-8 h-8 bg-flash-400 rounded-full flex items-center justify-center font-bold text-midnight-900">3</span>
                <div>
                  <h3 className="font-semibold text-midnight-900">Check back regularly</h3>
                  <p className="text-midnight-600 text-sm">Pets can be brought in days or weeks after going missing. Set a reminder to call shelters every few days.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start bg-white rounded-xl p-4 shadow-sm">
                <span className="flex-shrink-0 w-8 h-8 bg-flash-400 rounded-full flex items-center justify-center font-bold text-midnight-900">4</span>
                <div>
                  <h3 className="font-semibold text-midnight-900">Expand your search</h3>
                  <p className="text-midnight-600 text-sm">Pets can travel far. Check shelters in neighboring cities and counties, especially along major roads.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-midnight-900 border-t border-midnight-800">
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Haven't Found Your Pet Yet?
          </h2>
          <p className="text-midnight-300 mb-6 max-w-2xl mx-auto">
            Report your lost pet on PetRecovery. We'll help coordinate searches with your
            local Rescue Squad and automatically alert you if matching pets appear in shelters.
          </p>
          <Button
            variant="primary"
            href="/missions/new"
            size="lg"
          >
            <Building2 size={18} />
            Report a Lost Pet
          </Button>
        </div>
      </div>
    </div>
  );
}
