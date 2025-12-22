
import { Task } from '../types';
import { supabase, USER_ID } from './supabase';

export const getGlobalTasks = async (): Promise<Task[]> => {
  // We use a specific virtual workshop ID for "pool" tasks or filter by null workshop_id if the schema allows.
  // Since the schema requires workshop_id, we'll store global tasks under a dedicated pool workshop.
  const { data, error } = await supabase
    .from('workshop_tasks')
    .select('*')
    .is('workshop_id', null);

  if (error) {
    console.error('Error fetching global tasks:', error);
    return [];
  }

  return (data || []).map(t => ({
    id: t.id,
    title: t.title,
    brief: t.brief,
    criteria: t.criteria,
    humanAcceptance: t.human_acceptance,
    verifierSpec: t.verifier_spec,
    rewardCredits: t.reward_credits,
    dueDate: t.due_date,
    sequenceOrder: t.sequence_order
  }));
};

export const saveGlobalTask = async (task: Task) => {
  const taskData = {
    id: task.id,
    workshop_id: null, // Null indicates global pool
    title: task.title,
    brief: task.brief,
    criteria: task.criteria,
    human_acceptance: task.humanAcceptance,
    verifier_spec: task.verifierSpec,
    reward_credits: task.rewardCredits,
    due_date: task.dueDate,
    sequence_order: task.sequenceOrder
  };

  const { data: existing } = await supabase.from('workshop_tasks').select('id').eq('id', task.id).single();
  
  if (existing) {
    await supabase.from('workshop_tasks').update(taskData).eq('id', task.id);
  } else {
    await supabase.from('workshop_tasks').insert(taskData);
  }
};

export const deleteGlobalTask = async (id: string) => {
  await supabase.from('workshop_tasks').delete().eq('id', id);
};
