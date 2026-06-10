/**
 * Squad Hub Data Contract
 *
 * These types define the shape of data for the Squad Hub UI.
 * Backend should return data matching SquadHubData from GET /api/squads/[citySlug]/hub
 */

export type HubDivision = {
  id: string;
  name: string;        // "Lakeview"
  slug: string;        // "lakeview"
  activeCaseCount: number;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
};

export type HubCaseStatus =
  | 'NEW'
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'SIGHTING_REPORTED'
  | 'REUNITED'
  | 'CLOSED_OTHER';

export type HubCaseUrgency = 'LOW' | 'MEDIUM' | 'HIGH';

export type HubCase = {
  id: string;
  missionNumber: string;
  divisionId: string;
  petName: string;
  species: 'DOG' | 'CAT' | 'BIRD' | 'RABBIT' | 'OTHER';
  breed?: string;
  color?: string;
  photoUrl?: string;
  status: HubCaseStatus;
  urgency: HubCaseUrgency;
  lastSeenAt: string;       // ISO timestamp
  lastSeenLat: number | null;
  lastSeenLng: number | null;
  lastSeenAddress?: string;
  rewardAmount: number | null;
  isUserHelper: boolean;
  helperCount: number;
};

export type HubEventType =
  | 'case_created'
  | 'case_reunited'
  | 'member_joined'
  | 'status_changed'
  | 'sighting_reported'
  | 'announcement';

export type HubEvent = {
  id: string;
  type: HubEventType;
  createdAt: string;        // ISO timestamp
  payload: {
    missionNumber?: string;
    petName?: string;
    memberName?: string;
    message?: string;
    [key: string]: unknown;
  };
};

export type HubChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'MEMBER' | 'LEAD' | 'ADMIN';
  content: string;
  createdAt: string;        // ISO timestamp
  divisionId?: string;      // null = squad-wide
  missionId?: string | null;   // optional case context
};

export type HubAnnouncement = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  createdAt: string;
  isPinned: boolean;
  divisionId?: string;      // null = squad-wide
};

// Help request (micro-mission, optionally tied to a case)
export type HubRequestStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';

export type HubRequest = {
  id: string;
  title: string;
  body: string;
  divisionId: string | null; // null = squad-wide
  missionId?: string | null;    // optional link to a case
  caseCode?: string | null;  // e.g. "CHI-LKV-0001"
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAt: string;
  helpersCount: number;
  helpers?: { id: string; name: string; avatarUrl?: string }[];  // helper list for display
  isUserHelper: boolean;
  status: HubRequestStatus;
};

// Squad member for presence displays
export type HubMember = {
  id: string;
  name: string;
  avatarUrl?: string;
  role: 'MEMBER' | 'DIVISION_LEAD' | 'SQUAD_LEAD' | 'ADMIN';
  divisionId?: string;
  divisionName?: string;
  isOnDuty: boolean;
  lastActiveAt?: string;
};

export type SquadMembership = {
  isMember: boolean;
  isOnDuty: boolean;
  homeDivisionId: string | null;
  divisionIds: string[];    // divisions they belong to in this squad
  role: 'MEMBER' | 'DIVISION_LEAD' | 'SQUAD_LEAD' | 'ADMIN' | null;
};

export type SquadInfo = {
  id: string;
  citySlug: string;         // "chicago"
  cityName: string;         // "Chicago"
  displayName: string;      // "Chicago Rescue Force"
  memberCount: number;
  onDutyCount: number;
  centerLat?: number;
  centerLng?: number;
};

export type SquadHubData = {
  squad: SquadInfo;
  membership: SquadMembership;
  divisions: HubDivision[];
  cases: HubCase[];
  activityPreview: {
    recentEvents: HubEvent[];
  };
  chat?: {
    messages: HubChatMessage[];
  };
  announcements?: HubAnnouncement[];
  requests?: HubRequest[];
  members?: {
    onDuty: HubMember[];
    recentlyActive: HubMember[];
  };
};

// Context state types
export type MainTab = 'OPERATIONS' | 'COMMUNITY';
export type CaseQueueTab = 'INCOMING' | 'ACTIVE' | 'REUNITED';
export type ActivityTab = 'CHAT' | 'ACTIVITY' | 'ANNOUNCEMENTS';
export type CommunityTab = 'CHAT' | 'REQUESTS' | 'ANNOUNCEMENTS';
export type MobileTab = 'CASES' | 'MAP' | 'SQUAD';
export type MobileCommunityTab = 'CHAT' | 'REQUESTS' | 'ANNOUNCEMENTS';
export type DivisionFilter = 'ALL' | string;
export type ChatScopeFilter = 'DIVISION' | 'SQUAD';

// Mission type for "Your Missions" bar
export type YourMission = {
  type: 'CASE' | 'REQUEST';
  id: string;
  label: string;
  status: HubCaseStatus | HubRequestStatus;
  urgency?: HubCaseUrgency;  // only for cases
};

export type SquadHubState = {
  // Data
  squad: SquadInfo;
  membership: SquadMembership;
  divisions: HubDivision[];
  cases: HubCase[];
  events: HubEvent[];
  chatMessages: HubChatMessage[];
  announcements: HubAnnouncement[];
  requests: HubRequest[];
  onDutyMembers: HubMember[];
  recentlyActiveMembers: HubMember[];

  // Filters & UI state
  mainTab: MainTab;
  selectedDivisionId: DivisionFilter;
  caseTab: CaseQueueTab;
  activityTab: ActivityTab;
  communityTab: CommunityTab;
  mobileTab: MobileTab;
  mobileCommunityTab: MobileCommunityTab;
  chatScope: ChatScopeFilter;
  chatCaseFilterId: string | null;  // filter chat by case

  // Map state
  mapCenter: [number, number] | null;
  mapZoom: number;
  selectedMissionId: string | null;

  // Request highlight (for scroll-to)
  highlightRequestId: string | null;

  // Derived
  filteredCases: HubCase[];
  filteredRequests: HubRequest[];
  yourMissions: YourMission[];
};

export type SquadHubActions = {
  setMainTab: (tab: MainTab) => void;
  setSelectedDivisionId: (id: DivisionFilter) => void;
  setCaseTab: (tab: CaseQueueTab) => void;
  setActivityTab: (tab: ActivityTab) => void;
  setCommunityTab: (tab: CommunityTab) => void;
  setMobileTab: (tab: MobileTab) => void;
  setMobileCommunityTab: (tab: MobileCommunityTab) => void;
  selectCase: (missionId: string | null) => void;
  toggleOnDuty: () => Promise<void>;

  // Case actions
  helpOnCase: (missionId: string) => Promise<void>;
  leaveCase: (missionId: string) => Promise<void>;

  // Request (micro-mission) actions
  helpOnRequest: (requestId: string) => Promise<void>;
  completeRequestForUser: (requestId: string) => Promise<void>;
  leaveRequest: (requestId: string) => Promise<void>;
  postRequest: (title: string, body: string, divisionId?: string | null, missionId?: string | null) => Promise<void>;

  // Chat actions
  sendChatMessage: (content: string, divisionId?: string | null, missionId?: string | null) => Promise<void>;
  setChatScope: (scope: ChatScopeFilter) => void;
  setChatCaseFilterId: (missionId: string | null) => void;

  // Navigation actions
  joinSquad: () => Promise<void>;
  openCommunityView: () => void;
  openCaseChat: (missionId: string) => void;
  openMission: (mission: YourMission) => void;
  setHighlightRequestId: (requestId: string | null) => void;
};

export type SquadHubContextValue = SquadHubState & SquadHubActions;
