'use client';

/**
 * CommunityTabsMobile - Mobile layout for Community tab
 *
 * Features:
 * - Inner tab bar: Chat | Requests | Announcements
 * - "On duty now" pill with count
 * - Full-screen views for each tab
 */

import { useState } from 'react';
import { useSquadHub } from './context/SquadHubContext';
import {
  MessageCircle,
  HelpCircle,
  Megaphone,
  Send,
  User,
  Pin,
  HandHelping,
  CheckCircle,
  Users,
} from 'lucide-react';

const mobileTabs = [
  { id: 'CHAT', label: 'Chat', icon: MessageCircle },
  { id: 'REQUESTS', label: 'Requests', icon: HelpCircle },
  { id: 'ANNOUNCEMENTS', label: 'Announces', icon: Megaphone },
];

export default function CommunityTabsMobile() {
  const {
    mobileCommunityTab,
    setMobileCommunityTab,
    chatMessages,
    announcements,
    filteredRequests,
    onDutyMembers,
    selectedDivisionId,
    divisions,
    chatScope,
    setChatScope,
    sendChatMessage,
    membership,
    helpOnRequest,
    postRequest,
    postAnnouncement,
    squad,
  } = useSquadHub();

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--hub-bg-root)]">
      {/* Header with On Duty pill */}
      <div className="px-4 py-2 bg-[var(--hub-bg-panel)] border-b border-[var(--hub-border)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--hub-text-primary)]">
            Community
          </span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--hub-status-success)]/15 border border-[var(--hub-status-success)]/30">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--hub-status-success)] animate-pulse" />
            <Users size={12} className="text-[var(--hub-status-success)]" />
            <span className="text-[10px] font-medium text-[var(--hub-status-success)]">
              {onDutyMembers.length} on duty
            </span>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex bg-[var(--hub-bg-panel)] border-b border-[var(--hub-border)]">
        {mobileTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = mobileCommunityTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setMobileCommunityTab(tab.id)}
              className={`
                flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium
                transition-all duration-200 relative
                ${isActive
                  ? 'text-[var(--hub-accent-primary)]'
                  : 'text-[var(--hub-text-muted)]'
                }
              `}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[var(--hub-accent-primary)] rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mobileCommunityTab === 'CHAT' && (
          <MobileChatView
            messages={chatMessages}
            selectedDivisionId={selectedDivisionId}
            divisions={divisions}
            chatScope={chatScope}
            setChatScope={setChatScope}
            sendChatMessage={sendChatMessage}
            membership={membership}
          />
        )}
        {mobileCommunityTab === 'REQUESTS' && (
          <MobileRequestsView
            requests={filteredRequests}
            membership={membership}
            helpOnRequest={helpOnRequest}
            postRequest={postRequest}
            selectedDivisionId={selectedDivisionId}
          />
        )}
        {mobileCommunityTab === 'ANNOUNCEMENTS' && (
          <MobileAnnouncementsView
            announcements={announcements}
            membership={membership}
            postAnnouncement={postAnnouncement}
            selectedDivisionId={selectedDivisionId}
          />
        )}
      </div>
    </div>
  );
}

// Mobile Chat View
function MobileChatView({
  messages,
  selectedDivisionId,
  divisions,
  chatScope,
  setChatScope,
  sendChatMessage,
  membership,
}) {
  const [newMessage, setNewMessage] = useState('');

  const divisionName = selectedDivisionId === 'ALL'
    ? 'Rescue Force'
    : divisions.find(d => d.id === selectedDivisionId)?.name || 'Division';

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    await sendChatMessage(newMessage, chatScope === 'DIVISION' ? selectedDivisionId : null);
    setNewMessage('');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Scope toggle */}
      {selectedDivisionId !== 'ALL' && (
        <div className="px-3 py-2 border-b border-[var(--hub-border)] flex gap-2 bg-[var(--hub-bg-panel)]">
          <button
            onClick={() => setChatScope('DIVISION')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              chatScope === 'DIVISION'
                ? 'bg-[var(--hub-accent-primary)]/20 text-[var(--hub-accent-primary)]'
                : 'text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)]'
            }`}
          >
            {divisionName}
          </button>
          <button
            onClick={() => setChatScope('SQUAD')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
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
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[var(--hub-bg-root)]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageCircle size={36} className="text-[var(--hub-text-muted)] mb-3" />
            <p className="text-sm text-[var(--hub-text-muted)]">
              No messages yet
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <MobileChatMessage key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* Input */}
      {membership.isMember && (
        <div className="p-3 bg-[var(--hub-bg-panel)] border-t border-[var(--hub-border)]">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--hub-bg-card)] border border-[var(--hub-border)] text-sm text-[var(--hub-text-primary)] placeholder-[var(--hub-text-muted)] focus:outline-none focus:border-[var(--hub-accent-primary)]/50"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim()}
              className="w-11 h-11 rounded-lg bg-[var(--hub-accent-primary)] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileChatMessage({ message }) {
  const roleColors = {
    MEMBER: 'var(--hub-text-secondary)',
    LEAD: 'var(--hub-accent-primary)',
    ADMIN: 'var(--hub-accent-secondary)',
  };

  return (
    <div className="flex items-start gap-2.5">
      <div className="w-8 h-8 rounded-full bg-[var(--hub-bg-elevated)] flex items-center justify-center flex-shrink-0">
        <User size={14} className="text-[var(--hub-text-muted)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-xs font-semibold"
            style={{ color: roleColors[message.authorRole] || roleColors.MEMBER }}
          >
            {message.authorName}
          </span>
          <span className="text-[10px] text-[var(--hub-text-muted)]">
            {formatTime(message.createdAt)}
          </span>
        </div>
        <p className="text-sm text-[var(--hub-text-primary)] break-words">
          {message.content}
        </p>
      </div>
    </div>
  );
}

// Mobile Requests View
function MobileRequestsView({ requests, membership, helpOnRequest, postRequest, selectedDivisionId }) {
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;
    await postRequest(newTitle, newBody, selectedDivisionId !== 'ALL' ? selectedDivisionId : null);
    setNewTitle('');
    setNewBody('');
    setShowForm(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with post button */}
      {membership.isMember && !showForm && (
        <div className="p-3 bg-[var(--hub-bg-panel)] border-b border-[var(--hub-border)]">
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-2.5 rounded-lg bg-[var(--hub-accent-primary)] text-white text-sm font-medium"
          >
            Post a Request
          </button>
        </div>
      )}

      {/* New Request Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-3 border-b border-[var(--hub-border)] bg-[var(--hub-bg-card)]">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="What do you need help with?"
            className="w-full px-3 py-2.5 mb-2 rounded-lg bg-[var(--hub-bg-panel)] border border-[var(--hub-border)] text-sm text-[var(--hub-text-primary)] placeholder-[var(--hub-text-muted)] focus:outline-none"
          />
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Describe what you need..."
            rows={3}
            className="w-full px-3 py-2.5 mb-2 rounded-lg bg-[var(--hub-bg-panel)] border border-[var(--hub-border)] text-sm text-[var(--hub-text-primary)] placeholder-[var(--hub-text-muted)] focus:outline-none resize-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium text-[var(--hub-text-muted)] bg-[var(--hub-bg-panel)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim() || !newBody.trim()}
              className="flex-1 py-2.5 rounded-lg bg-[var(--hub-accent-primary)] text-white text-sm font-medium disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </form>
      )}

      {/* Requests List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[var(--hub-bg-root)]">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <HelpCircle size={36} className="text-[var(--hub-text-muted)] mb-3" />
            <p className="text-sm text-[var(--hub-text-muted)]">
              No active requests
            </p>
          </div>
        ) : (
          requests.map(req => (
            <MobileRequestCard
              key={req.id}
              request={req}
              membership={membership}
              onHelp={() => helpOnRequest(req.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MobileRequestCard({ request, membership, onHelp }) {
  const statusColors = {
    OPEN: 'var(--hub-status-high)',
    IN_PROGRESS: 'var(--hub-status-medium)',
    COMPLETED: 'var(--hub-status-success)',
  };

  return (
    <div className="p-3 rounded-lg bg-[var(--hub-bg-card)] border border-[var(--hub-border)]">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="text-sm font-semibold text-[var(--hub-text-primary)] line-clamp-1">
          {request.title}
        </h4>
        <span
          className="px-2 py-0.5 rounded text-[9px] font-medium flex-shrink-0"
          style={{
            backgroundColor: `${statusColors[request.status]}20`,
            color: statusColors[request.status],
          }}
        >
          {request.status === 'IN_PROGRESS' ? 'In Progress' : request.status}
        </span>
      </div>
      <p className="text-xs text-[var(--hub-text-secondary)] mb-2 line-clamp-2">
        {request.body}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--hub-text-muted)]">
          {request.authorName} · {formatTime(request.createdAt)}
        </span>
        <div className="flex items-center gap-2">
          {request.helpersCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--hub-text-muted)]">
              <HandHelping size={10} />
              {request.helpersCount}
            </span>
          )}
          {membership.isMember && !request.isUserHelper && request.status !== 'COMPLETED' && (
            <button
              onClick={onHelp}
              className="px-2.5 py-1 rounded-lg bg-[var(--hub-accent-secondary)]/10 text-[var(--hub-accent-secondary)] text-[10px] font-medium"
            >
              Help
            </button>
          )}
          {request.isUserHelper && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--hub-status-success)]">
              <CheckCircle size={10} />
              Helping
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Mobile Announcements View
function MobileAnnouncementsView({
  announcements,
  membership,
  postAnnouncement,
  selectedDivisionId,
}) {
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  // Only leads and admins can post announcements
  const canPost = membership.isMember &&
    ['DIVISION_LEAD', 'SQUAD_LEAD', 'ADMIN'].includes(membership.role);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    await postAnnouncement(
      newTitle,
      newContent,
      selectedDivisionId !== 'ALL' ? selectedDivisionId : null,
      false
    );
    setNewTitle('');
    setNewContent('');
    setShowForm(false);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Post button for leads */}
      {canPost && !showForm && (
        <div className="p-3 bg-[var(--hub-bg-panel)] border-b border-[var(--hub-border)]">
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-2.5 rounded-lg bg-[var(--hub-accent-secondary)] text-white text-sm font-medium flex items-center justify-center gap-2"
          >
            <Megaphone size={14} />
            Post Announcement
          </button>
        </div>
      )}

      {/* New Announcement Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-3 border-b border-[var(--hub-border)] bg-[var(--hub-bg-card)]">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Announcement title..."
            className="w-full px-3 py-2.5 mb-2 rounded-lg bg-[var(--hub-bg-panel)] border border-[var(--hub-border)] text-sm text-[var(--hub-text-primary)] placeholder-[var(--hub-text-muted)] focus:outline-none"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write your announcement..."
            rows={3}
            className="w-full px-3 py-2.5 mb-2 rounded-lg bg-[var(--hub-bg-panel)] border border-[var(--hub-border)] text-sm text-[var(--hub-text-primary)] placeholder-[var(--hub-text-muted)] focus:outline-none resize-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setNewTitle('');
                setNewContent('');
              }}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium text-[var(--hub-text-muted)] bg-[var(--hub-bg-panel)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim() || !newContent.trim()}
              className="flex-1 py-2.5 rounded-lg bg-[var(--hub-accent-secondary)] text-white text-sm font-medium disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </form>
      )}

      {/* Announcements List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[var(--hub-bg-root)]">
        {announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Megaphone size={36} className="text-[var(--hub-text-muted)] mb-3" />
            <p className="text-sm text-[var(--hub-text-muted)]">
              No announcements yet
              {canPost && '. Tap above to post one.'}
            </p>
          </div>
        ) : (
          <>
            {/* Pinned first */}
            {announcements.filter(a => a.isPinned).map(ann => (
              <MobileAnnouncementCard key={ann.id} announcement={ann} />
            ))}
            {/* Then unpinned */}
            {announcements.filter(a => !a.isPinned).map(ann => (
              <MobileAnnouncementCard key={ann.id} announcement={ann} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function MobileAnnouncementCard({ announcement }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--hub-bg-card)] border border-[var(--hub-border)]">
      <div className="flex items-center gap-2 mb-1.5">
        {announcement.isPinned && (
          <Pin size={12} className="text-[var(--hub-accent-primary)]" />
        )}
        <span className="text-sm font-semibold text-[var(--hub-text-primary)]">
          {announcement.title}
        </span>
      </div>
      <p className="text-xs text-[var(--hub-text-secondary)] mb-2">
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

// Helper function
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
