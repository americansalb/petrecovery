'use client';

/**
 * Homepage - Redesigned with PetRecovery Design System
 *
 * Uses: Midnight Blue + Flashlight Yellow color palette
 * Clean, modern, and emotionally engaging
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Search,
  Shield,
  CheckCircle,
  ArrowRight,
  Star,
  Users,
  MapPin,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui';

// --- Components ---

const LiveTicker = () => {
  const [index, setIndex] = useState(0);
  const events = [
    { pet: 'Max', breed: 'Golden Retriever', location: 'Austin, TX' },
    { pet: 'Luna', breed: 'Siamese Cat', location: 'Portland, OR' },
    { pet: 'Cooper', breed: 'Beagle', location: 'Denver, CO' },
    { pet: 'Bella', breed: 'Lab Mix', location: 'Nashville, TN' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % events.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-midnight-900 text-white py-2.5 relative z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
        <AnimatePresence mode='wait'>
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex items-center gap-2 text-sm"
          >
            <span className="inline-flex items-center justify-center w-5 h-5 bg-flash-400 rounded-full">
              <CheckCircle className="w-3 h-3 text-midnight-900" />
            </span>
            <span className="text-midnight-300">Just reunited:</span>
            <span className="font-semibold text-white">{events[index].pet}</span>
            <span className="text-midnight-400">({events[index].breed})</span>
            <span className="text-midnight-500">in {events[index].location}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

const HomeHeader = ({ session }) => {
  return (
    <div className="absolute top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 text-white font-bold text-xl">
          <img src="https://petrescue.b-cdn.net/Logos.svg" alt="Surumaa" className="h-10 w-auto drop-shadow-lg" />
          <span className="drop-shadow-lg">PetRecovery</span>
        </Link>
        <div className="flex items-center gap-3">
          {session ? (
            <Link href="/dashboard">
              <Button>Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button>Sign Up Free</Button>
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
    <div className="relative h-[90vh] min-h-[600px] flex items-center justify-center overflow-hidden">
      {/* Header */}
      <HomeHeader session={session} />

      {/* Background with Overlay */}
      <div className="absolute inset-0 bg-midnight-950">
        <img
          src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=80&w=2069&auto=format&fit=crop"
          alt="Happy dog running"
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-midnight-950/80 via-midnight-950/40 to-midnight-50" />
      </div>

      <div className="relative z-10 text-center max-w-5xl px-4 mt-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Surumaa mascot */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8, type: "spring" }}
            className="mb-8 flex justify-center"
          >
            <img
              src="https://petrescue.b-cdn.net/Logos%20(1).svg"
              alt="Surumaa"
              className="h-36 w-auto drop-shadow-2xl"
            />
          </motion.div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 tracking-tight drop-shadow-lg">
            Bring Them <span className="text-flash-400">Home.</span>
          </h1>
          <p className="text-lg md:text-2xl text-midnight-200 mb-10 font-medium max-w-3xl mx-auto leading-relaxed">
            The community-powered network that has reunited{' '}
            <span className="text-flash-400 font-bold">847 pets</span> this year.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/report/new">
              <Button
                size="xl"
                variant="danger"
                leftIcon={Bell}
                className="shadow-lg shadow-red-600/30 hover:shadow-red-600/50"
              >
                Report Lost Pet
              </Button>
            </Link>
            <Link href="/database">
              <Button
                size="xl"
                variant="outline"
                leftIcon={Search}
                className="border-white/30 text-white hover:bg-white/10"
              >
                Search Database
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const ActionCard = ({ href, icon: Icon, title, desc, variant, delay }) => {
  const variants = {
    danger: {
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      hoverBorder: 'hover:border-red-200',
    },
    success: {
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      hoverBorder: 'hover:border-green-200',
    },
    primary: {
      iconBg: 'bg-midnight-100',
      iconColor: 'text-midnight-600',
      hoverBorder: 'hover:border-midnight-300',
    },
  };

  const v = variants[variant] || variants.primary;

  return (
    <Link href={href} className="block group h-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay }}
        className={`bg-white rounded-2xl p-8 shadow-card border border-midnight-100 ${v.hoverBorder} transition-all hover:shadow-card-hover hover:-translate-y-1 h-full relative overflow-hidden`}
      >
        <div className={`w-14 h-14 rounded-2xl ${v.iconBg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
          <Icon className={`w-7 h-7 ${v.iconColor}`} />
        </div>

        <h3 className="text-2xl font-bold text-midnight-900 mb-3">{title}</h3>
        <p className="text-midnight-500 leading-relaxed mb-6">{desc}</p>

        <div className="flex items-center text-midnight-900 font-semibold group-hover:text-flash-600 transition-colors">
          Get Started <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </div>
      </motion.div>
    </Link>
  );
};

const SuccessStory = ({ name, story, image }) => (
  <div className="bg-white rounded-2xl overflow-hidden shadow-card border border-midnight-100 hover:shadow-card-hover transition-shadow">
    <div className="h-48 overflow-hidden">
      <img src={image} alt={name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
    </div>
    <div className="p-6">
      <div className="flex items-center gap-1 mb-3 text-flash-500">
        {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-current" />)}
      </div>
      <p className="text-midnight-600 italic mb-4 leading-relaxed">"{story}"</p>
      <div className="font-bold text-midnight-900">— {name}</div>
    </div>
  </div>
);

const StatsSection = () => (
  <div className="bg-midnight-900 py-16">
    <div className="max-w-7xl mx-auto px-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {[
          { value: '847', label: 'Pets Reunited This Year', icon: CheckCircle },
          { value: '12K+', label: 'Active Community Members', icon: Users },
          { value: '250+', label: 'Rescue Squads Nationwide', icon: Shield },
          { value: '48hrs', label: 'Avg. Time to Reunion', icon: Clock },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="text-center"
          >
            <stat.icon className="w-8 h-8 text-flash-400 mx-auto mb-3" />
            <div className="text-3xl md:text-4xl font-bold text-white mb-1">{stat.value}</div>
            <div className="text-sm text-midnight-400">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-midnight-50 font-sans selection:bg-flash-100 selection:text-midnight-900">
      <LiveTicker />
      <HeroSection session={session} />

      {/* Main Actions */}
      <div className="max-w-7xl mx-auto px-4 -mt-20 relative z-20 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          <ActionCard
            href="/report/new"
            icon={Bell}
            title="I Lost My Pet"
            desc="Activate the PetRecovery network immediately. Alert neighbors, squads, and shelters in seconds."
            variant="danger"
            delay={0.1}
          />
          <ActionCard
            href="/report/found"
            icon={CheckCircle}
            title="I Found a Pet"
            desc="Be a hero. Report a sighting or secured pet to help reunite them with their worried family."
            variant="success"
            delay={0.2}
          />
          <ActionCard
            href="/rescue-squads"
            icon={Shield}
            title="Join the Patrol"
            desc="Join local volunteer squads. Coordinate searches and bring lost pets home safely."
            variant="primary"
            delay={0.3}
          />
        </div>
      </div>

      {/* Stats Section */}
      <StatsSection />

      {/* Success Stories */}
      <div className="bg-white py-20 border-t border-midnight-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-midnight-900 mb-4">Stories of Hope</h2>
            <p className="text-lg text-midnight-500 max-w-2xl mx-auto">
              Real reunions made possible by our community. This is why we do what we do.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
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

      {/* Footer with Surumaa */}
      <div className="bg-midnight-900 py-12 border-t border-midnight-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img
                src="https://petrescue.b-cdn.net/Logos.svg"
                alt="Surumaa"
                className="h-14 w-auto"
              />
              <div>
                <p className="text-white font-semibold text-lg">Meet Surumaa</p>
                <p className="text-midnight-400 text-sm">Your guide on the journey home</p>
              </div>
            </div>
            <Link href="/about-surumaa">
              <Button variant="outline" className="border-flash-500/50 text-flash-400 hover:bg-flash-500/10">
                Learn About Surumaa <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="border-t border-midnight-800 mt-8 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-midnight-400">
              <p>© 2024 PetRecovery.org. All rights reserved.</p>
              <div className="flex items-center gap-6">
                <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
                <Link href="/contact" className="hover:text-white transition">Contact</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
