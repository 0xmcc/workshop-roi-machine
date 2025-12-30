
import React, { useEffect, useMemo, useState } from 'react';
import type { FieldEventSummary, FieldEventAttendee, FieldEventFollowup } from '../types';
import { ProjectStatus } from '../types';
import { Icons } from '../constants';
import { attendeesRepo } from '../services/repos/attendeesRepo';
import { followupsRepo } from '../services/repos/followupsRepo';

interface WorkshopDetailProps {
  fieldEvent: FieldEventSummary;
  onBack: () => void;
}

export const WorkshopDetail: React.FC<WorkshopDetailProps> = ({ fieldEvent, onBack }) => {
  const [attendees, setAttendees] = useState<FieldEventAttendee[] | null>(null);
  const [followupsByAttendeeId, setFollowupsByAttendeeId] = useState<Record<string, FieldEventFollowup>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedAttendee, setSelectedAttendee] = useState<FieldEventAttendee | null>(null);
  const [selectedFollowup, setSelectedFollowup] = useState<FieldEventFollowup | null>(null);

  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isMarkingSent, setIsMarkingSent] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let isStale = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [a, f] = await Promise.all([
          attendeesRepo.listByFieldEventId(fieldEvent.id),
          followupsRepo.listByFieldEventId(fieldEvent.id)
        ]);

        if (isStale) return;

        setAttendees(a);
        setFollowupsByAttendeeId(Object.fromEntries(f.map((x) => [x.attendeeId, x])));
      } catch (err: any) {
        if (isStale) return;
        setLoadError(err?.message ?? 'Failed to load attendees.');
        setAttendees([]);
        setFollowupsByAttendeeId({});
      } finally {
        if (isStale) return;
        setIsLoading(false);
      }
    }

    load();
    return () => {
      isStale = true;
    };
  }, [fieldEvent.id]);

  const selectedFollowupIsEditable = selectedFollowup?.status === 'draft';

  const handleOpenFollowup = async (attendee: FieldEventAttendee) => {
    setActionError(null);
    setSelectedAttendee(attendee);

    try {
      const followup = await followupsRepo.getOrCreateDraft({
        fieldEventId: fieldEvent.id,
        attendeeId: attendee.id,
        attendeeEmail: attendee.email
      });

      setSelectedFollowup(followup);
      setFollowupsByAttendeeId((prev) => ({ ...prev, [attendee.id]: followup }));
      setDraftSubject(followup.subject);
      setDraftBody(followup.body);
    } catch (err: any) {
      setActionError(err?.message ?? 'Failed to open follow-up.');
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedFollowup || selectedFollowup.status !== 'draft') return;

    setIsSaving(true);
    setActionError(null);
    try {
      const updated = await followupsRepo.saveDraft({
        followupId: selectedFollowup.id,
        subject: draftSubject,
        body: draftBody
      });

      setSelectedFollowup(updated);
      setFollowupsByAttendeeId((prev) => ({ ...prev, [updated.attendeeId]: updated }));
    } catch (err: any) {
      setActionError(err?.message ?? 'Failed to save draft.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkSent = async () => {
    if (!selectedFollowup || selectedFollowup.status !== 'draft') return;

    setIsMarkingSent(true);
    setActionError(null);
    try {
      const updated = await followupsRepo.markSent(selectedFollowup.id);
      setSelectedFollowup(updated);
      setFollowupsByAttendeeId((prev) => ({ ...prev, [updated.attendeeId]: updated }));
    } catch (err: any) {
      setActionError(err?.message ?? 'Failed to mark sent.');
    } finally {
      setIsMarkingSent(false);
    }
  };

  const attendeeFollowupStatus = useMemo(() => {
    const map: Record<string, 'draft' | 'sent'> = {};
    for (const [attendeeId, followup] of Object.entries(followupsByAttendeeId)) {
      map[attendeeId] = followup.status;
    }
    return map;
  }, [followupsByAttendeeId]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <button 
        onClick={onBack}
        className="text-slate-500 hover:text-indigo-600 flex items-center gap-2 transition-colors"
      >
        <Icons.ArrowRight className="rotate-180 w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{fieldEvent.title}</h1>
              <p className="text-slate-500">{fieldEvent.date} • {fieldEvent.venue}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                Conversion Goal: {fieldEvent.conversionGoal}
              </span>
            </div>
          </div>
        </div>

        {loadError && (
          <div className="px-8 py-4 bg-red-50 border-b border-red-100 text-red-700 text-sm">{loadError}</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-8 py-4 font-semibold">Attendee</th>
                <th className="px-6 py-4 font-semibold">Project</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Score</th>
                <th className="px-8 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(attendees ?? []).map((attendee) => (
                <tr key={attendee.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="font-semibold text-slate-800">{attendee.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{attendee.email}</span>
                      {attendeeFollowupStatus[attendee.id] === 'sent' && (
                        <span className="text-[10px] uppercase bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
                          Sent
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm text-slate-600">{attendee.projectName}</div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      attendee.status === ProjectStatus.SHIPPED ? 'bg-emerald-50 text-emerald-600' :
                      attendee.status === ProjectStatus.IN_PROGRESS ? 'bg-amber-50 text-amber-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {attendee.status}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className={`text-sm font-bold ${
                      attendee.engagementScore > 80 ? 'text-indigo-600' : 'text-slate-400'
                    }`}>
                      {attendee.engagementScore}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => handleOpenFollowup(attendee)}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
                    >
                      <Icons.Sparkles className="w-4 h-4" />
                      AI Follow-up
                    </button>
                  </td>
                </tr>
              ))}

              {isLoading && (
                <tr>
                  <td className="px-8 py-6 text-sm text-slate-400" colSpan={5}>
                    Loading attendees…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedAttendee && (
        <div className="bg-indigo-900 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Icons.Sparkles className="w-32 h-32" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Icons.Zap className="text-amber-400" />
              Follow-up Draft for {selectedAttendee.name}
            </h3>
            <p className="text-indigo-200 text-sm mb-6">
              Draft and send tracking for: "{selectedAttendee.projectName}"
            </p>
            
            {actionError && (
              <div className="mb-4 bg-white/10 border border-white/10 text-indigo-100 px-4 py-3 rounded-xl text-sm">
                {actionError}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-indigo-200">Subject</label>
                <input
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  disabled={!selectedFollowupIsEditable}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
                  placeholder="Subject"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-indigo-200">Body</label>
                <textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  disabled={!selectedFollowupIsEditable}
                  rows={8}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60 whitespace-pre-wrap"
                  placeholder="Write your follow-up…"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={!selectedFollowupIsEditable || isSaving}
                  className="bg-white text-indigo-900 hover:bg-indigo-50 px-6 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:hover:bg-white"
                >
                  {isSaving ? 'Saving…' : 'Save Draft'}
                </button>
                <button
                  onClick={handleMarkSent}
                  disabled={!selectedFollowupIsEditable || isMarkingSent}
                  className="bg-transparent border border-white/30 text-white hover:bg-white/10 px-6 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:hover:bg-transparent"
                >
                  {isMarkingSent ? 'Marking…' : 'Mark as Sent'}
                </button>
              </div>

              {selectedFollowup?.status === 'sent' && (
                <div className="text-xs text-indigo-200">
                  Sent{selectedFollowup.sentAt ? ` • ${new Date(selectedFollowup.sentAt).toLocaleString()}` : ''}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
