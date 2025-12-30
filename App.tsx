import React, { useEffect, useState } from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import { Icons } from './constants';
import { SupabaseDebugPanel } from './components/SupabaseDebugPanel';
import { ImportModal } from './components/ImportModal';
import { LumaSyncModal } from './components/LumaSyncModal';
import { Dashboard } from './pages/Dashboard';
import { EventDetail } from './pages/EventDetail';
import type { FieldEventSummary, FieldEventAttendee } from './types';
import { attendeesRepo } from './services/repos/attendeesRepo';
import { dashboardRepo, type DashboardMetrics } from './services/repos/dashboardRepo';
import { fieldEventsRepo } from './services/repos/fieldEventsRepo';

const AppLayout: React.FC = () => {
  const [fieldEvents, setFieldEvents] = useState<FieldEventSummary[] | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [hotLeads, setHotLeads] = useState<Array<FieldEventAttendee & { fieldEventTitle: string }> | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isLumaSyncModalOpen, setIsLumaSyncModalOpen] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [events, m, leads] = await Promise.all([
        fieldEventsRepo.listSummaries(),
        dashboardRepo.getMetrics(),
        attendeesRepo.listHotLeads(5)
      ]);

      setFieldEvents(events);
      setMetrics(m);
      setHotLeads(leads);
    } catch (err: any) {
      setLoadError(err?.message ?? 'Failed to load data from Supabase.');
      setFieldEvents([]);
      setMetrics(null);
      setHotLeads([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isStale = false;

    loadData().then(() => {
      if (isStale) return;
    });

    return () => {
      isStale = true;
    };
  }, []);

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
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                fieldEvents={fieldEvents}
                metrics={metrics}
                hotLeads={hotLeads}
                isLoading={isLoading}
                loadError={loadError}
                onOpenImportMenu={() => setShowImportMenu(!showImportMenu)}
                showImportMenu={showImportMenu}
                onCloseImportMenu={() => setShowImportMenu(false)}
                onOpenLumaSync={() => {
                  setShowImportMenu(false);
                  setIsLumaSyncModalOpen(true);
                }}
                onOpenCsvImport={() => {
                  setShowImportMenu(false);
                  setIsImportModalOpen(true);
                }}
              />
            }
          />
          <Route path="/events/:fieldEventId" element={<EventDetail />} />
        </Routes>
      </main>

      {/* Floating Action Button (Mobile/Context) */}
      <button className="fixed bottom-6 right-6 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl hover:bg-black transition-all transform hover:scale-110 active:scale-95 z-[100]">
        <Icons.Zap className="w-6 h-6 text-amber-400" />
      </button>

      {/* Debug Panel */}
      <SupabaseDebugPanel />

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={() => {
          loadData(); // Refresh data after import
        }}
        fieldEvents={fieldEvents?.map(e => ({ id: e.id, title: e.title })) ?? []}
      />

      {/* Luma Sync Modal */}
      <LumaSyncModal
        isOpen={isLumaSyncModalOpen}
        onClose={() => setIsLumaSyncModalOpen(false)}
        onSyncComplete={() => {
          loadData(); // Refresh data after sync
        }}
      />
    </div>
  );
};

const App: React.FC = () => {
  return <AppLayout />;
};

export default App;
