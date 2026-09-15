const STORAGE_KEY = 'customer_feedback';
const EXTERNAL_TICKETS_KEY = 'demo_external_tickets';
const PENDING_EVAL_KEY = 'demo_pending_evaluation_tickets';

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

const demoPendingEvaluationTicket = {
  id: 'TKT-2026-00901',
  ticket_ID: 9091,
  title: 'Air Conditioning Unit - Proof of Completion Pending Review',
  subject: 'AC Unit Repair - Pending Evaluation',
  description: 'Employee Juan Dela Cruz has completed the AC unit repair in Building A, 2nd Floor. The unit was showing error E4 and has been recalibrated. Proof of completion has been uploaded for CS review. The ticket must be reviewed and approved before it can be resolved.',
  status: 'Pending Evaluation',
  priority: 'High',
  category: 'HVAC',
  equipment: 'AC Unit - SN-AC-2026-001',
  customer: 'Acme Corporation',
  requestor: 'John Smith',
  created_by_name: 'John Smith',
  assigned: [1],
  assignedEmployees: [1],
  assigned_to: 1,
  facility: 'Building A, 2nd Floor',
  date_created: '2026-09-10T08:00:00Z',
  date: '2026-09-10',
  created_at: '2026-09-10T08:00:00Z',
  last_updated: '2026-09-12T14:30:00Z',
  lastUpdate: '2026-09-12T14:30:00Z',
  updated_at: '2026-09-12T14:30:00Z',
  resolved_at: null,
  closed_at: null,
  can_discard: false,
  isMock: true,
  sla: 'On Track',
  department: 'Service',
  ticket_type: 'External',
  type: 'External',
  accepted: true,
  reassignmentRequested: false,
  reassignmentReason: null,
  proofRejected: false,
  rejectionReason: null,
  attachments: [
    { id: 901, name: 'ac_error_E4_photo.jpg', url: '/storage/ticket-attachments/9091/ac_error_E4_photo.jpg', file_type: 'image/jpeg', size: 2457600, uploaded_at: '2026-09-10T08:15:00Z' },
    { id: 902, name: 'ac_maintenance_log.pdf', url: '/storage/ticket-attachments/9091/ac_maintenance_log.pdf', file_type: 'application/pdf', size: 512000, uploaded_at: '2026-09-10T08:20:00Z' },
  ],
  proofAttachments: [
    { id: 9011, proof_ID: 9011, name: 'proof_completion_report.pdf', url: '/storage/ticket-attachments/proofs/101/proof_completion_report.pdf', file_type: 'application/pdf', size: 1048576, uploaded_at: '2026-09-12T14:30:00Z' },
    { id: 9012, proof_ID: 9012, name: 'ac_final_test_results.jpg', url: '/storage/ticket-attachments/proofs/101/ac_final_test_results.jpg', file_type: 'image/jpeg', size: 1850000, uploaded_at: '2026-09-12T14:31:00Z' },
  ],
  proofFiles: [
    { id: 9011, proof_ID: 9011, name: 'proof_completion_report.pdf', url: '/storage/ticket-attachments/proofs/101/proof_completion_report.pdf', file_type: 'application/pdf', size: 1048576, uploaded_at: '2026-09-12T14:30:00Z' },
    { id: 9012, proof_ID: 9012, name: 'ac_final_test_results.jpg', url: '/storage/ticket-attachments/proofs/101/ac_final_test_results.jpg', file_type: 'image/jpeg', size: 1850000, uploaded_at: '2026-09-12T14:31:00Z' },
  ],
  timeline: [
    { id: 'creation', type: 'system', text: 'Ticket created by customer John Smith.', timestamp: '2026-09-10T08:00:00Z' },
    { id: 'assigned', type: 'system', text: 'Ticket assigned to Juan Dela Cruz (Service).', timestamp: '2026-09-10T09:00:00Z' },
    { id: 'accepted', type: 'system', text: 'Assignment accepted by Juan Dela Cruz.', timestamp: '2026-09-10T09:15:00Z' },
    { id: 'progress', type: 'status', text: 'Status updated to "In Progress" by Juan Dela Cruz.', timestamp: '2026-09-10T10:00:00Z' },
    { id: 'proof', type: 'system', text: 'Proof of completion uploaded by Juan Dela Cruz.', timestamp: '2026-09-12T14:30:00Z' },
    { id: 'pending_eval', type: 'status', text: 'Status updated to "Pending Evaluation" - Awaiting CS review of proof of completion.', timestamp: '2026-09-12T14:30:00Z' },
  ],
  internalNotes: [],
  remarks: [],
  status_history: [
    { status: 'Open', timestamp: '2026-09-10T08:00:00Z', actor: 'System' },
    { status: 'In Progress', timestamp: '2026-09-10T10:00:00Z', actor: 'Juan Dela Cruz' },
    { status: 'Pending Evaluation', timestamp: '2026-09-12T14:30:00Z', actor: 'Juan Dela Cruz' },
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

export function getDemoPendingEvaluationTicket() {
  return { ...demoPendingEvaluationTicket, proofAttachments: [...demoPendingEvaluationTicket.proofAttachments], proofFiles: [...demoPendingEvaluationTicket.proofFiles], attachments: [...demoPendingEvaluationTicket.attachments], timeline: [...demoPendingEvaluationTicket.timeline] };
}

export function seedDemoPendingEvaluationTicket() {
  try {
    const stored = localStorage.getItem(PENDING_EVAL_KEY);
    if (!stored) {
      localStorage.setItem(PENDING_EVAL_KEY, JSON.stringify([demoPendingEvaluationTicket]));
      return true;
    }
    const parsed = JSON.parse(stored);
    const exists = parsed.some((t) => t.id === demoPendingEvaluationTicket.id || t.ticket_ID === demoPendingEvaluationTicket.ticket_ID);
    if (!exists) {
      parsed.push(demoPendingEvaluationTicket);
      localStorage.setItem(PENDING_EVAL_KEY, JSON.stringify(parsed));
      return true;
    }
    return false;
  } catch {
    localStorage.setItem(PENDING_EVAL_KEY, JSON.stringify([demoPendingEvaluationTicket]));
    return true;
  }
}

export function getPendingEvaluationTicketsFromStorage() {
  try {
    const stored = localStorage.getItem(PENDING_EVAL_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function clearPendingEvaluationMocks() {
  localStorage.removeItem(PENDING_EVAL_KEY);
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

