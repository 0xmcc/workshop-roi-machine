import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '../services/supabaseClient';

interface ConnectionStatus {
  url: string | null;
  projectRef: string | null;
  isConnected: boolean;
  error: string | null;
  tables: string[];
  previewBranch: string | null;
}

export const SupabaseDebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [status, setStatus] = useState<ConnectionStatus>({
    url: null,
    projectRef: null,
    isConnected: false,
    error: null,
    tables: [],
    previewBranch: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkConnection() {
      setIsLoading(true);
      
      // Get env vars
      const url = (
        import.meta.env.VITE_SUPABASE_URL ||
        import.meta.env.SUPABASE_URL ||
        '(not set)'
      ) as string;
      
      // Extract project ref from URL (e.g., "abcdefgh" from "https://abcdefgh.supabase.co")
      const projectRef = url.match(/https:\/\/([^.]+)\./)?.[1] || 'unknown';
      
      // Check for preview branch indicator in URL or env
      const previewBranch = import.meta.env.VITE_SUPABASE_BRANCH || 
                           import.meta.env.SUPABASE_BRANCH || 
                           null;

      try {
        const supabase = getSupabaseClient();
        
        // Try to list tables by querying each one
        const tablesToCheck = ['field_events', 'field_event_attendees', 'field_event_attendance', 'people', 'field_event_followups'];
        const existingTables: string[] = [];
        
        for (const table of tablesToCheck) {
          const { error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          
          if (!error) {
            existingTables.push(table);
          }
        }

        setStatus({
          url: url,
          projectRef: projectRef,
          isConnected: existingTables.length > 0,
          error: existingTables.length === 0 ? 'No tables accessible' : null,
          tables: existingTables,
          previewBranch
        });
      } catch (err: any) {
        setStatus({
          url: url,
          projectRef: projectRef,
          isConnected: false,
          error: err?.message || 'Connection failed',
          tables: [],
          previewBranch
        });
      } finally {
        setIsLoading(false);
      }
    }

    checkConnection();
  }, []);

  const maskUrl = (url: string) => {
    if (!url || url === '(not set)') return url;
    // Show project ref but mask the rest
    const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (match) {
      return `https://${match[1]}.supabase.co`;
    }
    return url.substring(0, 30) + '...';
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-mono shadow-lg hover:bg-slate-700 z-[100]"
      >
        🔌 Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 bg-slate-900 text-white p-4 rounded-xl shadow-2xl z-[100] max-w-sm font-mono text-xs">
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-slate-300">Supabase Connection</span>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-slate-500 hover:text-white"
        >
          ✕
        </button>
      </div>
      
      {isLoading ? (
        <div className="text-slate-400">Checking connection...</div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={status.isConnected ? 'text-green-400' : 'text-red-400'}>
              {status.isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          
          <div className="bg-slate-800 rounded p-2 mt-2">
            <div className="text-slate-500 text-[10px] uppercase tracking-wide">Project Ref</div>
            <div className="text-cyan-400 font-bold">{status.projectRef || 'unknown'}</div>
          </div>
          
          <div className="text-slate-400">
            <span className="text-slate-500">URL:</span>{' '}
            <span className="text-slate-300 text-[11px]">{maskUrl(status.url || '')}</span>
          </div>
          
          {status.previewBranch && (
            <div className="text-slate-400">
              <span className="text-slate-500">Branch:</span>{' '}
              <span className="text-amber-400">{status.previewBranch}</span>
            </div>
          )}
          
          <div className="text-slate-400">
            <span className="text-slate-500">Tables found:</span>{' '}
            <span className={status.tables.length > 0 ? 'text-green-400' : 'text-red-400'}>
              {status.tables.length}
            </span>
          </div>
          
          {status.tables.length > 0 && (
            <div className="text-slate-500 text-[10px] pl-2 border-l border-slate-700">
              {status.tables.map(t => (
                <div key={t}>✓ {t}</div>
              ))}
            </div>
          )}
          
          {status.error && (
            <div className="text-red-400 text-[10px] mt-2 p-2 bg-red-900/30 rounded">
              {status.error}
            </div>
          )}
          
          <div className="text-slate-600 text-[10px] mt-3 pt-2 border-t border-slate-700 space-y-1">
            <div>
              <span className="text-slate-500">Vercel Env:</span>{' '}
              <span className={
                import.meta.env.VERCEL_ENV === 'preview' ? 'text-amber-400' :
                import.meta.env.VERCEL_ENV === 'production' ? 'text-green-400' :
                'text-slate-400'
              }>
                {import.meta.env.VERCEL_ENV || 'local'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Git Branch:</span>{' '}
              <span className="text-cyan-400">{import.meta.env.VERCEL_GIT_COMMIT_REF || 'unknown'}</span>
            </div>
            <div className="space-y-1 mt-1">
              <div className="text-slate-400">
                <span className="text-slate-500">Source:</span>{' '}
                <span className={import.meta.env.SUPABASE_URL ? 'text-cyan-400' : 'text-amber-400'}>
                  {import.meta.env.SUPABASE_URL ? 'SUPABASE_* (integration)' : 'VITE_* (manual)'}
                </span>
              </div>
              <div className="text-slate-400">
                <span className="text-slate-500">Anon Key:</span>{' '}
                {(() => {
                  // Match the logic in supabaseClient.ts - use SUPABASE_* if URL is set
                  // Integration uses SUPABASE_PUBLISHABLE_KEY, we also accept SUPABASE_ANON_KEY
                  const key = import.meta.env.SUPABASE_URL 
                    ? ((import.meta.env.SUPABASE_ANON_KEY as string | undefined) || (import.meta.env.SUPABASE_PUBLISHABLE_KEY as string | undefined))
                    : (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);
                  if (!key) return <span className="text-red-500">NOT SET</span>;
                  return <span className="text-green-400">{key.substring(0, 12)}...{key.substring(key.length - 4)}</span>;
                })()}
              </div>
              <div className="grid grid-cols-2 gap-1 text-slate-600">
                <span>VITE_URL: {import.meta.env.VITE_SUPABASE_URL ? '✓' : '✗'}</span>
                <span>SUPABASE_URL: {import.meta.env.SUPABASE_URL ? '✓' : '✗'}</span>
                <span>VITE_KEY: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓' : '✗'}</span>
                <span>SUPABASE_KEY: {(import.meta.env.SUPABASE_ANON_KEY || import.meta.env.SUPABASE_PUBLISHABLE_KEY) ? '✓' : '✗'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
