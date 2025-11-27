'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  AlertTriangle,
  Heart,
  Search,
  Users,
  MapPin,
  Clock,
  Shield,
  ArrowRight,
  CheckCircle2,
  Bell,
  Sparkles,
} from 'lucide-react';

export default function Home() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated' && session;

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <Heart className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-semibold text-gray-900 tracking-tight">
                PetRecovery
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link
                href="/database"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
              >
                Search Pets
              </Link>
              <Link
                href="/patrol/join"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
              >
                Volunteer
              </Link>
              <Link
                href="/rescue-squads"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
              >
                Rescue Squads
              </Link>
            </div>

            <div className="flex items-center gap-3">
              {isLoading ? (
                <span className="text-gray-400 text-sm">...</span>
              ) : isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-amber-50/30" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-100/50 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 lg:pt-24 lg:pb-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                <span>847 pets reunited and counting</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-6">
                Bring them{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-800">
                  home safe
                </span>
              </h1>

              <p className="text-lg text-gray-600 leading-relaxed mb-8">
                When your pet goes missing, every minute counts. Our community-powered
                platform connects you with local volunteers who help search, share sightings,
                and bring your family member home.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/report/new"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/25 hover:shadow-xl hover:shadow-red-600/30"
                >
                  <AlertTriangle className="w-5 h-5" />
                  Report Lost Pet
                </Link>
                <Link
                  href="/database"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
                >
                  <Search className="w-5 h-5" />
                  Search Database
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-6 mt-10 pt-8 border-t border-gray-100">
                <div className="flex items-center gap-2 text-gray-600">
                  <Shield className="w-5 h-5 text-green-600" />
                  <span className="text-sm">Verified volunteers</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-sm">48hr avg. recovery</span>
                </div>
              </div>
            </div>

            {/* Right: Hero Image Placeholder */}
            <div className="hidden lg:block relative">
              <div className="aspect-square max-w-lg mx-auto bg-gradient-to-br from-blue-100 to-amber-100 rounded-3xl flex items-center justify-center overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.15),transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(251,191,36,0.15),transparent_50%)]" />

                <div className="text-center p-8">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                    <Heart className="w-12 h-12 text-red-500" />
                  </div>
                  <p className="text-gray-600 font-medium">
                    Every pet deserves to come home
                  </p>
                </div>
              </div>

              {/* Floating cards */}
              <div className="absolute -left-4 top-1/4 bg-white rounded-2xl shadow-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Pet Found!</p>
                    <p className="text-xs text-gray-500">2 minutes ago</p>
                  </div>
                </div>
              </div>

              <div className="absolute -right-4 bottom-1/4 bg-white rounded-2xl shadow-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Bell className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">New Sighting</p>
                    <p className="text-xs text-gray-500">Near downtown</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-white">847</p>
              <p className="text-gray-400 text-sm mt-1">Pets Reunited</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-white">2,400+</p>
              <p className="text-gray-400 text-sm mt-1">Active Volunteers</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-white">48 hrs</p>
              <p className="text-gray-400 text-sm mt-1">Avg. Recovery Time</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-white">150+</p>
              <p className="text-gray-400 text-sm mt-1">Cities Covered</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How can we help you?
            </h2>
            <p className="text-lg text-gray-600">
              Whether you've lost a pet, found one, or want to help your community,
              we have the tools you need.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {/* Report Lost Pet Card */}
            <Link
              href="/report/new"
              className="group relative bg-white rounded-2xl p-8 border border-gray-200 hover:border-red-200 hover:shadow-xl transition-all duration-300"
            >
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center px-2.5 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                  URGENT
                </span>
              </div>

              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-7 h-7 text-red-600" />
              </div>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Report a Lost Pet
              </h3>

              <p className="text-gray-600 mb-6 leading-relaxed">
                Time is critical. Alert nearby volunteers instantly and get
                step-by-step guidance to maximize your chances of reunion.
              </p>

              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  Instant community alerts
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  Real-time sighting updates
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  Expert recovery guidance
                </li>
              </ul>

              <span className="inline-flex items-center gap-2 text-red-600 font-semibold group-hover:gap-3 transition-all">
                Start recovery
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>

            {/* Report Found Pet Card */}
            <Link
              href="/report/found"
              className="group relative bg-white rounded-2xl p-8 border border-gray-200 hover:border-green-200 hover:shadow-xl transition-all duration-300"
            >
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                  BE A HERO
                </span>
              </div>

              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Heart className="w-7 h-7 text-green-600" />
              </div>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Found a Pet?
              </h3>

              <p className="text-gray-600 mb-6 leading-relaxed">
                Help reunite a lost pet with their family. Your report could
                bring someone's best friend home today.
              </p>

              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  Match with lost pet reports
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  Safe reunion coordination
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  Notify nearby searchers
                </li>
              </ul>

              <span className="inline-flex items-center gap-2 text-green-600 font-semibold group-hover:gap-3 transition-all">
                Report found pet
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>

            {/* Join Volunteers Card */}
            <Link
              href="/patrol/join"
              className="group relative bg-white rounded-2xl p-8 border border-gray-200 hover:border-blue-200 hover:shadow-xl transition-all duration-300"
            >
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                  COMMUNITY
                </span>
              </div>

              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-7 h-7 text-blue-600" />
              </div>

              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Become a Volunteer
              </h3>

              <p className="text-gray-600 mb-6 leading-relaxed">
                Join your local patrol and receive alerts when pets go missing
                near you. Make a difference in your neighborhood.
              </p>

              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  Local sighting alerts
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  Coordinate with rescue squads
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  Earn volunteer recognition
                </li>
              </ul>

              <span className="inline-flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-3 transition-all">
                Join the patrol
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How it works
            </h2>
            <p className="text-lg text-gray-600">
              Our proven process helps reunite pets with their families quickly and safely.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                <AlertTriangle className="w-8 h-8 text-red-600" />
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  1
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Report Immediately
              </h3>
              <p className="text-gray-600">
                Submit details about your lost pet. We'll create a case file and
                begin alerting nearby volunteers right away.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                <Users className="w-8 h-8 text-blue-600" />
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  2
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Community Mobilizes
              </h3>
              <p className="text-gray-600">
                Local patrol members receive instant alerts. Volunteers in your
                area begin searching and reporting sightings.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6 relative">
                <Heart className="w-8 h-8 text-green-600" />
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  3
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Reunite Safely
              </h3>
              <p className="text-gray-600">
                Track sightings in real-time and coordinate safely through our
                platform to bring your pet home.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 lg:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Trusted by pet owners
            </h2>
            <p className="text-lg text-gray-600">
              Hear from families who've been reunited with their pets.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Sparkles key={i} className="w-4 h-4 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-600 mb-6 leading-relaxed">
                "Within 4 hours of posting, a neighbor spotted our dog. The community
                response was incredible. Max is home safe!"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">SM</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Sarah M.</p>
                  <p className="text-sm text-gray-500">Denver, CO</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Sparkles key={i} className="w-4 h-4 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-600 mb-6 leading-relaxed">
                "The step-by-step guidance kept me calm during a panic. We found
                our cat the next morning thanks to a volunteer's sighting."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-semibold text-sm">MT</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Michael T.</p>
                  <p className="text-sm text-gray-500">Austin, TX</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Sparkles key={i} className="w-4 h-4 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-600 mb-6 leading-relaxed">
                "I volunteer because I know how it feels. Helping reunite families
                with their pets is the most rewarding thing I do."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 font-semibold text-sm">LK</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Lisa K.</p>
                  <p className="text-sm text-gray-500">Seattle, WA</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-28 bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to help bring pets home?
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of volunteers who make a difference in their communities
            every day. Together, we can reunite more families.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/patrol/join"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-colors"
            >
              <Users className="w-5 h-5" />
              Join the Patrol
            </Link>
            <Link
              href="/database"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-500/20 text-white font-semibold rounded-xl border border-white/20 hover:bg-blue-500/30 transition-colors"
            >
              <Search className="w-5 h-5" />
              Browse Database
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Heart className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-semibold">PetRecovery</span>
              </div>
              <p className="text-gray-400 text-sm">
                Reuniting lost pets with their families since 2024.
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/database" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Pet Database
                  </Link>
                </li>
                <li>
                  <Link href="/advice" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Recovery Tips
                  </Link>
                </li>
                <li>
                  <Link href="/rescue-squads" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Rescue Squads
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Community</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/patrol/join" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Become a Volunteer
                  </Link>
                </li>
                <li>
                  <Link href="/rescue-squads" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Start a Squad
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/about" className="text-gray-400 hover:text-white text-sm transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-800 text-center">
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} PetRecovery.org. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
