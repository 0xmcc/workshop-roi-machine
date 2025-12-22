
import React, { useState, useEffect } from 'react';
import { Task, Workshop, VerifierSpec } from '../types';
import { getGlobalTasks, saveGlobalTask, deleteGlobalTask } from '../services/taskService';
import { Icons } from '../constants';
import { generateTaskBlueprint } from '../services/geminiService';

interface GlobalTasksProps {
  workshops: Workshop[];
  onUpdateWorkshops: (w: Workshop[]) => void;
}

export const GlobalTasks: React.FC<GlobalTasksProps> = ({ workshops, onUpdateWorkshops }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
  const [targetWorkshopId, setTargetWorkshopId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [aiGoal, setAiGoal] = useState('');
  const [isAiDrafting, setIsAiDrafting] = useState(false);

  const loadTasks = async () => {
    const t = await getGlobalTasks();
    setTasks(t);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleAiDraft = async () => {
    if (!aiGoal) return;
    setIsAiDrafting(true);
    try {
      const draft = await generateTaskBlueprint(aiGoal);
      setEditingTask(prev => ({
        ...prev,
        humanAcceptance: draft.humanAcceptance,
        verifierSpec: draft.verifierSpec
      }));
      setAiGoal('');
    } catch (err) {
      alert("AI Blueprint generation failed.");
    } finally {
      setIsAiDrafting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask?.title) return;
    
    const task: Task = {
      id: editingTask.id || crypto.randomUUID(),
      title: editingTask.title || '',
      brief: editingTask.brief || '',
      criteria: editingTask.criteria || '',
      humanAcceptance: editingTask.humanAcceptance || '',
      verifierSpec: editingTask.verifierSpec,
      rewardCredits: editingTask.rewardCredits || 0,
      dueDate: editingTask.dueDate
    };
    await saveGlobalTask(task);
    await loadTasks();
    setEditingTask(null);
  };

  const handleCopyToWorkshop = async (taskId: string) => {
    if (!targetWorkshopId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedWorkshops = workshops.map(w => {
      if (w.id === targetWorkshopId) {
        if (w.tasks.some(t => t.id === task.id)) {
          alert("Task already exists in this workshop.");
          return w;
        }
        return { ...w, tasks: [...w.tasks, task] };
      }
      return w;
    });

    await onUpdateWorkshops(updatedWorkshops);
    alert(`Applied to ${workshops.find(w => w.id === targetWorkshopId)?.title}`);
  };

  const getShareUrl = (taskId: string) => `${window.location.origin}/#/tasks/${taskId}?token=PRO-SECRET`;

  const handleShare = (taskId: string) => {
    navigator.clipboard.writeText(getShareUrl(taskId));
    setCopiedId(taskId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const inputClasses = "w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all";
  const labelClasses = "block text-[11px] font-black text-slate-600 uppercase mb-2 tracking-widest pl-1";

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Task Canonical Pool</h2>
          <p className="text-slate-500">Persistent pool for global workshop distribution.</p>
        </div>
        <button onClick={() => { setEditingTask({}); setAiGoal(''); }} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm">Create Global Task</button>
      </header>

      {editingTask && (
        <form onSubmit={handleSave} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6 animate-fadeIn">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className={labelClasses}>Task Title</label>
              <input required className={inputClasses} value={editingTask.title || ''} onChange={e => setEditingTask({...editingTask, title: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className={labelClasses}>Human Acceptance Checklist</label>
              <textarea className={`${inputClasses} h-24`} value={editingTask.humanAcceptance || ''} onChange={e => setEditingTask({...editingTask, humanAcceptance: e.target.value})} />
            </div>
            <div>
              <label className={labelClasses}>Reward Credits</label>
              <input type="number" className={inputClasses} value={editingTask.rewardCredits || 0} onChange={e => setEditingTask({...editingTask, rewardCredits: parseInt(e.target.value)})} />
            </div>
          </div>
          <div className="flex gap-4 justify-end pt-4 border-t border-slate-50">
            <button type="button" onClick={() => setEditingTask(null)} className="px-6 py-2 text-sm font-bold text-slate-400">Cancel</button>
            <button type="submit" className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-sm">Commit Task</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {tasks.map(t => (
          <div key={t.id} className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col group hover:border-indigo-200 transition-all shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex-1">
                <h4 className="font-bold text-slate-800 text-lg">{t.title}</h4>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditingTask(t)} className="p-2 text-slate-300 hover:text-slate-600"><Icons.Clipboard className="w-4 h-4" /></button>
                <button onClick={async () => { await deleteGlobalTask(t.id); await loadTasks(); }} className="p-2 text-slate-300 hover:text-red-500"><Icons.XCircle className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-50">
              <div className="flex items-center gap-3">
                <select className="text-xs border border-slate-200 p-2 rounded-lg" value={targetWorkshopId} onChange={e => setTargetWorkshopId(e.target.value)}>
                  <option value="">Select Workshop...</option>
                  {workshops.filter(w => !w.hidden).map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
                </select>
                <button disabled={!targetWorkshopId} onClick={() => handleCopyToWorkshop(t.id)} className="bg-indigo-600 px-4 py-2.5 rounded-xl text-white text-xs font-bold disabled:opacity-30">Apply</button>
              </div>
              <button onClick={() => handleShare(t.id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${copiedId === t.id ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600 border'}`}>
                {copiedId === t.id ? 'Copied' : 'Share Link'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
