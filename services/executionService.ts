
import { 
  AssignmentState, 
  ExecutionState, 
  AttendeeTask, 
  TransitionEvent, 
  Submission,
  Attendee,
  VerificationResult,
  Workshop,
  Task
} from '../types';
import { supabase } from './supabase';

export const getAttendeeTasks = async (): Promise<AttendeeTask[]> => {
  const { data: states, error: stateErr } = await supabase
    .from('workshop_attendee_tasks')
    .select('*');

  const { data: subs, error: subErr } = await supabase
    .from('workshop_task_submissions')
    .select('*');

  if (stateErr || subErr) return [];

  return states.map(s => ({
    attendeeId: s.attendee_id,
    taskId: s.task_id,
    assignmentState: s.assignment_state as AssignmentState,
    executionState: s.execution_state as ExecutionState,
    history: s.history as TransitionEvent[],
    submissions: subs
      .filter(sub => sub.attendee_id === s.attendee_id && sub.task_id === s.task_id)
      .map(sub => ({
        id: sub.id,
        content: sub.content,
        timestamp: new Date(sub.created_at).getTime(),
        reviewerNotes: sub.reviewer_notes,
        verificationResults: sub.verification_results as VerificationResult[]
      }))
  }));
};

const createEvent = (actor: string, action: string, from: any, to: any, notes?: string): TransitionEvent => ({
  timestamp: Date.now(),
  actor,
  action,
  from,
  to,
  notes
});

export const performTransition = async (
  attendeeId: string,
  taskId: string,
  action: string,
  actor: string = 'Operator',
  payload?: { notes?: string, content?: string }
): Promise<AttendeeTask> => {
  const { data: existing } = await supabase
    .from('workshop_attendee_tasks')
    .select('*')
    .eq('attendee_id', attendeeId)
    .eq('task_id', taskId)
    .single();

  let state: AssignmentState = existing?.assignment_state || AssignmentState.UNASSIGNED;
  let exec: ExecutionState | undefined = existing?.execution_state;
  let history: TransitionEvent[] = existing?.history || [];

  switch (action) {
    case 'assign':
      state = AssignmentState.ASSIGNED;
      exec = ExecutionState.NOT_STARTED;
      history.push(createEvent(actor, 'ASSIGN', 'NULL', AssignmentState.ASSIGNED));
      break;
    case 'unassign':
      state = AssignmentState.UNASSIGNED;
      exec = undefined;
      history.push(createEvent(actor, 'UNASSIGN', existing?.execution_state || AssignmentState.ASSIGNED, AssignmentState.UNASSIGNED));
      break;
    case 'start':
      exec = ExecutionState.IN_PROGRESS;
      history.push(createEvent(actor, 'START', ExecutionState.NOT_STARTED, ExecutionState.IN_PROGRESS));
      break;
    case 'submit':
      const from = exec;
      exec = ExecutionState.SUBMITTED;
      await supabase.from('workshop_task_submissions').insert({
        attendee_id: attendeeId,
        task_id: taskId,
        content: payload?.content || '',
        verification_results: []
      });
      history.push(createEvent(actor, 'SUBMIT', from, ExecutionState.SUBMITTED));
      break;
    case 'beginReview':
      exec = ExecutionState.IN_REVIEW;
      history.push(createEvent(actor, 'BEGIN_REVIEW', ExecutionState.SUBMITTED, ExecutionState.IN_REVIEW));
      break;
    case 'approve':
      exec = ExecutionState.COMPLETED;
      history.push(createEvent(actor, 'APPROVE', ExecutionState.IN_REVIEW, ExecutionState.COMPLETED, payload?.notes));
      break;
    case 'requestRevision':
      exec = ExecutionState.NEEDS_REVISION;
      history.push(createEvent(actor, 'REQUEST_REVISION', ExecutionState.IN_REVIEW, ExecutionState.NEEDS_REVISION, payload?.notes));
      break;
  }

  const { data: updated } = await supabase
    .from('workshop_attendee_tasks')
    .upsert({
      attendee_id: attendeeId,
      task_id: taskId,
      assignment_state: state,
      execution_state: exec,
      history: history,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  return {
    attendeeId,
    taskId,
    assignmentState: state,
    executionState: exec,
    history,
    submissions: [] // Will be merged at caller if needed
  };
};

export const batchAssignTask = async (attendees: Attendee[], taskId: string) => {
  for (const a of attendees) {
    await performTransition(a.id, taskId, 'assign');
  }
};

export const getNextTask = (attendeeId: string, workshop: Workshop, attendeeTasks: AttendeeTask[]): Task | null => {
  const completedIds = new Set(attendeeTasks.filter(t => t.attendeeId === attendeeId && t.executionState === ExecutionState.COMPLETED).map(t => t.taskId));
  return workshop.tasks.find(t => !completedIds.has(t.id)) || null;
};

export const saveVerificationResult = async (attendeeId: string, taskId: string, result: VerificationResult) => {
  const { data: lastSub } = await supabase
    .from('workshop_task_submissions')
    .select('*')
    .eq('attendee_id', attendeeId)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (lastSub) {
    const results = (lastSub.verification_results || []) as VerificationResult[];
    results.push(result);
    await supabase.from('workshop_task_submissions').update({
      verification_results: results
    }).eq('id', lastSub.id);
  }
};
