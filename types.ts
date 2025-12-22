
export enum ProjectStatus {
  SHIPPED = 'Shipped',
  IN_PROGRESS = 'In Progress',
  NOT_STARTED = 'Not Started'
}

export enum AssignmentState {
  UNASSIGNED = 'UNASSIGNED',
  ASSIGNED = 'ASSIGNED'
}

export enum ExecutionState {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  NEEDS_REVISION = 'NEEDS_REVISION',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED'
}

export enum WorkshopView {
  OVERVIEW = 'OVERVIEW',
  REVIEW_INBOX = 'REVIEW_INBOX',
  TASKS = 'TASKS',
  ATTENDEES = 'ATTENDEES',
  SUBMISSION_LOGS = 'SUBMISSION_LOGS'
}

export interface TransitionEvent {
  timestamp: number;
  actor: string;
  action: string;
  from: AssignmentState | ExecutionState | 'NULL';
  to: AssignmentState | ExecutionState;
  notes?: string;
  reasonCode?: string;
}

export interface Assertion {
  type: 'navigate' | 'click' | 'fill' | 'expectVisible' | 'expectTextContains' | 'expectUrlContains';
  urlPath?: string;
  selector?: string;
  value?: string;
  text?: string;
}

export interface VerifierSpec {
  testUrlSource: "submission_url" | "deployed_url";
  setupSteps: string[];
  assertions: Assertion[];
  timeouts: { pageLoadMs: number; actionMs: number; totalMs: number };
  evidence: { screenshot: boolean; console: boolean; trace: boolean };
  verdictPolicy: { inconclusiveOnTimeout: boolean };
}

export interface VerificationResult {
  verdict: "PASS" | "FAIL" | "INCONCLUSIVE";
  failingAssertionId?: string;
  evidence: { 
    screenshots?: string[]; 
    console?: string[]; 
    trace?: string; 
    summary: string; 
  };
  ranAt: number;
}

export interface Submission {
  id: string;
  content: string;
  timestamp: number;
  reviewerNotes?: string;
  verificationResults?: VerificationResult[];
}

export interface RejectedSubmission {
  id: string;
  email: string;
  taskId: string;
  content: string;
  timestamp: number;
  reasonCode: 'RATE_LIMIT' | 'INVALID_STATE' | 'MISSING_IDENTITY' | 'INVALID_TOKEN' | 'MALFORMED_INPUT';
  reasonMessage: string;
}

export interface AttendeeTask {
  attendeeId: string;
  taskId: string;
  assignmentState: AssignmentState;
  executionState?: ExecutionState;
  history: TransitionEvent[];
  submissions: Submission[];
}

export interface Task {
  id: string;
  title: string;
  brief: string;
  criteria: string; 
  humanAcceptance: string; 
  verifierSpec?: VerifierSpec; 
  rewardCredits?: number;
  dueDate?: string;
  sequenceOrder?: number;
}

export interface Attendee {
  id: string;
  name: string;
  email: string;
  projectName: string;
  status: ProjectStatus;
  engagementScore: number;
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
  tasks: Task[];
  topic: string;
  conversionGoal: string;
  hidden?: boolean;
  origin?: 'MANUAL' | 'AUTO_TEMPLATE';
  templateId?: string;
  rejectedSubmissions?: RejectedSubmission[];
}

export interface ConversionMetrics {
  totalWorkshops: number;
  totalAttendees: number;
  shipRate: number;
  conversionRate: number;
  estimatedROI: number;
  potentialMRR: number;
}
