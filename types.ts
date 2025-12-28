
export enum ProjectStatus {
  SHIPPED = 'Shipped',
  IN_PROGRESS = 'In Progress',
  NOT_STARTED = 'Not Started'
}

export type FieldEventId = string;
export type AttendeeId = string;

export interface FieldEvent {
  id: FieldEventId;
  title: string;
  date: string;
  venue: string;
  topic: string;
  conversionGoal: string;
}

export interface FieldEventSummary extends FieldEvent {
  attendeeCount: number;
}

export interface FieldEventAttendee {
  id: string;
  name: string;
  email: string;
  projectName: string;
  status: ProjectStatus;
  engagementScore: number; // 0-100
  notes: string;
  questionsAsked: number;
  fieldEventId: FieldEventId;
}

export type FollowupStatus = 'draft' | 'sent';

export interface FieldEventFollowup {
  id: string; // uuid from DB, represented as string in TS
  fieldEventId: FieldEventId;
  attendeeId: AttendeeId;
  attendeeEmail: string;
  subject: string;
  body: string;
  status: FollowupStatus;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversionMetrics {
  totalWorkshops: number;
  totalAttendees: number;
  shipRate: number;
  conversionRate: number;
  estimatedROI: number;
  potentialMRR: number;
}
