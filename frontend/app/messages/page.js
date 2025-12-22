'use client';

/**
 * Messages Page - List all conversations
 *
 * Shows conversations between pet owners and finders
 * for potential matches.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageCircle, ArrowLeft, Dog, Cat, Bird, Rabbit,
  Clock, CheckCircle, AlertCircle, Loader2, ChevronRight,
  Heart, Search, Inbox
} from 'lucide-react';

const SPECIES_ICONS = {
  DOG: Dog,
  CAT: Cat,
  BIRD: Bird,
  RABBIT: Rabbit,
  OTHER: Heart
};

const STATUS_LABELS = {
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-700', icon: MessageCircle },
  PENDING_OWNER: { label: 'Awaiting Owner', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  PENDING_FINDER: { label: 'Awaiting Finder', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  REUNION_PENDING: { label: 'Reunion Pending', color: 'bg-blue-100 text-blue-700', icon: Heart },
  REUNITED: { label: 'Reunited!', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  CLOSED: { label: 'Closed', color: 'bg-gray-100 text-gray-500', icon: AlertCircle }
};

export default function MessagesPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login?redirect=/messages');
      return;
    }

    if (authStatus === 'authenticated') {
      fetchConversations();
    }
  }, [authStatus, router]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/conversations');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch conversations');
      }

      setConversations(data.conversations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-green-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 shadow-lg max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchConversations}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={24} />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Messages</h1>
            <p className="text-sm text-gray-500">
              {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </header>

      {/* Conversations List */}
      <main className="max-w-2xl mx-auto">
        {conversations.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Inbox size={36} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No conversations yet</h2>
            <p className="text-gray-600 mb-6">
              When someone finds a pet that matches a lost pet report,
              you can communicate here to coordinate the reunion.
            </p>
            <Link
              href="/database"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              <Search size={18} />
              Browse Pet Database
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {conversations.map((conv) => {
              const StatusIcon = STATUS_LABELS[conv.status]?.icon || MessageCircle;
              const statusInfo = STATUS_LABELS[conv.status] || STATUS_LABELS.ACTIVE;
              const SpeciesIcon = SPECIES_ICONS[conv.lostCase?.petSpecies] || Heart;
              const petPhoto = conv.lostCase?.petPhotoUrl || conv.foundCase?.petPhotoUrl;
              const petName = conv.lostCase?.petName || 'Unknown Pet';

              return (
                <li key={conv.id}>
                  <Link
                    href={`/messages/${conv.id}`}
                    className="block bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="px-4 py-4 flex items-center gap-4">
                      {/* Pet Photo */}
                      <div className="relative flex-shrink-0">
                        {petPhoto ? (
                          <img
                            src={petPhoto}
                            alt={petName}
                            className="w-14 h-14 rounded-full object-cover border-2 border-gray-100"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                            <SpeciesIcon size={24} className="text-gray-400" />
                          </div>
                        )}
                        {conv.unreadCount > 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                            <span className="text-xs text-white font-bold">
                              {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {petName}
                          </h3>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {formatTime(conv.lastMessageAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {conv.userRole === 'owner' ? 'You are the owner' : 'You found this pet'}
                          </span>
                        </div>

                        {conv.lastMessage && (
                          <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                            {conv.lastMessage.senderRole === 'SYSTEM' ? (
                              <span className="italic">{conv.lastMessage.content}</span>
                            ) : (
                              <>
                                {conv.lastMessage.senderId === session?.user?.id ? 'You: ' : ''}
                                {conv.lastMessage.content}
                              </>
                            )}
                          </p>
                        )}
                      </div>

                      <ChevronRight size={20} className="text-gray-400 flex-shrink-0" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
