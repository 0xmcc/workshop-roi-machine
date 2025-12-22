
import { RejectedSubmission } from '../types';
import { supabase, USER_ID } from './supabase';

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  count: number;
}

export const checkRateLimit = async (email: string): Promise<RateLimitStatus> => {
  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  const { count, error } = await supabase
    .from('telemetry_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', USER_ID)
    .eq('event', 'submission_attempt')
    .eq('session_id', email) // Using session_id to store the learner's email for counting
    .gt('timestamp', twentyFourHoursAgo);

  if (error) {
    console.error('Error checking rate limit:', error);
    return { allowed: true, remaining: 5, count: 0 };
  }

  const submissionCount = count || 0;
  const limit = 5;

  return {
    allowed: submissionCount < limit,
    remaining: Math.max(0, limit - submissionCount),
    count: submissionCount
  };
};

export const incrementRateLimit = async (email: string) => {
  await supabase.from('telemetry_events').insert({
    user_id: USER_ID,
    session_id: email,
    event: 'submission_attempt',
    timestamp: Date.now(),
    path: window.location.hash
  });
};

export const validatePublicSubmission = async (
  attendeeId: string, 
  taskId: string
): Promise<{ allowed: boolean; reason?: string; code?: RejectedSubmission['reasonCode'] }> => {
  const { data: taskData, error } = await supabase
    .from('workshop_attendee_tasks')
    .select('execution_state')
    .eq('attendee_id', attendeeId)
    .eq('task_id', taskId)
    .single();

  if (error || !taskData) {
    return { allowed: true };
  }

  const validStates = ['NOT_STARTED', 'IN_PROGRESS', 'NEEDS_REVISION'];
  if (!validStates.includes(taskData.execution_state)) {
    return { 
      allowed: false, 
      reason: `Task is already in state: ${taskData.execution_state}`,
      code: 'INVALID_STATE'
    };
  }

  return { allowed: true };
};
