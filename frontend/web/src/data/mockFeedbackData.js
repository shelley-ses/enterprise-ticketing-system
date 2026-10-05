const STORAGE_KEY = 'customer_feedback';
const EXTERNAL_TICKETS_KEY = 'demo_external_tickets';
const PENDING_EVAL_KEY = 'demo_pending_evaluation_tickets';

const mockEmployees = [
  { id: 1, name: 'Juan Dela Cruz', jobTitle: 'Technical Support Engineer', department: 'Technical Support' },
  { id: 2, name: 'Maria Santos', jobTitle: 'Network Engineer', department: 'Network Engineering' },
  { id: 3, name: 'John Reyes', jobTitle: 'QA Engineer', department: 'Quality Assurance' },
];

// demoExternalTicket and demoPendingEvaluationTicket have been removed so only real database tickets are displayed.

export function getMockEmployees() {
  return mockEmployees;
}

export function getEmployeeById(id) {
  return mockEmployees.find((e) => e.id === id) || null;
}

export function getTicketEmployees(ticket) {
  if (!ticket) return [];
  // 1. If assigned array of objects exists:
  if (Array.isArray(ticket.assigned) && ticket.assigned.length > 0) {
    return ticket.assigned.map((a) => ({
      id: a.id || a.emp_id || 1,
      name: a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Assigned Support Specialist',
      jobTitle: a.role || a.jobTitle || 'Technical Support Specialist',
      department: a.department || ticket.department || 'Technical Support',
    }));
  }
  // 2. If assigned_employees array exists:
  if (Array.isArray(ticket.assigned_employees) && ticket.assigned_employees.length > 0) {
    return ticket.assigned_employees.map((a) => (typeof a === 'object' ? {
      id: a.id || a.emp_id || 1,
      name: a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || 'Assigned Support Specialist',
      jobTitle: a.role || a.jobTitle || 'Technical Support Specialist',
      department: a.department || ticket.department || 'Technical Support',
    } : (getEmployeeById(a) || {
      id: a,
      name: `Support Specialist #${a}`,
      jobTitle: 'Technical Support Specialist',
      department: ticket.department || 'Technical Support',
    })));
  }
  // 3. If assignedEmployees array of IDs exists:
  if (Array.isArray(ticket.assignedEmployees) && ticket.assignedEmployees.length > 0) {
    return ticket.assignedEmployees.map((id) => getEmployeeById(id) || {
      id,
      name: `Support Specialist #${id}`,
      jobTitle: 'Technical Support Specialist',
      department: ticket.department || 'Technical Support',
    });
  }
  // 4. If assigned_employee name exists:
  const empName = ticket.assigned_employee || ticket.assigned_employee_name || ticket.assigned_to_name || (typeof ticket.assigned_to === 'string' ? ticket.assigned_to : null);
  if (empName && empName !== '—' && empName !== 'Unassigned') {
    const empId = typeof ticket.assigned_to === 'number' ? ticket.assigned_to : 1;
    return [{
      id: empId,
      name: empName,
      jobTitle: 'Technical Support Specialist',
      department: ticket.department || 'Technical Support',
    }];
  }
  if (ticket.assigned_to) {
    return [{
      id: Number(ticket.assigned_to) || 1,
      name: 'Assigned Support Specialist',
      jobTitle: 'Technical Support Specialist',
      department: ticket.department || 'Technical Support',
    }];
  }
  // 5. Default fallback to general Support Team if ticket is closed
  return [{
    id: 1,
    name: 'Customer Support Team',
    jobTitle: 'Technical Support & Service Specialist',
    department: ticket.department || ticket.category || 'Customer Service',
  }];
}

export function getDemoExternalTicket() {
  return null;
}

export function seedDemoExternalTicket() {
  try {
    localStorage.removeItem(EXTERNAL_TICKETS_KEY);
  } catch {
    // ignore
  }
  return false;
}

export function getExternalTicketsFromStorage() {
  return [];
}

export function getDemoPendingEvaluationTicket() {
  return null;
}

export function seedDemoPendingEvaluationTicket() {
  try {
    localStorage.removeItem(PENDING_EVAL_KEY);
  } catch {
    // ignore
  }
  return false;
}

export function getPendingEvaluationTicketsFromStorage() {
  try {
    localStorage.removeItem(PENDING_EVAL_KEY);
  } catch {
    // ignore
  }
  return [];
}

export function clearPendingEvaluationMocks() {
  try {
    localStorage.removeItem(PENDING_EVAL_KEY);
  } catch {
    // ignore
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
  if (!ticketId) return null;
  const all = getAllFeedback();
  if (all[ticketId]) return all[ticketId];
  if (all[String(ticketId)]) return all[String(ticketId)];
  const num = Number(String(ticketId).replace(/\D/g, ''));
  if (num && all[num]) return all[num];
  return null;
}

export function hasFeedbackBeenSubmitted(ticketId) {
  const feedback = getTicketFeedback(ticketId);
  return !!(feedback && feedback.submitted);
}

export async function saveFeedback(ticketId, ratings, comments, overallComment, customerId = null, questionAnswers = {}, categoryQuestionsSnapshot = []) {
  const all = getAllFeedback();
  const feedbackData = {
    ratings,
    comments: comments || {},
    overallComment: overallComment || '',
    questionAnswers: questionAnswers || {},
    categoryQuestionsSnapshot: categoryQuestionsSnapshot || [],
    submittedAt: new Date().toISOString(),
    submitted: true,
  };

  all[ticketId] = feedbackData;
  all[String(ticketId)] = feedbackData;
  const num = Number(String(ticketId).replace(/\D/g, ''));
  if (num) {
    all[num] = feedbackData;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

  try {
    window.dispatchEvent(new CustomEvent('customer_feedback_submitted', { detail: { ticketId } }));
  } catch {
    // ignore
  }

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
        question_answers: questionAnswers || {},
        category_questions_snapshot: categoryQuestionsSnapshot || [],
      }),
    });
    const result = await res.json();
    console.log('CSAT feedback posted to analytics-service:', result);
  } catch (err) {
    console.warn('Analytics service offline. Feedback persisted locally:', err);
  }

  return all[ticketId];
}

export const FEEDBACK_MASTER_ENABLED_KEY = 'feedback_form_master_enabled';

// TEMPORARY: localStorage is used here only as a same-session demo bridge between Super Admin and Customer portals for this sprint's frontend-only scope. This must be replaced with a real backend-persisted setting, read by both portals via API, before this is production-ready — localStorage does not sync across different users/devices/browsers.
export function isFeedbackFormEnabled() {
  try {
    const val = localStorage.getItem(FEEDBACK_MASTER_ENABLED_KEY);
    if (val === null) return true; // Default: ON
    return JSON.parse(val);
  } catch {
    return true;
  }
}

// TEMPORARY: localStorage is used here only as a same-session demo bridge between Super Admin and Customer portals for this sprint's frontend-only scope. This must be replaced with a real backend-persisted setting, read by both portals via API, before this is production-ready — localStorage does not sync across different users/devices/browsers.
export function setFeedbackFormEnabled(enabled) {
  try {
    localStorage.setItem(FEEDBACK_MASTER_ENABLED_KEY, JSON.stringify(Boolean(enabled)));
    window.dispatchEvent(new Event('feedback_master_toggle_changed'));
  } catch (err) {
    console.error('Failed to save feedback master toggle to localStorage:', err);
  }
}

