
import React, { useState, useEffect } from 'react';
import { Task, Workshop, ProjectStatus, RejectedSubmission } from '../types';
import { getGlobalTasks } from '../services/taskService';
import { 
  findOrCreateHiddenContainer, 
  fetchWorkshops, 
  saveWorkshop
} from '../services/workshopService';
import { performTransition } from '../services/executionService';
import { checkRateLimit, incrementRateLimit } from '../services/publicSubmissionService';
import { Icons } from '../constants';

interface PublicTaskViewProps {
  templateId: string;
  token?: string;
}

export const PublicTaskView: React.FC<PublicTaskViewProps> = ({ templateId, token }) => {
  const [task, setTask] = useState<Task | null>(null);
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => {
    getGlobalTasks().then(all => {
      const found = all.find(t => t.id === templateId);
      setTask(found || null);
    });
  }, [templateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;

    if (token !== 'PRO-SECRET') {
      setError({ message: "Invalid token.", code: 'INVALID_TOKEN' });
      return;
    }

    if (!email || !email.includes('@')) {
      setError({ message: "Valid email required.", code: 'MISSING_IDENTITY' });
      return;
    }

    // Fix: Await the async checkRateLimit call to get the RateLimitStatus object
    const rate = await checkRateLimit(email);
    if (!rate.allowed) {
      setError({ message: "Submission limit reached.", code: 'RATE_LIMIT' });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const container = await findOrCreateHiddenContainer(task);
      const workshops = await fetchWorkshops();
      let workshopInRef = workshops.find(w => w.id === container.id)!;
      let attendee = workshopInRef.attendees.find(a => a.email.toLowerCase() === email.toLowerCase());

      if (!attendee) {
        attendee = {
          id: crypto.randomUUID(),
          name: email.split('@')[0],
          email: email,
          projectName: 'Public Submission',
          status: ProjectStatus.NOT_STARTED,
          engagementScore: 50,
          followUpSent: false,
          notes: '',
          questionsAsked: 0
        };
        workshopInRef.attendees.push(attendee);
        await saveWorkshop(workshopInRef);
      }

      await performTransition(attendee.id, task.id, 'assign', 'System');
      await performTransition(attendee.id, task.id, 'start', 'System');
      await performTransition(attendee.id, task.id, 'submit', 'Attendee', { content });
      
      incrementRateLimit(email);
      setSubmitted(true);
    } catch (err) {
      setError({ message: "Internal error.", code: 'MALFORMED_INPUT' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-12 bg-white rounded-3xl border text-center animate-fadeIn">
        <Icons.CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-6" />
        <h2 className="text-2xl font-bold mb-8">Proof Logged for Persistent Review</h2>
        <button onClick={() => { setSubmitted(false); setContent(''); }} className="text-indigo-600 font-bold">Submit another</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <div className="bg-white rounded-3xl border shadow-xl overflow-hidden animate-fadeIn">
        <div className="p-8 bg-indigo-900 text-white">
          <h1 className="text-3xl font-bold">{task?.title || 'Public Submission'}</h1>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <input required type="email" placeholder="you@company.com" className="w-full border p-4 rounded-xl" value={email} onChange={e => setEmail(e.target.value)} />
          <textarea required placeholder="Proof of Work..." className="w-full border p-4 rounded-xl h-32 resize-none" value={content} onChange={e => setContent(e.target.value)} />
          <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black">
            {isSubmitting ? 'Syncing...' : 'Submit Achievement'}
          </button>
        </form>
      </div>
    </div>
  );
};
