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
  caseNumber: string;
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
    caseNumber?: string;
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
  displayName: string;      // "Chicago Rescue Squad"
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
};

// Context state types
export type CaseQueueTab = 'INCOMING' | 'ACTIVE' | 'REUNITED';
export type ActivityTab = 'CHAT' | 'ACTIVITY' | 'ANNOUNCEMENTS';
export type MobileTab = 'CASES' | 'MAP' | 'SQUAD';
export type DivisionFilter = 'ALL' | string;

export type SquadHubState = {
  // Data
  squad: SquadInfo;
  membership: SquadMembership;
  divisions: HubDivision[];
  cases: HubCase[];
  events: HubEvent[];
  chatMessages: HubChatMessage[];
  announcements: HubAnnouncement[];

  // Filters & UI state
  selectedDivisionId: DivisionFilter;
  caseTab: CaseQueueTab;
  activityTab: ActivityTab;
  mobileTab: MobileTab;

  // Map state
  mapCenter: [number, number] | null;
  mapZoom: number;
  selectedCaseId: string | null;

  // Derived
  filteredCases: HubCase[];
};

export type SquadHubActions = {
  setSelectedDivisionId: (id: DivisionFilter) => void;
  setCaseTab: (tab: CaseQueueTab) => void;
  setActivityTab: (tab: ActivityTab) => void;
  setMobileTab: (tab: MobileTab) => void;
  selectCase: (caseId: string | null) => void;
  toggleOnDuty: () => Promise<void>;
  helpOnCase: (caseId: string) => Promise<void>;
  joinSquad: () => Promise<void>;
  sendChatMessage: (content: string, divisionId?: string) => Promise<void>;
};

export type SquadHubContextValue = SquadHubState & SquadHubActions;
