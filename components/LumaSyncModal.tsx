import React, { useState, useEffect } from 'react';
import { 
  lumaClient, 
  setLumaApiKey, 
  clearLumaApiKey, 
  syncLumaEvent,
  type LumaEvent,
  type LumaSyncResult 
} from '../services/luma';

interface LumaSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

type SyncStep = 'api-key' | 'select-event' | 'syncing' | 'complete';

export const LumaSyncModal: React.FC<LumaSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete
}) => {
  const [step, setStep] = useState<SyncStep>('api-key');
  const [apiKey, setApiKey] = useState('');
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [events, setEvents] = useState<LumaEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [syncResult, setSyncResult] = useState<LumaSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clear state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Small delay to allow close animation
      const timer = setTimeout(() => {
        setStep('api-key');
        setApiKey('');
        setEvents([]);
        setSelectedEventId('');
        setSyncResult(null);
        setError(null);
        clearLumaApiKey();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }

    setError(null);
    setIsLoadingEvents(true);

    try {
      // Set API key in client
      setLumaApiKey(apiKey.trim());

      // Test by fetching events
      const fetchedEvents = await lumaClient.listEvents();
      setEvents(fetchedEvents);
      setStep('select-event');
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to Luma API');
      clearLumaApiKey();
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleSync = async () => {
    if (!selectedEventId) {
      setError('Please select an event');
      return;
    }

    setError(null);
    setStep('syncing');

    try {
      const result = await syncLumaEvent({
        lumaEventApiId: selectedEventId
      });

      setSyncResult(result);
      setStep('complete');
      onSyncComplete();
    } catch (err: any) {
      setError(err?.message || 'Sync failed');
      setStep('select-event');
    }
  };

  const handleClose = () => {
    clearLumaApiKey();
    onClose();
  };

  if (!isOpen) return null;

  const selectedEvent = events.find(e => e.api_id === selectedEventId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h2 className="text-lg font-bold">Sync from Luma</h2>
          </div>
          <button onClick={handleClose} className="text-white/80 hover:text-white text-2xl">
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: API Key */}
          {step === 'api-key' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Luma API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Luma API key"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleApiKeySubmit()}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Requires Luma Plus subscription. Get your API key from{' '}
                  <a 
                    href="https://lu.ma/settings/api" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    lu.ma/settings/api
                  </a>
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="text-xs text-amber-800">
                    <strong>Development Only:</strong> This key grants full account access. 
                    Never commit or share it. In production, Luma API calls should go through a backend.
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleApiKeySubmit}
                disabled={isLoadingEvents || !apiKey.trim()}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoadingEvents ? 'Connecting...' : 'Connect to Luma'}
              </button>
            </div>
          )}

          {/* Step 2: Select Event */}
          {step === 'select-event' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Select Luma Event
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Choose an event...</option>
                  {events.map((event) => (
                    <option key={event.api_id} value={event.api_id}>
                      {event.name} ({new Date(event.start_at).toLocaleDateString()})
                    </option>
                  ))}
                </select>
                {events.length === 0 && (
                  <p className="text-sm text-slate-500 mt-1">
                    No events found in your Luma account.
                  </p>
                )}
              </div>

              {selectedEvent && (
                <div className="bg-slate-50 rounded-lg p-4 space-y-1">
                  <div className="font-medium text-slate-900">{selectedEvent.name}</div>
                  <div className="text-sm text-slate-600">
                    {new Date(selectedEvent.start_at).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                  {selectedEvent.geo_address_json?.city && (
                    <div className="text-sm text-slate-500">
                      📍 {selectedEvent.geo_address_json.city}
                      {selectedEvent.geo_address_json.region && `, ${selectedEvent.geo_address_json.region}`}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep('api-key');
                    clearLumaApiKey();
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSync}
                  disabled={!selectedEventId}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Sync Guests
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Syncing */}
          {step === 'syncing' && (
            <div className="text-center py-8">
              <div className="animate-spin w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-4" />
              <div className="text-slate-600">Syncing guests from Luma...</div>
              <div className="text-sm text-slate-400 mt-1">This may take a moment</div>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && syncResult && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="text-lg font-bold text-slate-900">Sync Complete</div>
                <div className="text-sm text-slate-500 mt-1">{syncResult.eventName}</div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total guests:</span>
                  <span className="font-medium text-slate-900">{syncResult.totalGuests}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">People created:</span>
                  <span className="font-medium text-green-600">{syncResult.peopleCreated}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">People updated:</span>
                  <span className="font-medium text-slate-900">{syncResult.peopleUpdated}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Attendance records created:</span>
                  <span className="font-medium text-green-600">{syncResult.attendanceCreated}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Attendance records updated:</span>
                  <span className="font-medium text-slate-900">{syncResult.attendanceUpdated}</span>
                </div>
              </div>

              {syncResult.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="text-amber-800 font-medium text-sm mb-2">
                    {syncResult.errors.length} guest(s) had errors
                  </div>
                  <div className="text-xs text-amber-700 max-h-32 overflow-y-auto space-y-1">
                    {syncResult.errors.slice(0, 5).map((err, i) => (
                      <div key={i}>{err.email}: {err.error}</div>
                    ))}
                    {syncResult.errors.length > 5 && (
                      <div>...and {syncResult.errors.length - 5} more</div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleClose}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
