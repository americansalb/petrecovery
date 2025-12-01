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
  ChevronDown,
  ChevronRight,
  PawPrint,
  LogOut,
  ExternalLink,
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
    groupedRequests,
    onDutyMembers,
    recentlyActiveMembers,
    selectedDivisionId,
    divisions,
    chatScope,
    setChatScope,
    chatCaseFilterId,
    setChatCaseFilterId,
    casesWithChat,
    cases,
    sendChatMessage,
    membership,
    helpOnRequest,
    completeRequestForUser,
    leaveRequest,
    postRequest,
    postAnnouncement,
    highlightRequestId,
    setMainTab,
    selectCase,
    setMobileTab,
    setCaseTab,
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
              chatCaseFilterId={chatCaseFilterId}
              setChatCaseFilterId={setChatCaseFilterId}
              casesWithChat={casesWithChat}
              allCases={cases}
              sendChatMessage={sendChatMessage}
              membership={membership}
            />
          )}
          {communityTab === 'REQUESTS' && (
            <RequestsSection
              groupedRequests={groupedRequests}
              membership={membership}
              helpOnRequest={helpOnRequest}
              completeRequestForUser={completeRequestForUser}
              leaveRequest={leaveRequest}
              postRequest={postRequest}
              selectedDivisionId={selectedDivisionId}
              highlightRequestId={highlightRequestId}
              onNavigateToCase={(caseId) => {
                setMainTab('OPERATIONS');
                setCaseTab('ACTIVE');
                selectCase(caseId);
                setMobileTab('CASES');
              }}
              divisions={divisions}
            />
          )}
          {communityTab === 'ANNOUNCEMENTS' && (
            <AnnouncementsSection
              announcements={announcements}
              membership={membership}
              postAnnouncement={postAnnouncement}
              selectedDivisionId={selectedDivisionId}
              divisions={divisions}
            />
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
  chatCaseFilterId,
  setChatCaseFilterId,
  casesWithChat,
  allCases,
  sendChatMessage,
  membership,
}) {
  const [newMessage, setNewMessage] = useState('');
  const [showCaseDropdown, setShowCaseDropdown] = useState(false);

  const divisionName = selectedDivisionId === 'ALL'
    ? 'Squad'
    : divisions.find(d => d.id === selectedDivisionId)?.name || 'Division';

  // Look up selected case from all cases (not just those with chat messages)
  const selectedCase = chatCaseFilterId
    ? (allCases || []).find(c => c.id === chatCaseFilterId)
    : null;

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    await sendChatMessage(
      newMessage,
      chatScope === 'DIVISION' ? selectedDivisionId : null,
      chatCaseFilterId
    );
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
      {/* Filter bar */}
      <div className="px-4 py-3 border-b border-[var(--hub-border)] space-y-2">
        {/* Scope toggle - always visible */}
        <div className="flex gap-2">
          <button
            onClick={() => setChatScope('DIVISION')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              chatScope === 'DIVISION'
                ? 'bg-[var(--hub-accent-primary)]/20 text-[var(--hub-accent-primary)]'
                : 'text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)] hover:bg-[var(--hub-bg-card)]/50'
            }`}
          >
            {selectedDivisionId === 'ALL' ? 'My Division' : `${divisionName} Only`}
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

        {/* Case filter - show if there are any active cases */}
        {(casesWithChat.length > 0 || chatCaseFilterId) && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--hub-text-muted)] uppercase tracking-wider">Filter by case:</span>
            <div className="relative">
              <button
                onClick={() => setShowCaseDropdown(!showCaseDropdown)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  chatCaseFilterId
                    ? 'bg-[var(--hub-status-high)]/20 text-[var(--hub-status-high)]'
                    : 'bg-[var(--hub-bg-card)] text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)]'
                }`}
              >
                <PawPrint size={12} />
                <span>{selectedCase ? selectedCase.petName : 'All cases'}</span>
                <ChevronDown size={12} />
              </button>
              {showCaseDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--hub-bg-card)] border border-[var(--hub-border)] rounded-lg shadow-lg z-10 py-1 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => {
                      setChatCaseFilterId(null);
                      setShowCaseDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--hub-bg-elevated)] transition-colors ${
                      !chatCaseFilterId ? 'text-[var(--hub-accent-primary)]' : 'text-[var(--hub-text-secondary)]'
                    }`}
                  >
                    All cases
                  </button>
                  {casesWithChat.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setChatCaseFilterId(c.id);
                        setShowCaseDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--hub-bg-elevated)] transition-colors flex items-center gap-2 ${
                        chatCaseFilterId === c.id ? 'text-[var(--hub-accent-primary)]' : 'text-[var(--hub-text-secondary)]'
                      }`}
                    >
                      <PawPrint size={10} />
                      <span>{c.petName}</span>
                      <span className="text-[var(--hub-text-muted)]">({c.caseNumber})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {chatCaseFilterId && (
              <button
                onClick={() => setChatCaseFilterId(null)}
                className="text-[10px] text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)] transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

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

// Requests Section - Help requests (micro-missions) from squad members
function RequestsSection({
  groupedRequests,
  membership,
  helpOnRequest,
  completeRequestForUser,
  leaveRequest,
  postRequest,
  selectedDivisionId,
  highlightRequestId,
  onNavigateToCase,
  divisions,
}) {
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;
    await postRequest(newTitle, newBody, selectedDivisionId !== 'ALL' ? selectedDivisionId : null);
    setNewTitle('');
    setNewBody('');
    setShowForm(false);
  };

  const totalActive = groupedRequests.OPEN.length + groupedRequests.IN_PROGRESS.length;
  const hasCompleted = groupedRequests.COMPLETED.length > 0;

  return (
    <div className="h-full flex flex-col bg-[var(--hub-bg-panel)]">
      {/* Header with post button */}
      <div className="px-4 py-3 border-b border-[var(--hub-border)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--hub-text-primary)]">Missions</h3>
          <p className="text-xs text-[var(--hub-text-muted)]">Help requests from your squad</p>
        </div>
        {membership.isMember && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 rounded-lg bg-[var(--hub-accent-primary)] text-white text-xs font-medium hover:bg-[var(--hub-accent-primary-dim)] transition-all"
          >
            Post Mission
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

      {/* Requests List - Grouped by status */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {totalActive === 0 && !hasCompleted ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <HelpCircle size={40} className="text-[var(--hub-text-muted)] mb-4" />
            <p className="text-sm text-[var(--hub-text-muted)]">
              No active missions. Post one if you need assistance!
            </p>
          </div>
        ) : (
          <>
            {/* OPEN requests */}
            {groupedRequests.OPEN.length > 0 && (
              <RequestGroup
                label="Open"
                count={groupedRequests.OPEN.length}
                statusColor="var(--hub-accent-primary)"
                requests={groupedRequests.OPEN}
                membership={membership}
                helpOnRequest={helpOnRequest}
                completeRequestForUser={completeRequestForUser}
                leaveRequest={leaveRequest}
                highlightRequestId={highlightRequestId}
                onNavigateToCase={onNavigateToCase}
                divisions={divisions}
              />
            )}

            {/* IN_PROGRESS requests */}
            {groupedRequests.IN_PROGRESS.length > 0 && (
              <RequestGroup
                label="In Progress"
                count={groupedRequests.IN_PROGRESS.length}
                statusColor="var(--hub-status-medium)"
                requests={groupedRequests.IN_PROGRESS}
                membership={membership}
                helpOnRequest={helpOnRequest}
                completeRequestForUser={completeRequestForUser}
                leaveRequest={leaveRequest}
                highlightRequestId={highlightRequestId}
                onNavigateToCase={onNavigateToCase}
                divisions={divisions}
              />
            )}

            {/* COMPLETED requests - collapsible */}
            {hasCompleted && (
              <div>
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-2 text-xs font-medium text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)] transition-colors mb-2"
                >
                  {showCompleted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Completed (past 24h)</span>
                  <span className="px-1.5 py-0.5 rounded bg-[var(--hub-status-success)]/20 text-[var(--hub-status-success)] text-[10px]">
                    {groupedRequests.COMPLETED.length}
                  </span>
                </button>
                {showCompleted && (
                  <div className="space-y-3 pl-5">
                    {groupedRequests.COMPLETED.map(req => (
                      <RequestCard
                        key={req.id}
                        request={req}
                        membership={membership}
                        helpOnRequest={helpOnRequest}
                        completeRequestForUser={completeRequestForUser}
                        leaveRequest={leaveRequest}
                        isHighlighted={highlightRequestId === req.id}
                        onNavigateToCase={onNavigateToCase}
                        divisions={divisions}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RequestGroup({
  label,
  count,
  statusColor,
  requests,
  membership,
  helpOnRequest,
  completeRequestForUser,
  leaveRequest,
  highlightRequestId,
  onNavigateToCase,
  divisions,
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
        <span className="text-xs font-semibold text-[var(--hub-text-primary)] uppercase tracking-wider">
          {label}
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
        >
          {count}
        </span>
      </div>
      <div className="space-y-3">
        {requests.map(req => (
          <RequestCard
            key={req.id}
            request={req}
            membership={membership}
            helpOnRequest={helpOnRequest}
            completeRequestForUser={completeRequestForUser}
            leaveRequest={leaveRequest}
            isHighlighted={highlightRequestId === req.id}
            onNavigateToCase={onNavigateToCase}
            divisions={divisions}
          />
        ))}
      </div>
    </div>
  );
}

function RequestCard({
  request,
  membership,
  helpOnRequest,
  completeRequestForUser,
  leaveRequest,
  isHighlighted,
  onNavigateToCase,
  divisions,
  compact = false,
}) {
  const statusColors = {
    OPEN: 'var(--hub-accent-primary)',
    IN_PROGRESS: 'var(--hub-status-medium)',
    COMPLETED: 'var(--hub-status-success)',
  };

  const statusColor = statusColors[request.status];
  const divisionName = request.divisionId
    ? divisions?.find(d => d.id === request.divisionId)?.name
    : null;

  return (
    <div
      className={`
        p-4 rounded-lg bg-[var(--hub-bg-card)] border transition-all
        ${isHighlighted
          ? 'border-[var(--hub-accent-primary)] ring-2 ring-[var(--hub-accent-primary)]/30'
          : 'border-[var(--hub-border)]'
        }
        ${compact ? 'opacity-75' : ''}
      `}
      style={{ borderLeftWidth: '3px', borderLeftColor: statusColor }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className={`font-semibold text-[var(--hub-text-primary)] ${compact ? 'text-xs' : 'text-sm'}`}>
          {request.title}
        </h4>
        <span
          className="px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
          style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
        >
          {request.status === 'IN_PROGRESS' ? 'In Progress' : request.status}
        </span>
      </div>

      {/* Body */}
      <p className={`text-[var(--hub-text-secondary)] mb-3 ${compact ? 'text-xs line-clamp-2' : 'text-sm line-clamp-3'}`}>
        {request.body}
      </p>

      {/* Helper avatars row */}
      {request.helpers && request.helpers.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex -space-x-2">
            {request.helpers.slice(0, 4).map((helper, idx) => (
              <div
                key={helper.id || idx}
                className="w-6 h-6 rounded-full bg-[var(--hub-bg-elevated)] border-2 border-[var(--hub-bg-card)] flex items-center justify-center"
                title={helper.name}
              >
                <span className="text-[9px] font-medium text-[var(--hub-text-muted)]">
                  {helper.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
            ))}
            {request.helpers.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-[var(--hub-bg-elevated)] border-2 border-[var(--hub-bg-card)] flex items-center justify-center">
                <span className="text-[9px] font-medium text-[var(--hub-text-muted)]">
                  +{request.helpers.length - 4}
                </span>
              </div>
            )}
          </div>
          <span className="text-[10px] text-[var(--hub-text-muted)]">
            {request.helpers.length} helping
          </span>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Left: Division + Case badge */}
        <div className="flex items-center gap-2 flex-wrap">
          {divisionName && (
            <span className="text-[10px] text-[var(--hub-text-muted)]">
              {divisionName}
            </span>
          )}
          {request.caseCode && (
            <button
              onClick={() => onNavigateToCase && onNavigateToCase(request.caseId)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--hub-status-high)]/10 text-[var(--hub-status-high)] text-[10px] font-medium hover:bg-[var(--hub-status-high)]/20 transition-colors"
            >
              <PawPrint size={10} />
              <span>for {request.caseCode}</span>
            </button>
          )}
          <span className="text-[10px] text-[var(--hub-text-muted)]">
            by {request.authorName} · {formatTime(request.createdAt)}
          </span>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2">
          {membership.isMember && !request.isUserHelper && request.status !== 'COMPLETED' && (
            <button
              onClick={() => helpOnRequest(request.id)}
              className="px-3 py-1.5 rounded-lg bg-[var(--hub-accent-primary)] text-white text-xs font-medium hover:bg-[var(--hub-accent-primary-dim)] transition-all"
            >
              I'll help with this
            </button>
          )}
          {request.isUserHelper && request.status !== 'COMPLETED' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => completeRequestForUser(request.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--hub-status-success)]/10 text-[var(--hub-status-success)] text-xs font-medium hover:bg-[var(--hub-status-success)]/20 transition-all"
              >
                <CheckCircle size={12} />
                Mark my part done
              </button>
              <button
                onClick={() => leaveRequest(request.id)}
                className="p-1.5 rounded-lg text-[var(--hub-text-muted)] hover:bg-[var(--hub-bg-elevated)] hover:text-[var(--hub-text-secondary)] transition-all"
                title="Leave mission"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
          {request.isUserHelper && request.status === 'COMPLETED' && (
            <span className="flex items-center gap-1 px-3 py-1.5 text-[var(--hub-status-success)] text-xs font-medium">
              <CheckCircle size={12} />
              Completed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Announcements Section
function AnnouncementsSection({
  announcements,
  membership,
  postAnnouncement,
  selectedDivisionId,
  divisions,
}) {
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);

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
      isPinned
    );
    setNewTitle('');
    setNewContent('');
    setIsPinned(false);
    setShowForm(false);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--hub-bg-panel)]">
      {/* Header with post button */}
      <div className="px-4 py-3 border-b border-[var(--hub-border)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--hub-text-primary)]">Announcements</h3>
          <p className="text-xs text-[var(--hub-text-muted)]">Important updates from squad leads</p>
        </div>
        {canPost && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 rounded-lg bg-[var(--hub-accent-secondary)] text-white text-xs font-medium hover:opacity-90 transition-all flex items-center gap-1.5"
          >
            <Megaphone size={12} />
            Post Announcement
          </button>
        )}
      </div>

      {/* New Announcement Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 border-b border-[var(--hub-border)] bg-[var(--hub-bg-card)]">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Announcement title..."
            className="w-full px-3 py-2 mb-3 rounded-lg bg-[var(--hub-bg-panel)] border border-[var(--hub-border)] text-sm text-[var(--hub-text-primary)] placeholder-[var(--hub-text-muted)] focus:outline-none focus:border-[var(--hub-accent-primary)]/50"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write your announcement..."
            rows={4}
            className="w-full px-3 py-2 mb-3 rounded-lg bg-[var(--hub-bg-panel)] border border-[var(--hub-border)] text-sm text-[var(--hub-text-primary)] placeholder-[var(--hub-text-muted)] focus:outline-none focus:border-[var(--hub-accent-primary)]/50 resize-none"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-[var(--hub-text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="rounded border-[var(--hub-border)]"
              />
              <Pin size={12} />
              Pin to top
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setNewTitle('');
                  setNewContent('');
                  setIsPinned(false);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--hub-text-muted)] hover:text-[var(--hub-text-secondary)] transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim() || !newContent.trim()}
                className="px-4 py-1.5 rounded-lg bg-[var(--hub-accent-secondary)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Post
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Announcements List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Megaphone size={40} className="text-[var(--hub-text-muted)] mb-4" />
            <p className="text-sm text-[var(--hub-text-muted)]">
              No announcements yet.
              {canPost
                ? ' Click the button above to post one.'
                : ' Squad leads can post important updates here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Pinned announcements first */}
            {announcements.filter(a => a.isPinned).map(ann => (
              <AnnouncementCard key={ann.id} announcement={ann} />
            ))}
            {/* Then unpinned */}
            {announcements.filter(a => !a.isPinned).map(ann => (
              <AnnouncementCard key={ann.id} announcement={ann} />
            ))}
          </>
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
