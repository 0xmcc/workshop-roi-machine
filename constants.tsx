
import React from 'react';
import { Workshop, ProjectStatus, VerifierSpec } from './types';

const SAMPLE_VERIFIER: VerifierSpec = {
  testUrlSource: "submission_url",
  setupSteps: ["Navigate to provided URL", "Wait for hydration"],
  assertions: [
    { type: 'expectVisible', selector: 'h1' },
    { type: 'expectTextContains', selector: 'body', text: 'Gemini' }
  ],
  timeouts: { pageLoadMs: 5000, actionMs: 1000, totalMs: 15000 },
  evidence: { screenshot: true, console: true, trace: true },
  verdictPolicy: { inconclusiveOnTimeout: true }
};

export const MOCK_WORKSHOPS: Workshop[] = [
  {
    id: '3361e6c3-1627-463a-874e-76e330f65306',
    title: 'AI Product Builder Masterclass',
    date: '2024-05-15',
    venue: 'Google Campus / SF',
    topic: 'Building MVPs with Gemini API',
    conversionGoal: 'Annual Pro Membership ($299)',
    tasks: [
      {
        id: 'd86f7841-f648-4286-9b62-671e35560b45',
        title: 'Initial API Handshake',
        brief: 'Successfully call the Gemini API and log a response.',
        criteria: 'Screenshot of console log with API response.',
        humanAcceptance: "- [ ] Console log shows 200 OK from Gemini\n- [ ] Response content matches the prompt context\n- [ ] Error handling block is present in source",
        verifierSpec: SAMPLE_VERIFIER,
        rewardCredits: 10
      },
      {
        id: '5b2c7923-3893-4a7b-8321-4f164d144573',
        title: 'MVP Deployment',
        brief: 'Deploy your MVP to a public URL.',
        criteria: 'Live URL and repository link.',
        humanAcceptance: "- [ ] URL is reachable\n- [ ] Repository is public\n- [ ] Environment variables are not committed",
        rewardCredits: 50
      }
    ],
    attendees: [
      {
        id: 'f78a7841-f648-4286-9b62-671e35560b45',
        name: 'Sarah Chen',
        email: 'sarah@example.com',
        projectName: 'Smart CRM Integration',
        status: ProjectStatus.SHIPPED,
        engagementScore: 95,
        followUpSent: true,
        notes: 'Highly engaged, asked about enterprise pricing.',
        questionsAsked: 5
      },
      {
        id: 'a2b27923-3893-4a7b-8321-4f164d144573',
        name: 'Marcus Thorne',
        email: 'marcus@devs.io',
        projectName: 'Voice Assistant for Seniors',
        status: ProjectStatus.IN_PROGRESS,
        engagementScore: 65,
        followUpSent: false,
        notes: 'Struggling with audio latency.',
        questionsAsked: 2
      },
      {
        id: 'e1c27923-3893-4a7b-8321-4f164d144573',
        name: 'Elena Rodriguez',
        email: 'elena@startup.co',
        projectName: 'Eco-Tracker Dashboard',
        status: ProjectStatus.SHIPPED,
        engagementScore: 88,
        followUpSent: true,
        notes: 'Already shared the project on LinkedIn.',
        questionsAsked: 1
      }
    ]
  }
];

export const Icons = {
  Zap: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4 14.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0"/><path d="M12 4h.01"/><path d="M12 10h.01"/><path d="M12 16h.01"/><path d="M12 22h.01"/><path d="M20 14.5a3.5 3.5 0 1 0-7 0 3.5 3.5 0 1 0 7 0"/></svg>
  ),
  TrendUp: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>
  ),
  Users: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  Sparkles: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
  ),
  ArrowRight: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
  ),
  Mail: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
  ),
  CheckCircle: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
  ),
  XCircle: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
  ),
  Plus: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  ),
  History: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
  ),
  Clipboard: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
  ),
  ExternalLink: (props: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
  )
};
