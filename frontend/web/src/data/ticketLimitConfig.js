/**
 * TS096: Ticket Limit Configuration (Max Open Tickets per Requester)
 *
 * Lightweight shared module backed by session/local storage with event dispatching.
 * Allows SuperAdminTicketConfig, TicketCreation, EmployeeMyTickets, and TicketModal
 * to read and write the limit synchronously without requiring global context wrappers.
 */

export const TICKET_LIMIT_STORAGE_KEY = 'superadmin_ticket_limit_config';

export const OPEN_STATUS_SET = [
  'Open',
  'Pending Assignment',
  'In Progress',
  'Pending',
  'Pending Evaluation',
  'On Hold',
  'Escalated',
  'Reopened',
];

export const DEFAULT_TICKET_LIMIT_CONFIG = {
  isUnlimited: true,
  limit: 5,
};

/**
 * Get active max open tickets configuration.
 * @returns {{ isUnlimited: boolean, limit: number }}
 */
export function getMaxOpenTicketsLimit() {
  try {
    const val = localStorage.getItem(TICKET_LIMIT_STORAGE_KEY);
    if (!val) return DEFAULT_TICKET_LIMIT_CONFIG;
    const parsed = JSON.parse(val);
    return {
      isUnlimited: parsed.isUnlimited !== undefined ? Boolean(parsed.isUnlimited) : true,
      limit: typeof parsed.limit === 'number' && parsed.limit > 0 ? parsed.limit : 5,
    };
  } catch {
    return DEFAULT_TICKET_LIMIT_CONFIG;
  }
}

/**
 * Set and persist max open tickets configuration for the current session.
 * @param {{ isUnlimited: boolean, limit: number }} config
 */
export function setMaxOpenTicketsLimit(config) {
  try {
    const payload = {
      isUnlimited: Boolean(config.isUnlimited),
      limit: typeof config.limit === 'number' && config.limit > 0 ? config.limit : 5,
    };
    localStorage.setItem(TICKET_LIMIT_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('ticket_limit_config_changed', { detail: payload }));
  } catch (err) {
    console.error('Failed to save ticket limit to localStorage:', err);
  }
}

/**
 * Check if a given status belongs to the active open status set.
 * @param {string} status
 * @returns {boolean}
 */
export function isOpenStatus(status) {
  if (!status) return false;
  return OPEN_STATUS_SET.includes(status.trim());
}
