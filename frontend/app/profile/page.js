'use client';

/**
 * Profile Page - Updated with PetRecovery Design System
 * Uses: Midnight Blue + Flashlight Yellow color palette
 */

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User,
  Award,
  MapPin,
  Users,
  Heart,
  Trophy,
  Target,
  ChevronRight,
  Settings,
  Bell,
  LogOut,
  Star,
  Zap,
  Shield,
  Crown,
  ArrowLeft,
  Phone,
  Mail,
  Loader2,
  Check,
  X,
  Edit3
} from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';

// Level configuration with thresholds and rewards
const RESCUE_LEVELS = {
  PET_OWNER: {
    name: 'Pet Owner',
    level: 0,
    icon: User,
    color: 'text-midnight-500',
    bg: 'bg-midnight-100',
    borderColor: 'border-midnight-300',
    description: 'Submitted a lost pet request',
    nextLevel: 'SCOUT',
    requirement: 'Join a rescue force'
  },
  SCOUT: {
    name: 'Scout',
    level: 1,
    icon: Target,
    color: 'text-green-600',
    bg: 'bg-green-100',
    borderColor: 'border-green-300',
    description: 'Joined a rescue force',
    nextLevel: 'SENTRY',
    requirement: 'Participate in first case'
  },
  SENTRY: {
    name: 'Sentry',
    level: 2,
    icon: Shield,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    borderColor: 'border-blue-300',
    description: 'Participated in first case',
    nextLevel: 'SHEPHERD',
    requirement: 'Mark 5+ areas, 15+ acres total'
  },
  SHEPHERD: {
    name: 'Shepherd',
    level: 3,
    icon: MapPin,
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    borderColor: 'border-purple-300',
    description: 'Marked 5+ areas, 15+ acres total',
    nextLevel: 'PATHFINDER',
    requirement: '1+ successful reunion'
  },
  PATHFINDER: {
    name: 'Pathfinder',
    level: 4,
    icon: Zap,
    color: 'text-flash-600',
    bg: 'bg-flash-100',
    borderColor: 'border-flash-300',
    description: '1+ successful reunion',
    nextLevel: 'PACK_GUARDIAN',
    requirement: '5+ successful reunions'
  },
  PACK_GUARDIAN: {
    name: 'Pack Guardian',
    level: 5,
    icon: Star,
    color: 'text-red-600',
    bg: 'bg-red-100',
    borderColor: 'border-red-300',
    description: '5+ successful reunions',
    nextLevel: 'PACK_LEGEND',
    requirement: '50+ successful reunions'
  },
  PACK_LEGEND: {
    name: 'Pack Legend',
    level: 6,
    icon: Crown,
    color: 'text-amber-600',
    bg: 'bg-amber-100',
    borderColor: 'border-amber-300',
    description: '50+ successful reunions',
    nextLevel: null,
    requirement: 'Maximum level reached!'
  }
};

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      loadProfile();
    }
  }, [status]);

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      setUser(data.user);
      setFormData({
        firstName: data.user.firstName || '',
        lastName: data.user.lastName || '',
        phone: data.user.phone || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      setUser(prev => ({ ...prev, ...formData }));
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setEditMode(false);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  const getCurrentLevel = () => {
    return RESCUE_LEVELS[user?.rescueLevel] || RESCUE_LEVELS.PET_OWNER;
  };

  const getLevelProgress = () => {
    const level = getCurrentLevel();
    if (!level.nextLevel) return 100;

    const { successfulReunions = 0, areasMarkedCount = 0, totalAcreageSearched = 0, squadsJoinedCount = 0 } = user || {};

    switch (user?.rescueLevel) {
      case 'PET_OWNER':
        return squadsJoinedCount > 0 ? 100 : 0;
      case 'SCOUT':
        return areasMarkedCount > 0 ? 100 : 0;
      case 'SENTRY':
        const areaProgress = Math.min((areasMarkedCount / 5) * 50, 50);
        const acreProgress = Math.min((totalAcreageSearched / 15) * 50, 50);
        return Math.floor(areaProgress + acreProgress);
      case 'SHEPHERD':
        return successfulReunions >= 1 ? 100 : 0;
      case 'PATHFINDER':
        return Math.min(Math.floor((successfulReunions / 5) * 100), 100);
      case 'PACK_GUARDIAN':
        return Math.min(Math.floor((successfulReunions / 50) * 100), 100);
      default:
        return 0;
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-midnight-100 to-midnight-200">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-flash-400 animate-spin mx-auto mb-4" />
          <p className="text-midnight-500 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!session || !user) return null;

  const currentLevel = getCurrentLevel();
  const LevelIcon = currentLevel.icon;
  const progress = getLevelProgress();

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight-100 to-midnight-200">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-midnight-900 to-midnight-800 px-4 pt-6 pb-24 relative">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-midnight-300 hover:text-white font-semibold mb-6 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-6 flex-wrap">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-2xl bg-midnight-700 flex items-center justify-center border-4 border-midnight-600">
              <User className="w-12 h-12 text-midnight-300" />
            </div>

            <div className="flex-1 min-w-[200px]">
              <h1 className="text-3xl font-bold text-white mb-1">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-midnight-300 mb-3">{user.email}</p>
              <div className={`inline-flex items-center gap-2 px-4 py-2 ${currentLevel.bg} rounded-full`}>
                <LevelIcon className={`w-5 h-5 ${currentLevel.color}`} />
                <span className={`font-bold text-sm ${currentLevel.color}`}>
                  {currentLevel.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-16 pb-12">
        {/* Message */}
        {message.text && (
          <div
            role="alert"
            className={`px-4 py-3 rounded-xl mb-6 font-semibold ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Level Progress Card */}
        <Card className="mb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-midnight-900 flex items-center gap-2">
              <Award className="w-6 h-6 text-flash-500" />
              Rescue Level Progress
            </h2>
            {user.honorsReceived > 0 && (
              <Badge variant="warning" className="flex items-center gap-1">
                <Trophy className="w-4 h-4" />
                {user.honorsReceived} Honors
              </Badge>
            )}
          </div>

          {/* Current Level Display */}
          <div className={`flex items-center gap-6 mb-6 p-6 ${currentLevel.bg} rounded-xl`}>
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-md">
              <LevelIcon className={`w-8 h-8 ${currentLevel.color}`} />
            </div>
            <div className="flex-1">
              <div className="text-xs text-midnight-500 font-semibold mb-1">
                LEVEL {currentLevel.level}
              </div>
              <div className="text-2xl font-bold text-midnight-900 mb-1">
                {currentLevel.name}
              </div>
              <div className="text-sm text-midnight-500">
                {currentLevel.description}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          {currentLevel.nextLevel && (
            <div>
              <div className="flex justify-between mb-2 text-sm text-midnight-500">
                <span className="font-semibold">Progress to {RESCUE_LEVELS[currentLevel.nextLevel].name}</span>
                <span className="font-bold text-flash-600">{progress}%</span>
              </div>
              <div className="h-3 bg-midnight-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-flash-400 to-flash-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-midnight-500">
                <strong>Next:</strong> {currentLevel.requirement}
              </p>
            </div>
          )}
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Forces Joined', value: user.squadsJoinedCount || 0, icon: Users, color: 'text-midnight-600', bg: 'bg-midnight-100' },
            { label: 'Areas Marked', value: user.areasMarkedCount || 0, icon: MapPin, color: 'text-green-600', bg: 'bg-green-100' },
            { label: 'Acreage Searched', value: `${(user.totalAcreageSearched || 0).toFixed(1)}`, icon: Target, color: 'text-flash-600', bg: 'bg-flash-100' },
            { label: 'Reunions', value: user.successfulReunions || 0, icon: Heart, color: 'text-red-600', bg: 'bg-red-100' },
          ].map((stat, i) => (
            <Card key={i} className="p-4">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-xs text-midnight-500 font-semibold mb-1">
                {stat.label}
              </div>
              <div className="text-2xl font-bold text-midnight-900">
                {stat.value}
              </div>
            </Card>
          ))}
        </div>

        {/* All Levels */}
        <Card className="mb-6">
          <h2 className="text-xl font-bold text-midnight-900 mb-6">
            All Rescue Levels
          </h2>

          <div className="space-y-3">
            {Object.entries(RESCUE_LEVELS).map(([key, level]) => {
              const Icon = level.icon;
              const isCurrentLevel = user.rescueLevel === key;
              const isPastLevel = level.level < currentLevel.level;
              const isFutureLevel = level.level > currentLevel.level;

              return (
                <div
                  key={key}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition ${
                    isCurrentLevel
                      ? `${level.bg} ${level.borderColor}`
                      : isFutureLevel
                      ? 'bg-midnight-50 border-midnight-200 opacity-60'
                      : 'bg-white border-midnight-100'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl ${isPastLevel || isCurrentLevel ? level.bg : 'bg-midnight-100'} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${isPastLevel || isCurrentLevel ? level.color : 'text-midnight-400'}`} />
                  </div>
                  <div className="flex-1">
                    <div className={`font-bold ${isCurrentLevel ? level.color : 'text-midnight-900'} text-sm flex items-center gap-2`}>
                      Level {level.level}: {level.name}
                      {isCurrentLevel && (
                        <span className="px-2 py-0.5 bg-flash-400 text-midnight-900 rounded text-xs font-bold">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-midnight-500">
                      {level.description}
                    </div>
                  </div>
                  {isPastLevel && (
                    <Badge variant="success" size="sm">
                      <Check className="w-3 h-3 mr-1" />
                      Achieved
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Account Settings */}
        <Card className="mb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-midnight-900 flex items-center gap-2">
              <Settings className="w-6 h-6 text-midnight-500" />
              Account Settings
            </h2>
            {!editMode && (
              <Button variant="secondary" size="sm" leftIcon={Edit3} onClick={() => setEditMode(true)}>
                Edit
              </Button>
            )}
          </div>

          {editMode ? (
            <form onSubmit={handleSave}>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label htmlFor="firstName" className="block mb-2 font-semibold text-midnight-700 text-sm">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block mb-2 font-semibold text-midnight-700 text-sm">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block mb-2 font-semibold text-midnight-700 text-sm">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={X}
                  onClick={() => {
                    setEditMode(false);
                    setFormData({
                      firstName: user.firstName || '',
                      lastName: user.lastName || '',
                      phone: user.phone || '',
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={saving} leftIcon={Check}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <div className="text-xs text-midnight-500 font-semibold mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  First Name
                </div>
                <div className="text-midnight-900 font-medium">
                  {user.firstName || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs text-midnight-500 font-semibold mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Last Name
                </div>
                <div className="text-midnight-900 font-medium">
                  {user.lastName || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs text-midnight-500 font-semibold mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Email
                </div>
                <div className="text-midnight-900 font-medium">
                  {user.email}
                </div>
              </div>
              <div>
                <div className="text-xs text-midnight-500 font-semibold mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  Phone
                </div>
                <div className="text-midnight-900 font-medium">
                  {user.phone || '-'}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Quick Links */}
        <div className="grid md:grid-cols-2 gap-4">
          <Link href="/settings/notifications" className="block group">
            <Card className="flex items-center gap-4 hover:shadow-card-hover transition">
              <div className="w-11 h-11 rounded-xl bg-midnight-100 flex items-center justify-center group-hover:bg-flash-100 transition">
                <Bell className="w-5 h-5 text-midnight-600 group-hover:text-flash-600 transition" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-midnight-900">Notification Settings</div>
                <div className="text-sm text-midnight-500">Manage email preferences</div>
              </div>
              <ChevronRight className="w-5 h-5 text-midnight-400 group-hover:text-midnight-600 transition" />
            </Card>
          </Link>

          <button onClick={handleSignOut} className="w-full text-left group">
            <Card className="flex items-center gap-4 border-2 border-red-100 hover:border-red-200 hover:shadow-card-hover transition">
              <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-red-600">Sign Out</div>
                <div className="text-sm text-midnight-500">Log out of your account</div>
              </div>
            </Card>
          </button>
        </div>
      </div>
    </div>
  );
}
