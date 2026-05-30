'use client';

import Link from 'next/link';
import { Mail, MessageCircle, ArrowRight, Search, Heart, Shield, Clock, MapPin } from 'lucide-react';

const SUPPORT_EMAIL = 'support@petrecovery.org';

const QUICK_ACTIONS = [
  {
    href: '/report/new',
    icon: Heart,
    title: 'My pet is lost',
    desc: 'Start a report and rally your local search party in minutes.',
    accent: 'from-rose-500 to-red-500',
  },
  {
    href: '/report/found',
    icon: Search,
    title: 'I found a pet',
    desc: 'Report a found pet so we can match it to a worried owner.',
    accent: 'from-emerald-500 to-emerald-600',
  },
  {
    href: '/patrol/join',
    icon: Shield,
    title: 'Become a volunteer',
    desc: 'Join a rescue force and help reunite pets near you.',
    accent: 'from-flash-400 to-amber-400',
  },
  {
    href: '/database',
    icon: MapPin,
    title: 'Search the database',
    desc: 'Browse lost and found pets reported in your area.',
    accent: 'from-blue-500 to-indigo-600',
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0a1526] via-midnight-900 to-[#0c1a30] py-20 md:py-24">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[620px] h-[620px] bg-flash-400/15 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute -bottom-24 right-0 w-[380px] h-[380px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.4] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(1.5px 1.5px at 25% 30%, rgba(255,255,255,0.4) 50%, transparent), radial-gradient(1.5px 1.5px at 75% 55%, rgba(255,255,255,0.3) 50%, transparent), radial-gradient(1px 1px at 50% 80%, rgba(250,204,21,0.4) 50%, transparent)' }}
        />
        <div className="max-w-3xl mx-auto px-4 text-center relative">
          <span className="inline-flex items-center gap-2 bg-flash-400/10 text-flash-200 px-4 py-2 rounded-full border border-flash-400/25 backdrop-blur-sm text-sm font-medium mb-5">
            <MessageCircle className="w-4 h-4" /> We&apos;re here to help
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Get in{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-flash-300 via-flash-400 to-amber-300 drop-shadow-[0_0_24px_rgba(250,204,21,0.35)]">
              Touch
            </span>
          </h1>
          <p className="text-midnight-200 text-lg max-w-xl mx-auto">
            Questions, feedback, or need a hand with a search? Our team reads every message.
          </p>
        </div>
      </section>

      {/* Email card */}
      <section className="max-w-3xl mx-auto px-4 -mt-12 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-10 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-flash-300 to-flash-400 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-flash-200">
            <Mail className="w-8 h-8 text-midnight-900" />
          </div>
          <h2 className="text-2xl font-bold text-midnight-900 mb-2">Email our team</h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            The fastest way to reach a real person. We typically reply within one business day.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-flash-400 to-amber-400 hover:from-flash-300 hover:to-amber-300 text-midnight-900 px-7 py-3.5 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-flash-200 hover:scale-[1.02]"
          >
            {SUPPORT_EMAIL} <ArrowRight className="w-5 h-5" />
          </a>
          <p className="flex items-center justify-center gap-2 text-sm text-slate-400 mt-5">
            <Clock className="w-4 h-4" /> Monitored 7 days a week
          </p>
        </div>
      </section>

      {/* Quick actions */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-midnight-900 mb-2">
            Looking for something specific?
          </h2>
          <p className="text-slate-500">
            Many things are faster to do directly — jump straight in below.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-start gap-4 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all"
              >
                <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${a.accent} flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-midnight-900 flex items-center gap-1.5">
                    {a.title}
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-flash-500 group-hover:translate-x-0.5 transition-all" />
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">{a.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
