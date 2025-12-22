
import React, { useState, useEffect, useMemo } from 'react';
import { Workshop, Task, Attendee, ProjectStatus, ExecutionState, AssignmentState, Submission, AttendeeTask } from '../types';
import { fetchWorkshops, saveWorkshop } from '../services/workshopService';
import { getAttendeeTasks, performTransition, getNextTask } from '../services/executionService';
import { checkRateLimit, incrementRateLimit, RateLimitStatus } from '../services/publicSubmissionService';
import { Icons } from '../constants';

interface StudentWorkshopViewProps {
  workshopId: string;
}

interface CriterionStatus {
  text: string;
  satisfied: boolean;
  type: 'url' | 'length' | 'generic';
}

export const StudentWorkshopView: React.FC<StudentWorkshopViewProps> = ({ workshopId }) => {
  const [email, setEmail] = useState(() => localStorage.getItem('student_identity_email') || '');
  const [isJoined, setIsJoined] = useState(!!email);
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [attendeeTasks, setAttendeeTasks] = useState<AttendeeTask[]>([]);
  const [submissionContent, setSubmissionContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSubmissionTime, setLastSubmissionTime] = useState(0);

  const loadData = async () => {
    const workshops = await fetchWorkshops();
    const found = workshops.find(w => w.id === workshopId);
    if (found) {
      setWorkshop(found);
      const tasks = await getAttendeeTasks();
      setAttendeeTasks(tasks);
    }
  };

  useEffect(() => {
    loadData();
  }, [workshopId, lastSubmissionTime]);

  const attendee = useMemo(() => {
    if (!workshop || !email) return null;
    return workshop.attendees.find(a => a.email.toLowerCase() === email.toLowerCase());
  }, [workshop, email]);

  const nextTask = useMemo(() => {
    if (!workshop || !attendee) return null;
    return getNextTask(attendee.id, workshop, attendeeTasks);
  }, [workshop, attendee, attendeeTasks]);

  const currentAttendeeTask = useMemo(() => {
    if (!attendee || !nextTask) return null;
    return attendeeTasks.find(at => at.attendeeId === attendee.id && at.taskId === nextTask.id);
  }, [attendee, nextTask, attendeeTasks]);

  const latestSubmission = useMemo(() => {
    if (!currentAttendeeTask || currentAttendeeTask.submissions.length === 0) return null;
    return currentAttendeeTask.submissions[currentAttendeeTask.submissions.length - 1];
  }, [currentAttendeeTask]);

  const progress = useMemo(() => {
    if (!workshop || !attendee) return 0;
    const completed = attendeeTasks.filter(at => at.attendeeId === attendee.id && at.executionState === ExecutionState.COMPLETED).length;
    return workshop.tasks.length > 0 ? (completed / workshop.tasks.length) * 100 : 0;
  }, [workshop, attendee, attendeeTasks]);

  // Fix: use state and useEffect to handle the async rate limit check correctly.
  const [rateInfo, setRateInfo] = useState<RateLimitStatus>({ allowed: true, remaining: 5, count: 0 });

  useEffect(() => {
    if (email) {
      checkRateLimit(email).then(setRateInfo);
    }
  }, [email, lastSubmissionTime]);

  const evaluation = useMemo(() => {
    if (!nextTask) return [];
    const lines = nextTask.humanAcceptance.split('\n').filter(l => l.trim().length > 0);
    const content = submissionContent.trim();
    const isUrl = /^https?:\/\/\S+/.test(content);
    return lines.map(line => {
      const cleanText = line.replace(/^-\s*\[\s*\]\s*/, '').trim();
      let satisfied = content.length > 5;
      if (cleanText.toLowerCase().includes('url') || cleanText.toLowerCase().includes('link')) {
        satisfied = isUrl;
      } else if (cleanText.toLowerCase().includes('describe') || cleanText.toLowerCase().includes('content')) {
        satisfied = content.length > 20;
      }
      return { text: cleanText, satisfied } as CriterionStatus;
    });
  }, [nextTask, submissionContent]);

  const allCriteriaMet = useMemo(() => evaluation.every(e => e.satisfied), [evaluation]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError("Please provide a valid professional email.");
      return;
    }
    
    localStorage.setItem('student_identity_email', email);
    
    if (workshop && !workshop.attendees.some(a => a.email.toLowerCase() === email.toLowerCase())) {
      const newAttendee: Attendee = {
        id: crypto.randomUUID(),
        name: email.split('@')[0],
        email: email,
        projectName: 'Workshop Participant',
        status: ProjectStatus.NOT_STARTED,
        engagementScore: 50,
        followUpSent: false,
        notes: '',
        questionsAsked: 0
      };
      const updated = { ...workshop, attendees: [...workshop.attendees, newAttendee] };
      await saveWorkshop(updated);
      await loadData();
    }
    
    setIsJoined(true);
    setError(null);
  };

  const handleSubmitProof = async (taskId: string) => {
    if (!attendee || !workshop || !allCriteriaMet || !rateInfo.allowed) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (!currentAttendeeTask || currentAttendeeTask.assignmentState === AssignmentState.UNASSIGNED) {
        await performTransition(attendee.id, taskId, 'assign', 'Student');
      }
      await performTransition(attendee.id, taskId, 'start', 'Student');
      await performTransition(attendee.id, taskId, 'submit', 'Student', { content: submissionContent });
      incrementRateLimit(email);
      setSubmissionContent('');
      setLastSubmissionTime(Date.now());
      await loadData();
    } catch (err) {
      setError("Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLocked = currentAttendeeTask?.executionState === ExecutionState.SUBMITTED || 
                   currentAttendeeTask?.executionState === ExecutionState.IN_REVIEW;

  if (!workshop) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <Icons.XCircle className="w-12 h-12 mb-4 opacity-20" />
        <h2 className="text-xl font-bold">Connecting...</h2>
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div className="max-w-md mx-auto py-20 px-6">
        <form onSubmit={handleJoin} className="bg-white p-8 rounded-3xl border shadow-xl space-y-6">
          <h1 className="text-2xl font-bold">Join Workshop</h1>
          <input required type="email" placeholder="Your work email" className="w-full border p-4 rounded-xl" value={email} onChange={e => setEmail(e.target.value)} />
          <button className="w-full bg-slate-900 text-white py-4 rounded-xl font-black">Enter Workspace</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 px-6 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl font-black">
            {workshop.title.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900">{workshop.title}</h1>
            <p className="text-slate-400 font-bold text-sm">{workshop.topic} • {workshop.venue}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border shadow-sm min-w-[180px]">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mastery Progress</span>
          <div className="h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8">
          {nextTask ? (
            <div className="bg-white rounded-[2.5rem] border overflow-hidden shadow-2xl">
              <div className="p-10 space-y-10">
                <section>
                  <h2 className="text-4xl font-black text-slate-900 mb-4">{nextTask.title}</h2>
                  <p className="text-slate-500 text-lg font-medium">{nextTask.brief}</p>
                </section>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    {isLocked ? (
                      <div className="bg-slate-50 border-2 border-dashed rounded-3xl p-8 flex flex-col gap-4">
                        <p className="text-indigo-600 font-bold italic">"{latestSubmission?.content}"</p>
                        <span className="text-[10px] font-black text-amber-600 uppercase">Processing review...</span>
                      </div>
                    ) : (
                      <textarea placeholder="Proof of work..." className="w-full border-2 rounded-3xl p-6 h-48 resize-none" value={submissionContent} onChange={e => setSubmissionContent(e.target.value)} />
                    )}
                  </div>
                  <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Requirements</h4>
                    {evaluation.map((e, i) => (
                      <div key={i} className={`p-4 rounded-2xl border flex items-center gap-3 ${e.satisfied || isLocked ? 'bg-emerald-50 text-emerald-900' : 'bg-white text-slate-400 opacity-60'}`}>
                        <Icons.CheckCircle className={`w-5 h-5 ${e.satisfied || isLocked ? 'text-emerald-500' : 'text-slate-200'}`} />
                        <span className="text-xs font-bold">{e.text}</span>
                      </div>
                    ))}
                    {!isLocked && (
                      <button disabled={isSubmitting || !allCriteriaMet || !rateInfo.allowed} onClick={() => handleSubmitProof(nextTask.id)} className="w-full py-5 rounded-2xl font-black bg-indigo-600 text-white disabled:opacity-30">
                        {isSubmitting ? 'Syncing...' : 'Commit Achievement'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 text-emerald-900 rounded-[2.5rem] p-12 text-center border-2 border-emerald-100 shadow-2xl">
              <h2 className="text-4xl font-black mb-4">Mastery Achieved</h2>
              <p className="text-emerald-700 font-bold mb-10">All workshop persistent objectives have been secured.</p>
            </div>
          )}
        </div>
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2rem] border overflow-hidden shadow-sm">
             <div className="p-6 bg-slate-50 border-b text-[11px] font-black uppercase tracking-widest text-slate-400">Journey Timeline</div>
             <div className="divide-y divide-slate-100">
               {workshop.tasks.map((t, idx) => {
                 const at = attendeeTasks.find(ed => ed.attendeeId === attendee?.id && ed.taskId === t.id);
                 const isCompleted = at?.executionState === ExecutionState.COMPLETED;
                 const isActive = nextTask?.id === t.id;
                 return (
                   <div key={t.id} className={`p-5 flex gap-4 ${isActive ? 'bg-indigo-50/30' : ''}`}>
                     <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black border-2 ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : isActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 text-slate-200'}`}>
                       {isCompleted ? '✓' : idx + 1}
                     </div>
                     <h4 className={`text-sm font-bold truncate ${isCompleted ? 'text-slate-300' : isActive ? 'text-slate-900' : 'text-slate-400'}`}>{t.title}</h4>
                   </div>
                 );
               })}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
