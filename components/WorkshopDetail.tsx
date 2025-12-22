
import React, { useState, useEffect, useMemo } from 'react';
import { Workshop, Attendee, Task, AssignmentState, ExecutionState, AttendeeTask, WorkshopView } from '../types';
import { Icons } from '../constants';
import { generateFollowUpMessage } from '../services/geminiService';
import { getAttendeeTasks, performTransition, batchAssignTask } from '../services/executionService';
import { ReviewInbox } from './ReviewInbox';
import { StatCard } from './StatCard';

interface WorkshopDetailProps {
  workshop: Workshop;
  initialView?: WorkshopView;
  onBack: () => void;
  onRefresh: () => void;
}

const VIEW_TO_SLUG: Record<WorkshopView, string> = {
  [WorkshopView.REVIEW_INBOX]: 'review',
  [WorkshopView.TASKS]: 'tasks',
  [WorkshopView.ATTENDEES]: 'attendees',
  [WorkshopView.SUBMISSION_LOGS]: 'logs',
  [WorkshopView.OVERVIEW]: 'performance'
};

export const WorkshopDetail: React.FC<WorkshopDetailProps> = ({ workshop, initialView, onBack, onRefresh }) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [executionData, setExecutionData] = useState<AttendeeTask[]>([]);
  
  const [aiMessage, setAiMessage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState<string | null>(null);

  const activeView = initialView;

  const refreshData = async () => {
    const data = await getAttendeeTasks();
    setExecutionData(data);

    if (!activeView) {
      const hasReviewItems = data.some(t => 
        (t.executionState === ExecutionState.SUBMITTED || t.executionState === ExecutionState.IN_REVIEW) &&
        workshop.attendees.some(a => a.id === t.attendeeId)
      );

      let targetView = WorkshopView.OVERVIEW;
      if (hasReviewItems) {
        targetView = WorkshopView.REVIEW_INBOX;
      } else if (workshop.tasks.length > 0) {
        targetView = WorkshopView.TASKS;
      } else {
        targetView = WorkshopView.ATTENDEES;
      }
      
      window.location.hash = `#/workshops/${workshop.id}/${VIEW_TO_SLUG[targetView]}`;
    }
  };

  useEffect(() => { refreshData(); }, [workshop.id, activeView]);

  useEffect(() => {
    if (activeView === WorkshopView.TASKS && !selectedTaskId && workshop.tasks.length > 0) {
      setSelectedTaskId(workshop.tasks[0].id);
    }
    if (activeView === WorkshopView.ATTENDEES && !selectedAttendeeId && workshop.attendees.length > 0) {
      const sortedAttendees = [...workshop.attendees].sort((a, b) => (b.engagementScore + b.questionsAsked) - (a.engagementScore + a.questionsAsked));
      setSelectedAttendeeId(sortedAttendees[0].id);
    }
  }, [activeView, workshop, executionData]);

  const handleTabView = (view: WorkshopView) => {
    window.location.hash = `#/workshops/${workshop.id}/${VIEW_TO_SLUG[view]}`;
  };

  const getTaskData = (aId: string, tId: string) => executionData.find(d => d.attendeeId === aId && d.taskId === tId);

  const taskMetrics = useMemo(() => {
    const map: Record<string, { assigned: number, completed: number, stalled: number, submitted: number }> = {};
    workshop.tasks.forEach(t => {
      const instances = executionData.filter(ed => ed.taskId === t.id);
      map[t.id] = {
        assigned: instances.filter(ed => ed.assignmentState === AssignmentState.ASSIGNED).length,
        completed: instances.filter(ed => ed.executionState === ExecutionState.COMPLETED).length,
        submitted: instances.filter(ed => ed.executionState === ExecutionState.SUBMITTED).length,
        stalled: instances.filter(ed => 
          ed.assignmentState === AssignmentState.ASSIGNED && 
          [ExecutionState.NOT_STARTED, ExecutionState.NEEDS_REVISION].includes(ed.executionState!)
        ).length
      };
    });
    return map;
  }, [workshop.tasks, executionData]);

  const handleAISynthesis = async (attendee: Attendee) => {
    setIsGenerating(true);
    setAiMessage('');
    const taskEx = getTaskData(attendee.id, selectedTaskId || '');
    const msg = await generateFollowUpMessage(attendee, workshop, taskEx);
    setAiMessage(msg);
    setIsGenerating(false);
  };

  const handleBatchAssign = async () => {
    if (!selectedTaskId) return;
    await batchAssignTask(workshop.attendees, selectedTaskId);
    refreshData();
    onRefresh();
  };

  const renderSurface = () => {
    switch (activeView) {
      case WorkshopView.REVIEW_INBOX:
        return <ReviewInbox workshop={workshop} onRefresh={() => { refreshData(); onRefresh(); }} />;
      
      case WorkshopView.TASKS:
        const currentTask = workshop.tasks.find(t => t.id === selectedTaskId);
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-280px)]">
              <div className="p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">Workshop Tasks</div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {workshop.tasks.map(t => {
                  const m = taskMetrics[t.id];
                  return (
                    <div 
                      key={t.id} 
                      onClick={() => setSelectedTaskId(t.id)}
                      className={`p-5 cursor-pointer transition-all ${selectedTaskId === t.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'hover:bg-slate-50'}`}
                    >
                      <div className="font-bold text-sm text-slate-900 mb-2">{t.title}</div>
                      <div className="flex gap-2">
                        <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">{m.assigned} Assigned</span>
                        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">{m.completed} OK</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="lg:col-span-9 h-[calc(100vh-280px)] flex flex-col">
              {currentTask ? (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-full">
                  <div className="p-6 bg-slate-50/50 border-b border-slate-200 shrink-0 flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{currentTask.title}</h3>
                      <p className="text-sm text-slate-500 mt-1">{currentTask.brief}</p>
                    </div>
                    <button 
                      onClick={handleBatchAssign}
                      className="bg-indigo-600 text-white text-xs font-black px-4 py-2 rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2"
                    >
                      <Icons.Plus className="w-3 h-3" /> Assign to All Attendees
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50/30 text-[10px] uppercase font-black tracking-widest text-slate-400 sticky top-0 bg-white z-10">
                        <tr>
                          <th className="px-6 py-4">Attendee / Lead</th>
                          <th className="px-6 py-4">Assignment</th>
                          <th className="px-6 py-4">Execution State</th>
                          <th className="px-6 py-4 text-right">Transition Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {workshop.attendees.map(a => {
                          const ed = getTaskData(a.id, currentTask.id);
                          return (
                            <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="text-sm font-bold text-slate-900">{a.name}</div>
                                <div className="text-[10px] text-slate-400 truncate">{a.projectName}</div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`text-[10px] font-black px-2 py-1 rounded-md border ${ed?.assignmentState === AssignmentState.ASSIGNED ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                                  {ed?.assignmentState || 'UNASSIGNED'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {ed?.assignmentState === AssignmentState.ASSIGNED ? (
                                  <span className={`text-[10px] font-black uppercase tracking-tighter ${
                                    ed.executionState === ExecutionState.COMPLETED ? 'text-emerald-600' :
                                    ed.executionState === ExecutionState.REJECTED ? 'text-red-600' :
                                    'text-slate-500'
                                  }`}>
                                    {ed.executionState}
                                  </span>
                                ) : <span className="text-slate-200">--</span>}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {ed?.assignmentState !== AssignmentState.ASSIGNED ? (
                                  <button onClick={async () => { await performTransition(a.id, currentTask.id, 'assign'); refreshData(); onRefresh(); }} className="bg-indigo-600 text-white text-[10px] font-black px-4 py-2 rounded-lg hover:bg-indigo-700">Assign Task</button>
                                ) : (
                                  <div className="flex gap-2 justify-end items-center">
                                    {ed.executionState === ExecutionState.NOT_STARTED && <button onClick={async () => { await performTransition(a.id, currentTask.id, 'start'); refreshData(); onRefresh(); }} className="text-[10px] text-blue-600 font-black hover:underline">Start</button>}
                                    {(ed.executionState === ExecutionState.IN_PROGRESS || ed.executionState === ExecutionState.NEEDS_REVISION) && 
                                      <button onClick={async () => { await performTransition(a.id, currentTask.id, 'submit', 'Attendee', { content: 'Simulated submission via Tasks UI' }); refreshData(); onRefresh(); }} className="text-[10px] bg-amber-500 text-white px-3 py-1.5 rounded-lg font-black shadow-sm">Sim. Sub</button>
                                    }
                                    {ed.executionState === ExecutionState.COMPLETED && <Icons.CheckCircle className="w-5 h-5 text-emerald-500" />}
                                    <button onClick={async () => { await performTransition(a.id, currentTask.id, 'unassign'); refreshData(); onRefresh(); }} className="text-[10px] font-black text-slate-300 hover:text-red-500 transition-colors uppercase">Void</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 border-2 border-slate-100 border-dashed rounded-xl">Select a task to manage rollout</div>
              )}
            </div>
          </div>
        );

      case WorkshopView.SUBMISSION_LOGS:
        return (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-6 bg-slate-50 border-b border-slate-200">
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Icons.CheckCircle className="w-4 h-4 text-emerald-500" /> Accepted Attendee History
                </h4>
                <p className="text-xs text-slate-500 mt-1">Successful transitions through the persistent pipeline.</p>
              </div>
              <div className="p-6 space-y-4">
                 {executionData.filter(ed => ed.history.length > 0).map(ed => (
                   <div key={`${ed.attendeeId}-${ed.taskId}`} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                     <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-800">
                          {workshop.attendees.find(a => a.id === ed.attendeeId)?.name} 
                          <span className="text-slate-400 font-normal ml-2">&rarr;</span> 
                          <span className="ml-2">{workshop.tasks.find(t => t.id === ed.taskId)?.title}</span>
                        </span>
                     </div>
                     <div className="space-y-1">
                        {ed.history.map((h, i) => (
                          <div key={i} className="text-[10px] flex gap-2 items-center">
                            <span className="text-slate-400">{new Date(h.timestamp).toLocaleTimeString()}</span>
                            <span className="font-bold uppercase text-indigo-600">{h.action}</span>
                            <span className="text-slate-500">by {h.actor}</span>
                          </div>
                        ))}
                     </div>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        );

      case WorkshopView.ATTENDEES:
        const attendee = workshop.attendees.find(a => a.id === selectedAttendeeId);
        const attendeeTasks = executionData.filter(ed => ed.attendeeId === selectedAttendeeId && ed.assignmentState === AssignmentState.ASSIGNED);
        const assignedTaskIds = new Set(attendeeTasks.map(at => at.taskId));
        const availableTasks = workshop.tasks.filter(t => !assignedTaskIds.has(t.id));

        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-280px)]">
              <div className="p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">Lead Targeting</div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {[...workshop.attendees].sort((a, b) => (b.engagementScore + b.questionsAsked) - (a.engagementScore + a.questionsAsked)).map(a => (
                  <div 
                    key={a.id} 
                    onClick={() => setSelectedAttendeeId(a.id)}
                    className={`p-5 cursor-pointer transition-all ${selectedAttendeeId === a.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-sm text-slate-900">{a.name}</div>
                      <span className="text-[10px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded-full shadow-md shadow-indigo-100">
                        {a.engagementScore + a.questionsAsked}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium truncate">{a.projectName}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="lg:col-span-9 h-[calc(100vh-280px)] flex flex-col space-y-6">
              {attendee ? (
                <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                    <header className="flex justify-between items-start mb-10 pb-8 border-b border-slate-50">
                      <div className="flex items-center gap-5">
                        <img src={`https://picsum.photos/80/80?random=${attendee.id}`} className="w-20 h-20 rounded-full border-4 border-white shadow-lg shadow-indigo-100" alt={attendee.name} />
                        <div>
                          <h3 className="text-2xl font-black text-slate-900">{attendee.name}</h3>
                          <p className="text-slate-500 font-bold">{attendee.email}</p>
                          <div className="flex gap-2 mt-2">
                            <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded uppercase tracking-widest">{attendee.status}</span>
                            <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded uppercase tracking-widest">Score: {attendee.engagementScore}</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleTabView(WorkshopView.OVERVIEW)}
                        className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest flex items-center gap-1 transition-colors"
                      >
                        Relationship Profile <Icons.ArrowRight className="w-3 h-3" />
                      </button>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <section className="space-y-4">
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Assigned Objectives</h4>
                        <div className="space-y-3">
                          {attendeeTasks.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No tasks currently assigned to this lead.</p>
                          ) : (
                            attendeeTasks.map(at => {
                              const task = workshop.tasks.find(t => t.id === at.taskId);
                              return (
                                <div key={at.taskId} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                  <span className="text-xs font-bold text-slate-800">{task?.title}</span>
                                  <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${
                                    at.executionState === ExecutionState.COMPLETED ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                                  }`}>
                                    {at.executionState}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </section>

                      <section className="space-y-4">
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Assign New Objective</h4>
                        <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col gap-3">
                          <select 
                            className="w-full text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all"
                            value={selectedTaskId || ''}
                            onChange={(e) => setSelectedTaskId(e.target.value)}
                          >
                            <option value="">Select a task...</option>
                            {availableTasks.map(t => (
                              <option key={t.id} value={t.id}>{t.title} ({t.rewardCredits} Credits)</option>
                            ))}
                          </select>
                          <button 
                            disabled={!selectedTaskId}
                            onClick={async () => { await performTransition(attendee.id, selectedTaskId!, 'assign'); refreshData(); onRefresh(); setSelectedTaskId(null); }}
                            className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all disabled:opacity-30 flex items-center justify-center gap-2 shadow-lg shadow-slate-100"
                          >
                            <Icons.Plus className="w-3 h-3" /> Commit Assignment
                          </button>
                        </div>
                      </section>
                    </div>
                  </div>

                  <div className="bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                    <div className="relative z-10">
                      <h4 className="text-indigo-300 font-bold text-[10px] uppercase mb-4 flex items-center gap-2 tracking-widest">
                        <Icons.Sparkles className="w-4 h-4" /> AI Lead Strategy & Outreach
                      </h4>
                      {isGenerating ? (
                        <div className="space-y-3 animate-pulse">
                          <div className="h-4 bg-white/10 rounded w-3/4"></div>
                          <div className="h-4 bg-white/10 rounded w-1/2"></div>
                          <div className="h-20 bg-white/5 rounded w-full"></div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {aiMessage ? (
                            <div className="bg-indigo-800/50 p-6 rounded-2xl text-sm italic leading-relaxed text-indigo-100 border border-indigo-700/50">
                              "{aiMessage}"
                            </div>
                          ) : (
                            <p className="text-indigo-200 text-sm font-medium">Synthesize a high-converting follow-up sequence based on this lead's project status and engagement history.</p>
                          )}
                          <div className="flex gap-3">
                            <button 
                              onClick={() => handleAISynthesis(attendee)} 
                              className="bg-white text-indigo-900 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-950/20 hover:scale-[1.02] active:scale-95 transition-all"
                            >
                              {aiMessage ? 'Regenerate Hook' : 'Draft Conversion Hook'}
                            </button>
                            {aiMessage && (
                              <button className="bg-indigo-700 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all">
                                Copy Draft
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 border-2 border-slate-100 border-dashed rounded-xl">
                  Select a lead from the ranking to manage the relationship
                </div>
              )}
            </div>
          </div>
        );

      case WorkshopView.OVERVIEW:
      default:
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
            <StatCard label="Task Assignments" value={executionData.filter(d => d.assignmentState === AssignmentState.ASSIGNED).length} icon={<Icons.Zap className="w-5 h-5"/>} />
            <StatCard label="Success Events" value={executionData.filter(d => d.executionState === ExecutionState.COMPLETED).length} icon={<Icons.CheckCircle className="w-5 h-5"/>} trend="OK" trendUp={true} />
            <StatCard label="High-Value Leads" value={workshop.attendees.filter(a => a.engagementScore > 85).length} icon={<Icons.TrendUp className="w-5 h-5"/>} />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-16 z-40 shadow-sm">
        <div>
          <button onClick={onBack} className="text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase flex items-center gap-1 mb-1 tracking-tighter">
            <Icons.ArrowRight className="rotate-180 w-3 h-3" /> Dashboard
          </button>
          <h2 className="text-xl font-bold text-slate-900">{workshop.title}</h2>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
          {[
            { id: WorkshopView.REVIEW_INBOX, label: 'Review Inbox', icon: <Icons.Clipboard className="w-4 h-4" /> },
            { id: WorkshopView.TASKS, label: 'Workshop Tasks', icon: <Icons.Zap className="w-4 h-4" /> },
            { id: WorkshopView.ATTENDEES, label: 'Attendee Leads', icon: <Icons.Users className="w-4 h-4" /> },
            { id: WorkshopView.SUBMISSION_LOGS, label: 'Hardened Logs', icon: <Icons.History className="w-4 h-4" /> },
            { id: WorkshopView.OVERVIEW, label: 'Performance', icon: <Icons.TrendUp className="w-4 h-4" /> }
          ].map(view => (
            <button 
              key={view.id} 
              onClick={() => handleTabView(view.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeView === view.id ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {view.icon} {view.label}
            </button>
          ))}
        </div>
      </div>
      <main className="max-w-[1440px] mx-auto px-6">{renderSurface()}</main>
    </div>
  );
};
