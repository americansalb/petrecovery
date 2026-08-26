'use client';

import Link from 'next/link';
import { SARAMA_AVATAR } from '@/lib/brandAssets';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="bg-midnight-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <img
            src={SARAMA_AVATAR}
            alt="Sarama"
            className="h-32 w-auto mx-auto mb-6"
          />
          <h1 className="text-4xl md:text-5xl font-black mb-4">Meet Sarama</h1>
          <p className="text-xl text-white/90">(suh-RUH-mah) - our guide and guardian</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="prose prose-lg max-w-none">
          <p className="text-xl text-gray-700 leading-relaxed mb-8">
            Sarama is our guide, a devoted dog adorned in search and rescue gear, always ready to help bring lost pets home.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">Her Ancient Origins</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            Her name carries deep meaning. In Sanskrit, Sarama (सरमा) means &quot;the fleet one.&quot; In the <strong>Rig Veda</strong>, one of humanity's oldest sacred texts from the <strong>Sanatana Dharma</strong> tradition, she is the divine dog: loyal, swift, and tireless.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            When the Panis (spirits of darkness) stole the sacred cattle and hid them in a mountain cave, it was Sarama who tracked them across impossible distances, found what was lost, and led the way to reunion.
          </p>
          <p className="text-gray-700 leading-relaxed mb-8">
            She is celebrated as <strong>Devasuni</strong>, the divine dog, and honored as the mother of all dogs. Her story is one of devotion, determination, and the unbreakable bond between humans and their animal companions.
          </p>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 p-6 rounded-r-lg my-12">
            <h3 className="text-xl font-bold text-amber-900 mb-4">We chose Sarama because her story is our mission:</h3>
            <p className="text-amber-800 leading-relaxed">
              Just as she never gave up searching for the lost, neither do we. Every missing pet deserves someone looking for them. Every family deserves hope. And every reunion, no matter how long it takes, is worth celebrating.
            </p>
          </div>

          <p className="text-gray-700 leading-relaxed mb-6">
            When you see Sarama on ReunitePets, she's here to guide you, encourage you, and remind you that lost doesn't mean gone forever.
          </p>

          <p className="text-2xl font-bold text-center text-midnight-900 my-12 italic">
            The search continues until they're home.
          </p>

          {/* Call to Action */}
          <div className="bg-midnight-900 rounded-2xl p-8 text-center text-white mt-12">
            <h3 className="text-2xl font-bold mb-4">Join Our Mission</h3>
            <p className="text-white/90 mb-6">
              Help us reunite lost pets with their families. Every volunteer, every share, every sighting matters.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="px-6 py-3 bg-flash-400 text-midnight-900 font-bold rounded-lg hover:bg-flash-500 transition"
              >
                Get Started
              </Link>
              <Link
                href="/rescue-forces/search"
                className="px-6 py-3 bg-white/20 text-white font-bold rounded-lg border-2 border-white/30 hover:bg-white/30 transition"
              >
                Find a Rescue Force
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
