'use client';

/**
 * SquadHubV5 - Redesigned Squad Interface
 * 
 * Aligns with Mission Control V2 using MapLayout.
 * Features:
 * - Map always visible (zoomed to squad coverage)
 * - Feed, Community, and Members panels
 * - Consistent navigation and visual style
 */

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

// Shared Components
import MapLayout from '@/components/ui/Layout/MapLayout';
import ExpandablePanel, { PanelGrid } from '@/components/ui/ExpandablePanel';
import { MissionBottomSheet } from '@/components/ui/BottomSheet';

// Icons
import {
    Newspaper,
    Users,
    Shield,
    MessageSquare,
    Map as MapIcon,
    Plus,
    Settings,
    Share2
} from 'lucide-react';

// Lazy load map
const MapView = dynamic(() => import('@/app/components/case/SARMapView'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
            <div className="animate-pulse text-slate-500">Loading squad map...</div>
        </div>
    ),
});

export default function SquadHubV5({ initialData, squadId }) {
    const router = useRouter();
    const { data: session } = useSession();

    // Data
    const squad = initialData?.squad || {};
    const allCases = initialData?.cases || [];
    const activeCases = allCases.filter(c => ['PENDING', 'ACTIVE', 'IN_PROGRESS'].includes(c.status));

    // UI State
    const [activePanel, setActivePanel] = useState(null);
    const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

    // Handlers
    const handleCaseClick = (caseId) => {
        // "Dive In" transition handled by Next.js navigation + MissionControlV2 map animation
        router.push(`/mission-control?mission=${caseId}`);
    };

    const openPanel = (id, title, content) => {
        if (activePanel?.id === id) {
            setActivePanel(null);
        } else {
            setActivePanel({ id, title, content });
        }
    };

    // Squad Header Component
    const SquadHeader = () => (
        <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 p-4 z-40">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
                <div className="flex items-center gap-3">
                    {squad.photoUrl ? (
                        <img
                            src={squad.photoUrl}
                            alt={squad.cityName}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
                            <Shield className="text-flash-400" size={20} />
                        </div>
                    )}
                    <div>
                        <h1 className="font-bold text-white text-lg leading-tight">
                            {squad.cityName || 'Rescue Squad'}
                        </h1>
                        <p className="text-xs text-slate-500">
                            {activeCases.length} active cases · {squad.memberCount || 0} members
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                        <Share2 size={20} />
                    </button>
                    {initialData?.membership?.role === 'ADMIN' && (
                        <button className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                            <Settings size={20} />
                        </button>
                    )}
                    <button
                        onClick={() => router.push('/cases/report')}
                        className="flex items-center gap-2 px-4 py-2 bg-flash-500 text-midnight-900 font-bold rounded-xl hover:bg-flash-400 transition-colors ml-2"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Report Pet</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <MapLayout
            activePanel={activePanel}
            onPanelClose={() => setActivePanel(null)}
            headerComponent={<SquadHeader />}
            mapComponent={
                <MapView
                    center={[squad.latitude || 41.8781, squad.longitude || -87.6298]}
                    zoom={12} // Zoomed out for city view
                    cases={activeCases} // Show all active cases as pins
                    onCaseClick={handleCaseClick}
                    showControls={false} // Cleaner look for hub
                />
            }
        >
            {/* Panel Triggers */}
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent pointer-events-auto">
                <div className="max-w-7xl mx-auto">
                    <PanelGrid>
                        <ExpandablePanel
                            icon={Newspaper}
                            title="Feed"
                            summary="Recent activity"
                            isExpanded={activePanel?.id === 'feed'}
                            onToggle={() => openPanel('feed', 'Activity Feed', <FeedContent data={initialData} />)}
                        />
                        <ExpandablePanel
                            icon={Users}
                            title="Community"
                            summary="Discussions"
                            isExpanded={activePanel?.id === 'community'}
                            onToggle={() => openPanel('community', 'Community', <CommunityContent />)}
                        />
                        <ExpandablePanel
                            icon={Shield}
                            title="Members"
                            summary={`${squad.memberCount || 0} members`}
                            isExpanded={activePanel?.id === 'members'}
                            onToggle={() => openPanel('members', 'Squad Members', <MembersContent />)}
                        />
                    </PanelGrid>
                </div>
            </div>
        </MapLayout>
    );
}

// Placeholder Content Components
function FeedContent({ data }) {
    return (
        <div className="space-y-4">
            {data?.cases?.map(c => (
                <div key={c.id} className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                            {c.petSpecies === 'DOG' ? '🐕' : '🐈'}
                        </div>
                        <div>
                            <div className="font-bold text-white">New Case: {c.petName}</div>
                            <div className="text-xs text-slate-400">{c.timeMissing} ago</div>
                        </div>
                    </div>
                    <p className="text-sm text-slate-300">
                        Missing from {c.lastSeenAddress}. Please keep an eye out!
                    </p>
                </div>
            ))}
        </div>
    );
}

function CommunityContent() {
    return <div className="text-center text-slate-500 py-12">Community Chat Placeholder</div>;
}

function MembersContent() {
    return <div className="text-center text-slate-500 py-12">Member List Placeholder</div>;
}
