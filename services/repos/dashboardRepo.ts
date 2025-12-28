import { getSupabaseClient } from '../supabaseClient';

export interface DashboardMetrics {
  totalFieldEvents: number;
  totalAttendees: number;
  shipRatePct: number;
  hotLeads: number;
  drafts: number;
  sent: number;
  estimatedOpportunityUsd: number;
}

export const dashboardRepo = {
  async getMetrics(): Promise<DashboardMetrics> {
    const supabase = getSupabaseClient();

    const eventsRes = await supabase.from('field_events').select('id', { count: 'exact', head: true });
    const totalAttendeesRes = await supabase
      .from('field_event_attendees')
      .select('id', { count: 'exact', head: true });
    const shippedAttendeesRes = await supabase
      .from('field_event_attendees')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Shipped');
    const hotLeadsRes = await supabase
      .from('field_event_attendees')
      .select('id', { count: 'exact', head: true })
      .gte('engagement_score', 80);

    const draftsRes = await supabase
      .from('field_event_followups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'draft');
    const sentRes = await supabase
      .from('field_event_followups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent');

    const firstError =
      eventsRes.error ??
      totalAttendeesRes.error ??
      shippedAttendeesRes.error ??
      hotLeadsRes.error ??
      draftsRes.error ??
      sentRes.error;
    if (firstError) throw firstError;

    // Supabase returns null counts in some edge cases; normalize.
    const totalAttendeesN = totalAttendeesRes.count ?? 0;
    const shippedAttendeesN = shippedAttendeesRes.count ?? 0;
    const shipRatePct = totalAttendeesN > 0 ? (shippedAttendeesN / totalAttendeesN) * 100 : 0;

    const hotLeadsN = hotLeadsRes.count ?? 0;

    // v1: keep the existing “Est. Opportunity” heuristic but base it on real attendee data.
    const estimatedOpportunityUsd = hotLeadsN * 299;

    return {
      totalFieldEvents: eventsRes.count ?? 0,
      totalAttendees: totalAttendeesN,
      shipRatePct,
      hotLeads: hotLeadsN,
      drafts: draftsRes.count ?? 0,
      sent: sentRes.count ?? 0,
      estimatedOpportunityUsd
    };
  }
};

