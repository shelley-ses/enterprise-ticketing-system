const STORAGE_KEY = 'customer_feedback';
const EXTERNAL_TICKETS_KEY = 'demo_external_tickets';

const mockEmployees = [
  { id: 1, name: 'Juan Dela Cruz', jobTitle: 'Technical Support Engineer', department: 'Technical Support' },
  { id: 2, name: 'Maria Santos', jobTitle: 'Network Engineer', department: 'Network Engineering' },
  { id: 3, name: 'John Reyes', jobTitle: 'QA Engineer', department: 'Quality Assurance' },
];

const demoExternalTicket = {
  id: 'EXT-2026-00125',
  ticket_ID: 100125,
  title: 'Network connectivity issues in Building B',
  subject: 'Network connectivity issues in Building B',
  description: 'Intermittent network connectivity issues affecting multiple workstations in Building B, third floor. The issue has been present for the past week and requires immediate attention.',
  status: 'Closed',
  priority: 'High',
  category: 'Network',
  equipment: 'Network Switch',
  customer: 'Acme Corporation',
  requestor: 'John Smith',
  created_by_name: 'John Smith',
  assignedEmployees: [1, 2, 3],
  assigned_to: null,
  facility: 'Building B',
  date_created: '2026-07-20T08:30:00Z',
  created_at: '2026-07-20T08:30:00Z',
  resolved_at: '2026-07-22T16:45:00Z',
  closed_at: '2026-07-22T17:00:00Z',
  last_updated: '2026-07-22T17:00:00Z',
  lastUpdate: '2026-07-22T17:00:00Z',
  updated_at: '2026-07-22T17:00:00Z',
  can_discard: false,
  isMock: true,
  attachments: [
    { id: 1, name: 'network_diagram.pdf', url: '#' },
  ],
  timeline: [
    { id: 'creation', type: 'system', text: 'Ticket created.', timestamp: '2026-07-20T08:30:00Z' },
    { id: 'assigned', type: 'system', text: 'Assigned to Technical Support team.', timestamp: '2026-07-20T10:00:00Z' },
    { id: 'progress', type: 'status', text: 'Investigation started by Juan Dela Cruz.', timestamp: '2026-07-21T09:00:00Z' },
    { id: 'resolved', type: 'status', text: 'Issue resolved. Network switch configuration updated.', timestamp: '2026-07-22T16:45:00Z' },
    { id: 'closed', type: 'status', text: 'Ticket closed.', timestamp: '2026-07-22T17:00:00Z' },
  ],
};

export function getMockEmployees() {
  return mockEmployees;
}

export function getEmployeeById(id) {
  return mockEmployees.find((e) => e.id === id) || null;
}

export function getDemoExternalTicket() {
  return { ...demoExternalTicket };
}

export function seedDemoExternalTicket() {
  const stored = localStorage.getItem(EXTERNAL_TICKETS_KEY);
  if (!stored) {
    localStorage.setItem(EXTERNAL_TICKETS_KEY, JSON.stringify([demoExternalTicket]));
    return true;
  }
  return false;
}

export function getExternalTicketsFromStorage() {
  try {
    const stored = localStorage.getItem(EXTERNAL_TICKETS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function getAllFeedback() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function getTicketFeedback(ticketId) {
  const all = getAllFeedback();
  return all[ticketId] || null;
}

export function hasFeedbackBeenSubmitted(ticketId) {
  const feedback = getTicketFeedback(ticketId);
  return !!(feedback && feedback.submitted);
}

export async function saveFeedback(ticketId, ratings, comments, overallComment, customerId = null) {
  const all = getAllFeedback();
  const feedbackData = {
    ratings,
    comments: comments || {},
    overallComment: overallComment || '',
    submittedAt: new Date().toISOString(),
    submitted: true,
  };

  all[ticketId] = feedbackData;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

  // Send rating payload to legacy DB via analytics-service backend API
  try {
    const res = await fetch('/api/ticketing/analytics/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        ticket_id: String(ticketId),
        customer_id: customerId ? String(customerId) : null,
        ratings,
        comments: comments || {},
        overall_comment: overallComment || '',
      }),
    });
    const result = await res.json();
    console.log('CSAT feedback posted to analytics-service:', result);
  } catch (err) {
    console.warn('Analytics service offline. Feedback persisted locally:', err);
  }

  return all[ticketId];
}

