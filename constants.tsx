
import React from 'react';
import { Workshop, ProjectStatus } from './types';

export const MOCK_WORKSHOPS: Workshop[] = [
  {
    id: 'w1',
    title: 'AI Product Builder Masterclass',
    date: '2024-05-15',
    venue: 'Google Campus / SF',
    topic: 'Building MVPs with Gemini API',
    conversionGoal: 'Annual Pro Membership ($299)',
    attendees: [
      {
        id: 'a1',
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
        id: 'a2',
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
        id: 'a3',
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
  },
  {
    id: 'w2',
    title: 'Modern React Frameworks',
    date: '2024-05-10',
    venue: 'Corporate Office / Austin',
    topic: 'Next.js 14 and Server Components',
    conversionGoal: 'Team Training Package ($4,999)',
    attendees: [
      {
        id: 'a4',
        name: 'David Kim',
        email: 'david.k@corp.com',
        projectName: 'Internal Analytics Portal',
        status: ProjectStatus.IN_PROGRESS,
        engagementScore: 40,
        followUpSent: false,
        notes: 'Needs more help with cache revalidation.',
        questionsAsked: 0
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
  )
};
