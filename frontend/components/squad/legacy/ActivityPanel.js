'use client';

/**
 * ActivityPanel - Right panel with Chat, Activity, Announcements
 *
 * Three tabs:
 * - Chat: Free-form messages (division or squad-wide)
 * - Activity: System events feed
 * - Announcements: Pinned messages from leads
 *
 * Props:
 * - compact: When true, shows compact view with "Open Community view" links
 */

import { useState } from 'react';
import { useSquadHub } from './context/SquadHubContext';
import {
  MessageCircle,
  Activity,
  Megaphone,
  Send,
  User,
  Heart,
  Plus,
  AlertCircle,
  Pin,
  ArrowRight,
} from 'lucide-react';

const tabs = [
  { id: 'CHAT', label: 'Chat', icon: MessageCircle },
  { id: 'ACTIVITY', label: 'Activity', icon: Activity },
  { id: 'ANNOUNCEMENTS', label: 'Announcements', icon: Megaphone },
];

export default function ActivityPanel({ compact = false }) {
  const { activityTab, setActivityTab, events, chatMessages, announcements, selectedDivisionId, divisions, chatScope, setChatScope, openCommunityView } = useSquadHub();

  return (
    <div className="h-full flex flex-col bg-[var(--hub-bg-panel)]">
      {/* Tabs */}
      <div className="flex gap-1 p-2 border-b border-[var(--hub-border)]">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activityTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActivityTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-1.5
                py-2 px-2 rounded-lg text-xs font-medium
                transition-all duration-200
                ${isActive
                  ? 'bg-[var(--hub-bg-card)] text-[var(--hub-text-primary)]'
                  : 'text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)] hover:bg-[var(--hub-bg-card)]/50'
                }
              `}
            >
              <Icon size={14} />
              <span className="hidden lg:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activityTab === 'CHAT' && (
          <ChatTab
            messages={chatMessages}
            selectedDivisionId={selectedDivisionId}
            divisions={divisions}
            chatScope={chatScope}
            setChatScope={setChatScope}
            compact={compact}
            onOpenCommunity={openCommunityView}
          />
        )}
        {activityTab === 'ACTIVITY' && <ActivityTab events={events} compact={compact} />}
        {activityTab === 'ANNOUNCEMENTS' && (
          <AnnouncementsTab
            announcements={announcements}
            compact={compact}
            onOpenCommunity={openCommunityView}
          />
        )}
      </div>
    </div>
  );
}

function ChatTab({ messages, selectedDivisionId, divisions, chatScope, setChatScope, compact, onOpenCommunity }) {
  const [newMessage, setNewMessage] = useState('');
  const { sendChatMessage, membership } = useSquadHub();

  const divisionName = selectedDivisionId === 'ALL'
    ? 'Squad'
    : divisions.find(d => d.id === selectedDivisionId)?.name || 'Division';

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    await sendChatMessage(newMessage, chatScope === 'DIVISION' ? selectedDivisionId : null);
    setNewMessage('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // In compact mode, show limited messages
  const displayMessages = compact ? messages.slice(-5) : messages;

  return (
    <div className="h-full flex flex-col">
      {/* Scope toggle */}
      {selectedDivisionId !== 'ALL' && (
        <div className="px-3 py-2 border-b border-[var(--hub-border)] flex gap-2">
          <button
            onClick={() => setChatScope('DIVISION')}
            className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all ${
              chatScope === 'DIVISION'
                ? 'bg-[var(--hub-accent-primary)]/20 text-[var(--hub-accent-primary)]'
                : 'text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)]'
            }`}
          >
            {divisionName}
          </button>
          <button
            onClick={() => setChatScope('SQUAD')}
            className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-all ${
              chatScope === 'SQUAD'
                ? 'bg-[var(--hub-accent-primary)]/20 text-[var(--hub-accent-primary)]'
                : 'text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)]'
            }`}
          >
            Whole Squad
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageCircle size={32} className="text-[var(--hub-text-muted)] mb-3" />
            <p className="text-xs text-[var(--hub-text-muted)]">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          displayMessages.map(msg => (
            <ChatMessage key={msg.id} message={msg} compact={compact} />
          ))
        )}
      </div>

      {/* Open Community link - compact mode */}
      {compact && onOpenCommunity && (
        <button
          onClick={onOpenCommunity}
          className="mx-3 mb-2 flex items-center justify-center gap-1.5 py-2 text-xs text-[var(--hub-accent-primary)] hover:text-[var(--hub-accent-primary-bright)] transition-colors"
        >
          Open Community view
          <ArrowRight size={12} />
        </button>
      )}

      {/* Input */}
      {membership.isMember && (
        <div className="p-3 border-t border-[var(--hub-border)]">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--hub-bg-card)] border border-[var(--hub-border)] text-sm text-[var(--hub-text-primary)] placeholder-[var(--hub-text-muted)] focus:outline-none focus:border-[var(--hub-accent-primary)]/50"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim()}
              className="w-10 h-10 rounded-lg bg-[var(--hub-accent-primary)] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-[var(--hub-accent-primary-dim)]"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatMessage({ message, compact }) {
  // Map roles to CSS classes for high contrast
  const roleClasses = {
    MEMBER: 'text-[var(--hub-text-secondary)]',
    LEAD: 'text-[var(--hub-accent-primary)]',
    ADMIN: 'text-[var(--hub-accent-secondary)]',
  };

  return (
    <div className="hub-activity-item">
      <div className="flex items-start gap-2">
        {!compact && (
          <div className="w-8 h-8 rounded-full bg-[var(--hub-bg-elevated)] flex items-center justify-center flex-shrink-0">
            <User size={14} className="text-[var(--hub-text-muted)]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`font-bold ${compact ? 'text-[10px]' : 'text-xs'} ${roleClasses[message.authorRole] || roleClasses.MEMBER}`}>
              {message.authorName}
            </span>
            <span className="text-[10px] text-[var(--hub-text-muted)]">
              {formatTime(message.createdAt)}
            </span>
          </div>
          <p className={`text-[var(--hub-text-secondary)] break-words ${compact ? 'text-xs line-clamp-2' : 'text-sm'}`}>
            {message.content}
          </p>
        </div>
      </div>
    </div>
  );
}

function ActivityTab({ events, compact }) {
  // In compact mode, show limited events
  const displayEvents = compact ? events.slice(0, 5) : events;

  return (
    <div className="h-full overflow-y-auto p-3 space-y-2">
      {displayEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <Activity size={32} className="text-[var(--hub-text-muted)] mb-3" />
          <p className="text-xs text-[var(--hub-text-muted)]">
            No recent activity. Events will appear here as they happen.
          </p>
        </div>
      ) : (
        displayEvents.map(event => (
          <ActivityEvent key={event.id} event={event} compact={compact} />
        ))
      )}
    </div>
  );
}

function ActivityEvent({ event, compact }) {
  const config = getEventConfig(event);

  return (
    <div className={`hub-activity-item flex items-start gap-2 ${compact ? 'p-1.5' : 'p-2'} rounded-lg bg-[var(--hub-bg-card)]/50`}>
      <div className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} rounded-full flex items-center justify-center flex-shrink-0 ${config.bgClass}`}>
        <config.icon size={compact ? 12 : 14} className={config.iconClass} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[var(--hub-text-secondary)] ${compact ? 'text-[10px] line-clamp-1' : 'text-xs'}`}>
          {config.message}
        </p>
        <span className="text-[10px] text-[var(--hub-text-muted)]">
          {formatTime(event.createdAt)}
        </span>
      </div>
    </div>
  );
}

function AnnouncementsTab({ announcements, compact, onOpenCommunity }) {
  // In compact mode, show limited announcements
  const displayAnnouncements = compact ? announcements.slice(0, 2) : announcements;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {displayAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Megaphone size={32} className="text-[var(--hub-text-muted)] mb-3" />
            <p className="text-xs text-[var(--hub-text-muted)]">
              No announcements yet. Squad leads can post important updates here.
            </p>
          </div>
        ) : (
          displayAnnouncements.map(ann => (
            <Announcement key={ann.id} announcement={ann} compact={compact} />
          ))
        )}
      </div>

      {/* Open Community link - compact mode */}
      {compact && onOpenCommunity && (
        <button
          onClick={onOpenCommunity}
          className="mx-3 mb-3 flex items-center justify-center gap-1.5 py-2 text-xs text-[var(--hub-accent-primary)] hover:text-[var(--hub-accent-primary-bright)] transition-colors"
        >
          Open Community view
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

function Announcement({ announcement, compact }) {
  return (
    <div className={`hub-activity-item ${compact ? 'p-2' : 'p-3'} rounded-lg bg-[var(--hub-bg-card)] border border-[var(--hub-border)]`}>
      <div className="flex items-center gap-2 mb-1">
        {announcement.isPinned && (
          <Pin size={compact ? 10 : 12} className="text-[var(--hub-accent-primary)]" />
        )}
        <span className={`font-semibold text-[var(--hub-text-primary)] ${compact ? 'text-[10px]' : 'text-xs'}`}>
          {announcement.title}
        </span>
      </div>
      <p className={`text-[var(--hub-text-secondary)] ${compact ? 'text-xs line-clamp-2 mb-1' : 'text-sm mb-2'}`}>
        {announcement.content}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--hub-text-muted)]">
          By {announcement.authorName}
        </span>
        <span className="text-[10px] text-[var(--hub-text-muted)]">
          {formatTime(announcement.createdAt)}
        </span>
      </div>
    </div>
  );
}

// Helpers - using CSS classes for colors
function getEventConfig(event) {
  switch (event.type) {
    case 'case_created':
      return {
        icon: Plus,
        bgClass: 'hub-urgency-high-bg',
        iconClass: 'hub-urgency-high-text',
        message: `New case: ${event.payload.petName || 'Unknown pet'} reported missing`,
      };
    case 'case_reunited':
      return {
        icon: Heart,
        bgClass: 'bg-[var(--hub-status-success)]/20',
        iconClass: 'text-[var(--hub-status-success)]',
        message: `${event.payload.petName || 'A pet'} was reunited with their family!`,
      };
    case 'member_joined':
      return {
        icon: User,
        bgClass: 'bg-[var(--hub-accent-primary)]/20',
        iconClass: 'text-[var(--hub-accent-primary)]',
        message: `${event.payload.memberName || 'Someone'} joined the squad`,
      };
    case 'sighting_reported':
      return {
        icon: AlertCircle,
        bgClass: 'hub-urgency-medium-bg',
        iconClass: 'hub-urgency-medium-text',
        message: `New sighting reported for ${event.payload.petName || 'a pet'}`,
      };
    case 'status_changed':
      return {
        icon: Activity,
        bgClass: 'bg-[var(--hub-accent-secondary)]/20',
        iconClass: 'text-[var(--hub-accent-secondary)]',
        message: event.payload.message || 'Case status updated',
      };
    default:
      return {
        icon: Activity,
        bgClass: 'bg-[var(--hub-text-muted)]/20',
        iconClass: 'text-[var(--hub-text-muted)]',
        message: 'Activity recorded',
      };
  }
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}
