import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { WorkshopDetail } from '../components/WorkshopDetail';
import { fieldEventsRepo } from '../services/repos/fieldEventsRepo';
import type { FieldEventSummary } from '../types';

export const EventDetail: React.FC = () => {
  const { fieldEventId } = useParams<{ fieldEventId: string }>();
  const navigate = useNavigate();

  const [fieldEvent, setFieldEvent] = useState<FieldEventSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!fieldEventId) {
      setLoadError('No event ID provided');
      setIsLoading(false);
      return;
    }

    let isStale = false;

    async function loadFieldEvent() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const event = await fieldEventsRepo.getById(fieldEventId);
        if (isStale) return;

        if (!event) {
          setLoadError('Event not found');
          setFieldEvent(null);
        } else {
          setFieldEvent(event);
        }
      } catch (err: any) {
        if (isStale) return;
        setLoadError(err?.message ?? 'Failed to load event');
        setFieldEvent(null);
      } finally {
        if (isStale) return;
        setIsLoading(false);
      }
    }

    loadFieldEvent();

    return () => {
      isStale = true;
    };
  }, [fieldEventId]);

  const handleBack = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="animate-fadeIn">
        <div className="text-sm text-slate-400 px-2 py-8">Loading event…</div>
      </div>
    );
  }

  if (loadError || !fieldEvent) {
    return (
      <div className="animate-fadeIn space-y-4">
        <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-xl text-sm">
          {loadError ?? 'Event not found'}
        </div>
        <button
          onClick={handleBack}
          className="text-slate-500 hover:text-indigo-600 flex items-center gap-2 transition-colors"
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  return <WorkshopDetail fieldEvent={fieldEvent} onBack={handleBack} />;
};
