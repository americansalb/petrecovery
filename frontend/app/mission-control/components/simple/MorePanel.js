'use client';

/**
 * MorePanel - Additional options and settings
 *
 * Features:
 * - Pet details view
 * - Share options
 * - Settings
 * - Activity log
 * - Help resources
 */

import {
  Home,
  Share2,
  Activity,
  Settings,
  HelpCircle,
  FileText,
  Bell,
  ChevronRight,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  Clock,
  Calendar,
  Bookmark,
  Flag
} from 'lucide-react';

export default function MorePanel({
  mission,
  onAction,
}) {
  const pet = mission || {};

  const menuSections = [
    {
      title: 'Pet Information',
      items: [
        { id: 'details', icon: Home, label: 'View Pet Details', description: 'Photos, description, microchip' },
        { id: 'timeline', icon: Clock, label: 'Timeline', description: 'When and where last seen' },
        { id: 'flyer', icon: FileText, label: 'Download Flyer', description: 'Print and post in your area' },
      ]
    },
    {
      title: 'Share & Spread',
      items: [
        { id: 'share', icon: Share2, label: 'Share Case', description: 'Facebook, Twitter, Nextdoor' },
        { id: 'contacts', icon: Phone, label: 'Emergency Contacts', description: 'Shelters, vets, animal control' },
      ]
    },
    {
      title: 'Activity',
      items: [
        { id: 'activity', icon: Activity, label: 'Activity Log', description: 'All searches, sightings, updates' },
        { id: 'sightings', icon: MapPin, label: 'All Sightings', description: 'View reported sighting locations' },
        { id: 'notifications', icon: Bell, label: 'Notification Settings', description: 'Manage alerts' },
      ]
    },
    {
      title: 'Help',
      items: [
        { id: 'tips', icon: HelpCircle, label: 'Search Tips', description: 'Best practices for finding pets' },
        { id: 'resources', icon: Bookmark, label: 'Local Resources', description: 'Shelters, lost pet groups' },
        { id: 'report', icon: Flag, label: 'Report Issue', description: 'Something wrong? Let us know' },
      ]
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
      {/* Pet Quick Info */}
      <div className="p-4 bg-slate-900/50 border-b border-slate-800">
        <div className="flex items-center gap-4">
          {/* Pet Photo/Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-3xl">
            {pet.petSpecies === 'DOG' ? '🐕' : pet.petSpecies === 'CAT' ? '🐈' : '🐾'}
          </div>

          {/* Pet Info */}
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">{pet.petName || 'Unknown Pet'}</h2>
            <p className="text-sm text-slate-400">
              {pet.petSpecies || 'Pet'} {pet.petBreed && `• ${pet.petBreed}`}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {pet.petColor && `${pet.petColor} • `}
              Case #{pet.id?.slice(-6) || '------'}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        {pet.lastSeenAt && (
          <div className="mt-3 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1 text-slate-500">
              <Calendar size={12} />
              <span>Lost {new Date(pet.lastSeenAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-500">
              <MapPin size={12} />
              <span className="truncate max-w-[150px]">{pet.lastSeenAddress || 'Location unknown'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Menu Sections */}
      <div className="flex-1 overflow-y-auto">
        {menuSections.map(section => (
          <div key={section.title}>
            <div className="px-4 py-2 bg-slate-900/30">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {section.title}
              </h3>
            </div>

            {section.items.map(item => (
              <button
                key={item.id}
                onClick={() => onAction?.(item.id)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-900/50 transition border-b border-slate-800/50"
              >
                <div className="p-2 rounded-lg bg-slate-800 text-slate-400">
                  <item.icon size={18} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-medium">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.description}</p>
                </div>
                <ChevronRight size={18} className="text-slate-600" />
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <p className="text-center text-xs text-slate-600">
          ReunitePets.org • Helping pets find their way home
        </p>
      </div>
    </div>
  );
}
