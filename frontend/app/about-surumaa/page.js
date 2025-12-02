'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Sparkles, Home, Shield } from 'lucide-react';

export default function AboutSurumaa() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-white/80 hover:text-white transition"
          >
            <ArrowLeft size={20} />
            Back to Home
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="mb-8 flex justify-center"
          >
            <img
              src="https://petrescue.b-cdn.net/Untitled%20design%20(13).svg"
              alt="Surumaa"
              className="h-64 w-auto drop-shadow-2xl"
            />
          </motion.div>

          <h1 className="text-6xl md:text-7xl font-black text-white mb-6 tracking-tight">
            Meet <span className="text-amber-400">Surumaa</span>
          </h1>
          <p className="text-2xl text-slate-300 mb-4 font-medium">
            Your compassionate guide on the journey home
          </p>
        </motion.div>

        {/* Story Section */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/10 backdrop-blur-md border-2 border-white/20 rounded-3xl p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center">
                <Heart className="text-rose-400" size={24} />
              </div>
              <h2 className="text-3xl font-bold text-white">Who is Surumaa?</h2>
            </div>
            <p className="text-slate-200 leading-relaxed mb-4">
              Surumaa is your personal companion through one of the hardest moments a pet parent can face. Like a guardian angel, she's always by your side - offering encouragement, tracking your progress, and reminding you that you're not alone.
            </p>
            <p className="text-slate-200 leading-relaxed">
              Her name means "protector" in ancient tongues, and that's exactly what she is: a warm, caring presence that helps guide lost pets back to the arms of those who love them.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white/10 backdrop-blur-md border-2 border-white/20 rounded-3xl p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Sparkles className="text-amber-400" size={24} />
              </div>
              <h2 className="text-3xl font-bold text-white">What She Does</h2>
            </div>
            <div className="space-y-4 text-slate-200">
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">💙</div>
                <p><strong className="text-white">Encourages you</strong> when things feel overwhelming</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">📊</div>
                <p><strong className="text-white">Tracks your progress</strong> so you can see how much you've done</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">💡</div>
                <p><strong className="text-white">Shares tips</strong> from thousands of successful reunions</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">✨</div>
                <p><strong className="text-white">Celebrates wins</strong> - big and small - with you</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Philosophy Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-br from-purple-500/20 via-rose-500/20 to-amber-500/20 border-2 border-amber-400/30 rounded-3xl p-10 mb-16"
        >
          <h2 className="text-4xl font-bold text-white mb-6 text-center">The Surumaa Promise</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                <Home className="text-emerald-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Never Give Up</h3>
              <p className="text-slate-200 text-sm">
                Every lost pet deserves to come home. Surumaa will remind you to keep going, even when it's hard.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="text-cyan-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">You're Not Alone</h3>
              <p className="text-slate-200 text-sm">
                Thousands of families have walked this path. Surumaa brings their wisdom to help you.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                <Heart className="text-rose-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Hope Lives Here</h3>
              <p className="text-slate-200 text-sm">
                Most lost pets ARE found. Surumaa helps you focus on action, not despair.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Where to Find Her */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="bg-white/5 backdrop-blur-sm border-2 border-white/10 rounded-3xl p-10 text-center"
        >
          <h2 className="text-4xl font-bold text-white mb-6">Where You'll See Surumaa</h2>
          <p className="text-slate-200 text-lg mb-8 max-w-3xl mx-auto leading-relaxed">
            Look for Surumaa throughout your search journey. She appears in your Case Command Center, celebrates when you complete tasks, and pops up with helpful tips at just the right moments. Think of her as your personal cheerleader and search coordinator rolled into one.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <div className="px-6 py-3 bg-cyan-500/20 border-2 border-cyan-500/50 text-cyan-400 rounded-full font-semibold">
              🎯 Case Command Center
            </div>
            <div className="px-6 py-3 bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400 rounded-full font-semibold">
              ✅ Task Completion
            </div>
            <div className="px-6 py-3 bg-purple-500/20 border-2 border-purple-500/50 text-purple-400 rounded-full font-semibold">
              📊 Progress Tracking
            </div>
            <div className="px-6 py-3 bg-amber-500/20 border-2 border-amber-500/50 text-amber-400 rounded-full font-semibold">
              💡 Helpful Tips
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="text-center mt-16"
        >
          <p className="text-slate-300 text-xl mb-8">
            Ready to bring your loved one home?
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/report/new"
              className="px-8 py-4 bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold rounded-full shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/50 hover:-translate-y-1 transition-all flex items-center gap-2"
            >
              <Heart size={20} />
              Report Lost Pet
            </Link>
            <Link
              href="/"
              className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white border-2 border-white/30 font-bold rounded-full hover:bg-white/20 transition-all flex items-center gap-2"
            >
              Back to Home
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
