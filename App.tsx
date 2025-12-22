
import React, { useState, useMemo, useEffect } from 'react';
import { MOCK_WORKSHOPS, Icons } from './constants';
import { Workshop, ProjectStatus, WorkshopView, AttendeeTask } from './types';
import { StatCard } from './components/StatCard';
import { WorkshopDetail } from './components/WorkshopDetail';
import { GlobalTasks } from './components/GlobalTasks';
import { PublicTaskView } from './components/PublicTaskView';
import { StudentWorkshopView } from './components/StudentWorkshopView';
import { fetchWorkshops, saveWorkshop } from './services/workshopService';
import { getAttendeeTasks } from './services/executionService';
import { hasSupabaseCredentials, isEnvConfigured, resetRuntimeConfig } from './services/supabase';

const SLUG_TO_VIEW: Record<string, WorkshopView> = {
  'review': WorkshopView.REVIEW_INBOX,
  'tasks': WorkshopView.TASKS,
  'attendees': WorkshopView.ATTENDEES,
  'logs': WorkshopView.SUBMISSION_LOGS,
  'performance': WorkshopView.OVERVIEW
};

const SupabaseSetup: React.FC = () => {
  const [url, setUrl] = useState(localStorage.getItem('SUPABASE_URL') || 'https://wyzcizewwswwnqllzoyl.supabase.co');
  const [key, setKey] = useState(localStorage.getItem('SUPABASE_ANON_KEY') || '');

  const handleSave = () => {
    if (!url || !key) {
      alert('Please provide both URL and Anon Key');
      return;
    }
    localStorage.setItem('SUPABASE_URL', url);
    localStorage.setItem('SUPABASE_ANON_KEY', key);
    // Reload to re-initialize the Supabase client with new credentials
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl font-black mx-auto mb-4">S</div>
          <h2 className="text-2xl font-bold text-slate-900">Infrastructure Setup</h2>
          <p className="text-slate-500 text-sm">Required environment variables are missing. Please provide runtime configuration to proceed.</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Supabase URL</label>
            <input 
              type="text" 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
              placeholder="https://your-project.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Anon Key</label>
            <input 
              type="password" 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
              placeholder="your-anon-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          <button 
            onClick={handleSave}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
          >
            Save Configuration
          </button>
        </div>
        
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
          <p className="text-[10px] text-amber-700 leading-relaxed text-center font-medium">
            Note: Runtime values are stored in localStorage and will be ignored if environment variables are provided in the future.
          </p>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const parseRoute = () => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    
    if (hash.startsWith('#/tasks/')) {
      const parts = hash.split('/');
      const templateId = parts[2]?.split('?')[0];
      const hashQuery = hash.includes('?') ? new URLSearchParams(hash.split('?')[1]) : null;
      const token = hashQuery?.get('token') || params.get('token') || undefined;
      return { path: 'PUBLIC_TASK', templateId, token };
    }

    if (hash.startsWith('#/workshop/')) {
      const parts = hash.split('/');
      const workshopId = parts[2];
      const subPath = parts[3];
      if (subPath === 'student') {
        return { path: 'STUDENT_WORKSHOP', workshopId };
      }
    }

    if (hash === '#/tasks') return { path: 'TASKS' };
    if (hash === '#/inbox') return { path: 'GLOBAL_INBOX' };

    if (hash.startsWith('#/workshops/')) {
      const parts = hash.split('/');
      const workshopId = parts[2];
      const subviewSlug = parts[3];
      return { 
        path: 'WORKSHOP_DETAIL', 
        workshopId, 
        view: subviewSlug ? SLUG_TO_VIEW[subviewSlug] : undefined 
      };
    }

    return { path: 'DASHBOARD' };
  };

  const [route, setRoute] = useState(parseRoute());

  const refreshAll = async () => {
    // block data access and app initialization until configuration is provided.
    if (!hasSupabaseCredentials()) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const w = await fetchWorkshops(MOCK_WORKSHOPS);
      setWorkshops(w);
    } catch (err) {
      console.error("Failed to fetch from Supabase:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    const handleHashChange = () => setRoute(parseRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleUpdateWorkshops = async (updated: Workshop[]) => {
    setWorkshops(updated);
    for (const w of updated) {
      await saveWorkshop(w);
    }
  };

  const stats = useMemo(() => {
    const allAttendees = workshops.flatMap(w => w.attendees);
    const totalAttendees = allAttendees.length;
    const shippedCount = allAttendees.filter(a => a.status === ProjectStatus.SHIPPED).length;
    const highValueLeads = allAttendees.filter(a => a.engagementScore >= 80).length;
    const shipRate = totalAttendees > 0 ? (shippedCount / totalAttendees) * 100 : 0;

    return {
      totalWorkshops: workshops.filter(w => !w.hidden).length,
      totalAttendees,
      shipRate: `${shipRate.toFixed(1)}%`,
      highValueLeads,
      estimatedROI: `$${(highValueLeads * 299).toLocaleString()}`
    };
  }, [workshops]);

  const selectedWorkshop = useMemo(() => 
    route.path === 'WORKSHOP_DETAIL' ? workshops.find(w => w.id === route.workshopId) : null
  , [workshops, route]);

  const hotLeads = useMemo(() => {
    return workshops
      .flatMap(w => w.attendees.map(a => ({ ...a, workshopTitle: w.title })))
      .filter(a => a.engagementScore >= 85)
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 5);
  }, [workshops]);

  // If configuration is missing (env or local), block and show setup UI
  if (!hasSupabaseCredentials()) {
    return <SupabaseSetup />;
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Synchronizing Registry...</p>
        </div>
      </div>
    );
  }

  if (route.path === 'PUBLIC_TASK' && route.templateId) {
    return <PublicTaskView templateId={route.templateId} token={route.token} />;
  }

  if (route.path === 'STUDENT_WORKSHOP' && route.workshopId) {
    return <StudentWorkshopView workshopId={route.workshopId} />;
  }

  const renderContent = () => {
    if (route.path === 'WORKSHOP_DETAIL' && selectedWorkshop) {
      return (
        <WorkshopDetail 
          workshop={selectedWorkshop} 
          initialView={route.view}
          onBack={() => { window.location.hash = '#/workshops'; }} 
          onRefresh={refreshAll}
        />
      );
    }

    if (route.path === 'TASKS') {
      return <GlobalTasks workshops={workshops} onUpdateWorkshops={handleUpdateWorkshops} />;
    }

    if (route.path === 'GLOBAL_INBOX') {
      const hiddenWorkshops = workshops.filter(w => w.hidden);
      return (
        <div className="space-y-6">
          <header>
            <h2 className="text-3xl font-bold text-slate-900">Global Review Inbox</h2>
            <p className="text-slate-500">Submissions captured from public distribution links.</p>
          </header>
          {hiddenWorkshops.length === 0 ? (
            <div className="p-20 text-center text-slate-400 border-2 border-dashed rounded-3xl bg-white">
              <Icons.Clipboard className="w-12 h-12 mx-auto mb-4 opacity-10" />
              <p>No public submissions yet. Share a task link to start capturing leads.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hiddenWorkshops.map(w => (
                <div 
                  key={w.id}
                  onClick={() => { window.location.hash = `#/workshops/${w.id}`; }}
                  className="bg-white p-6 rounded-2xl border border-slate-100 hover:border-indigo-300 cursor-pointer shadow-sm transition-all group"
                >
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full uppercase tracking-widest">Public Endpoint</span>
                    <span className="text-xs text-slate-400 font-bold">{w.attendees.length} Submissions</span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{w.title}</h4>
                  <p className="text-sm text-slate-500 mt-2 truncate">Reviewing public leads capture.</p>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-8 animate-fadeIn">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Performance Overview</h2>
            <p className="text-slate-500 mt-1">Track your workshop conversion pipeline and hot leads.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Workshops" value={stats.totalWorkshops} icon={<Icons.Zap className="w-5 h-5" />} />
          <StatCard label="Attendees" value={stats.totalAttendees} icon={<Icons.Users className="w-5 h-5" />} />
          <StatCard label="Ship Rate" value={stats.shipRate} trend="+12%" trendUp={true} icon={<Icons.TrendUp className="w-5 h-5" />} />
          <StatCard label="Hot Leads" value={stats.highValueLeads} icon={<Icons.Sparkles className="w-5 h-5" />} />
          <StatCard label="Est. Opportunity" value={stats.estimatedROI} icon={<Icons.TrendUp className="w-5 h-5" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">Active Pipelines</h3>
            {workshops.filter(w => !w.hidden).map(workshop => (
              <div 
                key={workshop.id}
                onClick={() => { window.location.hash = `#/workshops/${workshop.id}`; }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-300 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h4 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{workshop.title}</h4>
                    <p className="text-sm text-slate-500">{workshop.date} • {workshop.venue}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <a 
                      href={`#/workshop/${workshop.id}/student`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                    >
                      Student View
                      <Icons.ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <Icons.ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Hot Leads Priority</h3>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100">
              {hotLeads.map(lead => (
                <div key={lead.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer">
                  <img src={`https://picsum.photos/48/48?random=${lead.id}`} className="w-12 h-12 rounded-full" alt={lead.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{lead.name}</p>
                    <p className="text-[10px] text-indigo-500 font-medium uppercase">{lead.workshopTitle}</p>
                  </div>
                  <Icons.Mail className="w-4 h-4 text-indigo-600" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-slate-900 pb-20">
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => { window.location.hash = '#/workshops'; }}>
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">W</div>
              <h1 className="text-xl font-bold tracking-tight">Workshop <span className="text-indigo-600">ROI Machine</span></h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Runtime config resettable button - only visible if NOT environment-configured */}
            {!isEnvConfigured && (
              <button 
                onClick={resetRuntimeConfig}
                className="text-[10px] font-black text-slate-400 hover:text-red-600 uppercase tracking-widest transition-colors p-2"
                title="Reset Database Connection"
              >
                Reset Connection
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
              <img src="https://picsum.photos/32/32" alt="Avatar" />
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 mt-8">{renderContent()}</main>
    </div>
  );
};

export default App;
