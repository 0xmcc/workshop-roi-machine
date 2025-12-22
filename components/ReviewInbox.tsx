
import React, { useState, useEffect, useMemo } from 'react';
import { getAttendeeTasks, performTransition, saveVerificationResult } from '../services/executionService';
import { runVerificationStub } from '../services/verificationService';
import { AttendeeTask, ExecutionState, Workshop, Attendee, Task, VerificationResult, Submission } from '../types';
import { Icons } from '../constants';

interface ReviewInboxProps {
  workshop: Workshop;
  onRefresh: () => void;
}

export const ReviewInbox: React.FC<ReviewInboxProps> = ({ workshop, onRefresh }) => {
  const [executionData, setExecutionData] = useState<AttendeeTask[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loadData = async () => {
    const all = await getAttendeeTasks();
    const relevant = all.filter(t => 
      (t.executionState === ExecutionState.SUBMITTED || t.executionState === ExecutionState.IN_REVIEW) &&
      workshop.attendees.some(a => a.id === t.attendeeId)
    );
    setExecutionData(relevant);
    
    if (!selectedKey && relevant.length > 0) {
      const oldest = [...relevant].sort((a, b) => {
        const aT = a.submissions[a.submissions.length - 1]?.timestamp || 0;
        const bT = b.submissions[b.submissions.length - 1]?.timestamp || 0;
        return aT - bT;
      })[0];
      setSelectedKey(`${oldest.attendeeId}-${oldest.taskId}`);
    }
  };

  useEffect(() => {
    loadData();
  }, [workshop]);

  const handleAction = async (attendeeId: string, taskId: string, action: string) => {
    await performTransition(attendeeId, taskId, action, 'Operator', { notes: reviewNote });
    setReviewNote('');
    await loadData();
    onRefresh();
  };

  const currentTask = useMemo(() => 
    executionData.find(at => `${at.attendeeId}-${at.taskId}` === selectedKey)
  , [selectedKey, executionData]);

  const currentTaskSpec = useMemo(() => {
    if (!currentTask) return null;
    return workshop.tasks.find(t => t.id === currentTask.taskId);
  }, [currentTask, workshop.tasks]);

  const latestSubmission = useMemo(() => {
    if (!currentTask || currentTask.submissions.length === 0) return null;
    return currentTask.submissions[currentTask.submissions.length - 1];
  }, [currentTask]);

  const handleRunVerification = async () => {
    if (!currentTask || !currentTaskSpec || !latestSubmission) return;
    
    setIsVerifying(true);
    const result = await runVerificationStub(currentTaskSpec, latestSubmission);
    await saveVerificationResult(currentTask.attendeeId, currentTask.taskId, result);
    setIsVerifying(false);
    await loadData();
  };

  const ArtifactView = ({ submission, title, highlight = false }: { submission: Submission, title: string, highlight?: boolean }) => {
    const content = submission.content.trim();
    const isLink = content.startsWith('http');
    return (
      <div className={`p-6 rounded-2xl border transition-all ${highlight ? 'bg-indigo-50/50 border-indigo-200 ring-2 ring-indigo-500/10' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h4>
            {isLink ? (
              <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded uppercase">URL Artifact</span>
            ) : (
              <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase">Text/Notes</span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            {new Date(submission.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        </div>
        
        {isLink ? (
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 bg-white p-4 rounded-xl border border-indigo-100 shadow-sm overflow-hidden min-w-0 w-full">
              <p className="text-indigo-600 font-bold break-all truncate underline underline-offset-4 decoration-indigo-200">
                {content}
              </p>
            </div>
            <a 
              href={content} 
              target="_blank" 
              rel="noopener noreferrer"
              className="shrink-0 bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
            >
              <Icons.ExternalLink className="w-4 h-4" /> Open Link
            </a>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
            <p className="text-base text-slate-800 leading-relaxed font-serif italic">
              "{submission.content}"
            </p>
          </div>
        )}
      </div>
    );
  };

  if (executionData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border border-slate-100 border-dashed">
        <Icons.CheckCircle className="w-12 h-12 text-slate-200 mb-4" />
        <h3 className="text-lg font-bold text-slate-400">Review Inbox Clear</h3>
        <p className="text-slate-400 text-sm">All persistent submissions have been addressed.</p>
      </div>
    );
  }

  const latestResult: VerificationResult | undefined = latestSubmission?.verificationResults?.slice(-1)[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
      <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-280px)] shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
          <span className="font-bold text-xs uppercase text-slate-500 tracking-wider">Queue ({executionData.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {executionData.map(at => {
            const attendee = workshop.attendees.find(a => a.id === at.attendeeId);
            const task = workshop.tasks.find(t => t.id === at.taskId);
            const key = `${at.attendeeId}-${at.taskId}`;
            const latestSub = at.submissions[at.submissions.length - 1];
            return (
              <div 
                key={key} 
                onClick={() => { setSelectedKey(key); setShowHistory(false); }}
                className={`p-4 cursor-pointer transition-all ${selectedKey === key ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'hover:bg-slate-50'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="font-bold text-sm text-slate-900">{attendee?.name}</div>
                  <span className="text-[10px] text-slate-400">{new Date(latestSub?.timestamp || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="text-xs text-slate-500 truncate">{task?.title}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-8 flex flex-col h-[calc(100vh-280px)] overflow-y-auto pr-2">
        {currentTask ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-8 h-fit flex flex-col shadow-sm">
            <header className="flex justify-between items-start shrink-0">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">
                  {workshop.attendees.find(a => a.id === currentTask.attendeeId)?.name}
                </h3>
                <p className="text-slate-500 font-medium">
                  Project: {workshop.attendees.find(a => a.id === currentTask.attendeeId)?.projectName}
                </p>
              </div>
              <div className="text-right">
                <span className="bg-slate-100 text-slate-800 px-4 py-1.5 rounded-lg text-xs font-black ring-1 ring-slate-200 uppercase">
                  {currentTask.executionState}
                </span>
              </div>
            </header>

            <div className="space-y-8">
              <div className="space-y-4">
                {latestSubmission && (
                  <ArtifactView submission={latestSubmission} title="Primary Evidence" highlight={true} />
                )}
              </div>

              {currentTaskSpec?.humanAcceptance && (
                <div className="p-6 border-2 border-dashed border-slate-100 rounded-2xl">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Manual Acceptance Checklist</h4>
                  <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {currentTaskSpec.humanAcceptance}
                  </div>
                </div>
              )}

              {currentTask.executionState === ExecutionState.SUBMITTED ? (
                <div className="pt-4">
                  <button 
                    onClick={() => handleAction(currentTask.attendeeId, currentTask.taskId, 'beginReview')}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all transform active:scale-[0.98]"
                  >
                    Lock Submission & Begin Review
                  </button>
                </div>
              ) : (
                <div className="space-y-6 pt-4 border-t border-slate-100">
                  <textarea 
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Reviewer Feedback..."
                    className="w-full border-2 border-slate-200 rounded-2xl p-6 text-sm outline-none h-40 transition-all font-medium"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button onClick={() => handleAction(currentTask.attendeeId, currentTask.taskId, 'approve')} className="bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm">Approve</button>
                    <button onClick={() => handleAction(currentTask.attendeeId, currentTask.taskId, 'requestRevision')} className="bg-amber-500 text-white py-4 rounded-2xl font-black text-sm">Req. Revision</button>
                    <button onClick={() => handleAction(currentTask.attendeeId, currentTask.taskId, 'reject')} className="bg-red-600 text-white py-4 rounded-2xl font-black text-sm">Reject</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 bg-white rounded-xl border-2 border-slate-100 border-dashed">
            <p className="font-medium">Select a submission from the queue</p>
          </div>
        )}
      </div>
    </div>
  );
};
