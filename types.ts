
export enum ProjectStatus {
  SHIPPED = 'Shipped',
  IN_PROGRESS = 'In Progress',
  NOT_STARTED = 'Not Started'
}

export interface Attendee {
  id: string;
  name: string;
  email: string;
  projectName: string;
  status: ProjectStatus;
  engagementScore: number; // 0-100
  followUpSent: boolean;
  notes: string;
  questionsAsked: number;
}

export interface Workshop {
  id: string;
  title: string;
  date: string;
  venue: string;
  attendees: Attendee[];
  topic: string;
  conversionGoal: string; // e.g., "Join Membership", "Enroll in Cohort"
}

export interface ConversionMetrics {
  totalWorkshops: number;
  totalAttendees: number;
  shipRate: number;
  conversionRate: number;
  estimatedROI: number;
  potentialMRR: number;
}
