
import { Workshop, Task, Attendee, ProjectStatus } from '../types';
import { supabase, USER_ID } from './supabase';

export const fetchWorkshops = async (initial?: Workshop[]): Promise<Workshop[]> => {
  const { data, error } = await supabase
    .from('workshops_roi')
    .select(`
      *,
      attendees: workshop_attendees(*),
      tasks: workshop_tasks(*)
    `)
    .eq('owner_user_id', USER_ID);

  if (error) {
    console.error('Error fetching workshops:', error);
    return [];
  }

  if ((!data || data.length === 0) && initial) {
    for (const w of initial) {
      await saveWorkshop(w);
    }
    return fetchWorkshops();
  }

  return data.map(w => ({
    id: w.id,
    title: w.title,
    date: w.date,
    venue: w.venue,
    topic: w.topic,
    conversionGoal: w.conversion_goal,
    hidden: w.hidden,
    origin: w.origin,
    attendees: w.attendees.map((a: any) => ({
      ...a,
      projectName: a.project_name,
      status: a.status as ProjectStatus,
      engagementScore: a.engagement_score,
      followUpSent: a.follow_up_sent,
      questionsAsked: a.questions_asked
    })),
    tasks: w.tasks.map((t: any) => ({
      ...t,
      humanAcceptance: t.human_acceptance,
      verifierSpec: t.verifier_spec,
      rewardCredits: t.reward_credits,
      sequenceOrder: t.sequence_order
    })).sort((a: any, b: any) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0))
  }));
};

export const saveWorkshop = async (workshop: Workshop) => {
  const workshopData = {
    id: workshop.id,
    owner_user_id: USER_ID,
    title: workshop.title,
    date: workshop.date,
    venue: workshop.venue,
    topic: workshop.topic,
    conversion_goal: workshop.conversionGoal,
    hidden: workshop.hidden || false,
    origin: workshop.origin || 'MANUAL'
  };

  const { error } = await supabase.from('workshops_roi').upsert(workshopData);
  if (error) throw error;

  if (workshop.tasks) {
    for (const t of workshop.tasks) {
      await supabase.from('workshop_tasks').upsert({
        id: t.id,
        workshop_id: workshop.id,
        title: t.title,
        brief: t.brief,
        criteria: t.criteria,
        human_acceptance: t.humanAcceptance,
        verifier_spec: t.verifierSpec,
        reward_credits: t.rewardCredits,
        sequence_order: t.sequenceOrder
      });
    }
  }

  if (workshop.attendees) {
    for (const a of workshop.attendees) {
      await supabase.from('workshop_attendees').upsert({
        id: a.id,
        workshop_id: workshop.id,
        name: a.name,
        email: a.email,
        project_name: a.projectName,
        status: a.status,
        engagement_score: a.engagementScore,
        follow_up_sent: a.followUpSent,
        notes: a.notes,
        questions_asked: a.questionsAsked
      });
    }
  }
};

export const findOrCreateHiddenContainer = async (templateTask: Task): Promise<Workshop> => {
  const { data: existing } = await supabase
    .from('workshops_roi')
    .select('id')
    .eq('origin', 'AUTO_TEMPLATE')
    .eq('title', `Inbox: ${templateTask.title}`)
    .single();

  if (existing) {
    const workshops = await fetchWorkshops();
    return workshops.find(w => w.id === existing.id)!;
  }

  const container: Workshop = {
    id: crypto.randomUUID(),
    title: `Inbox: ${templateTask.title}`,
    date: new Date().toISOString().split('T')[0],
    venue: 'Global Public Endpoint',
    topic: templateTask.title,
    conversionGoal: 'Public Lead Capture',
    tasks: [templateTask],
    attendees: [],
    hidden: true,
    origin: 'AUTO_TEMPLATE'
  };

  await saveWorkshop(container);
  return container;
};
