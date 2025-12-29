
import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from './constants';
import { StatCard } from './components/StatCard';
import { WorkshopDetail } from './components/WorkshopDetail';
import { SupabaseDebugPanel } from './components/SupabaseDebugPanel';
import type { FieldEventSummary, FieldEventAttendee } from './types';
import { attendeesRepo } from './services/repos/attendeesRepo';
import { dashboardRepo, type DashboardMetrics } from './services/repos/dashboardRepo';
import { fieldEventsRepo } from './services/repos/fieldEventsRepo';

const App: React.FC = () => {
  const [fieldEvents, setFieldEvents] = useState<FieldEventSummary[] | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [hotLeads, setHotLeads] = useState<Array<FieldEventAttendee & { fieldEventTitle: string }> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedFieldEventId, setSelectedFieldEventId] = useState<string | null>(null);

  useEffect(() => {
    let isStale = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [events, m, leads] = await Promise.all([
          fieldEventsRepo.listSummaries(),
          dashboardRepo.getMetrics(),
          attendeesRepo.listHotLeads(5)
        ]);

        if (isStale) return;
        setFieldEvents(events);
        setMetrics(m);
        setHotLeads(leads);
      } catch (err: any) {
        if (isStale) return;
        setLoadError(err?.message ?? 'Failed to load data from Supabase.');
        setFieldEvents([]);
        setMetrics(null);
        setHotLeads([]);
      } finally {
        if (isStale) return;
        setIsLoading(false);
      }
    }

    load();
    return () => {
      isStale = true;
    };
  }, []);

  const selectedFieldEvent = useMemo(
    () => fieldEvents?.find((e) => e.id === selectedFieldEventId) ?? null,
    [fieldEvents, selectedFieldEventId]
  );

  return (
    <div className="min-h-screen text-slate-900 pb-20">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">W</div>
            <h1 className="text-xl font-bold tracking-tight">Workshop <span className="text-indigo-600">ROI Machine</span></h1>
          </div>
          <div className="flex gap-4">
            <button className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">Settings</button>
            <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
              <img src="https://picsum.photos/32/32" alt="Avatar" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 mt-8">
        {!selectedFieldEventId ? (
          <div className="space-y-8 animate-fadeIn">
            <header className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">Performance Overview</h2>
                <p className="text-slate-500 mt-1">Track your workshop conversion pipeline and hot leads.</p>
              </div>
              <button className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2">
                <span className="text-xl">+</span> Import Attendee List
              </button>
            </header>

            {loadError && (
              <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm">
                {loadError}
              </div>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                label="Workshops"
                value={isLoading ? null : metrics?.totalFieldEvents ?? 0}
                icon={<Icons.Zap className="w-5 h-5" />}
              />
              <StatCard
                label="Attendees"
                value={isLoading ? null : metrics?.totalAttendees ?? 0}
                icon={<Icons.Users className="w-5 h-5" />}
              />
              <StatCard
                label="Ship Rate"
                value={isLoading ? null : `${(metrics?.shipRatePct ?? 0).toFixed(1)}%`}
                trend={undefined}
                trendUp={true}
                icon={<Icons.TrendUp className="w-5 h-5" />}
              />
              <StatCard
                label="Hot Leads"
                value={isLoading ? null : metrics?.hotLeads ?? 0}
                icon={<Icons.Sparkles className="w-5 h-5" />}
              />
              <StatCard
                label="Est. Opportunity"
                value={isLoading ? null : `$${(metrics?.estimatedOpportunityUsd ?? 0).toLocaleString()}`}
                icon={<Icons.TrendUp className="w-5 h-5" />}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Active Workshops List */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  Active Pipelines
                  <span className="bg-slate-100 text-slate-600 text-[10px] uppercase px-2 py-0.5 rounded">Live</span>
                </h3>
                {(fieldEvents ?? []).map((fieldEvent) => (
                  <div
                    key={fieldEvent.id}
                    onClick={() => setSelectedFieldEventId(fieldEvent.id)}
                    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-300 transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {fieldEvent.title}
                        </h4>
                        <p className="text-sm text-slate-500 flex items-center gap-2">
                          {fieldEvent.date} • {fieldEvent.venue}
                        </p>
                      </div>
                      <Icons.ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-transform group-hover:translate-x-1" />
                    </div>
                    <div className="mt-6 flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {Array.from({ length: Math.min(3, fieldEvent.attendeeCount) }, (_, i) => i + 1).map((i) => (
                          <img
                            key={i}
                            className="w-8 h-8 rounded-full border-2 border-white"
                            src={`https://picsum.photos/40/40?random=${fieldEvent.id}-${i}`}
                            alt="Attendee"
                          />
                        ))}
                        {fieldEvent.attendeeCount > 3 && (
                          <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                            +{fieldEvent.attendeeCount - 3}
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-medium text-slate-400">
                        Goal: <span className="text-slate-700">{fieldEvent.conversionGoal}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="text-sm text-slate-400 px-2 py-2">Loading pipelines…</div>
                )}
              </div>

              {/* Hot Leads Sidebar */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  Hot Leads Priority
                  <span className="bg-amber-100 text-amber-600 text-[10px] uppercase px-2 py-0.5 rounded">Action Required</span>
                </h3>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100">
                  {(hotLeads ?? []).map((lead) => (
                    <div key={lead.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer">
                      <div className="relative">
                        <img src={`https://picsum.photos/48/48?random=${lead.id}`} className="w-12 h-12 rounded-full" alt={lead.name} />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                          {lead.engagementScore}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{lead.name}</p>
                        <p className="text-xs text-slate-500 truncate">{lead.fieldEventTitle}</p>
                        <p className="text-[10px] text-indigo-500 font-medium mt-1 uppercase tracking-tighter">
                          {lead.questionsAsked > 3 ? `Asked ${lead.questionsAsked} Questions` : 'Shipped Project'}
                        </p>
                      </div>
                      <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                        <Icons.Mail className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="p-4 text-center">
                    <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
                      View All High-Intensity Leads
                    </button>
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl">
                  <h4 className="text-sm font-bold text-indigo-900 mb-2">Automated Drip Status</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-indigo-700">Draft Follow-ups</span>
                      <span className="text-indigo-900 font-bold">
                        {isLoading ? '—' : metrics ? `${metrics.drafts} Drafts` : '—'}
                      </span>
                    </div>
                    <div className="w-full bg-indigo-200 rounded-full h-1.5">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full"
                        style={{
                          width:
                            !metrics || metrics.drafts + metrics.sent === 0
                              ? '0%'
                              : `${Math.round((metrics.drafts / (metrics.drafts + metrics.sent)) * 100)}%`
                        }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-indigo-700">Sent Follow-ups</span>
                      <span className="text-indigo-900 font-bold">
                        {isLoading ? '—' : metrics ? `${metrics.sent} Sent` : '—'}
                      </span>
                    </div>
                    <div className="w-full bg-indigo-200 rounded-full h-1.5">
                      <div
                        className="bg-indigo-600 h-1.5 rounded-full"
                        style={{
                          width:
                            !metrics || metrics.drafts + metrics.sent === 0
                              ? '0%'
                              : `${Math.round((metrics.sent / (metrics.drafts + metrics.sent)) * 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <WorkshopDetail 
            fieldEvent={selectedFieldEvent!}
            onBack={() => setSelectedFieldEventId(null)}
          />
        )}
      </main>

      {/* Floating Action Button (Mobile/Context) */}
      <button className="fixed bottom-6 right-6 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl hover:bg-black transition-all transform hover:scale-110 active:scale-95 z-[100]">
        <Icons.Zap className="w-6 h-6 text-amber-400" />
      </button>

      {/* Debug Panel */}
      <SupabaseDebugPanel />
    </div>
  );
};

export default App;
