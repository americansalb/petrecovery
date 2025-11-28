'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  Search,
  Shield,
  Bell,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

// --- Components ---

const LiveTicker = () => {
  const [index, setIndex] = useState(0);
  const events = [
    "🔔 Max (Golden Retriever) was just reunited in Austin, TX",
    "🔔 Luna (Siamese) was found safe in Portland, OR",
    "🔔 Cooper (Beagle) is back home in Denver, CO",
    "🔔 Bella (Lab Mix) was reunited in Nashville, TN"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % events.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-indigo-900 text-white py-2 overflow-hidden relative z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
        <AnimatePresence mode='wait'>
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center gap-2 text-sm font-medium"
          >
            {events[index]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

const HomeHeader = ({ session }) => {
  return (
    <div className="absolute top-0 left-0 right-0 z-50 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black text-white drop-shadow-lg flex items-center gap-2">
          <span>🐾</span> PetRecovery
        </Link>
        <div className="flex items-center gap-3">
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="px-5 py-2.5 bg-white text-indigo-600 rounded-full font-bold text-sm hover:bg-indigo-50 transition-all shadow-lg"
              >
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-5 py-2.5 text-white font-semibold text-sm hover:bg-white/10 rounded-full transition-all"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="px-5 py-2.5 bg-white text-indigo-600 rounded-full font-bold text-sm hover:bg-indigo-50 transition-all shadow-lg"
              >
                Sign Up Free
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const HeroSection = ({ session }) => {
  return (
    <div className="relative h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Header */}
      <HomeHeader session={session} />

      {/* Background with Overlay */}
      <div className="absolute inset-0 bg-slate-900">
        <img
          src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=2069&auto=format&fit=crop"
          alt="Happy dog running"
          className="w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-transparent to-slate-50" />
      </div>

      <div className="relative z-10 text-center max-w-5xl px-4 mt-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tight drop-shadow-lg">
            Bring Them <span className="text-amber-400">Home.</span>
          </h1>
          <p className="text-xl md:text-3xl text-slate-100 mb-12 font-medium max-w-3xl mx-auto leading-relaxed drop-shadow-md">
            The community-powered network that has reunited <span className="text-amber-400 font-bold">847 pets</span> this year.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link href="/report/new" className="group relative px-10 py-5 bg-rose-600 hover:bg-rose-700 text-white rounded-full font-bold text-xl transition-all shadow-[0_0_40px_rgba(225,29,72,0.5)] hover:shadow-[0_0_60px_rgba(225,29,72,0.7)] hover:-translate-y-1 flex items-center justify-center gap-3">
              <Bell className="w-6 h-6" />
              Report Lost Pet
            </Link>
            <Link href="/database" className="px-10 py-5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border-2 border-white/30 rounded-full font-bold text-xl transition-all hover:-translate-y-1 flex items-center justify-center gap-3">
              <Search className="w-6 h-6" />
              Search Database
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const ActionCard = ({ href, icon: Icon, title, desc, color, delay }) => (
  <Link href={href} className="block group h-full">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="bg-white rounded-[2rem] p-10 shadow-xl border border-slate-100 hover:border-indigo-100 transition-all hover:shadow-2xl hover:-translate-y-2 h-full relative overflow-hidden"
    >
      <div className={`absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity ${color}`}>
        <Icon className="w-40 h-40" />
      </div>

      <div className={`w-16 h-16 rounded-2xl ${color} bg-opacity-10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className={`w-8 h-8 ${color.replace('bg-', 'text-')}`} />
      </div>

      <h3 className="text-3xl font-bold text-slate-900 mb-4">{title}</h3>
      <p className="text-slate-600 text-lg leading-relaxed mb-8">{desc}</p>

      <div className="flex items-center text-indigo-600 font-bold text-lg group-hover:gap-3 transition-all">
        Get Started <ArrowRight className="w-5 h-5 ml-2" />
      </div>
    </motion.div>
  </Link>
);

const SuccessStory = ({ name, story, image }) => (
  <div className="bg-white rounded-3xl overflow-hidden shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
    <div className="h-48 overflow-hidden">
      <img src={image} alt={name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
    </div>
    <div className="p-8">
      <div className="flex items-center gap-2 mb-4 text-amber-400">
        {[1,2,3,4,5].map(i => <div key={i}>★</div>)}
      </div>
      <p className="text-slate-700 text-lg italic mb-6 leading-relaxed">"{story}"</p>
      <div className="font-bold text-slate-900 text-xl">— {name}</div>
    </div>
  </div>
);

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100">
      <LiveTicker />
      <HeroSection session={session} />

      {/* Main Actions */}
      <div className="max-w-7xl mx-auto px-4 -mt-24 relative z-20 pb-24">
        <div className="grid md:grid-cols-3 gap-8">
          <ActionCard
            href="/report/new"
            icon={Bell}
            title="I Lost My Pet"
            desc="Activate the PetRecovery network immediately. Alert neighbors, squads, and shelters in seconds."
            color="bg-rose-500"
            delay={0.1}
          />
          <ActionCard
            href="/report/found"
            icon={CheckCircle}
            title="I Found a Pet"
            desc="Be a hero. Report a sighting or secured pet to help reunite them with their worried family."
            color="bg-emerald-500"
            delay={0.2}
          />
          <ActionCard
            href="/rescue-squads"
            icon={Shield}
            title="Join the Patrol"
            desc="Join local volunteer squads. Coordinate searches and bring lost pets home safely."
            color="bg-indigo-500"
            delay={0.3}
          />
        </div>
      </div>

      {/* Success Stories */}
      <div className="bg-white py-24 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">Stories of Hope</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Real reunions made possible by our community. This is why we do what we do.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            <SuccessStory
              name="Sarah & Buster"
              image="https://images.unsplash.com/photo-1558788353-f76d92427f16?q=80&w=1000&auto=format&fit=crop"
              story="I thought I'd lost him forever. Within 20 minutes of posting, a patrol member spotted him three blocks away. I can't stop crying happy tears."
            />
            <SuccessStory
              name="James & Mochi"
              image="https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?q=80&w=1000&auto=format&fit=crop"
              story="The map feature is incredible. We coordinated a search grid and found Mochi hiding in a neighbor's shed. Thank you PetRecovery!"
            />
            <SuccessStory
              name="The Rodriguez Family"
              image="https://images.unsplash.com/photo-1601758228041-f3b2795255f1?q=80&w=1000&auto=format&fit=crop"
              story="We found a scared beagle and used the database to find his owners instantly. Seeing their reunion was the highlight of my year."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
