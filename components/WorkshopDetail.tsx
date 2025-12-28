
import React, { useState } from 'react';
import { Workshop, Attendee, ProjectStatus } from '../types';
import { Icons } from '../constants';
import { generateFollowUpMessage } from '../services/geminiService';

interface WorkshopDetailProps {
  workshop: Workshop;
  onBack: () => void;
}

export const WorkshopDetail: React.FC<WorkshopDetailProps> = ({ workshop, onBack }) => {
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [aiMessage, setAiMessage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAI = async (attendee: Attendee) => {
    setSelectedAttendee(attendee);
    setIsGenerating(true);
    setAiMessage('');
    const msg = await generateFollowUpMessage(attendee, workshop);
    setAiMessage(msg);
    setIsGenerating(false);
  };

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
              <h1 className="text-2xl font-bold text-slate-900">{workshop.title}</h1>
              <p className="text-slate-500">{workshop.date} • {workshop.venue}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                Conversion Goal: {workshop.conversionGoal}
              </span>
            </div>
          </div>
        </div>

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
              {workshop.attendees.map((attendee) => (
                <tr key={attendee.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="font-semibold text-slate-800">{attendee.name}</div>
                    <div className="text-xs text-slate-500">{attendee.email}</div>
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
                      onClick={() => handleGenerateAI(attendee)}
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow-md"
                    >
                      <Icons.Sparkles className="w-4 h-4" />
                      AI Follow-up
                    </button>
                  </td>
                </tr>
              ))}
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
              Generated Strategy for {selectedAttendee.name}
            </h3>
            <p className="text-indigo-200 text-sm mb-6">
              AI-crafted sequence based on their project: "{selectedAttendee.projectName}"
            </p>
            
            {isGenerating ? (
              <div className="flex items-center gap-3 animate-pulse">
                <div className="h-4 w-4 bg-indigo-400 rounded-full"></div>
                <p className="text-indigo-300">Drafting the perfect pitch...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white/10 p-5 rounded-xl border border-white/10 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {aiMessage}
                </div>
                <div className="flex gap-3">
                  <button className="bg-white text-indigo-900 hover:bg-indigo-50 px-6 py-2.5 rounded-lg font-semibold transition-colors">
                    Send via Email
                  </button>
                  <button className="bg-transparent border border-white/30 text-white hover:bg-white/10 px-6 py-2.5 rounded-lg font-semibold transition-colors">
                    Edit Sequence
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
