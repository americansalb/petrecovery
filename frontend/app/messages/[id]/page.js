'use client';

/**
 * Conversation Detail Page
 *
 * Real-time messaging between pet owners and finders.
 * Includes pet comparison, privacy controls, and reunion confirmation.
 */

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/app/components/ui/Toast';
import {
  ArrowLeft, Send, Image, MapPin, Phone, Mail, Shield,
  CheckCircle, AlertCircle, Loader2, MoreVertical, X,
  Heart, Dog, Cat, Bird, Rabbit, Info, ChevronDown
} from 'lucide-react';

const SPECIES_ICONS = {
  DOG: Dog,
  CAT: Cat,
  BIRD: Bird,
  RABBIT: Rabbit,
  OTHER: Heart
};

export default function ConversationPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const conversationId = params.id;

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [showPetComparison, setShowPetComparison] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push(`/login?redirect=/messages/${conversationId}`);
      return;
    }

    if (authStatus === 'authenticated' && conversationId) {
      fetchConversation();
      // Poll for new messages every 10 seconds
      const interval = setInterval(fetchMessages, 10000);
      return () => clearInterval(interval);
    }
  }, [authStatus, conversationId, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversation = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/conversations/${conversationId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch conversation');
      }

      setConversation(data.conversation);
      setMessages(data.conversation.messages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`);
      const data = await response.json();

      if (response.ok && data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setMessages(prev => [...prev, data.message]);
      setNewMessage('');
      inputRef.current?.focus();
    } catch (err) {
      toast.error(err.message || 'Something went wrong.');
    } finally {
      setSending(false);
    }
  };

  const handleAction = async (action, reason = null) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Action failed');
      }

      // Refresh conversation
      fetchConversation();
      setShowActions(false);
    } catch (err) {
      toast.error(err.message || 'Something went wrong.');
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString();
  };

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-green-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 shadow-lg max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link
            href="/messages"
            className="inline-block px-4 py-2 bg-green-500 text-white rounded-lg"
          >
            Back to Messages
          </Link>
        </div>
      </div>
    );
  }

  if (!conversation) return null;

  const { lostCase, foundCase, owner, finder, userRole } = conversation;
  const otherParty = userRole === 'owner' ? finder : owner;
  const isClosed = conversation.status === 'CLOSED' || conversation.status === 'REUNITED';
  const SpeciesIcon = SPECIES_ICONS[lostCase?.petSpecies] || Heart;

  return (
    <div className="h-[100dvh] bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/messages" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={24} />
          </Link>

          <div
            className="flex-1 flex items-center gap-3 cursor-pointer"
            onClick={() => setShowPetComparison(true)}
          >
            {lostCase?.petPhotoUrl ? (
              <img
                src={lostCase.petPhotoUrl}
                alt={lostCase.petName}
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-100"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <SpeciesIcon size={20} className="text-gray-400" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-semibold text-gray-900 truncate">
                {lostCase?.petName || 'Unknown Pet'}
              </h1>
              <p className="text-sm text-gray-500 truncate">
                Match Score: {conversation.matchScore}%
              </p>
            </div>
            <ChevronDown size={16} className="text-gray-400" />
          </div>

          <button
            onClick={() => setShowActions(!showActions)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
          >
            <MoreVertical size={20} />
          </button>
        </div>

        {/* Match Score Banner */}
        <div className={`px-4 py-2 text-sm flex items-center gap-2 ${
          conversation.matchScore >= 80 ? 'bg-green-50 text-green-700' :
          conversation.matchScore >= 60 ? 'bg-blue-50 text-blue-700' :
          'bg-yellow-50 text-yellow-700'
        }`}>
          <Info size={16} />
          <span>
            {userRole === 'owner'
              ? `Someone may have found ${lostCase?.petName}!`
              : `This pet may belong to ${otherParty?.firstName || 'someone'}!`
            }
          </span>
          <button
            onClick={() => setShowPetComparison(true)}
            className="ml-auto text-sm underline"
          >
            Compare
          </button>
        </div>
      </header>

      {/* Actions Menu */}
      {showActions && (
        <div className="absolute top-16 right-4 bg-white rounded-xl shadow-xl border border-gray-200 z-20 py-2 w-56">
          {!isClosed && (
            <>
              <button
                onClick={() => handleAction('reveal_contact')}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
              >
                <Phone size={18} className="text-gray-500" />
                <span>Share My Contact Info</span>
              </button>
              <button
                onClick={() => handleAction('confirm_reunion')}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-green-600"
              >
                <CheckCircle size={18} />
                <span>Confirm Reunion</span>
              </button>
              <hr className="my-2" />
              <button
                onClick={() => handleAction('not_my_pet')}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-gray-500"
              >
                <X size={18} />
                <span>Not My Pet</span>
              </button>
            </>
          )}
          <button
            onClick={() => setShowActions(false)}
            className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-gray-500"
          >
            <ArrowLeft size={18} />
            <span>Close Menu</span>
          </button>
        </div>
      )}

      {/* Pet Comparison Modal */}
      {showPetComparison && (
        <div className="fixed inset-0 bg-black/50 z-30 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
              <h2 className="font-bold text-lg">Compare Pets</h2>
              <button onClick={() => setShowPetComparison(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Lost Pet */}
              <div className="bg-red-50 rounded-xl p-4">
                <h3 className="font-semibold text-red-800 mb-3">Lost Pet Report</h3>
                <div className="flex gap-4">
                  {lostCase?.petPhotoUrl && (
                    <img src={lostCase.petPhotoUrl} alt="" className="w-24 h-24 rounded-lg object-cover" />
                  )}
                  <div className="text-sm space-y-1">
                    <p><strong>Name:</strong> {lostCase?.petName}</p>
                    <p><strong>Breed:</strong> {lostCase?.petBreed || 'Unknown'}</p>
                    <p><strong>Color:</strong> {lostCase?.petColor}</p>
                    <p><strong>Size:</strong> {lostCase?.petSize}</p>
                    <p><strong>Last Seen:</strong> {lostCase?.lastSeenAddress}</p>
                  </div>
                </div>
              </div>

              {/* Found Pet */}
              <div className="bg-green-50 rounded-xl p-4">
                <h3 className="font-semibold text-green-800 mb-3">Found Pet Report</h3>
                <div className="flex gap-4">
                  {foundCase?.petPhotoUrl && (
                    <img src={foundCase.petPhotoUrl} alt="" className="w-24 h-24 rounded-lg object-cover" />
                  )}
                  <div className="text-sm space-y-1">
                    <p><strong>Description:</strong> {foundCase?.petName}</p>
                    <p><strong>Breed:</strong> {foundCase?.petBreed || 'Unknown'}</p>
                    <p><strong>Color:</strong> {foundCase?.petColor}</p>
                    <p><strong>Size:</strong> {foundCase?.petSize}</p>
                    <p><strong>Found At:</strong> {foundCase?.lastSeenAddress}</p>
                  </div>
                </div>
              </div>

              {/* Match Score Breakdown */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-2">Match Analysis</h3>
                <div className="flex items-center gap-3">
                  <div className={`text-3xl font-bold ${
                    conversation.matchScore >= 80 ? 'text-green-600' :
                    conversation.matchScore >= 60 ? 'text-blue-600' :
                    'text-yellow-600'
                  }`}>
                    {conversation.matchScore}%
                  </div>
                  <p className="text-sm text-gray-600">
                    {conversation.matchScore >= 80 ? 'Excellent match!' :
                     conversation.matchScore >= 60 ? 'Good potential match' :
                     'Possible match - verify carefully'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, index) => {
          const isOwn = msg.senderId === session?.user?.id;
          const isSystem = msg.senderRole === 'SYSTEM';
          const showDate = index === 0 ||
            formatDate(messages[index - 1].createdAt) !== formatDate(msg.createdAt);

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="text-center py-2">
                  <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm">
                    {formatDate(msg.createdAt)}
                  </span>
                </div>
              )}

              {isSystem ? (
                <div className="flex justify-center">
                  <div className="bg-gray-100 rounded-xl px-4 py-2 max-w-sm text-center">
                    <p className="text-sm text-gray-600 italic">{msg.content}</p>
                  </div>
                </div>
              ) : (
                <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${isOwn ? 'order-2' : 'order-1'}`}>
                    <div className={`rounded-2xl px-4 py-2 ${
                      isOwn
                        ? 'bg-green-500 text-white rounded-br-md'
                        : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <p className={`text-xs mt-1 ${isOwn ? 'text-right' : 'text-left'} text-gray-400`}>
                      {formatTime(msg.createdAt)}
                      {msg.readAt && isOwn && ' · Read'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Contact Info Banner (if revealed) */}
      {(conversation.ownerRevealed || conversation.finderRevealed) && (
        <div className="bg-blue-50 border-t border-blue-100 px-4 py-3">
          <div className="flex items-center gap-2 text-blue-700 text-sm">
            <Shield size={16} />
            <span>Contact info shared:</span>
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-sm">
            {userRole === 'owner' && conversation.finderRevealed && finder?.email && (
              <a href={`mailto:${finder.email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                <Mail size={14} /> {finder.email}
              </a>
            )}
            {userRole === 'finder' && conversation.ownerRevealed && owner?.email && (
              <a href={`mailto:${owner.email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                <Mail size={14} /> {owner.email}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Reunion Banner */}
      {conversation.status === 'REUNITED' && (
        <div className="bg-green-500 text-white px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <Heart size={20} fill="white" />
            <span className="font-semibold">Pet has been reunited with their family!</span>
          </div>
        </div>
      )}

      {/* Message Input */}
      {!isClosed ? (
        <form onSubmit={sendMessage} className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2">
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                rows={1}
                className="w-full bg-transparent resize-none focus:outline-none text-sm max-h-32"
                style={{ minHeight: '24px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className={`p-3 rounded-full transition-colors ${
                newMessage.trim() && !sending
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {sending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-gray-100 border-t border-gray-200 p-4 text-center text-gray-500">
          This conversation is closed.
        </div>
      )}
    </div>
  );
}
