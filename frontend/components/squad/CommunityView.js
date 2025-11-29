'use client';

/**
 * CommunityView - Desktop two-column layout for Community tab
 *
 * Left column (flex-1): Chat | Requests | Announcements tabs
 * Right column (fixed): People & Presence panel
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
  Clock,
  Users,
  HandHelping,
  CheckCircle,
} from 'lucide-react';

const communityTabs = [
  { id: 'CHAT', label: 'Chat', icon: MessageCircle },
  { id: 'REQUESTS', label: 'Requests', icon: HelpCircle },
  { id: 'ANNOUNCEMENTS', label: 'Announcements', icon: Megaphone },
];

export default function CommunityView() {
  const {
    communityTab,
    setCommunityTab,
    chatMessages,
    announcements,
    filteredRequests,
    onDutyMembers,
    recentlyActiveMembers,
    selectedDivisionId,
    divisions,
    chatScope,
    setChatScope,
    sendChatMessage,
    membership,
    helpOnRequest,
    postRequest,
  } = useSquadHub();

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Column - Content area */}
      <div className="flex-1 flex flex-col border-r border-[var(--hub-border)] overflow-hidden">
        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b border-[var(--hub-border)] bg-[var(--hub-bg-panel)]">
          {communityTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = communityTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setCommunityTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${isActive
                    ? 'bg-[var(--hub-accent-primary)]/15 text-[var(--hub-accent-primary)]'
                    : 'text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)] hover:bg-[var(--hub-bg-card)]/50'
                  }
                `}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {communityTab === 'CHAT' && (
            <ChatSection
              messages={chatMessages}
              selectedDivisionId={selectedDivisionId}
              divisions={divisions}
              chatScope={chatScope}
              setChatScope={setChatScope}
              sendChatMessage={sendChatMessage}
              membership={membership}
            />
          )}
          {communityTab === 'REQUESTS' && (
            <RequestsSection
              requests={filteredRequests}
              membership={membership}
              helpOnRequest={helpOnRequest}
              postRequest={postRequest}
              selectedDivisionId={selectedDivisionId}
            />
          )}
          {communityTab === 'ANNOUNCEMENTS' && (
            <AnnouncementsSection announcements={announcements} />
          )}
        </div>
      </div>

      {/* Right Column - People & Presence */}
      <div className="w-80 flex-shrink-0 overflow-hidden">
        <PeoplePresenceSection
          onDutyMembers={onDutyMembers}
          recentlyActiveMembers={recentlyActiveMembers}
        />
      </div>
    </div>
  );
}

// Chat Section - Full chat interface
function ChatSection({
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

  return (
    <div className="h-full flex flex-col bg-[var(--hub-bg-panel)]">
      {/* Scope toggle */}
      {selectedDivisionId !== 'ALL' && (
        <div className="px-4 py-3 border-b border-[var(--hub-border)] flex gap-2">
          <button
            onClick={() => setChatScope('DIVISION')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              chatScope === 'DIVISION'
                ? 'bg-[var(--hub-accent-primary)]/20 text-[var(--hub-accent-primary)]'
                : 'text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)] hover:bg-[var(--hub-bg-card)]/50'
            }`}
          >
            {divisionName} Only
          </button>
          <button
            onClick={() => setChatScope('SQUAD')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              chatScope === 'SQUAD'
                ? 'bg-[var(--hub-accent-primary)]/20 text-[var(--hub-accent-primary)]'
                : 'text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)] hover:bg-[var(--hub-bg-card)]/50'
            }`}
          >
            Whole Squad
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageCircle size={40} className="text-[var(--hub-text-muted)] mb-4" />
            <p className="text-sm text-[var(--hub-text-muted)]">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* Input */}
      {membership.isMember && (
        <div className="p-4 border-t border-[var(--hub-border)]">
          <div className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 rounded-lg bg-[var(--hub-bg-card)] border border-[var(--hub-border)] text-sm text-[var(--hub-text-primary)] placeholder-[var(--hub-text-muted)] focus:outline-none focus:border-[var(--hub-accent-primary)]/50"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim()}
              className="px-6 py-3 rounded-lg bg-[var(--hub-accent-primary)] text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-[var(--hub-accent-primary-dim)]"
            >
              <Send size={16} />
              <span className="text-sm font-medium">Send</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatMessage({ message }) {
  const roleColors = {
    MEMBER: 'var(--hub-text-secondary)',
    LEAD: 'var(--hub-accent-primary)',
    ADMIN: 'var(--hub-accent-secondary)',
  };

  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-full bg-[var(--hub-bg-elevated)] flex items-center justify-center flex-shrink-0">
        <User size={16} className="text-[var(--hub-text-muted)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-sm font-semibold"
            style={{ color: roleColors[message.authorRole] || roleColors.MEMBER }}
          >
            {message.authorName}
          </span>
          <span className="text-xs text-[var(--hub-text-muted)]">
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

// Requests Section - Help requests from squad members
function RequestsSection({ requests, membership, helpOnRequest, postRequest, selectedDivisionId }) {
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
    <div className="h-full flex flex-col bg-[var(--hub-bg-panel)]">
      {/* Header with post button */}
      <div className="px-4 py-3 border-b border-[var(--hub-border)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--hub-text-primary)]">Help Requests</h3>
          <p className="text-xs text-[var(--hub-text-muted)]">Ask for help or volunteer to assist</p>
        </div>
        {membership.isMember && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 rounded-lg bg-[var(--hub-accent-primary)] text-white text-xs font-medium hover:bg-[var(--hub-accent-primary-dim)] transition-all"
          >
            Post Request
          </button>
        )}
      </div>

      {/* New Request Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 border-b border-[var(--hub-border)] bg-[var(--hub-bg-card)]">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="What do you need help with?"
            className="w-full px-3 py-2 mb-3 rounded-lg bg-[var(--hub-bg-panel)] border border-[var(--hub-border)] text-sm text-[var(--hub-text-primary)] placeholder-[var(--hub-text-muted)] focus:outline-none focus:border-[var(--hub-accent-primary)]/50"
          />
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Describe what you need..."
            rows={3}
            className="w-full px-3 py-2 mb-3 rounded-lg bg-[var(--hub-bg-panel)] border border-[var(--hub-border)] text-sm text-[var(--hub-text-primary)] placeholder-[var(--hub-text-muted)] focus:outline-none focus:border-[var(--hub-accent-primary)]/50 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTitle.trim() || !newBody.trim()}
              className="px-4 py-1.5 rounded-lg bg-[var(--hub-accent-primary)] text-white text-xs font-medium hover:bg-[var(--hub-accent-primary-dim)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Post
            </button>
          </div>
        </form>
      )}

      {/* Requests List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <HelpCircle size={40} className="text-[var(--hub-text-muted)] mb-4" />
            <p className="text-sm text-[var(--hub-text-muted)]">
              No active help requests. Post one if you need assistance!
            </p>
          </div>
        ) : (
          requests.map(req => (
            <RequestCard
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

function RequestCard({ request, membership, onHelp }) {
  const statusColors = {
    OPEN: 'var(--hub-status-high)',
    IN_PROGRESS: 'var(--hub-status-medium)',
    COMPLETED: 'var(--hub-status-success)',
  };

  return (
    <div className="p-4 rounded-lg bg-[var(--hub-bg-card)] border border-[var(--hub-border)]">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="text-sm font-semibold text-[var(--hub-text-primary)]">
          {request.title}
        </h4>
        <span
          className="px-2 py-0.5 rounded text-[10px] font-medium"
          style={{
            backgroundColor: `${statusColors[request.status]}20`,
            color: statusColors[request.status],
          }}
        >
          {request.status === 'IN_PROGRESS' ? 'In Progress' : request.status}
        </span>
      </div>
      <p className="text-sm text-[var(--hub-text-secondary)] mb-3 line-clamp-3">
        {request.body}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--hub-text-muted)]">
            By {request.authorName}
          </span>
          <span className="text-xs text-[var(--hub-text-muted)]">
            {formatTime(request.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {request.helpersCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-[var(--hub-text-muted)]">
              <HandHelping size={12} />
              {request.helpersCount}
            </span>
          )}
          {membership.isMember && !request.isUserHelper && request.status !== 'COMPLETED' && (
            <button
              onClick={onHelp}
              className="px-3 py-1.5 rounded-lg bg-[var(--hub-accent-secondary)]/10 text-[var(--hub-accent-secondary)] text-xs font-medium hover:bg-[var(--hub-accent-secondary)]/20 transition-all"
            >
              Help
            </button>
          )}
          {request.isUserHelper && (
            <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--hub-status-success)]/10 text-[var(--hub-status-success)] text-xs font-medium">
              <CheckCircle size={12} />
              Helping
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Announcements Section
function AnnouncementsSection({ announcements }) {
  return (
    <div className="h-full flex flex-col bg-[var(--hub-bg-panel)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--hub-border)]">
        <h3 className="text-sm font-semibold text-[var(--hub-text-primary)]">Announcements</h3>
        <p className="text-xs text-[var(--hub-text-muted)]">Important updates from squad leads</p>
      </div>

      {/* Announcements List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Megaphone size={40} className="text-[var(--hub-text-muted)] mb-4" />
            <p className="text-sm text-[var(--hub-text-muted)]">
              No announcements yet. Squad leads can post important updates here.
            </p>
          </div>
        ) : (
          announcements.map(ann => (
            <AnnouncementCard key={ann.id} announcement={ann} />
          ))
        )}
      </div>
    </div>
  );
}

function AnnouncementCard({ announcement }) {
  return (
    <div className="p-4 rounded-lg bg-[var(--hub-bg-card)] border border-[var(--hub-border)]">
      <div className="flex items-center gap-2 mb-2">
        {announcement.isPinned && (
          <Pin size={14} className="text-[var(--hub-accent-primary)]" />
        )}
        <span className="text-sm font-semibold text-[var(--hub-text-primary)]">
          {announcement.title}
        </span>
      </div>
      <p className="text-sm text-[var(--hub-text-secondary)] mb-3">
        {announcement.content}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--hub-text-muted)]">
          By {announcement.authorName}
        </span>
        <span className="text-xs text-[var(--hub-text-muted)]">
          {formatTime(announcement.createdAt)}
        </span>
      </div>
    </div>
  );
}

// People & Presence Section
function PeoplePresenceSection({ onDutyMembers, recentlyActiveMembers }) {
  return (
    <div className="h-full flex flex-col bg-[var(--hub-bg-panel)]">
      {/* On Duty Now */}
      <div className="border-b border-[var(--hub-border)]">
        <div className="px-4 py-3 border-b border-[var(--hub-border)]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--hub-status-success)] animate-pulse" />
            <h3 className="text-sm font-semibold text-[var(--hub-text-primary)]">On Duty Now</h3>
            <span className="px-2 py-0.5 rounded-full bg-[var(--hub-status-success)]/20 text-[var(--hub-status-success)] text-[10px] font-medium">
              {onDutyMembers.length}
            </span>
          </div>
        </div>
        <div className="max-h-48 overflow-y-auto p-3 space-y-2">
          {onDutyMembers.length === 0 ? (
            <p className="text-xs text-[var(--hub-text-muted)] text-center py-3">
              No one is on duty right now
            </p>
          ) : (
            onDutyMembers.map(member => (
              <MemberItem key={member.id} member={member} showStatus />
            ))
          )}
        </div>
      </div>

      {/* Recently Active */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--hub-border)]">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[var(--hub-text-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--hub-text-primary)]">Recently Active</h3>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {recentlyActiveMembers.length === 0 ? (
            <p className="text-xs text-[var(--hub-text-muted)] text-center py-3">
              No recent activity
            </p>
          ) : (
            recentlyActiveMembers.map(member => (
              <MemberItem key={member.id} member={member} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MemberItem({ member, showStatus }) {
  const roleLabels = {
    MEMBER: null,
    DIVISION_LEAD: 'Lead',
    SQUAD_LEAD: 'Squad Lead',
    ADMIN: 'Admin',
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--hub-bg-card)]/50 transition-colors">
      <div className="relative">
        <div className="w-8 h-8 rounded-full bg-[var(--hub-bg-elevated)] flex items-center justify-center">
          {member.avatarUrl ? (
            <img src={member.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <User size={14} className="text-[var(--hub-text-muted)]" />
          )}
        </div>
        {showStatus && member.isOnDuty && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--hub-status-success)] border-2 border-[var(--hub-bg-panel)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--hub-text-primary)] truncate">
            {member.name}
          </span>
          {roleLabels[member.role] && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[var(--hub-accent-primary)]/20 text-[var(--hub-accent-primary)]">
              {roleLabels[member.role]}
            </span>
          )}
        </div>
        {member.divisionName && (
          <span className="text-[10px] text-[var(--hub-text-muted)]">
            {member.divisionName}
          </span>
        )}
        {!showStatus && member.lastActiveAt && (
          <span className="text-[10px] text-[var(--hub-text-muted)]">
            Active {formatTime(member.lastActiveAt)}
          </span>
        )}
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
