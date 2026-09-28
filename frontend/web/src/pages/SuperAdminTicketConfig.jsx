import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Plus, MoreVertical, Clock, Save, Building2, ChevronRight, ChevronDown, ChevronUp, ArrowLeft, CheckCircle2, Edit3, Trash2, Power, AlertCircle, RotateCcw, GitBranch, ArrowRight, Lock, Info, ShieldCheck, ShieldAlert, FileUp, Check, HardDrive, Bell, Users, UserCheck, Mail, Layers, Star, MessageSquare, Hash, Eye, Calendar, Tag, EyeOff, Send, Key, RefreshCw, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import NotificationModal from '@/components/NotificationModal';
import { useAuth } from '@/context/AuthContext';
import {
  getSuperAdminConfig,
  createSuperAdminEquipment,
  updateSuperAdminEquipment,
  deleteSuperAdminEquipment,
  createSuperAdminPriority,
  updateSuperAdminPriority,
  deleteSuperAdminPriority,
  getSLARules,
  saveDepartmentSLARules,
  getDepartments,
  getWorkflowStatuses,
  createWorkflowStatus,
  updateWorkflowStatus,
  deleteWorkflowStatus,
  getEscalationRules,
  createEscalationRule,
  updateEscalationRule,
  toggleEscalationRule,
  deleteEscalationRule,
  getTicketFormOptions
} from '@/services/ticketService';

import {
  getEmailConfiguration,
  saveEmailConfiguration,
  updateEmailApiKey,
  removeEmailConfiguration,
  sendTestEmail,
} from '@/services/configurationService';

import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import { isFeedbackFormEnabled, setFeedbackFormEnabled } from '@/data/mockFeedbackData';
import { getMaxOpenTicketsLimit, setMaxOpenTicketsLimit, OPEN_STATUS_SET } from '@/data/ticketLimitConfig';

export const GROUP_CLASSIFICATION = 'classification';
export const GROUP_LIFECYCLE = 'lifecycle';
export const GROUP_SLA_ESCALATION = 'sla-escalation';
export const GROUP_NOTIFICATIONS = 'notifications';
export const GROUP_SECURITY = 'security';

export const TAB_EQUIPMENT = 'equipment';
export const TAB_PRIORITY = 'priority';
export const TAB_DEFAULTS = 'defaults';
export const TAB_NUMBER_FORMAT = 'number-format';
export const TAB_LIMITS = 'limits';
export const TAB_SLA = 'sla';
export const TAB_WORKFLOW = 'workflow';
export const TAB_TRANSITIONS = 'transitions';
export const TAB_FILES = 'files';
export const TAB_WINDOWS = 'windows';
export const TAB_NOTIFICATIONS = 'notifications';
export const TAB_ESCALATION = 'escalation';
export const TAB_FEEDBACK = 'feedback';

export const NOTIF_SUBTAB_RECIPIENTS = 'recipients';
export const NOTIF_SUBTAB_CHANNELS = 'channels';
export const NOTIF_SUBTAB_EMAIL_DELIVERY = 'email-delivery';

export const GROUPS_CONFIG = [
  {
    id: GROUP_CLASSIFICATION,
    label: 'Classification',
    defaultSubTab: TAB_EQUIPMENT,
    subTabs: [
      { id: TAB_EQUIPMENT, label: 'Equipment Categories' },
      { id: TAB_PRIORITY, label: 'Priority Levels' },
      { id: TAB_DEFAULTS, label: 'Ticket Defaults' },
      { id: TAB_NUMBER_FORMAT, label: 'Ticket Number Format' },
      { id: TAB_LIMITS, label: 'Max Open Tickets' },
    ],
  },
  {
    id: GROUP_LIFECYCLE,
    label: 'Lifecycle & Workflow',
    defaultSubTab: TAB_WORKFLOW,
    subTabs: [
      { id: TAB_WORKFLOW, label: 'Statuses & Sequence' },
      { id: TAB_TRANSITIONS, label: 'Transition Matrix' },
      { id: TAB_WINDOWS, label: 'Closure Windows' },
      { id: TAB_FEEDBACK, label: 'Feedback Form' },
    ],
  },
  {
    id: GROUP_SLA_ESCALATION,
    label: 'SLA & Escalations',
    defaultSubTab: TAB_SLA,
    subTabs: [
      { id: TAB_SLA, label: 'Department SLAs' },
      { id: TAB_ESCALATION, label: 'Escalation Rules' },
    ],
  },
  {
    id: GROUP_NOTIFICATIONS,
    label: 'Notifications',
    defaultSubTab: NOTIF_SUBTAB_RECIPIENTS,
    subTabs: [
      { id: NOTIF_SUBTAB_RECIPIENTS, label: 'Recipients' },
      { id: NOTIF_SUBTAB_CHANNELS, label: 'Channels' },
      { id: NOTIF_SUBTAB_EMAIL_DELIVERY, label: 'Email Delivery' },
    ],
  },
  {
    id: GROUP_SECURITY,
    label: 'Storage & Security',
    defaultSubTab: TAB_FILES,
    subTabs: [
      { id: TAB_FILES, label: 'File Limits & Security' },
    ],
  },
];

// ==========================================
// TS094: Ticket Number Format Configuration Constants
// ==========================================
export const TS094_DEFAULT_FORMAT = {
  prefix: 'TKT',
  includeDeptCode: false,
  deptCode: '',
  dateSegment: 'none',
  digitLength: 4,
};

export const TS094_DATE_OPTIONS = [
  { value: 'none', label: 'None (Omit date segment) — Current behavior' },
  { value: 'YYYY', label: 'YYYY (e.g. 2026)' },
  { value: 'YYYYMM', label: 'YYYYMM (e.g. 202609)' },
  { value: 'YYYYMMDD', label: 'YYYYMMDD (e.g. 20260925)' },
];

// ==========================================
// TS104: Feedback Form Configuration Constants
// ==========================================
// Category source is provisional — pending confirmation with PM on whether this should map to the Departments API or remain a dedicated Feedback Form category concept. Do not assume these values match items.departments.
export const FEEDBACK_CATEGORIES = ['IT', 'Service', 'Others'];

export const TS104_RESPONSE_TYPES = ['Star Rating', 'Multiple Choice', 'Free Text'];

export const TS104_DEFAULT_QUESTIONS = {
  'IT': [
    {
      id: 'it-1',
      text: "How would you rate the technician's technical knowledge?",
      responseType: 'Star Rating',
      isEnabled: true,
    },
    {
      id: 'it-2',
      text: 'Was your issue resolved on the first visit?',
      responseType: 'Multiple Choice',
      isEnabled: true,
    },
    {
      id: 'it-3',
      text: 'Do you have any additional feedback about the IT support provided?',
      responseType: 'Free Text',
      isEnabled: false,
    },
  ],
  'Service': [
    {
      id: 'svc-1',
      text: 'How satisfied are you with the timeliness and professionalism of the service engineer?',
      responseType: 'Star Rating',
      isEnabled: true,
    },
    {
      id: 'svc-2',
      text: 'Did the technician explain the issue and repair clearly?',
      responseType: 'Multiple Choice',
      isEnabled: true,
    },
    {
      id: 'svc-3',
      text: 'Any suggestions for improving our on-site service experience?',
      responseType: 'Free Text',
      isEnabled: true,
    },
  ],
  'Others': [
    {
      id: 'oth-1',
      text: 'How would you rate your overall support experience?',
      responseType: 'Star Rating',
      isEnabled: true,
    },
    {
      id: 'oth-2',
      text: 'Would you recommend our support team to others?',
      responseType: 'Multiple Choice',
      isEnabled: true,
    },
    {
      id: 'oth-3',
      text: 'Please share any additional comments or suggestions for our team.',
      responseType: 'Free Text',
      isEnabled: false,
    },
  ],
};

export const TS093_STATUSES = [
  'Open',
  'In Progress (CS-owned)',
  'Assigned',
  'Reassigned',
  'In Progress (Employee-owned)',
  'Resolved',
  'Closed',
  'Reopened',
  'On Hold/Pending',
  'Cancelled',
];

export const TS093_DEFAULT_RULES = {
  'Open': {
    allowed: ['In Progress (CS-owned)', 'Cancelled'],
    type: 'editable',
    description: 'Initial ticket state upon customer or internal creation.',
  },
  'In Progress (CS-owned)': {
    allowed: ['On Hold/Pending', 'Assigned', 'Resolved'],
    type: 'editable',
    description: 'Ticket being triaged or actively handled directly by Customer Service.',
  },
  'Assigned': {
    allowed: ['Reassigned', 'In Progress (Employee-owned)'],
    type: 'editable',
    description: 'Ticket dispatched to an engineer/technician and awaiting their acceptance.',
  },
  'Reassigned': {
    allowed: ['In Progress (Employee-owned)', 'Assigned'],
    type: 'editable',
    description: 'Ticket reassignment requested or approved for re-dispatch.',
  },
  'In Progress (Employee-owned)': {
    allowed: ['On Hold/Pending', 'Reassigned', 'Resolved'],
    type: 'editable',
    description: 'Service engineer has accepted the assignment and is actively working on the machine.',
  },
  'Resolved': {
    allowed: ['Closed', 'In Progress (Employee-owned)'],
    type: 'editable',
    description: 'Work is marked complete with proof of completion pending evaluation.',
  },
  'Closed': {
    allowed: ['Reopened'],
    type: 'editable',
    caption: 'Reopening is permitted only within the configured reopen window (e.g. 48h after resolution).',
    description: 'Final confirmed state. Can transition to Reopened within the allowed reopen window.',
  },
  'Reopened': {
    allowed: ['In Progress (CS-owned)'],
    type: 'fixed',
    caption: 'Automatic transition: Reopened tickets immediately route to Customer Service (CS-owned). This transition is system-automated and non-editable.',
    description: 'Ticket reopened by customer within window; routes automatically to CS.',
  },
  'On Hold/Pending': {
    allowed: [],
    type: 'contextual',
    caption: 'Contextual transition: Resumes back to whichever In Progress state it came from (CS-owned or Employee-owned). This is contextual rather than a fixed pair, so it is non-editable.',
    description: 'Ticket paused awaiting parts, customer feedback, or external dependency.',
  },
  'Cancelled': {
    allowed: [],
    type: 'terminal',
    caption: 'Terminal status: No further transitions permitted from Cancelled.',
    description: 'Ticket discarded or cancelled before assignment.',
  },
};

export const TS098_AVAILABLE_EXTENSIONS = [
  { ext: 'PDF', label: 'PDF Document', desc: 'Adobe Acrobat (.pdf)', mime: 'application/pdf' },
  { ext: 'DOCX', label: 'Word Document', desc: 'Microsoft Word XML (.docx)', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { ext: 'DOC', label: 'Legacy Word', desc: 'Microsoft Word 97-2003 (.doc)', mime: 'application/msword' },
  { ext: 'JPG', label: 'JPEG Image', desc: 'Standard JPEG (.jpg)', mime: 'image/jpeg' },
  { ext: 'JPEG', label: 'JPEG Alt Image', desc: 'Joint Photographic Experts (.jpeg)', mime: 'image/jpeg' },
  { ext: 'PNG', label: 'PNG Image', desc: 'Portable Network Graphics (.png)', mime: 'image/png' },
  { ext: 'TXT', label: 'Plain Text', desc: 'ASCII / UTF-8 Text (.txt)', mime: 'text/plain' },
];

export const TS098_DEFAULT_FILE_CONFIG = {
  maxFileSizeMB: 15,
  allowedFileTypes: ['PDF', 'DOCX', 'DOC', 'JPG', 'JPEG', 'PNG'],
  maxFileCount: 5,
  malwareScanningEnabled: true,
};

export const TS100_DEFAULT_WINDOW_CONFIG = {
  reopenEnabled: true,
  reopenWindowDays: 2, // 48 hours (in active codebase: TicketService.php & CustomerTicketDetailModal.jsx)
  autoCloseEnabled: true,
  autoCloseWindowDays: 2, // 48 hours (in active codebase: AutoCloseInternalTickets.php command)
};

export const TS099_ALERT_TYPES = [
  {
    key: 'new_ticket',
    title: 'New Ticket Alert',
    badge: 'Creation',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Dispatched immediately when an end-customer or internal employee submits a new ticket.',
    defaultSummary: 'Default: Customer Service (CS)',
  },
  {
    key: 'new_message',
    title: 'New Message Alert',
    badge: 'Messaging',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Dispatched when a new comment, message, or diagnostic update is posted to the ticket thread.',
    defaultSummary: 'Default: Assigned Employee (Contextual)',
  },
  {
    key: 'overdue_ticket',
    title: 'Overdue Ticket Alert',
    badge: 'SLA Escalation',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Dispatched when an active ticket breaches its defined SLA response or resolution deadline.',
    defaultSummary: 'Default: Customer Service (CS)',
  },
];

export const TS099_STATIC_ROLES = [
  { id: 'role_cs', label: 'Customer Service (CS)', desc: 'All active customer service agents', type: 'role', badge: 'Role' },
  { id: 'role_service', label: 'Service Engineer / Employee', desc: 'All technicians in service & maintenance', type: 'role', badge: 'Role' },
  { id: 'role_it_admin', label: 'IT Admin', desc: 'Branch IT and system administrators', type: 'role', badge: 'Role' },
  { id: 'role_superadmin', label: 'Super Admin', desc: 'System administrators with global oversight', type: 'role', badge: 'Role' },
];

export const TS099_CONTEXTUAL_RECIPIENTS = [
  { id: 'contextual_assigned', label: 'Assigned Employee', desc: 'The specific technician actively assigned to the ticket (resolves dynamically)', isContextual: true },
  { id: 'contextual_requester', label: 'Ticket Requester / Customer', desc: 'The customer or employee who created the ticket (resolves dynamically)', isContextual: true },
];

export const TS099_DEFAULT_ROUTING = {
  new_ticket: ['role_cs'],
  new_message: ['contextual_assigned'],
  overdue_ticket: ['role_cs'],
};

export const TS103_CHANNEL_OPTIONS = [
  { id: 'email', label: 'Email only' },
  { id: 'in_app', label: 'In-App only' },
  { id: 'both', label: 'Both' },
];

export const TS103_ALERT_TYPES = [
  {
    key: 'new_ticket',
    title: 'New Ticket',
    badge: 'Creation',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Triggered immediately when an end-customer or internal employee submits a new ticket.',
    defaultChannel: 'both',
  },
  {
    key: 'status_update',
    title: 'Status Update',
    badge: 'Lifecycle',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Triggered when a ticket transitions between statuses (e.g. Open, In Progress, Resolved).',
    defaultChannel: 'both',
  },
  {
    key: 'escalation_delegation',
    title: 'Escalation & Assignment',
    badge: 'Escalation',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Triggered when a ticket SLA approaches breach or an engineer is assigned/delegated.',
    defaultChannel: 'both',
  },
  {
    key: 'reassignment',
    title: 'Reassignment',
    badge: 'Staff Transfer',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    description: 'Triggered when ticket ownership is transferred to another technician or department.',
    defaultChannel: 'email',
  },
  {
    key: 'new_message',
    title: 'New Message',
    badge: 'Messaging',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'Triggered when a customer or staff member posts a message in the ticket thread.',
    defaultChannel: 'in_app',
  },
  {
    key: 'overdue_sla_breach',
    title: 'Overdue & SLA Breach',
    badge: 'SLA Warning',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Triggered when a ticket response or resolution SLA has officially breached its deadline.',
    defaultChannel: 'both',
  },
  {
    key: 'system_alert',
    title: 'System Alert',
    badge: 'System Critical',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Critical infrastructure, security, or service desk failures requiring global administrative attention.',
    defaultChannel: 'both',
    isSystemAlert: true,
  },
];

export const TS103_DEFAULT_CHANNELS = {
  new_ticket: 'both',
  status_update: 'both',
  escalation_delegation: 'both',
  reassignment: 'email',
  new_message: 'in_app',
  overdue_sla_breach: 'both',
  system_alert: 'both',
};

const priorityColorOptions = [
  { value: 'bg-red-100 text-red-700', label: 'Red' },
  { value: 'bg-orange-100 text-orange-700', label: 'Orange' },
  { value: 'bg-yellow-100 text-yellow-700', label: 'Yellow' },
  { value: 'bg-green-100 text-green-700', label: 'Green' },
  { value: 'bg-blue-100 text-blue-700', label: 'Blue' },
  { value: 'bg-purple-100 text-purple-700', label: 'Purple' },
  { value: 'bg-indigo-100 text-indigo-700', label: 'Indigo' },
  { value: 'bg-pink-100 text-pink-700', label: 'Pink' },
  { value: 'bg-gray-100 text-gray-700', label: 'Gray' },
];

const priorityList = [
  { name: 'Critical', badgeClass: 'bg-red-100 text-red-700 border-red-200', defaultResp: 15, defaultRes: 240 },
  { name: 'High', badgeClass: 'bg-orange-100 text-orange-700 border-orange-200', defaultResp: 30, defaultRes: 480 },
  { name: 'Medium', badgeClass: 'bg-yellow-100 text-yellow-700 border-yellow-200', defaultResp: 120, defaultRes: 1440 },
  { name: 'Low', badgeClass: 'bg-green-100 text-green-700 border-green-200', defaultResp: 240, defaultRes: 4320 },
];

const defaultWorkflowStatuses = [
  { id: 1, name: 'New', description: 'Ticket has been submitted and is awaiting review', bgColor: '#DBEAFE', textColor: '#1D4ED8', order: 1 },
  { id: 2, name: 'Assigned', description: 'Ticket has been assigned to a technician', bgColor: '#FFEDD5', textColor: '#C2410C', order: 2 },
  { id: 3, name: 'In Progress', description: 'Technician is actively working on the ticket', bgColor: '#FEE2E2', textColor: '#B91C1C', order: 3 },
  { id: 4, name: 'Pending Parts', description: 'Waiting for replacement parts to arrive', bgColor: '#F3E8FF', textColor: '#7E22CE', order: 4 },
  { id: 5, name: 'Resolved', description: 'Issue has been resolved pending confirmation', bgColor: '#DCFCE7', textColor: '#15803D', order: 5 },
  { id: 6, name: 'Closed', description: 'Ticket has been closed and confirmed by the requester', bgColor: '#F3F4F6', textColor: '#4B5563', order: 6 },
];

const defaultEscalationRules = [
  {
    id: 1,
    name: 'Response Deadline Escalation',
    isActive: true,
    trigger: 'Response deadline approaching',
    condition: { text: 'No response within 30 minutes before deadline', highlight: '30 minutes' },
    action: 'Auto-escalate to Senior Engineer',
    notify: 'CS + Manager',
  },
  {
    id: 2,
    name: 'Critical Priority Escalation',
    isActive: true,
    trigger: 'Critical ticket unresolved',
    condition: { text: 'No resolution within 50% of SLA target', highlight: '50%' },
    action: 'Auto-escalate to Department Head',
    notify: 'CS + Manager + Department Head',
  },
  {
    id: 3,
    name: 'SLA Breach Prevention',
    isActive: false,
    trigger: 'Resolution deadline approaching',
    condition: { text: 'No resolution within 15 minutes before deadline', highlight: '15 minutes' },
    action: 'Auto-escalate to Senior Engineer',
    notify: 'CS + Manager',
  },
  {
    id: 4,
    name: 'Customer Reopen Escalation',
    isActive: true,
    trigger: 'Ticket reopened by customer',
    condition: { text: 'Same issue reopened within 7 days', highlight: '7 days' },
    action: 'Auto-assign to previous technician',
    notify: 'Previous Technician + Manager',
  },
];

const workflowColorOptions = [
  { bgColor: '#DBEAFE', textColor: '#1D4ED8', label: 'Blue' },
  { bgColor: '#FFEDD5', textColor: '#C2410C', label: 'Orange' },
  { bgColor: '#FEE2E2', textColor: '#B91C1C', label: 'Red' },
  { bgColor: '#F3E8FF', textColor: '#7E22CE', label: 'Purple' },
  { bgColor: '#DCFCE7', textColor: '#15803D', label: 'Green' },
  { bgColor: '#F3F4F6', textColor: '#4B5563', label: 'Gray' },
  { bgColor: '#FEF9C3', textColor: '#A16207', label: 'Yellow' },
  { bgColor: '#FCE7F3', textColor: '#BE185D', label: 'Pink' },
  { bgColor: '#CCFBF1', textColor: '#0F766E', label: 'Teal' },
];

const formatMinutes = (mins) => {
  if (mins === '' || mins === null || mins === undefined) return '';
  const m = parseInt(mins, 10);
  if (isNaN(m) || m <= 0) return '0 mins';
  if (m < 60) return `${m} mins`;
  const hours = m / 60;
  if (hours < 24) {
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} ${hours === 1 ? 'hr' : 'hrs'}`;
  }
  const days = hours / 24;
  return `${Number.isInteger(days) ? days : days.toFixed(1)} ${days === 1 ? 'day' : 'days'}`;
};

const formatFileSize = (mb) => {
  if (mb === '' || mb === null || mb === undefined) return '';
  const num = parseFloat(mb);
  if (isNaN(num) || num <= 0) return 'Invalid size';
  const bytes = Math.round(num * 1024 * 1024);
  return `${num} MB (${bytes.toLocaleString()} bytes)`;
};

const formatFileCount = (count) => {
  if (count === '' || count === null || count === undefined) return '';
  const num = parseInt(count, 10);
  if (isNaN(num) || num <= 0) return 'Invalid count';
  return num === 1 ? '1 file per upload' : `Up to ${num} files per upload`;
};

const formatWindowDays = (days, type) => {
  if (days === '' || days === null || days === undefined) return '';
  const num = parseInt(days, 10);
  if (isNaN(num) || num <= 0) return 'Invalid duration';
  const hours = num * 24;
  if (type === 'reopen') {
    return num === 1
      ? 'Tickets can be reopened for 1 day (24 hours) after closing'
      : `Tickets can be reopened for ${num} days (${hours} hours) after closing`;
  } else {
    return num === 1
      ? 'Tickets auto-close after 1 day (24 hours) with no customer response'
      : `Tickets auto-close after ${num} days (${hours} hours) with no customer response`;
  }
};

export default function SuperAdminTicketConfig() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams();

  const storageKey = useMemo(() => {
    return user?.id ? `superadmin_ticket_config_state_${user.id}` : 'superadmin_ticket_config_state';
  }, [user?.id]);

  // Read initial state from localStorage if available
  const initialSavedState = useMemo(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return null;
  }, [storageKey]);

  // Helper to normalize group IDs (handling dashes vs underscores)
  const normalizeGroupId = useCallback((rawGroup) => {
    if (!rawGroup) return null;
    const g = rawGroup.toLowerCase();
    if (g === 'classification') return GROUP_CLASSIFICATION;
    if (g === 'lifecycle') return GROUP_LIFECYCLE;
    if (g === 'sla-escalation' || g === 'sla_escalation' || g === 'sla') return GROUP_SLA_ESCALATION;
    if (g === 'notifications') return GROUP_NOTIFICATIONS;
    if (g === 'security' || g === 'files') return GROUP_SECURITY;
    if (g === 'feedback') return GROUP_LIFECYCLE;
    return null;
  }, []);

  // Helper to normalize sub-tab IDs within a group
  const normalizeSubTabId = useCallback((groupId, rawSubTab) => {
    if (!rawSubTab) return null;
    const s = rawSubTab.toLowerCase();
    const groupDef = GROUPS_CONFIG.find((g) => g.id === groupId);
    if (!groupDef) return null;
    const matched = groupDef.subTabs.find((st) => st.id.toLowerCase() === s);
    return matched ? matched.id : null;
  }, []);

  const [activeGroup, setActiveGroup] = useState(() => {
    return initialSavedState?.activeGroup || GROUP_CLASSIFICATION;
  });

  const [activeSubTabs, setActiveSubTabs] = useState(() => {
    return {
      [GROUP_CLASSIFICATION]: TAB_EQUIPMENT,
      [GROUP_LIFECYCLE]: TAB_WORKFLOW,
      [GROUP_SLA_ESCALATION]: TAB_SLA,
      [GROUP_NOTIFICATIONS]: NOTIF_SUBTAB_RECIPIENTS,
      [GROUP_SECURITY]: TAB_FILES,
      ...(initialSavedState?.activeSubTabs || {}),
    };
  });

  // Current active group definition
  const currentGroup = useMemo(() => {
    return GROUPS_CONFIG.find((g) => g.id === activeGroup) || GROUPS_CONFIG[0];
  }, [activeGroup]);

  // Current active sub-tab for the active group
  const currentSubTab = useMemo(() => {
    return activeSubTabs[activeGroup] || currentGroup?.defaultSubTab || TAB_EQUIPMENT;
  }, [activeSubTabs, activeGroup, currentGroup]);

  // Backward-compatible aliases for existing internal expressions
  const tab = currentSubTab;
  const notifSubtab = currentSubTab;

  // Persist state to localStorage on update
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ activeGroup, activeSubTabs }));
    } catch {
      // ignore
    }
  }, [storageKey, activeGroup, activeSubTabs]);

  // Synchronize route params with activeGroup / activeSubTabs + fallback normalization
  useEffect(() => {
    const rawGroup = params.group;
    const rawSubTab = params.subtab;

    if (!rawGroup) {
      navigate(`/superadmin/ticket-config/${activeGroup}/${currentSubTab}`, { replace: true });
      return;
    }

    const validGroup = normalizeGroupId(rawGroup);
    if (!validGroup) {
      const fallbackGroup = GROUP_CLASSIFICATION;
      const fallbackSubTab = TAB_EQUIPMENT;
      setActiveGroup(fallbackGroup);
      setActiveSubTabs((prev) => ({ ...prev, [fallbackGroup]: fallbackSubTab }));
      navigate(`/superadmin/ticket-config/${fallbackGroup}/${fallbackSubTab}`, { replace: true });
      return;
    }

    const expectedSubTab = activeSubTabs[validGroup] || GROUPS_CONFIG.find((g) => g.id === validGroup)?.defaultSubTab;
    if (!rawSubTab) {
      if (activeGroup !== validGroup) {
        setActiveGroup(validGroup);
      }
      navigate(`/superadmin/ticket-config/${validGroup}/${expectedSubTab}`, { replace: true });
      return;
    }

    const validSubTab = normalizeSubTabId(validGroup, rawSubTab);
    if (!validSubTab) {
      if (activeGroup !== validGroup) {
        setActiveGroup(validGroup);
      }
      navigate(`/superadmin/ticket-config/${validGroup}/${expectedSubTab}`, { replace: true });
      return;
    }

    if (activeGroup !== validGroup) {
      setActiveGroup(validGroup);
    }
    if (activeSubTabs[validGroup] !== validSubTab) {
      setActiveSubTabs((prev) => ({ ...prev, [validGroup]: validSubTab }));
    }
  }, [params.group, params.subtab, activeGroup, currentSubTab, activeSubTabs, normalizeGroupId, normalizeSubTabId, navigate]);

  // Unified Group Navigation: Option A (Restores remembered sub-tab everywhere)
  const handleSelectGroup = useCallback((groupId) => {
    const validGroup = normalizeGroupId(groupId) || GROUP_CLASSIFICATION;
    const targetSubTab = activeSubTabs[validGroup] || GROUPS_CONFIG.find((g) => g.id === validGroup)?.defaultSubTab;
    setActiveGroup(validGroup);
    setSelectedDeptId(null);
    navigate(`/superadmin/ticket-config/${validGroup}/${targetSubTab}`);
  }, [activeSubTabs, normalizeGroupId, navigate]);

  const handleSelectSubTab = useCallback((subTabId) => {
    setActiveSubTabs((prev) => ({ ...prev, [activeGroup]: subTabId }));
    setSelectedDeptId(null);
    navigate(`/superadmin/ticket-config/${activeGroup}/${subTabId}`);
  }, [activeGroup, navigate]);

  const setNotifSubtab = handleSelectSubTab;
  const [items, setItems] = useState({ equipment: [], priorities: [], slaRules: [], departments: [], slas: [] });
  const [loading, setLoading] = useState(true);
  const [savingSla, setSavingSla] = useState(false);
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState(null);

  // Equipment / Priority Edit state
  const [editingItem, setEditingItem] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(priorityColorOptions[0].value);

  // SLA Selected Department for detailed rule view (null = Department List view)
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [departmentSlaForm, setDepartmentSlaForm] = useState({
    Critical: { response_time_limit: '15', resolution_time_limit: '240' },
    High: { response_time_limit: '30', resolution_time_limit: '480' },
    Medium: { response_time_limit: '120', resolution_time_limit: '1440' },
    Low: { response_time_limit: '240', resolution_time_limit: '4320' },
  });

  const [notification, setNotification] = useState(null);

  // Workflow Rules state
  const [workflowStatuses, setWorkflowStatuses] = useState(defaultWorkflowStatuses);
  const [escalationRules, setEscalationRules] = useState(defaultEscalationRules);

  // Workflow / Escalation edit state
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [editingEscalation, setEditingEscalation] = useState(null);

  // Transition Rules state (local component state for this sprint)
  const [transitionRules, setTransitionRules] = useState(TS093_DEFAULT_RULES);
  const [selectedTransitionStatus, setSelectedTransitionStatus] = useState(TS093_STATUSES[0]);

  // File Upload & Security Limits state (local component state for this sprint)
  const [fileConfig, setFileConfig] = useState(TS098_DEFAULT_FILE_CONFIG);
  const [fileConfigErrors, setFileConfigErrors] = useState({});

  // Reopen & Auto-Close Windows state (local component state for this sprint)
  const [windowConfig, setWindowConfig] = useState(TS100_DEFAULT_WINDOW_CONFIG);
  const [windowConfigErrors, setWindowConfigErrors] = useState({});

  // Notifications state (managed via two-level activeGroup / activeSubTabs state)

  // Notification Recipient Routing state (local component state for this sprint)
  const [routingConfig, setRoutingConfig] = useState(TS099_DEFAULT_ROUTING);
  const [configuredAlerts, setConfiguredAlerts] = useState({});
  const [routingErrors, setRoutingErrors] = useState({});
  const [expandedRecipientAlert, setExpandedRecipientAlert] = useState(null);

  //  Notification Channel Configuration state (local component state for this sprint)
  const [channelConfig, setChannelConfig] = useState(TS103_DEFAULT_CHANNELS);
  const [configuredChannels, setConfiguredChannels] = useState({});
  const [channelErrors, setChannelErrors] = useState({});

  // Feedback Form Configuration state (local component state for this sprint)
  const [feedbackQuestions, setFeedbackQuestions] = useState(TS104_DEFAULT_QUESTIONS);
  const [activeFeedbackCategory, setActiveFeedbackCategory] = useState(FEEDBACK_CATEGORIES[0]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [feedbackInlineError, setFeedbackInlineError] = useState('');

  //  Feedback Form Master Toggle state (defaults to true / read from localStorage)
  const [feedbackMasterEnabled, setFeedbackMasterEnabled] = useState(() => isFeedbackFormEnabled());

  //  Ticket Defaults state (local component state for this sprint)
  // Low priority and dynamic SLA policy are active system defaults, so they start as configured
  const [defaultsConfig, setDefaultsConfig] = useState({
    status: 'Open',
    priority: 'Low',
    slaPolicy: 'dynamic',
  });
  const [configuredDefaults, setConfiguredDefaults] = useState({
    priority: true,
    slaPolicy: true,
  });
  const [defaultsErrors, setDefaultsErrors] = useState({});

  // TS094: Ticket Number Format state (local component state for this sprint)
  const [numberFormatConfig, setNumberFormatConfig] = useState(TS094_DEFAULT_FORMAT);
  const [savedNumberFormat, setSavedNumberFormat] = useState(TS094_DEFAULT_FORMAT);
  const [hasEverSavedFormat, setHasEverSavedFormat] = useState(false);
  const [numberFormatErrors, setNumberFormatErrors] = useState({});

  // TS096: Max Open Tickets per Requester state (shared with ticket creation flows)
  const [ticketLimitConfig, setTicketLimitConfigState] = useState(() => getMaxOpenTicketsLimit());
  const [savedTicketLimit, setSavedTicketLimit] = useState(() => getMaxOpenTicketsLimit());
  const [hasEverSavedLimit, setHasEverSavedLimit] = useState(false);
  const [limitError, setLimitError] = useState('');

  // Email Delivery Configuration state
  const [emailConfig, setEmailConfig] = useState(null);
  const [isAddingEmailConfig, setIsAddingEmailConfig] = useState(false);
  const [newEmailConfig, setNewEmailConfig] = useState({
    provider: 'Resend',
    apiKey: '',
    fromName: '',
    fromEmail: '',
  });
  const [newEmailConfigErrors, setNewEmailConfigErrors] = useState({});
  const [showNewApiKey, setShowNewApiKey] = useState(false);
  const [showChangeApiKeyModal, setShowChangeApiKeyModal] = useState(false);
  const [showChangeApiKey, setShowChangeApiKey] = useState(false);
  const [changeApiKeyInput, setChangeApiKeyInput] = useState('');
  const [changeApiKeyError, setChangeApiKeyError] = useState(null);
  const [emailConfigErrors, setEmailConfigErrors] = useState({});
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState(() => user?.email || 'support@sbs-med.com');

  const closeNotif = () => setNotification(null);
  const showSuccess = (title, message) => setNotification({ type: 'success', title, message });
  const showConfirm = (title, message, onConfirm, opts = {}) => setNotification({ type: 'confirm', title, message, onConfirm, onCancel: closeNotif, ...opts });

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [configData, slaData, deptsData, workflowData, escalationData, formOptionsData] = await Promise.all([
        getSuperAdminConfig().catch(() => ({ equipment: [], priorities: [] })),
        getSLARules().catch(() => ({ sla_rules: [] })),
        getDepartments().catch(() => ({ departments: [] })),
        getWorkflowStatuses().catch(() => ({ workflow_statuses: [] })),
        getEscalationRules().catch(() => ({ escalation_rules: [] })),
        getTicketFormOptions().catch(() => ({ slas: [] })),
      ]);

      const depts = deptsData.departments || deptsData || [];
      const rules = slaData.sla_rules || [];
      const slas = (formOptionsData?.slas && formOptionsData.slas.length > 0)
        ? formOptionsData.slas
        : [
          { sla_ID: 1, sla_name: 'Standard SLA', response_time_minutes: 240, resolution_time_minutes: 1440 },
          { sla_ID: 2, sla_name: 'Critical SLA', response_time_minutes: 30, resolution_time_minutes: 240 },
        ];

      setItems({
        equipment: configData.equipment || [],
        priorities: configData.priorities || [],
        slaRules: rules,
        departments: depts,
        slas,
      });

      if (workflowData.workflow_statuses && workflowData.workflow_statuses.length > 0) {
        setWorkflowStatuses(
          workflowData.workflow_statuses.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description || '',
            bgColor: s.bg_color || '#DBEAFE',
            textColor: s.text_color || '#1D4ED8',
            order: s.order_position || 1,
          }))
        );
      }

      if (escalationData.escalation_rules && escalationData.escalation_rules.length > 0) {
        setEscalationRules(
          escalationData.escalation_rules.map((r) => ({
            id: r.id,
            name: r.name,
            isActive: Boolean(r.is_active),
            trigger: r.trigger,
            condition: {
              text: r.condition_text || '',
              highlight: r.condition_highlight || '',
            },
            action: r.action,
            notify: r.notify,
          }))
        );
      }

      try {
        const emailRes = await getEmailConfiguration();
        if (emailRes?.is_configured && emailRes?.data) {
          setEmailConfig(emailRes.data);
        } else {
          setEmailConfig(null);
        }
      } catch {
        // keep fallback or null
      }
    } catch (err) {
      console.error('Failed to load superadmin config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // When selected department or SLA rules change, populate form for that department
  useEffect(() => {
    if (!selectedDeptId) return;

    const deptRules = items.slaRules.filter((r) => String(r.department_id) === String(selectedDeptId));

    const newForm = {
      Critical: { response_time_limit: '15', resolution_time_limit: '240' },
      High: { response_time_limit: '30', resolution_time_limit: '480' },
      Medium: { response_time_limit: '120', resolution_time_limit: '1440' },
      Low: { response_time_limit: '240', resolution_time_limit: '4320' },
    };

    deptRules.forEach((rule) => {
      const pName = rule.priority;
      if (newForm[pName]) {
        newForm[pName] = {
          response_time_limit: String(rule.response_time_limit || ''),
          resolution_time_limit: String(rule.resolution_time_limit || ''),
        };
      }
    });

    setDepartmentSlaForm(newForm);
  }, [selectedDeptId, items.slaRules]);

  useRealtimeRefresh({
    refresh: loadConfig,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 15000,
  });

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e) => {
      if (!e.target.closest('[data-menu-id]') && !e.target.closest('.menu-trigger')) {
        setOpenMenuId(null);
        setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  const list = tab === TAB_EQUIPMENT ? items.equipment : items.priorities;

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((item) => item.name && item.name.toLowerCase().includes(q));
  }, [list, search]);

  const handleAdd = () => {
    setEditingItem({ id: null, name: '' });
    setEditName('');
    setEditColor(priorityColorOptions[0].value);
  };

  const handleEdit = (item) => {
    setOpenMenuId(null);
    setMenuPos(null);
    setEditingItem(item);
    setEditName(item.name);
    setEditColor(item.color || priorityColorOptions[0].value);
  };

  const handleSaveItem = async () => {
    if (!editName.trim()) return;
    try {
      if (tab === TAB_EQUIPMENT) {
        if (editingItem.id === null) {
          await createSuperAdminEquipment({ name: editName.trim() });
        } else {
          await updateSuperAdminEquipment(editingItem.id, { name: editName.trim() });
        }
        showSuccess('Saved', 'Category has been saved.');
      } else {
        if (editingItem.id === null) {
          await createSuperAdminPriority({ name: editName.trim(), color: editColor });
        } else {
          await updateSuperAdminPriority(editingItem.id, { name: editName.trim(), color: editColor });
        }
        showSuccess('Saved', 'Priority has been saved.');
      }
      setEditingItem(null);
      loadConfig();
    } catch (err) {
      console.error(err);
      showSuccess('Error', 'Failed to save configuration settings.');
    }
  };

  const handleDelete = (item) => {
    setOpenMenuId(null);
    setMenuPos(null);
    const label = tab === TAB_EQUIPMENT ? 'category' : 'priority';
    showConfirm(`Delete ${label}?`, `Are you sure you want to delete "${item.name}"?`, () => confirmDelete(item), { confirmText: 'Delete', confirmClassName: 'bg-red-600 hover:bg-red-700' });
  };

  const confirmDelete = async (item) => {
    closeNotif();
    try {
      if (tab === TAB_EQUIPMENT) {
        await deleteSuperAdminEquipment(item.id);
        showSuccess('Deleted', `${item.name} has been deleted.`);
      } else {
        await deleteSuperAdminPriority(item.id);
        showSuccess('Deleted', `${item.name} has been deleted.`);
      }
      loadConfig();
    } catch (err) {
      console.error(err);
      showSuccess('Error', 'Failed to delete item.');
    }
  };

  // Workflow CRUD
  const handleAddWorkflow = () => {
    setEditingWorkflow({ id: null, name: '', description: '', bgColor: workflowColorOptions[0].bgColor, textColor: workflowColorOptions[0].textColor, order: workflowStatuses.length + 1 });
  };

  const handleEditWorkflow = (status) => {
    setEditingWorkflow({ ...status });
  };

  const handleSaveWorkflow = async () => {
    if (!editingWorkflow.name.trim()) return;
    try {
      const payload = {
        name: editingWorkflow.name.trim(),
        description: editingWorkflow.description,
        bg_color: editingWorkflow.bgColor,
        text_color: editingWorkflow.textColor,
        order_position: parseInt(editingWorkflow.order, 10) || 1,
      };

      if (editingWorkflow.id === null) {
        await createWorkflowStatus(payload);
      } else {
        await updateWorkflowStatus(editingWorkflow.id, payload);
      }
      setEditingWorkflow(null);
      showSuccess('Saved', 'Workflow status has been saved.');
      await loadConfig();
    } catch (err) {
      console.error('Failed to save workflow status:', err);
      showSuccess('Error', 'Failed to save workflow status.');
    }
  };

  const handleDeleteWorkflow = (status) => {
    showConfirm('Delete Status?', `Are you sure you want to delete "${status.name}"?`, async () => {
      closeNotif();
      try {
        await deleteWorkflowStatus(status.id);
        showSuccess('Deleted', `${status.name} has been deleted.`);
        await loadConfig();
      } catch (err) {
        console.error('Failed to delete workflow status:', err);
        showSuccess('Error', 'Failed to delete workflow status.');
      }
    }, { confirmText: 'Delete', confirmClassName: 'bg-red-600 hover:bg-red-700' });
  };

  // Escalation CRUD
  const handleAddEscalation = () => {
    setEditingEscalation({ id: null, name: '', isActive: true, trigger: '', condition: { text: '', highlight: '' }, action: '', notify: '' });
  };

  const handleEditEscalation = (rule) => {
    setEditingEscalation({ ...rule, condition: { ...rule.condition } });
  };

  const handleToggleEscalation = async (ruleId) => {
    try {
      await toggleEscalationRule(ruleId);
      await loadConfig();
    } catch (err) {
      console.error('Failed to toggle escalation rule:', err);
      showSuccess('Error', 'Failed to update escalation rule status.');
    }
  };

  const handleSaveEscalation = async () => {
    if (!editingEscalation.name.trim()) return;
    try {
      const payload = {
        name: editingEscalation.name.trim(),
        is_active: editingEscalation.isActive,
        trigger: editingEscalation.trigger,
        condition_text: editingEscalation.condition?.text || '',
        condition_highlight: editingEscalation.condition?.highlight || '',
        action: editingEscalation.action,
        notify: editingEscalation.notify,
      };

      if (editingEscalation.id === null) {
        await createEscalationRule(payload);
      } else {
        await updateEscalationRule(editingEscalation.id, payload);
      }
      setEditingEscalation(null);
      showSuccess('Saved', 'Escalation rule has been saved.');
      await loadConfig();
    } catch (err) {
      console.error('Failed to save escalation rule:', err);
      showSuccess('Error', 'Failed to save escalation rule.');
    }
  };

  const handleDeleteEscalation = (rule) => {
    showConfirm('Delete Rule?', `Are you sure you want to delete "${rule.name}"?`, async () => {
      closeNotif();
      try {
        await deleteEscalationRule(rule.id);
        showSuccess('Deleted', `${rule.name} has been deleted.`);
        await loadConfig();
      } catch (err) {
        console.error('Failed to delete escalation rule:', err);
        showSuccess('Error', 'Failed to delete escalation rule.');
      }
    }, { confirmText: 'Delete', confirmClassName: 'bg-red-600 hover:bg-red-700' });
  };

  const handleSlaInputChange = (priorityName, field, value) => {
    setDepartmentSlaForm((prev) => ({
      ...prev,
      [priorityName]: {
        ...prev[priorityName],
        [field]: value,
      },
    }));
  };

  const handleSaveDepartmentSla = async () => {
    if (!selectedDeptId) return;

    for (const p of priorityList) {
      const data = departmentSlaForm[p.name];
      if (!data?.response_time_limit || !data?.resolution_time_limit || isNaN(data.response_time_limit) || isNaN(data.resolution_time_limit)) {
        showSuccess('Validation Error', `Please fill out valid response and resolution time limits for ${p.name} priority.`);
        return;
      }
    }

    setSavingSla(true);
    try {
      const rulesPayload = priorityList.map((p) => ({
        priority: p.name,
        response_time_limit: parseInt(departmentSlaForm[p.name].response_time_limit, 10),
        resolution_time_limit: parseInt(departmentSlaForm[p.name].resolution_time_limit, 10),
      }));

      await saveDepartmentSLARules(parseInt(selectedDeptId, 10), rulesPayload);

      const deptName = items.departments.find((d) => String(d.id) === String(selectedDeptId))?.name || 'Department';
      showSuccess('SLA Rules Saved', `SLA configuration for ${deptName} has been saved successfully.`);
      await loadConfig();
      setSelectedDeptId(null);
    } catch (err) {
      console.error('Failed to save department SLA rules:', err);
      showSuccess('Error', 'Failed to save SLA rules for this department.');
    } finally {
      setSavingSla(false);
    }
  };

  const currentDeptObj = items.departments.find((d) => String(d.id) === String(selectedDeptId));

  const getDeptRuleSummary = (deptId) => {
    const rules = items.slaRules.filter((r) => String(r.department_id) === String(deptId));
    if (rules.length === 0) return { count: 0, text: 'No SLA rules configured' };
    return { count: rules.length, text: `${rules.length} Priority Rules Configured` };
  };

  const handleToggleTransition = (targetStatus) => {
    setTransitionRules((prev) => {
      const currentRule = prev[selectedTransitionStatus];
      if (!currentRule || currentRule.type !== 'editable') return prev;
      const isAllowed = currentRule.allowed.includes(targetStatus);
      const newAllowed = isAllowed
        ? currentRule.allowed.filter((s) => s !== targetStatus)
        : [...currentRule.allowed, targetStatus];
      return {
        ...prev,
        [selectedTransitionStatus]: {
          ...currentRule,
          allowed: newAllowed,
        },
      };
    });
  };

  const handleResetTransitions = () => {
    setTransitionRules(TS093_DEFAULT_RULES);
    showSuccess('Reset Complete', 'Transition rules have been restored to system defaults.');
  };

  // TS098 File Config Handlers
  const handleMaxFileSizeChange = (val) => {
    setFileConfig((prev) => ({ ...prev, maxFileSizeMB: val }));
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      setFileConfigErrors((prev) => ({ ...prev, maxFileSizeMB: 'Max file size must be a positive number greater than 0 MB.' }));
    } else {
      setFileConfigErrors((prev) => {
        const next = { ...prev };
        delete next.maxFileSizeMB;
        return next;
      });
    }
  };

  const handleMaxFileCountChange = (val) => {
    setFileConfig((prev) => ({ ...prev, maxFileCount: val }));
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      setFileConfigErrors((prev) => ({ ...prev, maxFileCount: 'Max file count must be a positive integer of at least 1.' }));
    } else {
      setFileConfigErrors((prev) => {
        const next = { ...prev };
        delete next.maxFileCount;
        return next;
      });
    }
  };

  const handleToggleFileType = (ext) => {
    setFileConfig((prev) => {
      const isAllowed = prev.allowedFileTypes.includes(ext);
      if (isAllowed) {
        if (prev.allowedFileTypes.length <= 1) {
          showSuccess('Validation Warning', 'At least one file type must remain allowed.');
          setFileConfigErrors((e) => ({ ...e, allowedFileTypes: 'At least one file type must remain allowed.' }));
          return prev;
        }
        const updated = prev.allowedFileTypes.filter((t) => t !== ext);
        setFileConfigErrors((e) => {
          const next = { ...e };
          delete next.allowedFileTypes;
          return next;
        });
        return { ...prev, allowedFileTypes: updated };
      } else {
        setFileConfigErrors((e) => {
          const next = { ...e };
          delete next.allowedFileTypes;
          return next;
        });
        return { ...prev, allowedFileTypes: [...prev.allowedFileTypes, ext] };
      }
    });
  };

  const handleToggleMalwareScanning = () => {
    if (fileConfig.malwareScanningEnabled) {
      // Turning OFF requires confirmation
      showConfirm(
        'Disable Malware Scanning?',
        'Disabling malware scanning allows files to bypass virus checks before being stored. This is not recommended.',
        () => {
          closeNotif();
          setFileConfig((prev) => ({ ...prev, malwareScanningEnabled: false }));
        },
        {
          confirmText: 'Disable Scanning',
          confirmClassName: 'bg-red-600 hover:bg-red-700',
        }
      );
    } else {
      // Turning ON does not require confirmation
      setFileConfig((prev) => ({ ...prev, malwareScanningEnabled: true }));
    }
  };

  const handleResetFileConfig = () => {
    setFileConfig(TS098_DEFAULT_FILE_CONFIG);
    setFileConfigErrors({});
    showSuccess('Reset Complete', 'File upload settings have been restored to system defaults.');
  };

  const handleSaveFileConfig = () => {
    const sizeNum = parseFloat(fileConfig.maxFileSizeMB);
    const countNum = parseInt(fileConfig.maxFileCount, 10);

    const errors = {};
    if (isNaN(sizeNum) || sizeNum <= 0) {
      errors.maxFileSizeMB = 'Please enter a valid max file size greater than 0 MB.';
    }
    if (isNaN(countNum) || countNum <= 0) {
      errors.maxFileCount = 'Please enter a valid max file count of at least 1.';
    }
    if (!fileConfig.allowedFileTypes || fileConfig.allowedFileTypes.length === 0) {
      errors.allowedFileTypes = 'At least one file type must be selected.';
    }

    if (Object.keys(errors).length > 0) {
      setFileConfigErrors(errors);
      showSuccess('Validation Error', 'Please correct the errors before saving.');
      return;
    }

    setFileConfigErrors({});
    showSuccess('Settings Saved (Session)', 'File upload limits and security settings updated for this session. Persistence coming soon.');
  };

  // TS100 Reopen & Auto-Close Handlers
  const handleToggleReopen = () => {
    if (windowConfig.reopenEnabled) {
      showConfirm(
        'Disable Ticket Reopen Window?',
        'Disabling Reopen means all closed tickets are final and cannot be reopened by the customer.',
        () => {
          closeNotif();
          setWindowConfig((prev) => ({ ...prev, reopenEnabled: false }));
        },
        {
          confirmText: 'Disable Reopen',
          confirmClassName: 'bg-red-600 hover:bg-red-700',
        }
      );
    } else {
      setWindowConfig((prev) => ({ ...prev, reopenEnabled: true }));
    }
  };

  const handleToggleAutoClose = () => {
    if (windowConfig.autoCloseEnabled) {
      showConfirm(
        'Disable Auto-Close Window?',
        'Disabling Auto-Close means Resolved tickets stay open indefinitely until the customer manually closes them.',
        () => {
          closeNotif();
          setWindowConfig((prev) => ({ ...prev, autoCloseEnabled: false }));
        },
        {
          confirmText: 'Disable Auto-Close',
          confirmClassName: 'bg-red-600 hover:bg-red-700',
        }
      );
    } else {
      setWindowConfig((prev) => ({ ...prev, autoCloseEnabled: true }));
    }
  };

  const handleReopenDaysChange = (val) => {
    setWindowConfig((prev) => ({ ...prev, reopenWindowDays: val }));
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      setWindowConfigErrors((prev) => ({ ...prev, reopenWindowDays: 'Duration must be a positive number of days (at least 1).' }));
    } else {
      setWindowConfigErrors((prev) => {
        const next = { ...prev };
        delete next.reopenWindowDays;
        return next;
      });
    }
  };

  const handleAutoCloseDaysChange = (val) => {
    setWindowConfig((prev) => ({ ...prev, autoCloseWindowDays: val }));
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      setWindowConfigErrors((prev) => ({ ...prev, autoCloseWindowDays: 'Duration must be a positive number of days (at least 1).' }));
    } else {
      setWindowConfigErrors((prev) => {
        const next = { ...prev };
        delete next.autoCloseWindowDays;
        return next;
      });
    }
  };

  const handleResetWindowConfig = () => {
    setWindowConfig(TS100_DEFAULT_WINDOW_CONFIG);
    setWindowConfigErrors({});
    showSuccess('Reset Complete', 'Reopen and auto-close window rules have been restored to system defaults.');
  };

  const handleSaveWindowConfig = () => {
    const errors = {};
    if (windowConfig.reopenEnabled) {
      const num = parseInt(windowConfig.reopenWindowDays, 10);
      if (isNaN(num) || num <= 0) {
        errors.reopenWindowDays = 'Please enter a valid duration of at least 1 day.';
      }
    }
    if (windowConfig.autoCloseEnabled) {
      const num = parseInt(windowConfig.autoCloseWindowDays, 10);
      if (isNaN(num) || num <= 0) {
        errors.autoCloseWindowDays = 'Please enter a valid duration of at least 1 day.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setWindowConfigErrors(errors);
      showSuccess('Validation Error', 'Please correct the errors before saving.');
      return;
    }

    setWindowConfigErrors({});
    showSuccess('Settings Saved (Session)', 'Reopen and auto-close window rules updated in session state. Persistence coming soon.');
  };

  // TS099: Compute full recipient options combining contextual actors, static roles, and dynamic departments
  const ts099RecipientOptions = useMemo(() => {
    const deptList = (items.departments && items.departments.length > 0)
      ? items.departments.map((d) => ({
        id: `dept_${d.id}`,
        label: `${d.name} Department`,
        desc: d.description || `All staff in ${d.name} department`,
        type: 'department',
        badge: 'Dept',
      }))
      : [
        { id: 'dept_1', label: 'Service Department', desc: 'All staff in Service department', type: 'department', badge: 'Dept' },
        { id: 'dept_2', label: 'IT Department', desc: 'All staff in IT department', type: 'department', badge: 'Dept' },
      ];

    return {
      contextual: TS099_CONTEXTUAL_RECIPIENTS,
      staticGroup: [
        ...TS099_STATIC_ROLES,
        ...deptList,
      ],
    };
  }, [items.departments]);

  const handleToggleRecipient = (alertKey, recipientId) => {
    const currentRecipients = routingConfig[alertKey] || [];
    const isSelected = currentRecipients.includes(recipientId);
    const nextRecipients = isSelected
      ? currentRecipients.filter((id) => id !== recipientId)
      : [...currentRecipients, recipientId];

    // Validation: block selecting zero recipients with an inline error
    if (nextRecipients.length === 0) {
      const alertMeta = TS099_ALERT_TYPES.find((a) => a.key === alertKey);
      setRoutingErrors((prev) => ({
        ...prev,
        [alertKey]: `At least one recipient is required for ${alertMeta?.title || 'this alert'}.`,
      }));
      return;
    }

    // Clear any existing error for this alertKey
    setRoutingErrors((prev) => {
      if (!prev[alertKey]) return prev;
      const next = { ...prev };
      delete next[alertKey];
      return next;
    });

    const isAlreadyConfigured = configuredAlerts[alertKey];
    const allRecipients = [
      ...TS099_CONTEXTUAL_RECIPIENTS,
      ...TS099_STATIC_ROLES,
      ...(items.departments || []).map((d) => ({ id: `dept_${d.id}`, label: `${d.name} Department` })),
      { id: 'dept_1', label: 'Service Department' },
      { id: 'dept_2', label: 'IT Department' },
    ];
    const recipientMeta = allRecipients.find((r) => r.id === recipientId);
    const recipientLabel = recipientMeta?.label || recipientId;
    const alertMeta = TS099_ALERT_TYPES.find((a) => a.key === alertKey);
    const actionText = isSelected ? 'remove' : 'add';

    if (isAlreadyConfigured) {
      showConfirm(
        `Update ${alertMeta?.title || 'Alert'} Recipients?`,
        `Are you sure you want to ${actionText} "${recipientLabel}" ${isSelected ? 'from' : 'to'} ${alertMeta?.title || 'this alert'}? This changes who receives notifications for this event.`,
        () => {
          closeNotif();
          setRoutingConfig((prev) => ({
            ...prev,
            [alertKey]: nextRecipients,
          }));
          showSuccess('Recipient Updated', `Updated recipient routing for ${alertMeta?.title}.`);
        },
        {
          confirmText: isSelected ? 'Remove Recipient' : 'Add Recipient',
          confirmClassName: isSelected ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#252578] hover:bg-[#1a1a5e]',
          onCancel: () => {
            closeNotif();
            // Revert: state remains untouched at currentRecipients
          },
        }
      );
    } else {
      // First-time configuration: no modal
      setRoutingConfig((prev) => ({
        ...prev,
        [alertKey]: nextRecipients,
      }));
      setConfiguredAlerts((prev) => ({
        ...prev,
        [alertKey]: true,
      }));
    }
  };

  const handleResetRoutingConfig = () => {
    showConfirm(
      'Reset Recipient Routing to Defaults?',
      'Are you sure you want to restore all notification routing rules to their system defaults? Any recipient customizations will be reverted.',
      () => {
        closeNotif();
        setRoutingConfig(TS099_DEFAULT_ROUTING);
        setConfiguredAlerts({});
        setRoutingErrors({});
        showSuccess('Reset to Defaults', 'Notification recipient routing has been restored to defaults.');
      },
      {
        confirmText: 'Reset to Defaults',
        confirmClassName: 'bg-amber-600 hover:bg-amber-700',
      }
    );
  };

  const handleSaveRoutingConfig = () => {
    const errors = {};
    for (const alert of TS099_ALERT_TYPES) {
      const list = routingConfig[alert.key] || [];
      if (list.length === 0) {
        errors[alert.key] = `At least one recipient is required for ${alert.title}.`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setRoutingErrors(errors);
      showSuccess('Validation Error', 'Please ensure all alert types have at least one recipient selected.');
      return;
    }

    setRoutingErrors({});
    setConfiguredAlerts({
      new_ticket: true,
      new_message: true,
      overdue_ticket: true,
    });
    showSuccess(
      'Settings Saved (Preview)',
      'Notification recipient routing settings updated in local state.'
    );
  };

  // TS103 Notification Channel Handlers
  const handleChangeChannel = (alertKey, newChannel) => {
    const currentChannel = channelConfig[alertKey];
    if (currentChannel === newChannel) return;

    const alertMeta = TS103_ALERT_TYPES.find((a) => a.key === alertKey);
    const getOptionLabel = (val) => TS103_CHANNEL_OPTIONS.find((o) => o.id === val)?.label || val;
    const isAlreadyConfigured = Boolean(configuredChannels[alertKey]);

    // Clear any existing error for this alertKey
    setChannelErrors((prev) => {
      if (!prev[alertKey]) return prev;
      const next = { ...prev };
      delete next[alertKey];
      return next;
    });

    if (isAlreadyConfigured) {
      showConfirm(
        `Update ${alertMeta?.title || 'Alert'} Delivery Channel?`,
        `Are you sure you want to change the delivery channel for "${alertMeta?.title || alertKey}" from "${getOptionLabel(currentChannel)}" to "${getOptionLabel(newChannel)}"? This alters how notifications are delivered to recipients.`,
        () => {
          closeNotif();
          setChannelConfig((prev) => ({
            ...prev,
            [alertKey]: newChannel,
          }));
          showSuccess('Channel Updated', `Delivery channel for ${alertMeta?.title} set to ${getOptionLabel(newChannel)}.`);
        },
        {
          confirmText: 'Update Channel',
          confirmClassName: 'bg-[#252578] hover:bg-[#1a1a5e]',
          onCancel: () => {
            closeNotif();
            // Revert: stays at currentChannel
          },
        }
      );
    } else {
      // First-time configuration: skip modal
      setChannelConfig((prev) => ({
        ...prev,
        [alertKey]: newChannel,
      }));
      setConfiguredChannels((prev) => ({
        ...prev,
        [alertKey]: true,
      }));
    }
  };

  const handleResetChannelConfig = () => {
    showConfirm(
      'Reset Notification Channels to Defaults?',
      'Are you sure you want to restore all notification delivery channels to system defaults? Any channel customizations will be reverted.',
      () => {
        closeNotif();
        setChannelConfig(TS103_DEFAULT_CHANNELS);
        setConfiguredChannels({});
        setChannelErrors({});
        showSuccess('Reset to Defaults', 'Notification channel configuration has been restored to defaults.');
      },
      {
        confirmText: 'Reset to Defaults',
        confirmClassName: 'bg-amber-600 hover:bg-amber-700',
      }
    );
  };

  const handleSaveChannelConfig = () => {
    const errors = {};
    for (const alert of TS103_ALERT_TYPES) {
      const ch = channelConfig[alert.key];
      if (!ch) {
        errors[alert.key] = `Please select a delivery channel for ${alert.title}.`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setChannelErrors(errors);
      showSuccess('Validation Error', 'Please select a delivery channel for all alert types.');
      return;
    }

    setChannelErrors({});
    const allConfigured = {};
    TS103_ALERT_TYPES.forEach((a) => {
      allConfigured[a.key] = true;
    });
    setConfiguredChannels(allConfigured);
    showSuccess(
      'Settings Saved (Preview)',
      'Notification channel configuration updated in local state.'
    );
  };

  // TS095 Ticket Defaults Handlers
  const handlePriorityChange = (newPriority) => {
    if (!newPriority) {
      setDefaultsErrors((prev) => ({ ...prev, priority: 'Please select a valid default priority level.' }));
      return;
    }
    setDefaultsErrors((prev) => {
      const next = { ...prev };
      delete next.priority;
      return next;
    });

    if (newPriority === defaultsConfig.priority) return;

    if (configuredDefaults.priority || defaultsConfig.priority) {
      showConfirm(
        'Change Default Priority?',
        'This affects all new tickets going forward across the system.',
        () => {
          closeNotif();
          setDefaultsConfig((prev) => ({ ...prev, priority: newPriority }));
          setConfiguredDefaults((prev) => ({ ...prev, priority: true }));
          showSuccess('Default Priority Updated', `Default priority has been updated to "${newPriority}" for new tickets.`);
        },
        {
          confirmText: 'Change Priority',
          confirmClassName: 'bg-[#252578] hover:bg-[#1a1a5e]',
        }
      );
    } else {
      // First-time configuration: no confirmation modal required
      setDefaultsConfig((prev) => ({ ...prev, priority: newPriority }));
      setConfiguredDefaults((prev) => ({ ...prev, priority: true }));
      showSuccess('Default Priority Set', `Default priority set to "${newPriority}".`);
    }
  };

  const handleSlaPolicyChange = (newSlaPolicy) => {
    if (newSlaPolicy === defaultsConfig.slaPolicy) return;

    const getPolicyLabel = (key) => {
      if (key === 'dynamic') return 'Dynamic (Department & Priority Rule)';
      const found = (items.slas || []).find((s) => String(s.sla_ID) === String(key) || s.sla_name === key);
      return found?.sla_name || key;
    };
    const newLabel = getPolicyLabel(newSlaPolicy);

    if (configuredDefaults.slaPolicy || defaultsConfig.slaPolicy) {
      showConfirm(
        'Change Default SLA Policy?',
        'This affects all new tickets going forward across the system.',
        () => {
          closeNotif();
          setDefaultsConfig((prev) => ({ ...prev, slaPolicy: newSlaPolicy }));
          setConfiguredDefaults((prev) => ({ ...prev, slaPolicy: true }));
          showSuccess('Default SLA Policy Updated', `Default SLA policy has been updated to "${newLabel}" for new tickets.`);
        },
        {
          confirmText: 'Change SLA Policy',
          confirmClassName: 'bg-[#252578] hover:bg-[#1a1a5e]',
        }
      );
    } else {
      // First-time configuration: no confirmation modal required
      setDefaultsConfig((prev) => ({ ...prev, slaPolicy: newSlaPolicy }));
      setConfiguredDefaults((prev) => ({ ...prev, slaPolicy: true }));
      showSuccess('Default SLA Policy Set', `Default SLA policy set to "${newLabel}".`);
    }
  };

  const handleResetDefaults = () => {
    showConfirm(
      'Reset Ticket Defaults?',
      'This will restore default ticket values (Open status, Low priority, Dynamic SLA Policy).',
      () => {
        closeNotif();
        setDefaultsConfig({ status: 'Open', priority: 'Low', slaPolicy: 'dynamic' });
        setDefaultsErrors({});
        showSuccess('Reset Complete', 'Ticket defaults have been reset to system baseline.');
      },
      { confirmText: 'Reset Defaults', confirmClassName: 'bg-red-600 hover:bg-red-700' }
    );
  };

  // TS094 Ticket Number Format Handlers & Live Preview Computations
  const livePreviewDatePart = useMemo(() => {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    if (numberFormatConfig.dateSegment === 'YYYY') return yyyy;
    if (numberFormatConfig.dateSegment === 'YYYYMM') return `${yyyy}${mm}`;
    if (numberFormatConfig.dateSegment === 'YYYYMMDD') return `${yyyy}${mm}${dd}`;
    return null;
  }, [numberFormatConfig.dateSegment]);

  const livePreviewSeqPart = useMemo(() => {
    const rawLen = parseInt(String(numberFormatConfig.digitLength || '').trim(), 10);
    const padLen = !isNaN(rawLen) && rawLen >= 1 && rawLen <= 12 ? rawLen : 4;
    return String(1).padStart(padLen, '0');
  }, [numberFormatConfig.digitLength]);

  const livePreviewTicketNumber = useMemo(() => {
    const p = (numberFormatConfig.prefix || '').trim().toUpperCase() || 'TKT';
    const dCode = numberFormatConfig.includeDeptCode
      ? (numberFormatConfig.deptCode || '').trim().toUpperCase() || 'DEPT'
      : null;
    const datePart = livePreviewDatePart;
    const seqPart = livePreviewSeqPart;

    return [p, dCode, datePart, seqPart].filter(Boolean).join('-');
  }, [numberFormatConfig.prefix, numberFormatConfig.includeDeptCode, numberFormatConfig.deptCode, livePreviewDatePart, livePreviewSeqPart]);

  const validateNumberFormat = (config) => {
    const errors = {};

    // Prefix validation
    if (!config.prefix || !config.prefix.trim()) {
      errors.prefix = 'A prefix is required.';
    } else if (!/^[A-Za-z0-9_-]+$/.test(config.prefix.trim())) {
      errors.prefix = 'Prefix can only contain letters, numbers, hyphens, and underscores.';
    }

    // Branch/Department code validation (if enabled)
    if (config.includeDeptCode) {
      if (!config.deptCode || !config.deptCode.trim()) {
        errors.deptCode = 'Please enter a department code or disable this segment.';
      } else if (!/^[A-Za-z0-9_-]+$/.test(config.deptCode.trim())) {
        errors.deptCode = 'Department code can only contain letters, numbers, and hyphens.';
      }
    }

    // Sequential digit length validation
    const rawLen = String(config.digitLength ?? '').trim();
    if (!rawLen || rawLen === '0' || !/^\d+$/.test(rawLen)) {
      errors.digitLength = 'A sequential number is required to prevent duplicate ticket IDs.';
    } else {
      const num = parseInt(rawLen, 10);
      if (num < 3 || num > 8) {
        errors.digitLength = 'Sequential digit length must be between 3 and 8 digits.';
      }
    }

    return errors;
  };

  const handlePrefixChange = (val) => {
    setNumberFormatConfig((prev) => ({ ...prev, prefix: val }));
    if (numberFormatErrors.prefix) {
      setNumberFormatErrors((prev) => {
        const next = { ...prev };
        delete next.prefix;
        return next;
      });
    }
  };

  const handleIncludeDeptCodeChange = (checked) => {
    setNumberFormatConfig((prev) => ({ ...prev, includeDeptCode: checked }));
    if (numberFormatErrors.deptCode) {
      setNumberFormatErrors((prev) => {
        const next = { ...prev };
        delete next.deptCode;
        return next;
      });
    }
  };

  const handleDeptCodeChange = (val) => {
    setNumberFormatConfig((prev) => ({ ...prev, deptCode: val }));
    if (numberFormatErrors.deptCode) {
      setNumberFormatErrors((prev) => {
        const next = { ...prev };
        delete next.deptCode;
        return next;
      });
    }
  };

  const handleDateSegmentChange = (val) => {
    setNumberFormatConfig((prev) => ({ ...prev, dateSegment: val }));
  };

  const handleDigitLengthChange = (val) => {
    setNumberFormatConfig((prev) => ({ ...prev, digitLength: val }));
    if (numberFormatErrors.digitLength) {
      setNumberFormatErrors((prev) => {
        const next = { ...prev };
        delete next.digitLength;
        return next;
      });
    }
  };

  const handleSaveNumberFormat = () => {
    const errors = validateNumberFormat(numberFormatConfig);
    if (Object.keys(errors).length > 0) {
      setNumberFormatErrors(errors);
      showSuccess('Validation Error', 'Please correct the errors in the format configuration before saving.');
      return;
    }

    setNumberFormatErrors({});

    showConfirm(
      'Save Ticket Number Format?',
      'This will change how all tickets are numbered going forward, across all branches.',
      () => {
        closeNotif();
        const normalized = {
          prefix: numberFormatConfig.prefix.trim().toUpperCase(),
          includeDeptCode: numberFormatConfig.includeDeptCode,
          deptCode: numberFormatConfig.includeDeptCode ? numberFormatConfig.deptCode.trim().toUpperCase() : '',
          dateSegment: numberFormatConfig.dateSegment,
          digitLength: parseInt(String(numberFormatConfig.digitLength).trim(), 10),
        };
        setNumberFormatConfig(normalized);
        setSavedNumberFormat(normalized);
        setHasEverSavedFormat(true);
        showSuccess('Ticket Format Saved', 'Ticket number format has been saved. New tickets will use this format going forward.');
      },
      {
        confirmText: 'Save Format',
        confirmClassName: 'bg-[#252578] hover:bg-[#1a1a5e]',
        onCancel: () => {
          closeNotif();
          // If cancelled, revert to prior saved format
          setNumberFormatConfig({ ...savedNumberFormat });
          setNumberFormatErrors({});
        },
      }
    );
  };

  const handleResetNumberFormat = () => {
    showConfirm(
      'Reset Ticket Number Format?',
      'This will restore the ticket number format to default (TKT-0001).',
      () => {
        closeNotif();
        setNumberFormatConfig(TS094_DEFAULT_FORMAT);
        setSavedNumberFormat(TS094_DEFAULT_FORMAT);
        setHasEverSavedFormat(false);
        setNumberFormatErrors({});
        showSuccess('Reset to Defaults', 'Ticket number format has been reset to system default (TKT-0001).');
      },
      {
        confirmText: 'Reset Format',
        confirmClassName: 'bg-amber-600 hover:bg-amber-700',
      }
    );
  };

  // TS096 Max Open Tickets per Requester Handlers
  const handleToggleUnlimited = (checked) => {
    setTicketLimitConfigState((prev) => ({
      ...prev,
      isUnlimited: checked,
    }));
    setLimitError('');
  };

  const handleLimitNumberChange = (val) => {
    setTicketLimitConfigState((prev) => ({
      ...prev,
      limit: val,
    }));
    if (limitError) {
      setLimitError('');
    }
  };

  const handleSaveTicketLimit = () => {
    if (!ticketLimitConfig.isUnlimited) {
      const parsed = parseInt(String(ticketLimitConfig.limit).trim(), 10);
      if (isNaN(parsed) || parsed <= 0) {
        setLimitError('Please enter a valid ticket limit greater than 0.');
        showSuccess('Validation Error', 'Please enter a valid numeric limit greater than 0.');
        return;
      }
    }

    setLimitError('');

    const normalized = {
      isUnlimited: Boolean(ticketLimitConfig.isUnlimited),
      limit: parseInt(String(ticketLimitConfig.limit || 5).trim(), 10) || 5,
    };

    showConfirm(
      'Save Max Open Tickets Limit?',
      'This will affect ticket submission for all Customers and Requestors going forward.',
      () => {
        closeNotif();
        setMaxOpenTicketsLimit(normalized);
        setTicketLimitConfigState(normalized);
        setSavedTicketLimit(normalized);
        setHasEverSavedLimit(true);
        showSuccess(
          'Limit Saved',
          normalized.isUnlimited
            ? 'Max open tickets limit set to Unlimited. Ticket creation will not be restricted.'
            : `Max open tickets limit updated to ${normalized.limit}. Ticket creation blocking will use this value.`
        );
      },
      {
        confirmText: 'Save Limit',
        confirmClassName: 'bg-[#252578] hover:bg-[#1a1a5e]',
        onCancel: () => {
          closeNotif();
          setTicketLimitConfigState({ ...savedTicketLimit });
          setLimitError('');
        },
      }
    );
  };

  const handleResetTicketLimit = () => {
    showConfirm(
      'Reset Max Open Tickets Limit?',
      'This will restore the ticket limit to system default (Unlimited).',
      () => {
        closeNotif();
        const def = { isUnlimited: true, limit: 5 };
        setMaxOpenTicketsLimit(def);
        setTicketLimitConfigState(def);
        setSavedTicketLimit(def);
        setHasEverSavedLimit(false);
        setLimitError('');
        showSuccess('Reset to Defaults', 'Max open tickets limit has been restored to Unlimited.');
      },
      {
        confirmText: 'Reset Limit',
        confirmClassName: 'bg-amber-600 hover:bg-amber-700',
      }
    );
  };

  // TS101 Feedback Form Master Toggle Handler
  // TEMPORARY: localStorage is used here only as a same-session demo bridge between Super Admin and Customer portals for this sprint's frontend-only scope. This must be replaced with a real backend-persisted setting, read by both portals via API, before this is production-ready — localStorage does not sync across different users/devices/browsers.
  const handleToggleFeedbackMaster = () => {
    if (feedbackMasterEnabled) {
      showConfirm(
        'Disable Feedback Form?',
        'Disabling Feedback Form will stop showing the feedback prompt to customers and stop collecting new CSAT/feedback analytics. Historical data already collected will not be affected.',
        () => {
          closeNotif();
          setFeedbackMasterEnabled(false);
          setFeedbackFormEnabled(false);
        },
        {
          confirmText: 'Disable Feedback Form',
          confirmClassName: 'bg-red-600 hover:bg-red-700',
        }
      );
    } else {
      setFeedbackMasterEnabled(true);
      setFeedbackFormEnabled(true);
    }
  };

  // TS104 Feedback Form Handlers
  const handleSelectFeedbackCategory = (cat) => {
    setActiveFeedbackCategory(cat);
    setFeedbackInlineError('');
  };

  const handleToggleFeedbackQuestion = (category, questionId) => {
    setFeedbackInlineError('');
    const questions = feedbackQuestions[category] || [];
    const target = questions.find((q) => q.id === questionId);
    if (!target) return;

    if (target.isEnabled) {
      const enabledCount = questions.filter((q) => q.isEnabled).length;
      if (enabledCount <= 1) {
        setFeedbackInlineError(`At least one question must stay enabled for ${category}.`);
        return;
      }
    }

    setFeedbackQuestions((prev) => ({
      ...prev,
      [category]: (prev[category] || []).map((q) =>
        q.id === questionId ? { ...q, isEnabled: !q.isEnabled } : q
      ),
    }));
  };

  const handleMoveFeedbackQuestion = (category, index, direction) => {
    setFeedbackInlineError('');
    const questions = feedbackQuestions[category] || [];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const updated = [...questions];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    setFeedbackQuestions((prev) => ({
      ...prev,
      [category]: updated,
    }));
  };

  const handleAddFeedbackQuestion = () => {
    setFeedbackInlineError('');
    setEditingQuestion({
      id: null,
      category: activeFeedbackCategory,
      text: '',
      responseType: 'Star Rating',
      isEnabled: true,
    });
  };

  const handleEditFeedbackQuestion = (question) => {
    setFeedbackInlineError('');
    setEditingQuestion({
      ...question,
      category: activeFeedbackCategory,
    });
  };

  const handleSaveFeedbackQuestion = () => {
    if (!editingQuestion || !editingQuestion.text.trim()) return;
    const trimmedText = editingQuestion.text.trim();
    const cat = editingQuestion.category || activeFeedbackCategory;

    setFeedbackQuestions((prev) => {
      const list = prev[cat] || [];
      if (editingQuestion.id === null) {
        const newQuestion = {
          id: `custom-${Date.now()}`,
          text: trimmedText,
          responseType: editingQuestion.responseType || 'Star Rating',
          isEnabled: editingQuestion.isEnabled !== undefined ? editingQuestion.isEnabled : true,
        };
        return {
          ...prev,
          [cat]: [...list, newQuestion],
        };
      } else {
        return {
          ...prev,
          [cat]: list.map((q) =>
            q.id === editingQuestion.id
              ? { ...q, text: trimmedText, responseType: editingQuestion.responseType }
              : q
          ),
        };
      }
    });

    setEditingQuestion(null);
    setFeedbackInlineError('');
  };

  const handleRemoveFeedbackQuestion = (category, question) => {
    setFeedbackInlineError('');
    const questions = feedbackQuestions[category] || [];
    if (question.isEnabled) {
      const enabledCount = questions.filter((q) => q.isEnabled).length;
      if (enabledCount <= 1) {
        setFeedbackInlineError(`At least one question must stay enabled for ${category}.`);
        return;
      }
    }

    showConfirm(
      'Remove Question?',
      'This action cannot be undone. Historical responses tied to this question will remain in past submissions, but the question will no longer be editable or reusable.',
      () => {
        closeNotif();
        setFeedbackQuestions((prev) => ({
          ...prev,
          [category]: (prev[category] || []).filter((q) => q.id !== question.id),
        }));
      },
      { confirmText: 'Remove', confirmClassName: 'bg-red-600 hover:bg-red-700' }
    );
  };

  const handleResetFeedback = () => {
    showConfirm(
      'Reset Questions to Defaults?',
      'This will restore all default questions for IT, Service, and Others. Any unsaved custom questions will be lost.',
      () => {
        closeNotif();
        setFeedbackQuestions(TS104_DEFAULT_QUESTIONS);
        setFeedbackInlineError('');
      },
      { confirmText: 'Reset', confirmClassName: 'bg-red-600 hover:bg-red-700' }
    );
  };

  // Email Delivery Configuration Handlers
  const handleAddEmailConfig = () => {
    const errors = {};
    if (!newEmailConfig.apiKey || !newEmailConfig.apiKey.trim()) {
      errors.apiKey = 'API Key is required and cannot be null or empty.';
    } else if (!newEmailConfig.apiKey.trim().startsWith('re_')) {
      errors.apiKey = 'Resend API Key must start with "re_".';
    } else if (newEmailConfig.apiKey.trim().length < 8) {
      errors.apiKey = 'API Key must be at least 8 characters.';
    }

    if (!newEmailConfig.fromName || !newEmailConfig.fromName.trim()) {
      errors.fromName = 'From Name is required and cannot be null or empty.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newEmailConfig.fromEmail || !newEmailConfig.fromEmail.trim()) {
      errors.fromEmail = 'From Email is required and cannot be null or empty.';
    } else if (!emailRegex.test(newEmailConfig.fromEmail.trim())) {
      errors.fromEmail = 'Please provide a valid sender email address.';
    }

    if (Object.keys(errors).length > 0) {
      setNewEmailConfigErrors(errors);
      return;
    }

    setNewEmailConfigErrors({});
    showConfirm(
      'Save Email Configuration?',
      'Once you save, you cannot see the API key again. It will be permanently masked for security. Are you sure you want to proceed?',
      async () => {
        closeNotif();
        try {
          const res = await saveEmailConfiguration({
            apiKey: newEmailConfig.apiKey.trim(),
            fromName: newEmailConfig.fromName.trim(),
            fromEmail: newEmailConfig.fromEmail.trim(),
          });
          setEmailConfig(res.data);
          setIsAddingEmailConfig(false);
          setNewEmailConfig({ provider: 'Resend', apiKey: '', fromName: '', fromEmail: '' });
          showSuccess(
            'Email Configuration Saved',
            'Resend email delivery gateway has been verified and configured successfully.'
          );
        } catch (err) {
          const errMsg = err?.response?.data?.errors?.apiKey || err?.response?.data?.message || err?.message || 'Failed to verify and save email configuration.';
          setNewEmailConfigErrors((prev) => ({ ...prev, apiKey: errMsg }));
        }
      },
      {
        confirmText: 'Save Configuration',
        cancelText: 'Cancel',
        confirmClassName: 'bg-[#252578] hover:bg-[#1a1a5e]',
      }
    );
  };

  const handleOpenTestEmailFromAdd = () => {
    const errors = {};
    if (!newEmailConfig.apiKey || !newEmailConfig.apiKey.trim()) {
      errors.apiKey = 'API Key is required to send a test email.';
    }
    if (!newEmailConfig.fromName || !newEmailConfig.fromName.trim()) {
      errors.fromName = 'From Name is required to send a test email.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newEmailConfig.fromEmail || !newEmailConfig.fromEmail.trim()) {
      errors.fromEmail = 'From Email is required to send a test email.';
    } else if (!emailRegex.test(newEmailConfig.fromEmail.trim())) {
      errors.fromEmail = 'Please provide a valid sender email address.';
    }

    if (Object.keys(errors).length > 0) {
      setNewEmailConfigErrors(errors);
      return;
    }

    setShowTestEmailModal(true);
  };

  const handleChangeApiKey = () => {
    if (!changeApiKeyInput || !changeApiKeyInput.trim()) {
      setChangeApiKeyError('API Key is required and cannot be null or empty.');
      return;
    }
    if (!changeApiKeyInput.trim().startsWith('re_')) {
      setChangeApiKeyError('Resend API Key must start with "re_".');
      return;
    }
    if (changeApiKeyInput.trim().length < 8) {
      setChangeApiKeyError('API Key must be at least 8 characters.');
      return;
    }

    showConfirm(
      'Change API Key?',
      'Once you save, you cannot see the API key again. It will be permanently masked for security. Are you sure you want to update the key?',
      async () => {
        closeNotif();
        try {
          const res = await updateEmailApiKey(changeApiKeyInput.trim());
          setEmailConfig(res.data);
          setShowChangeApiKeyModal(false);
          setChangeApiKeyInput('');
          setChangeApiKeyError(null);
          showSuccess('API Key Updated', 'Resend API key has been verified and changed successfully.');
        } catch (err) {
          const errMsg = err?.response?.data?.errors?.apiKey || err?.response?.data?.message || err?.message || 'Failed to verify new API key with Resend.';
          setChangeApiKeyError(errMsg);
        }
      },
      {
        confirmText: 'Update API Key',
        cancelText: 'Cancel',
        confirmClassName: 'bg-[#252578] hover:bg-[#1a1a5e]',
      }
    );
  };

  const handleSaveEmailConfig = () => {
    if (!emailConfig) return;
    const errors = {};
    if (!emailConfig.fromName || !emailConfig.fromName.trim()) {
      errors.fromName = 'From Name is required and cannot be null or empty.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailConfig.fromEmail || !emailConfig.fromEmail.trim()) {
      errors.fromEmail = 'From Email is required and cannot be null or empty.';
    } else if (!emailRegex.test(emailConfig.fromEmail.trim())) {
      errors.fromEmail = 'Please provide a valid sender email address.';
    }

    if (Object.keys(errors).length > 0) {
      setEmailConfigErrors(errors);
      return;
    }

    setEmailConfigErrors({});
    showSuccess(
      'Email Configuration Saved',
      'Transactional email settings for Resend are actively configured.'
    );
  };

  const handleRemoveEmailConfig = () => {
    showConfirm(
      'Remove Email Configuration?',
      'Are you sure you want to remove the Resend email configuration? Email alerts will be suspended until a new configuration is added.',
      async () => {
        closeNotif();
        try {
          await removeEmailConfiguration();
        } catch {
          // ignore
        }
        setEmailConfig(null);
        setEmailConfigErrors({});
        setIsAddingEmailConfig(false);
        showSuccess('Configuration Removed', 'Email configuration has been removed successfully.');
      },
      {
        confirmText: 'Remove Configuration',
        confirmClassName: 'bg-red-600 hover:bg-red-700',
      }
    );
  };

  const handleTestEmail = async () => {
    const configToUse = emailConfig || (newEmailConfig.apiKey ? newEmailConfig : null);
    if (!configToUse || (!configToUse.apiKey && !emailConfig)) {
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!testEmailRecipient || !emailRegex.test(testEmailRecipient.trim())) {
      setEmailConfigErrors((prev) => ({ ...prev, testEmail: 'Please enter a valid recipient email address.' }));
      return;
    }

    setIsTestingEmail(true);
    setEmailConfigErrors((prev) => {
      const next = { ...prev };
      delete next.testEmail;
      return next;
    });

    try {
      const isUnsaved = !emailConfig && Boolean(newEmailConfig.apiKey);
      const res = await sendTestEmail({
        recipientEmail: testEmailRecipient.trim(),
        apiKey: isUnsaved ? newEmailConfig.apiKey.trim() : null,
        fromName: isUnsaved ? newEmailConfig.fromName.trim() : null,
        fromEmail: isUnsaved ? newEmailConfig.fromEmail.trim() : null,
      });

      setIsTestingEmail(false);
      setShowTestEmailModal(false);
      if (emailConfig && res.last_tested) {
        setEmailConfig((prev) => prev ? { ...prev, lastTested: res.last_tested, last_tested: res.last_tested } : prev);
      }
      showSuccess(
        'Test Email Sent',
        res.message || `A test verification email was successfully delivered to ${testEmailRecipient} via Resend.`
      );
    } catch (err) {
      setIsTestingEmail(false);
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to dispatch test email through Resend.';
      setEmailConfigErrors((prev) => ({ ...prev, testEmail: errMsg }));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Interactive Hierarchical Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-gray-500">
        <button
          type="button"
          onClick={() => handleSelectGroup(GROUP_CLASSIFICATION)}
          className="hover:text-[#252578] hover:underline cursor-pointer font-medium transition-colors"
        >
          Ticket Configuration
        </button>
        <ChevronRight size={13} className="text-gray-400 shrink-0" />
        <button
          type="button"
          onClick={() => handleSelectGroup(currentGroup.id)}
          className={`hover:text-[#252578] hover:underline cursor-pointer font-medium transition-colors ${currentGroup.subTabs.length <= 1 ? 'text-gray-900 font-semibold cursor-default hover:no-underline' : ''
            }`}
        >
          {currentGroup.label}
        </button>
        {currentGroup.subTabs.length > 1 && (
          <>
            <ChevronRight size={13} className="text-gray-400 shrink-0" />
            <span className="text-gray-900 font-semibold cursor-default select-none" aria-current="page">
              {currentGroup.subTabs.find((s) => s.id === currentSubTab)?.label || currentSubTab}
            </span>
          </>
        )}
      </nav>

      <div>
        <h1 className="text-3xl font-bold text-[#252578]">Ticket Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure ticket classification, lifecycle state machines, service level agreements, and system policies.
        </p>
      </div>

      {/* Level 1: 5 Group Pills */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit flex-wrap shadow-xs">
        {GROUPS_CONFIG.map((group) => {
          const isActive = activeGroup === group.id;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => handleSelectGroup(group.id)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${isActive
                  ? 'bg-white text-[#252578] shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      {/* Level 2: Secondary Sub-Tab Strip (reusing Notifications sub-tab styling) */}
      {currentGroup.subTabs.length > 1 && (
        <div className="flex items-center justify-between border-b border-gray-200 overflow-x-auto">
          <div className="flex items-center gap-2 ml-3 min-w-max">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mr-2 select-none">
              <span>{currentGroup.label}</span>
              <ChevronRight size={13} className="text-gray-300" />
            </div>

            <nav className="flex gap-6 -mb-px" aria-label={`${currentGroup.label} Sub-tabs`}>
              {currentGroup.subTabs.map((sub) => {
                const isSubActive = currentSubTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => handleSelectSubTab(sub.id)}
                    className={`pb-3 pt-1 text-[13px] font-semibold border-b-2 transition-all cursor-pointer ${isSubActive
                        ? 'border-[#252578] text-[#252578]'
                        : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                      }`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {tab === TAB_WORKFLOW ? (
        <div className="flex flex-col gap-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Workflow Status Sequence</h2>
              <p className="text-sm text-gray-500 mt-0.5">Define priority levels and their default deadline targets</p>
            </div>
            <button onClick={handleAddWorkflow} className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg shrink-0">
              <Plus size={18} />
              Add Status
            </button>
          </div>

          {/* Stepper / Sequence Diagram */}
          <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
            <div className="relative">
              {/* Background connecting line */}
              <div className="absolute top-7 left-[calc(7%+28px)] right-[calc(7%+28px)] h-0.5 bg-gray-200" />
              <div className="relative flex justify-between">
                {workflowStatuses.sort((a, b) => a.order - b.order).map((status, idx) => (
                  <div key={status.id} className="flex flex-col items-center" style={{ flex: '1 1 0%' }}>
                    <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full font-semibold text-lg shadow-sm"
                      style={{ backgroundColor: status.bgColor, color: status.textColor }}>
                      {idx + 1}
                    </div>
                    <span className="mt-2.5 text-sm font-semibold" style={{ color: status.textColor }}>{status.name}</span>
                    <span className="mt-1 text-[11px] text-gray-500 text-center leading-tight px-1 max-w-[130px]">{status.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Status Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {workflowStatuses.sort((a, b) => a.order - b.order).map((status, idx) => (
              <div key={status.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex items-start gap-4 hover:shadow-md transition-all">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold text-sm"
                  style={{ backgroundColor: status.bgColor, color: status.textColor }}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">{status.name}</h4>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEditWorkflow(status)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" title="Edit">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDeleteWorkflow(status)} className="rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{status.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : tab === TAB_TRANSITIONS ? (
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900">Ticket Status Transition Rules</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>Changes are not yet saved — persistence coming soon</span>
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Configure valid next-status transitions and lifecycle guardrails for tickets.
              </p>
            </div>
            <button
              onClick={handleResetTransitions}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-[#252578] transition-all shrink-0 cursor-pointer shadow-xs"
            >
              <RotateCcw size={14} />
              Reset to Defaults
            </button>
          </div>

          {/* Status Selector & Summary Card */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left Column: Status Picker */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Select Source Status
                </label>
                <div className="relative">
                  <select
                    value={selectedTransitionStatus}
                    onChange={(e) => setSelectedTransitionStatus(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#252578] cursor-pointer appearance-none pr-10"
                  >
                    {TS093_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <ChevronRight size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 rotate-90 pointer-events-none" />
                </div>
                <p className="text-xs text-gray-400">
                  Select a status above to configure which states tickets can transition into.
                </p>
              </div>

              {/* Right Column: Status Information Card */}
              <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-gray-50/60 p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#252578] text-white">
                      <GitBranch size={16} />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{selectedTransitionStatus}</h3>
                      <span className="text-xs text-gray-500">Source status</span>
                    </div>
                  </div>

                  {/* Status Type Badge */}
                  {(() => {
                    const rule = transitionRules[selectedTransitionStatus];
                    if (!rule) return null;
                    if (rule.type === 'terminal') {
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 border border-red-200">
                          <Lock size={12} />
                          Terminal Status
                        </span>
                      );
                    }
                    if (rule.type === 'fixed') {
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
                          <Lock size={12} />
                          Automated / Non-Editable
                        </span>
                      );
                    }
                    if (rule.type === 'contextual') {
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
                          <Lock size={12} />
                          Contextual / Non-Editable
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 border border-green-200">
                        <CheckCircle2 size={12} />
                        Configurable Transitions ({rule.allowed.length} Allowed)
                      </span>
                    );
                  })()}
                </div>

                <p className="text-sm text-gray-600 leading-relaxed">
                  {transitionRules[selectedTransitionStatus]?.description}
                </p>

                {transitionRules[selectedTransitionStatus]?.caption && (
                  <div className="flex items-start gap-2 rounded-lg bg-white border border-gray-200 p-3 text-xs text-gray-700">
                    <Info size={16} className="text-[#252578] shrink-0 mt-0.5" />
                    <span>{transitionRules[selectedTransitionStatus]?.caption}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Next Allowed Transitions Section */}
            <div className="border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    Permitted Next Transitions
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {transitionRules[selectedTransitionStatus]?.type === 'editable'
                      ? 'Check or uncheck the statuses tickets are permitted to move to next.'
                      : 'Next transitions for this status are enforced by system rules.'}
                  </p>
                </div>
              </div>

              {/* Conditional Transition Rendering based on status type */}
              {(() => {
                const currentRule = transitionRules[selectedTransitionStatus];
                if (!currentRule) return null;

                if (currentRule.type === 'terminal') {
                  return (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-gray-600 mb-1">
                        <Lock size={22} />
                      </div>
                      <h5 className="text-base font-semibold text-gray-800">Terminal Status</h5>
                      <p className="text-sm text-gray-500 max-w-md">
                        {currentRule.caption || 'This is a terminal status. No further transitions are allowed.'}
                      </p>
                      <div className="mt-2 text-xs text-gray-400">
                        (Next-status list is empty and disabled)
                      </div>
                    </div>
                  );
                }

                if (currentRule.type === 'fixed') {
                  return (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 flex items-start gap-2.5">
                        <Lock size={16} className="text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">System-Enforced Automated Transition</p>
                          <p className="mt-0.5 text-blue-800 leading-relaxed">{currentRule.caption}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {currentRule.allowed.map((targetStatus) => (
                          <div
                            key={targetStatus}
                            className="flex items-center justify-between rounded-xl border border-blue-200 bg-white p-4 shadow-xs"
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={true}
                                disabled={true}
                                className="h-4 w-4 rounded border-gray-300 text-[#252578] opacity-70 cursor-not-allowed"
                              />
                              <div>
                                <span className="text-sm font-semibold text-gray-900">{targetStatus}</span>
                                <p className="text-xs text-blue-600 font-medium">Automatic target (read-only)</p>
                              </div>
                            </div>
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <ArrowRight size={14} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (currentRule.type === 'contextual') {
                  return (
                    <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-6 text-center flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-700 mb-1">
                        <RotateCcw size={22} />
                      </div>
                      <h5 className="text-base font-semibold text-purple-900">Contextual Resume Transition</h5>
                      <p className="text-sm text-purple-800 max-w-lg leading-relaxed">
                        {currentRule.caption}
                      </p>
                      <div className="mt-2 text-xs text-purple-600 font-semibold bg-white/80 px-3 py-1.5 rounded-lg border border-purple-200">
                        Resumes to preceding In Progress state (CS-owned or Employee-owned) upon hold release
                      </div>
                    </div>
                  );
                }

                // Editable statuses: Show full checkbox list of all other 9 statuses
                const otherStatuses = TS093_STATUSES.filter((s) => s !== selectedTransitionStatus);

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {otherStatuses.map((targetStatus) => {
                      const isChecked = currentRule.allowed.includes(targetStatus);
                      return (
                        <label
                          key={targetStatus}
                          className={`flex items-start gap-3.5 rounded-xl border p-4 transition-all cursor-pointer select-none ${isChecked
                              ? 'border-[#252578] bg-[#252578]/5 shadow-xs'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTransition(targetStatus)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#252578] focus:ring-[#252578] cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-sm font-semibold ${isChecked ? 'text-[#252578]' : 'text-gray-800'}`}>
                                {targetStatus}
                              </span>
                              {isChecked && (
                                <span className="inline-block rounded-full bg-[#252578] px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wider shrink-0">
                                  Allowed
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-1">
                              <span>{selectedTransitionStatus}</span>
                              <ArrowRight size={11} className="text-gray-400 shrink-0" />
                              <span className="font-medium text-gray-700 truncate">{targetStatus}</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : tab === TAB_FILES ? (
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900">File Upload & Security Limits</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>Changes are not yet saved — persistence coming soon</span>
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Configure system-wide file upload constraints and malware scanning policies across ticket attachments, messages, and knowledge base articles.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleResetFileConfig}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-[#252578] transition-all shrink-0 cursor-pointer shadow-xs"
              >
                <RotateCcw size={14} />
                Reset to Defaults
              </button>
              <button
                onClick={handleSaveFileConfig}
                className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-xs font-semibold text-white transition-all hover:shadow-lg shrink-0 cursor-pointer"
              >
                <Save size={14} />
                Save Settings
              </button>
            </div>
          </div>

          {/* Section 1: Upload Limits (Size & Count) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Max File Size */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <HardDrive size={16} className="text-[#252578]" />
                    Max File Size per Upload (MB)
                  </label>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Per File</span>
                </div>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  Maximum permitted file size for any single uploaded attachment or document.
                </p>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={fileConfig.maxFileSizeMB}
                    onChange={(e) => handleMaxFileSizeChange(e.target.value)}
                    placeholder="e.g. 15"
                    className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition-all ${fileConfigErrors.maxFileSizeMB
                        ? 'border-red-300 bg-red-50/50 text-red-900 focus:ring-2 focus:ring-red-400'
                        : 'border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#252578]'
                      }`}
                  />
                </div>
                {fileConfigErrors.maxFileSizeMB ? (
                  <p className="mt-2 text-xs font-medium text-red-600 flex items-center gap-1">
                    <AlertCircle size={13} /> {fileConfigErrors.maxFileSizeMB}
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-medium text-[#252578] flex items-center gap-1 min-h-[18px]">
                    <Clock size={12} /> {formatFileSize(fileConfig.maxFileSizeMB)}
                  </p>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                System default: 15 MB. Files exceeding this size will be rejected prior to transfer.
              </div>
            </div>

            {/* Max File Count */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <FileUp size={16} className="text-[#252578]" />
                    Max File Count per Upload
                  </label>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Per Batch</span>
                </div>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  Maximum number of files a user is allowed to upload in a single ticket or action.
                </p>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={fileConfig.maxFileCount}
                    onChange={(e) => handleMaxFileCountChange(e.target.value)}
                    placeholder="e.g. 5"
                    className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition-all ${fileConfigErrors.maxFileCount
                        ? 'border-red-300 bg-red-50/50 text-red-900 focus:ring-2 focus:ring-red-400'
                        : 'border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#252578]'
                      }`}
                  />
                </div>
                {fileConfigErrors.maxFileCount ? (
                  <p className="mt-2 text-xs font-medium text-red-600 flex items-center gap-1">
                    <AlertCircle size={13} /> {fileConfigErrors.maxFileCount}
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-medium text-[#252578] flex items-center gap-1 min-h-[18px]">
                    <CheckCircle2 size={12} /> {formatFileCount(fileConfig.maxFileCount)}
                  </p>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                System default: 5 files. Users cannot select more than this count in one file dialog.
              </div>
            </div>
          </div>

          {/* Section 2: Allowed File Types (Chip / Pill Multi-Select Grid) */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-[#252578]" />
                  Allowed File Types
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select which file extensions are permitted across ticket attachments, messages, and knowledge base documents.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-[#252578]/5 px-3 py-1 text-xs font-semibold text-[#252578] border border-[#252578]/20">
                  {fileConfig.allowedFileTypes.length} of {TS098_AVAILABLE_EXTENSIONS.length} Types Allowed
                </span>
              </div>
            </div>

            {fileConfigErrors.allowedFileTypes && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-red-600" />
                <span>{fileConfigErrors.allowedFileTypes}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 pt-2">
              {TS098_AVAILABLE_EXTENSIONS.map((item) => {
                const isChecked = fileConfig.allowedFileTypes.includes(item.ext);
                return (
                  <button
                    key={item.ext}
                    type="button"
                    onClick={() => handleToggleFileType(item.ext)}
                    className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all cursor-pointer select-none ${isChecked
                        ? 'border-[#252578] bg-[#252578]/5 shadow-xs ring-1 ring-[#252578]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 opacity-75'
                      }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl font-semibold text-xs transition-colors shrink-0 ${isChecked ? 'bg-[#252578] text-white' : 'bg-gray-100 text-gray-500'
                          }`}
                      >
                        {item.ext}
                      </div>
                      <div className="truncate">
                        <p className={`text-sm font-semibold truncate ${isChecked ? 'text-[#252578]' : 'text-gray-700'}`}>
                          {item.label}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                    </div>

                    <div className="ml-3 shrink-0">
                      {isChecked ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#252578] text-white">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      ) : (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 text-xs text-gray-400 flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-50">
              <span>Extensions correspond to MIME validation in TicketCreation, EmployeeTicketUpdate, and AIKnowledgeBase.</span>
              <span className="font-semibold text-gray-500">At least 1 format must remain enabled.</span>
            </div>
          </div>

          {/* Section 3: Malware & Antivirus Scanning */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Malware & Antivirus Scanning</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ClamAV antivirus daemon inspection for all inbound uploads before permanent storage.
                  </p>
                </div>
              </div>

              {/* Inline Architecture Notice Badge */}
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 border border-amber-200/80 w-fit">
                <AlertCircle size={13} className="text-amber-600 shrink-0" />
                <span>Pending architecture approval — not yet functional</span>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-4 rounded-xl bg-gray-50/60 border border-gray-100">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-gray-900">ClamAV In-Stream Daemon Inspection</h4>
                  <div className="relative group inline-flex items-center">
                    <Info size={15} className="text-gray-400 hover:text-[#252578] cursor-pointer" />
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-72 rounded-xl bg-gray-900 p-3 text-center text-xs text-white shadow-xl group-hover:block z-50 leading-relaxed">
                      Disabling malware scanning allows files to bypass virus checks before being stored. This is not recommended.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-2xl">
                  Inspects all incoming file payloads using the containerized ClamAV daemon (`clamav:3310`) via `zINSTREAM`. Infected or unrecognized macro binaries are rejected with HTTP 422 before reaching the storage volume.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {fileConfig.malwareScanningEnabled ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 border border-green-200">
                    <ShieldCheck size={13} />
                    Active Scanning
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 border border-red-200">
                    <ShieldAlert size={13} />
                    Scanning Bypassed
                  </span>
                )}

                {/* iOS-style slider switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={fileConfig.malwareScanningEnabled}
                  onClick={handleToggleMalwareScanning}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer ${fileConfig.malwareScanningEnabled ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  title={fileConfig.malwareScanningEnabled ? 'Click to disable scanning' : 'Click to enable scanning'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${fileConfig.malwareScanningEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : tab === TAB_WINDOWS ? (
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900">Reopen & Auto-Close Windows</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>Changes are not yet saved — persistence coming soon</span>
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Configure time windows and operational policies for customer ticket reopening and automated closure of resolved tickets.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleResetWindowConfig}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-[#252578] transition-all shrink-0 cursor-pointer shadow-xs"
              >
                <RotateCcw size={14} />
                Reset to Defaults
              </button>
              <button
                onClick={handleSaveWindowConfig}
                className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-xs font-semibold text-white transition-all hover:shadow-lg shrink-0 cursor-pointer"
              >
                <Save size={14} />
                Save Settings
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Feature 1: Customer Ticket Reopen Window */}
            <div className={`rounded-2xl border bg-white p-6 shadow-sm flex flex-col justify-between transition-all ${windowConfig.reopenEnabled ? 'border-gray-100' : 'border-gray-200 bg-gray-50/40'
              }`}>
              <div>
                {/* Header with Switch */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">Customer Reopen Window</h3>
                      <div className="relative group inline-flex items-center">
                        <Info size={15} className="text-gray-400 hover:text-[#252578] cursor-pointer" />
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-72 rounded-xl bg-gray-900 p-3 text-center text-xs text-white shadow-xl group-hover:block z-50 leading-relaxed">
                          Disabling Reopen means all closed tickets are final and cannot be reopened by the customer.
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Allow customers to reopen recently closed tickets if their issue remains unresolved.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {windowConfig.reopenEnabled ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 border border-green-200">
                        <CheckCircle2 size={12} />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 border border-gray-200">
                        <Lock size={12} />
                        Disabled
                      </span>
                    )}

                    {/* iOS-style slider switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={windowConfig.reopenEnabled}
                      onClick={handleToggleReopen}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer ${windowConfig.reopenEnabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      title={windowConfig.reopenEnabled ? 'Click to disable reopen' : 'Click to enable reopen'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${windowConfig.reopenEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Duration Input & Caption */}
                <div className="mt-5">
                  {windowConfig.reopenEnabled ? (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                        Reopen Window Duration (Days)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={windowConfig.reopenWindowDays}
                          onChange={(e) => handleReopenDaysChange(e.target.value)}
                          placeholder="e.g. 2"
                          className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition-all ${windowConfigErrors.reopenWindowDays
                              ? 'border-red-300 bg-red-50/50 text-red-900 focus:ring-2 focus:ring-red-400'
                              : 'border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#252578]'
                            }`}
                        />
                      </div>

                      {windowConfigErrors.reopenWindowDays ? (
                        <p className="mt-2 text-xs font-medium text-red-600 flex items-center gap-1">
                          <AlertCircle size={13} /> {windowConfigErrors.reopenWindowDays}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs font-medium text-[#252578] flex items-center gap-1 min-h-[18px]">
                          <Clock size={12} /> {formatWindowDays(windowConfig.reopenWindowDays, 'reopen')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500 flex items-start gap-2.5">
                      <Lock size={15} className="text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-gray-700">Reopen Disabled</p>
                        <p className="mt-0.5 text-gray-500 leading-relaxed">
                          All closed tickets are final. Customers cannot reopen tickets after closing; a new ticket must be submitted.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                System default: 2 days (48h). Once this window elapses, the reopen button in customer views is disabled.
              </div>
            </div>

            {/* Feature 2: Resolved Ticket Auto-Close Window */}
            <div className={`rounded-2xl border bg-white p-6 shadow-sm flex flex-col justify-between transition-all ${windowConfig.autoCloseEnabled ? 'border-gray-100' : 'border-gray-200 bg-gray-50/40'
              }`}>
              <div>
                {/* Header with Switch */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">Auto-Close Resolved Tickets</h3>
                      <div className="relative group inline-flex items-center">
                        <Info size={15} className="text-gray-400 hover:text-[#252578] cursor-pointer" />
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-72 rounded-xl bg-gray-900 p-3 text-center text-xs text-white shadow-xl group-hover:block z-50 leading-relaxed">
                          Disabling Auto-Close means Resolved tickets stay open indefinitely until the customer manually closes them.
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Automatically transition Resolved tickets to Closed after a configured period of inactivity.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {windowConfig.autoCloseEnabled ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
                        <Clock size={12} />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 border border-gray-200">
                        <AlertCircle size={12} />
                        Disabled
                      </span>
                    )}

                    {/* iOS-style slider switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={windowConfig.autoCloseEnabled}
                      onClick={handleToggleAutoClose}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer ${windowConfig.autoCloseEnabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      title={windowConfig.autoCloseEnabled ? 'Click to disable auto-close' : 'Click to enable auto-close'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${windowConfig.autoCloseEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Duration Input & Caption */}
                <div className="mt-5">
                  {windowConfig.autoCloseEnabled ? (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                        Auto-Close Window Duration (Days)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={windowConfig.autoCloseWindowDays}
                          onChange={(e) => handleAutoCloseDaysChange(e.target.value)}
                          placeholder="e.g. 2"
                          className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition-all ${windowConfigErrors.autoCloseWindowDays
                              ? 'border-red-300 bg-red-50/50 text-red-900 focus:ring-2 focus:ring-red-400'
                              : 'border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#252578]'
                            }`}
                        />
                      </div>

                      {windowConfigErrors.autoCloseWindowDays ? (
                        <p className="mt-2 text-xs font-medium text-red-600 flex items-center gap-1">
                          <AlertCircle size={13} /> {windowConfigErrors.autoCloseWindowDays}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs font-medium text-[#252578] flex items-center gap-1 min-h-[18px]">
                          <CheckCircle2 size={12} /> {formatWindowDays(windowConfig.autoCloseWindowDays, 'autoclose')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500 flex items-start gap-2.5">
                      <AlertCircle size={15} className="text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-gray-700">Auto-Close Disabled</p>
                        <p className="mt-0.5 text-gray-500 leading-relaxed">
                          Resolved tickets will remain in Resolved status indefinitely until explicitly confirmed or closed by the customer or staff.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                System default: 2 days (48h). Processed by the scheduled backend worker (`tickets:auto-close-internal`).
              </div>
            </div>
          </div>
        </div>
      ) : tab === TAB_FEEDBACK ? (
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900">Feedback Form Configuration</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>Changes are not yet saved — persistence coming soon. Toggle state syncs locally via localStorage for demo.</span>
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Configure, scope, and order customer satisfaction survey questions across service categories.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetFeedback}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-[#252578] transition-all shrink-0 cursor-pointer shadow-xs"
            >
              <RotateCcw size={14} />
              Reset Questions to Defaults
            </button>
          </div>

          {/* TS101 Feedback Form Master Toggle Card */}
          <div className={`rounded-2xl border p-5 sm:p-6 shadow-xs transition-all ${feedbackMasterEnabled ? 'border-gray-200 bg-white' : 'border-amber-200 bg-amber-50/20'
            }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-bold text-gray-900">Feedback Form</h3>
                  <div className="relative group inline-flex items-center">
                    <button
                      type="button"
                      aria-label="Feedback Form master toggle information"
                      className="text-gray-400 hover:text-[#252578] cursor-help p-0.5 rounded-sm transition-colors"
                    >
                      <Info size={15} />
                    </button>
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-80 rounded-xl bg-gray-900 p-3 text-center text-xs text-white shadow-xl group-hover:block z-50 leading-relaxed animate-in fade-in zoom-in-95 duration-150">
                      Disabling this stops both the feedback prompt shown to customers and the feedback-related analytics (like CSAT scores) that depend on it, since the two are tied together.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                    </div>
                  </div>
                  {feedbackMasterEnabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 border border-green-200">
                      <CheckCircle2 size={12} />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 border border-gray-200">
                      <Lock size={12} />
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Existing feedback and CSAT data already collected will remain visible in dashboards and reports.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* iOS-style slider switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={feedbackMasterEnabled}
                  onClick={handleToggleFeedbackMaster}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer ${feedbackMasterEnabled ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  title={feedbackMasterEnabled ? 'Click to disable Feedback Form' : 'Click to enable Feedback Form'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${feedbackMasterEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic Live State Notice (TS101) */}
          <div className={`rounded-2xl border p-4 sm:p-5 flex items-start gap-3.5 shadow-xs transition-colors ${feedbackMasterEnabled ? 'border-blue-100 bg-blue-50/70' : 'border-amber-200 bg-amber-50/80'
            }`}>
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 mt-0.5 ${feedbackMasterEnabled ? 'bg-blue-600/10 text-blue-600' : 'bg-amber-600/10 text-amber-700'
              }`}>
              <Info size={18} />
            </div>
            <div className={`text-xs sm:text-sm ${feedbackMasterEnabled ? 'text-blue-900' : 'text-amber-900'
              }`}>
              <span className="font-semibold">Feature Notice: </span>
              {feedbackMasterEnabled ? (
                <span>
                  Feedback Form is currently enabled system-wide — customers will be prompted for feedback on closed external tickets.
                </span>
              ) : (
                <span>
                  Feedback Form is currently disabled system-wide — this configuration remains editable, but no form is shown to customers until it's re-enabled.
                </span>
              )}
            </div>
          </div>

          {/* Category Tabs & Tooltip Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200/80 pb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 rounded-xl bg-gray-100 p-1 shadow-xs">
                {FEEDBACK_CATEGORIES.map((cat) => {
                  const isCatActive = activeFeedbackCategory === cat;
                  const catList = feedbackQuestions[cat] || [];
                  const enabledCount = catList.filter((q) => q.isEnabled).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleSelectFeedbackCategory(cat)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${isCatActive
                          ? 'bg-white text-[#252578] shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                        }`}
                    >
                      <span>{cat}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold transition-colors ${isCatActive
                            ? 'bg-[#252578]/10 text-[#252578]'
                            : 'bg-gray-200/70 text-gray-500'
                          }`}
                      >
                        {enabledCount}/{catList.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Scoping Information Icon with Tooltip */}
              <div className="relative group inline-flex items-center">
                <button
                  type="button"
                  aria-label="Question scoping information"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-[#252578] hover:bg-gray-100 transition-colors cursor-help"
                  title="Questions are scoped per category — changes to IT's questions don't affect Service or Others."
                >
                  <Info size={16} />
                </button>
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-72 rounded-xl bg-gray-900 p-3 text-center text-xs text-white shadow-xl group-hover:block z-50 leading-relaxed animate-in fade-in zoom-in-95 duration-150">
                  Questions are scoped per category — changes to IT's questions don't affect Service or Others.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>

              {/* Inactive badge when master toggle is OFF */}
              {!feedbackMasterEnabled && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-300 shadow-2xs">
                  <Lock size={12} />
                  Forms currently hidden from customers
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleAddFeedbackQuestion}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#252578] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-md cursor-pointer shrink-0"
            >
              <Plus size={16} />
              Add Question
            </button>
          </div>

          {/* Inactive Banner when Master Toggle is OFF */}
          {!feedbackMasterEnabled && (
            <div className="rounded-xl border border-amber-200/90 bg-amber-50/70 p-3.5 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-200/80 px-2 py-0.5 font-bold text-amber-900 shrink-0">
                  <Lock size={12} /> Inactive for Customers
                </span>
                <span>
                  The Feedback Form master toggle is currently OFF. You can still create, edit, reorder, or toggle questions below, but customers will not see any feedback prompts until the feature is re-enabled.
                </span>
              </div>
            </div>
          )}

          {/* Inline Error Message */}
          {feedbackInlineError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-800 flex items-center justify-between gap-3 animate-in fade-in duration-150 shadow-xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={16} className="text-red-600 shrink-0" />
                <span className="font-semibold">{feedbackInlineError}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackInlineError('')}
                className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 hover:bg-red-100 rounded-lg cursor-pointer transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Questions Cards List */}
          {(!feedbackQuestions[activeFeedbackCategory] || feedbackQuestions[activeFeedbackCategory].length === 0) ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center shadow-xs">
              <p className="text-sm font-semibold text-gray-700">No questions configured for {activeFeedbackCategory}.</p>
              <p className="text-xs text-gray-400 mt-1">Get started by creating your first survey question.</p>
              <button
                type="button"
                onClick={handleAddFeedbackQuestion}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#252578] px-4 py-2 text-xs font-semibold text-white hover:shadow-md transition-all cursor-pointer"
              >
                <Plus size={14} /> Add Question
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {feedbackQuestions[activeFeedbackCategory].map((q, idx) => {
                const currentList = feedbackQuestions[activeFeedbackCategory];
                const typeBadgeClass =
                  q.responseType === 'Star Rating'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : q.responseType === 'Multiple Choice'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                return (
                  <div
                    key={q.id}
                    className={`rounded-2xl border bg-white p-5 transition-all shadow-xs ${q.isEnabled
                        ? 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        : 'border-gray-100 bg-gray-50/60 opacity-65'
                      }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      {/* Left: Order index, badge & text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="flex h-6 min-w-6 px-1.5 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-gray-600">
                            #{idx + 1}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${typeBadgeClass}`}>
                            {q.responseType}
                          </span>
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${q.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                              }`}
                          >
                            {q.isEnabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <h4 className="mt-3 text-sm sm:text-base font-semibold text-gray-900 leading-snug break-words">
                          {q.text}
                        </h4>
                      </div>

                      {/* Right: Controls & actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t border-gray-100 sm:border-t-0">
                        {/* Up / Down Reorder Arrows */}
                        <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50/50 p-0.5">
                          <button
                            type="button"
                            onClick={() => handleMoveFeedbackQuestion(activeFeedbackCategory, idx, 'up')}
                            disabled={idx === 0}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#252578] hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500 cursor-pointer transition-colors"
                            title="Move Question Up"
                            aria-label="Move question up"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <div className="h-4 w-px bg-gray-200" />
                          <button
                            type="button"
                            onClick={() => handleMoveFeedbackQuestion(activeFeedbackCategory, idx, 'down')}
                            disabled={idx === currentList.length - 1}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#252578] hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500 cursor-pointer transition-colors"
                            title="Move Question Down"
                            aria-label="Move question down"
                          >
                            <ChevronDown size={16} />
                          </button>
                        </div>

                        {/* iOS-slider switch toggle */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={q.isEnabled}
                            onClick={() => handleToggleFeedbackQuestion(activeFeedbackCategory, q.id)}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer ${q.isEnabled ? 'bg-green-500' : 'bg-gray-300'
                              }`}
                            title={q.isEnabled ? 'Click to disable question' : 'Click to enable question'}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${q.isEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                          </button>
                        </div>

                        {/* Edit & Remove Action Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditFeedbackQuestion(q)}
                            className="rounded-lg p-2 text-gray-400 hover:text-[#252578] hover:bg-gray-100 transition-colors cursor-pointer"
                            title="Edit Question"
                            aria-label="Edit question"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFeedbackQuestion(activeFeedbackCategory, q)}
                            className="rounded-lg p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Remove Question"
                            aria-label="Remove question"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TS104 Create / Edit Question Modal */}
          {editingQuestion !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-start justify-between border-b border-gray-150 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {editingQuestion.id ? 'Edit Question' : 'Add Question'}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Configuring survey question for category: <span className="font-semibold text-[#252578]">{editingQuestion.category || activeFeedbackCategory}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingQuestion(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  {/* Question Text Input */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                      Question Text <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={editingQuestion.text}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
                      placeholder="e.g. How would you rate the technician's technical knowledge?"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-3 text-sm text-gray-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-[#252578]"
                    />
                  </div>

                  {/* Response Type Dropdown */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                      Response Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editingQuestion.responseType}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, responseType: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-3 text-sm font-semibold text-gray-900 outline-none transition-all focus:bg-white focus:ring-2 focus:ring-[#252578]"
                    >
                      {TS104_RESPONSE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-gray-400">
                      {editingQuestion.responseType === 'Star Rating' && 'Presents an interactive 1–5 star rating scale to the customer.'}
                      {editingQuestion.responseType === 'Multiple Choice' && 'Offers selectable pre-configured options or Yes/No answer choices.'}
                      {editingQuestion.responseType === 'Free Text' && 'Provides an open-ended multiline text area for written suggestions.'}
                    </p>
                  </div>
                </div>

                {/* Modal Actions: Cancel & Save immediately */}
                <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingQuestion(null)}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFeedbackQuestion}
                    disabled={!editingQuestion.text.trim()}
                    className="rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50 cursor-pointer"
                  >
                    Save Question
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : activeGroup === GROUP_NOTIFICATIONS ? (
        <div className="flex flex-col gap-6">
          {currentSubTab === NOTIF_SUBTAB_RECIPIENTS ? (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Notification Recipient Routing</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Choose who receives each notification event across ticket actors, roles, and departments.
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800 flex items-start gap-3">
                <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Changes are local preview only and are not yet persisted. System Alerts are excluded because they always route to Super Admin.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {TS099_ALERT_TYPES.map((alert) => {
                  const selectedRecipients = routingConfig[alert.key] || [];
                  const alertError = routingErrors[alert.key];
                  const isExpanded = expandedRecipientAlert === alert.key;
                  const panelId = `recipient-panel-${alert.key}`;

                  return (
                    <div key={alert.key} className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition-colors ${
                      isExpanded ? 'border-[#252578]/25' : 'border-gray-100'
                    }`}>
                      <button
                        type="button"
                        onClick={() => setExpandedRecipientAlert((current) => current === alert.key ? null : alert.key)}
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left hover:bg-gray-50/70 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#252578]/10 text-[#252578] shrink-0">
                            <Bell size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h3 className="text-sm sm:text-base font-bold text-gray-900">{alert.title}</h3>
                              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${alert.badgeColor}`}>
                                {alert.badge}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 truncate">{alert.description}</p>
                            {alertError && <p className="text-xs font-semibold text-red-600 mt-1">{alertError}</p>}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="inline-flex items-center rounded-full bg-[#252578]/5 px-2.5 sm:px-3 py-1 text-xs font-bold text-[#252578] border border-[#252578]/20">
                            <span className="sm:hidden">{selectedRecipients.length}</span>
                            <span className="hidden sm:inline">{selectedRecipients.length} selected</span>
                          </span>
                          <ChevronDown
                            size={19}
                            aria-hidden="true"
                            className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-[#252578]' : ''}`}
                          />
                        </div>
                      </button>

                      {isExpanded && (
                        <div id={panelId} className="border-t border-gray-100 p-4 sm:p-6 flex flex-col gap-5">
                          <div className="sm:hidden">
                            <span className="inline-flex items-center rounded-full bg-[#252578]/5 px-3 py-1 text-xs font-bold text-[#252578] border border-[#252578]/20">
                              {selectedRecipients.length} Recipient{selectedRecipients.length === 1 ? '' : 's'} Selected
                            </span>
                          </div>

                          {alertError && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                              <AlertCircle size={15} className="shrink-0 text-red-600" />
                              <span className="font-semibold">{alertError}</span>
                            </div>
                          )}

                          <div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 mb-2.5">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">Contextual Recipients</h4>
                                <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                                  Dynamic Actors
                                </span>
                              </div>
                              <span className="text-[11px] text-gray-400">Resolves dynamically at runtime per ticket</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {ts099RecipientOptions.contextual.map((item) => {
                                const isChecked = selectedRecipients.includes(item.id);
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleToggleRecipient(alert.key, item.id)}
                                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer select-none ${
                                      isChecked
                                        ? 'border-[#252578] bg-[#252578]/5 shadow-xs ring-1 ring-[#252578]'
                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 opacity-75'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs transition-colors shrink-0 ${
                                        isChecked ? 'bg-[#252578] text-white' : 'bg-gray-100 text-gray-500'
                                      }`}>
                                        <UserCheck size={16} />
                                      </div>
                                      <div className="truncate">
                                        <div className="flex items-center gap-1.5">
                                          <p className={`text-sm font-bold truncate ${isChecked ? 'text-[#252578]' : 'text-gray-800'}`}>{item.label}</p>
                                          <span className="rounded bg-purple-100 px-1.5 py-0.2 text-[9px] font-bold text-purple-700 border border-purple-200 shrink-0">
                                            Contextual
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.desc}</p>
                                      </div>
                                    </div>
                                    <div className="ml-3 shrink-0">
                                      {isChecked ? (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#252578] text-white">
                                          <Check size={12} strokeWidth={3} />
                                        </span>
                                      ) : (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white" />
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="border-t border-gray-100" />

                          <div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 mb-2.5">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">Static Roles & Departments</h4>
                                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                                  Fixed Groups
                                </span>
                              </div>
                              <span className="text-[11px] text-gray-400">Notifies all active staff members in the selected group</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {ts099RecipientOptions.staticGroup.map((item) => {
                                const isChecked = selectedRecipients.includes(item.id);
                                const isDept = item.type === 'department';
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleToggleRecipient(alert.key, item.id)}
                                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer select-none ${
                                      isChecked
                                        ? 'border-[#252578] bg-[#252578]/5 shadow-xs ring-1 ring-[#252578]'
                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 opacity-75'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs transition-colors shrink-0 ${
                                        isChecked ? 'bg-[#252578] text-white' : 'bg-gray-100 text-gray-500'
                                      }`}>
                                        {isDept ? <Building2 size={16} /> : <Users size={16} />}
                                      </div>
                                      <div className="truncate">
                                        <div className="flex items-center gap-1.5">
                                          <p className={`text-sm font-bold truncate ${isChecked ? 'text-[#252578]' : 'text-gray-800'}`}>{item.label}</p>
                                          <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold shrink-0 border ${
                                            isDept ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                                          }`}>
                                            {item.badge}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.desc}</p>
                                      </div>
                                    </div>
                                    <div className="ml-3 shrink-0">
                                      {isChecked ? (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#252578] text-white">
                                          <Check size={12} strokeWidth={3} />
                                        </span>
                                      ) : (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white" />
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                            {alert.defaultSummary}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                <button
                  onClick={handleResetRoutingConfig}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-[#252578] transition-all cursor-pointer shadow-xs"
                >
                  <RotateCcw size={14} />
                  Reset to Defaults
                </button>
                <button
                  onClick={handleSaveRoutingConfig}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-xs font-semibold text-white transition-all hover:shadow-lg cursor-pointer"
                >
                  <Save size={14} />
                  Save Recipients
                </button>
              </div>
            </div>
          ) : currentSubTab === NOTIF_SUBTAB_CHANNELS ? (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Notification Channel Configuration</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Choose whether each system-generated event is delivered by email, in-app notification, or both.
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800 flex items-start gap-3">
                <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Changes are local preview only and are not yet persisted. This tab controls delivery channels; recipient routing remains in Recipients.
                </p>
              </div>

              <div className="flex flex-col gap-5">
                {TS103_ALERT_TYPES.map((alert) => {
                  const selectedChannel = channelConfig[alert.key] || alert.defaultChannel;
                  const alertError = channelErrors[alert.key];

                  return (
                    <div key={alert.key} className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 shadow-sm flex flex-col gap-5">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                        <div className="flex items-start gap-3.5">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#252578]/10 text-[#252578] shrink-0">
                            {alert.key === 'reassignment' ? <Mail size={20} /> : <Bell size={20} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h3 className="text-base font-semibold text-gray-900">{alert.title}</h3>
                              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold border ${alert.badgeColor}`}>
                                {alert.badge}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{alert.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center shrink-0 overflow-x-auto">
                          <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200 min-w-max">
                            {TS103_CHANNEL_OPTIONS.map((opt) => {
                              const isActive = selectedChannel === opt.id;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => handleChangeChannel(alert.key, opt.id)}
                                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none flex items-center gap-1.5 ${
                                    isActive ? 'bg-[#252578] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                                  }`}
                                >
                                  {opt.id === 'email' && <Mail size={13} />}
                                  {opt.id === 'in_app' && <Bell size={13} />}
                                  {opt.id === 'both' && <Layers size={13} />}
                                  <span>{opt.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {alert.isSystemAlert && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
                          <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                          <span className="font-medium leading-relaxed">
                            System Alert always goes to Super Admin only, regardless of the channel chosen here.
                          </span>
                        </div>
                      )}

                      {alertError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
                          <AlertCircle size={15} className="shrink-0 text-red-600" />
                          <span className="font-semibold">{alertError}</span>
                        </div>
                      )}

                      <div className="pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                        Default: {TS103_CHANNEL_OPTIONS.find((o) => o.id === alert.defaultChannel)?.label || alert.defaultChannel}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                <button
                  onClick={handleResetChannelConfig}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-[#252578] transition-all cursor-pointer shadow-xs"
                >
                  <RotateCcw size={14} />
                  Reset to Defaults
                </button>
                <button
                  onClick={handleSaveChannelConfig}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-xs font-semibold text-white transition-all hover:shadow-lg cursor-pointer"
                >
                  <Save size={14} />
                  Save Channels
                </button>
              </div>
            </div>
          ) : currentSubTab === NOTIF_SUBTAB_EMAIL_DELIVERY ? (
            <div className="flex flex-col gap-6">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-bold text-gray-900">Email Configuration</h2>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
                    emailConfig?.isConfigured 
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700' 
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${emailConfig?.isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    {emailConfig?.isConfigured ? 'Connected & Active' : 'Not Configured'}
                  </span>
                  {emailConfig?.lastTested && (
                    <span className="text-xs text-gray-400">
                      Last tested: {emailConfig.lastTested}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Configure Resend transactional email delivery provider, API credentials, and default sender identity for ticket alerts.
                </p>
              </div>

              {!emailConfig || !emailConfig.isConfigured ? (
                /* Unconfigured state */
                !isAddingEmailConfig ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 sm:p-14 flex flex-col items-center justify-center text-center shadow-xs">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#252578]/10 text-[#252578] mb-4">
                      <Mail size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">No Email Configuration</h3>
                    <p className="text-sm text-gray-500 max-w-md mb-6">
                      No transactional email delivery gateway is configured yet. Add your Resend account credentials to enable automated ticket alerts, status updates, and notifications.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingEmailConfig(true);
                        setNewEmailConfigErrors({});
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#252578] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#1a1a5e] hover:shadow-lg cursor-pointer"
                    >
                      <Plus size={18} />
                      Add Email Configuration
                    </button>
                  </div>
                ) : (
                  /* Add Email Configuration Form */
                  <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-gray-50/50 via-white to-gray-50/30">
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#252578]/10 text-[#252578] shrink-0">
                          <Mail size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Transactional Gateway</p>
                          <h3 className="text-lg font-bold text-gray-900">Add Resend Email Configuration</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#252578]/15 bg-[#252578]/5 px-3 py-1 text-xs font-bold text-[#252578]">
                          <Key size={13} />
                          Resend API v1
                        </span>
                      </div>
                    </div>

                    <div className="p-5 sm:p-8 flex flex-col gap-6">
                      {/* Provider Field (Fixed to Resend) */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-800 flex items-center justify-between">
                          <span>Provider</span>
                          <span className="text-xs font-normal text-gray-400">Dedicated delivery engine</span>
                        </label>
                        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm font-semibold text-gray-800">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                            <span>Resend</span>
                            <span className="text-xs font-normal text-gray-500">(Modern Developer-First Email API)</span>
                          </div>
                          <span className="text-xs font-medium text-gray-400 bg-gray-200/60 px-2 py-0.5 rounded-md">Fixed</span>
                        </div>
                      </div>

                      {/* API Key Field */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-800 flex items-center justify-between">
                          <span>API Key <span className="text-red-500">*</span></span>
                          <span className="text-xs font-normal text-gray-400">Secret key from Resend API dashboard</span>
                        </label>
                        <div className="relative flex items-center">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                            <Key size={16} />
                          </div>
                          <input
                            type={showNewApiKey ? 'text' : 'password'}
                            value={newEmailConfig.apiKey}
                            onChange={(e) => {
                              setNewEmailConfig({ ...newEmailConfig, apiKey: e.target.value });
                              if (newEmailConfigErrors.apiKey) {
                                setNewEmailConfigErrors((prev) => {
                                  const n = { ...prev };
                                  delete n.apiKey;
                                  return n;
                                });
                              }
                            }}
                            placeholder="re_••••••••••••••••••••••••"
                            className={`w-full rounded-xl border pl-10 pr-11 py-3 text-sm font-mono outline-none transition-all ${
                              newEmailConfigErrors.apiKey
                                ? 'border-red-300 bg-red-50/30 text-red-900 focus:ring-2 focus:ring-red-200'
                                : 'border-gray-200 bg-gray-50/50 text-gray-900 focus:border-[#252578] focus:bg-white focus:ring-2 focus:ring-[#252578]/10'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewApiKey(!showNewApiKey)}
                            aria-label={showNewApiKey ? 'Hide API key' : 'Show API key'}
                            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                          >
                            {showNewApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        {newEmailConfigErrors.apiKey ? (
                          <p className="text-xs font-medium text-red-600 mt-0.5">{newEmailConfigErrors.apiKey}</p>
                        ) : (
                          <p className="text-xs text-amber-600 font-medium mt-0.5">⚠️ Once you save, you cannot see the API key again. It will be permanently masked.</p>
                        )}
                      </div>

                      {/* From Name & From Email Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* From Name */}
                        <div className="flex flex-col gap-2">
                          <label className="text-sm font-bold text-gray-800 flex items-center justify-between">
                            <span>From Name <span className="text-red-500">*</span></span>
                            <span className="text-xs font-normal text-gray-400">Sender display name</span>
                          </label>
                          <input
                            type="text"
                            value={newEmailConfig.fromName}
                            onChange={(e) => {
                              setNewEmailConfig({ ...newEmailConfig, fromName: e.target.value });
                              if (newEmailConfigErrors.fromName) {
                                setNewEmailConfigErrors((prev) => {
                                  const n = { ...prev };
                                  delete n.fromName;
                                  return n;
                                });
                              }
                            }}
                            placeholder="e.g. SBSI Support"
                            className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all ${
                              newEmailConfigErrors.fromName
                                ? 'border-red-300 bg-red-50/30 text-red-900 focus:ring-2 focus:ring-red-200'
                                : 'border-gray-200 bg-gray-50/50 text-gray-900 focus:border-[#252578] focus:bg-white focus:ring-2 focus:ring-[#252578]/10'
                            }`}
                          />
                          {newEmailConfigErrors.fromName ? (
                            <p className="text-xs font-medium text-red-600 mt-0.5">{newEmailConfigErrors.fromName}</p>
                          ) : (
                            <p className="text-xs text-gray-400">Visible to customers and employees in their email client headers.</p>
                          )}
                        </div>

                        {/* From Email */}
                        <div className="flex flex-col gap-2">
                          <label className="text-sm font-bold text-gray-800 flex items-center justify-between">
                            <span>From Email <span className="text-red-500">*</span></span>
                            <span className="text-xs font-normal text-gray-400">Verified domain address</span>
                          </label>
                          <input
                            type="email"
                            value={newEmailConfig.fromEmail}
                            onChange={(e) => {
                              setNewEmailConfig({ ...newEmailConfig, fromEmail: e.target.value });
                              if (newEmailConfigErrors.fromEmail) {
                                setNewEmailConfigErrors((prev) => {
                                  const n = { ...prev };
                                  delete n.fromEmail;
                                  return n;
                                });
                              }
                            }}
                            placeholder="support@sbs-med.com"
                            className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all ${
                              newEmailConfigErrors.fromEmail
                                ? 'border-red-300 bg-red-50/30 text-red-900 focus:ring-2 focus:ring-red-200'
                                : 'border-gray-200 bg-gray-50/50 text-gray-900 focus:border-[#252578] focus:bg-white focus:ring-2 focus:ring-[#252578]/10'
                            }`}
                          />
                          {newEmailConfigErrors.fromEmail ? (
                            <p className="text-xs font-medium text-red-600 mt-0.5">{newEmailConfigErrors.fromEmail}</p>
                          ) : (
                            <p className="text-xs text-gray-400">Must be a verified sending domain or email configured in your Resend account.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Form Action Footer */}
                    <div className="border-t border-gray-100 bg-gray-50/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                        <span>Credentials validated and protected by client-side encryption.</span>
                      </div>

                      <div className="flex items-center gap-2.5 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingEmailConfig(false);
                            setNewEmailConfigErrors({});
                          }}
                          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={handleOpenTestEmailFromAdd}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#252578]/20 bg-white px-5 py-2.5 text-xs font-bold text-[#252578] hover:bg-[#252578]/5 transition-all cursor-pointer shadow-xs"
                        >
                          <Send size={14} />
                          Test Email
                        </button>

                        <button
                          type="button"
                          onClick={handleAddEmailConfig}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#252578] px-6 py-2.5 text-xs font-bold text-white transition-all hover:bg-[#1a1a5e] hover:shadow-lg cursor-pointer"
                        >
                          <Save size={14} />
                          Save Configuration
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                /* Configured Email Delivery Card */
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden flex flex-col">
                  <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-gray-50/50 via-white to-gray-50/30">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#252578]/10 text-[#252578] shrink-0">
                        <Mail size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Transactional Gateway</p>
                        <h3 className="text-lg font-bold text-gray-900">Provider & Sender Setup</h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#252578]/15 bg-[#252578]/5 px-3 py-1 text-xs font-bold text-[#252578]">
                        <Key size={13} />
                        Resend API v1
                      </span>
                    </div>
                  </div>

                  <div className="p-5 sm:p-8 flex flex-col gap-6">
                    {/* Provider Field (Fixed to Resend) */}
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-gray-800 flex items-center justify-between">
                        <span>Provider</span>
                        <span className="text-xs font-normal text-gray-400">Primary delivery engine</span>
                      </label>
                      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm font-semibold text-gray-800">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                          <span>Resend</span>
                          <span className="text-xs font-normal text-gray-500">(Modern Developer-First Email API)</span>
                        </div>
                        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">Active</span>
                      </div>
                    </div>

                    {/* API Key Field (Masked - only shows re_•••••••••) */}
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-bold text-gray-800 flex items-center justify-between">
                        <span>API Key</span>
                        <span className="text-xs font-normal text-emerald-600 flex items-center gap-1 font-medium">
                          <Lock size={12} /> Key Secured & Encrypted
                        </span>
                      </label>
                      <div className="relative flex items-center">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                          <Key size={16} />
                        </div>
                        <input
                          type="text"
                          readOnly
                          disabled
                          value="re_•••••••••"
                          aria-label="Masked Resend API Key"
                          className="w-full rounded-xl border border-gray-200 bg-gray-100/80 py-3 pl-10 pr-36 font-mono text-sm text-gray-600 select-none cursor-not-allowed tracking-wider"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setChangeApiKeyInput('');
                            setChangeApiKeyError(null);
                            setShowChangeApiKeyModal(true);
                          }}
                          className="absolute right-2.5 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#252578] shadow-xs hover:bg-gray-50 hover:border-[#252578]/30 transition-all cursor-pointer"
                        >
                          <Key size={13} />
                          Change API Key
                        </button>
                      </div>
                      <p className="text-xs text-gray-400">API key is protected and masked. To enter a new secret key, use Change API Key.</p>
                    </div>

                    {/* From Name & From Email Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* From Name */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-800 flex items-center justify-between">
                          <span>From Name <span className="text-red-500">*</span></span>
                          <span className="text-xs font-normal text-gray-400">Sender display name</span>
                        </label>
                        <input
                          type="text"
                          value={emailConfig.fromName || ''}
                          onChange={(e) => {
                            setEmailConfig({ ...emailConfig, fromName: e.target.value });
                            if (emailConfigErrors.fromName) {
                              setEmailConfigErrors((prev) => {
                                const n = { ...prev };
                                delete n.fromName;
                                return n;
                              });
                            }
                          }}
                          placeholder="e.g. SBSI Support"
                          className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all ${
                            emailConfigErrors.fromName
                              ? 'border-red-300 bg-red-50/30 text-red-900 focus:ring-2 focus:ring-red-200'
                              : 'border-gray-200 bg-gray-50/50 text-gray-900 focus:border-[#252578] focus:bg-white focus:ring-2 focus:ring-[#252578]/10'
                          }`}
                        />
                        {emailConfigErrors.fromName ? (
                          <p className="text-xs font-medium text-red-600 mt-0.5">{emailConfigErrors.fromName}</p>
                        ) : (
                          <p className="text-xs text-gray-400">Visible to customers and employees in their email client headers.</p>
                        )}
                      </div>

                      {/* From Email */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-800 flex items-center justify-between">
                          <span>From Email <span className="text-red-500">*</span></span>
                          <span className="text-xs font-normal text-gray-400">Verified domain address</span>
                        </label>
                        <input
                          type="email"
                          value={emailConfig.fromEmail || ''}
                          onChange={(e) => {
                            setEmailConfig({ ...emailConfig, fromEmail: e.target.value });
                            if (emailConfigErrors.fromEmail) {
                              setEmailConfigErrors((prev) => {
                                const n = { ...prev };
                                delete n.fromEmail;
                                return n;
                              });
                            }
                          }}
                          placeholder="support@sbs-med.com"
                          className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all ${
                            emailConfigErrors.fromEmail
                              ? 'border-red-300 bg-red-50/30 text-red-900 focus:ring-2 focus:ring-red-200'
                              : 'border-gray-200 bg-gray-50/50 text-gray-900 focus:border-[#252578] focus:bg-white focus:ring-2 focus:ring-[#252578]/10'
                          }`}
                        />
                        {emailConfigErrors.fromEmail ? (
                          <p className="text-xs font-medium text-red-600 mt-0.5">{emailConfigErrors.fromEmail}</p>
                        ) : (
                          <p className="text-xs text-gray-400">Must be a verified sending domain or email configured in your Resend account.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="border-t border-gray-100 bg-gray-50/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                      <span>Credentials protected by enterprise client-side encryption.</span>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-end">
                      <button
                        type="button"
                        onClick={handleRemoveEmailConfig}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-all cursor-pointer shadow-xs"
                      >
                        <Trash2 size={14} />
                        Remove Configuration
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowTestEmailModal(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#252578]/20 bg-white px-5 py-2.5 text-xs font-bold text-[#252578] hover:bg-[#252578]/5 transition-all cursor-pointer shadow-xs"
                      >
                        <Send size={14} />
                        Test Email
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveEmailConfig}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#252578] px-6 py-2.5 text-xs font-bold text-white transition-all hover:bg-[#1a1a5e] hover:shadow-lg cursor-pointer"
                      >
                        <Save size={14} />
                        Save Configuration
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : tab === TAB_DEFAULTS ? (
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900">Ticket Defaults</h2>
                <div className="relative group inline-flex items-center">
                  <button
                    type="button"
                    aria-label="Ticket Defaults fallback explanation"
                    className="text-gray-400 hover:text-[#252578] cursor-help p-0.5 rounded-sm transition-colors"
                  >
                    <Info size={16} />
                  </button>
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-80 rounded-xl bg-gray-900 p-3 text-center text-xs text-white shadow-xl group-hover:block z-50 leading-relaxed animate-in fade-in zoom-in-95 duration-150">
                    These are fallback values only — they apply when no more specific rule (category, priority, or branch SLA policy) already determines the value. This is not an override.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>Changes are not yet saved — persistence coming soon</span>
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Configure baseline fallback attributes applied to newly created tickets across the system.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-[#252578] transition-all shrink-0 cursor-pointer shadow-xs"
            >
              <RotateCcw size={14} />
              Reset to Defaults
            </button>
          </div>

          {/* Informational Non-Retroactive Callout Card */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 shrink-0 mt-0.5">
              <Info size={18} />
            </div>
            <div className="text-xs sm:text-sm text-blue-900 leading-relaxed">
              <span className="font-semibold">Non-Retroactive Notice: </span>
              Changing these defaults will not affect tickets already created under the previous defaults. These settings only apply to new tickets going forward.
            </div>
          </div>

          {/* Configuration Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {/* 1. Default Status (Locked / Non-Editable) */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900">Default Status</h3>
                    <div className="relative group inline-flex items-center">
                      <button
                        type="button"
                        aria-label="Status locked information"
                        className="text-gray-400 hover:text-[#252578] cursor-help p-0.5"
                      >
                        <Info size={14} />
                      </button>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-72 rounded-xl bg-gray-900 p-3 text-center text-xs text-white shadow-xl group-hover:block z-50 leading-relaxed">
                        Tickets cannot start in any other state without violating the system transition lifecycle.
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 border border-gray-200">
                    <Lock size={12} />
                    Locked
                  </span>
                </div>

                <div className="mt-5 space-y-2">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                    Initial Ticket State
                  </label>
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 select-none">
                    <div className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span className="text-sm font-bold text-gray-900">{defaultsConfig.status}</span>
                    </div>
                    <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
                      <Lock size={12} /> Read-only
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-5 pt-3 border-t border-gray-100 leading-relaxed">
                All newly created tickets start in Open status, per the system's transition rules. This cannot be changed.
              </p>
            </div>

            {/* 2. Default Priority (Editable Dropdown) */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900">Default Priority</h3>
                    <div className="relative group inline-flex items-center">
                      <button
                        type="button"
                        aria-label="Default Priority info"
                        className="text-gray-400 hover:text-[#252578] cursor-help p-0.5"
                      >
                        <Info size={14} />
                      </button>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-72 rounded-xl bg-gray-900 p-3 text-center text-xs text-white shadow-xl group-hover:block z-50 leading-relaxed">
                        Fallback priority level applied when requestors do not explicitly set a priority level.
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                    Configurable
                  </span>
                </div>

                <div className="mt-5 space-y-2">
                  <label htmlFor="default-priority-select" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                    Baseline Priority Level
                  </label>
                  <div className="relative">
                    <select
                      id="default-priority-select"
                      value={defaultsConfig.priority}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                      className={`w-full rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-[#252578] cursor-pointer appearance-none pr-10 shadow-2xs ${defaultsErrors.priority ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'
                        }`}
                    >
                      {items.priorities && items.priorities.length > 0 ? (
                        items.priorities.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name} Priority
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Low">Low Priority</option>
                          <option value="Medium">Medium Priority</option>
                          <option value="High">High Priority</option>
                          <option value="Urgent">Urgent Priority</option>
                        </>
                      )}
                    </select>
                    <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  {defaultsErrors.priority && (
                    <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mt-1">
                      <AlertCircle size={13} /> {defaultsErrors.priority}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-5 pt-3 border-t border-gray-100 leading-relaxed">
                Matches current standard ticket intake baseline (Low). Selecting a different priority assigns that tier as the default intake severity.
              </p>
            </div>

            {/* 3. Default SLA Policy (Editable Dropdown) */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-gray-900">Default SLA Policy</h3>
                    <div className="relative group inline-flex items-center">
                      <button
                        type="button"
                        aria-label="Default SLA Policy info"
                        className="text-gray-400 hover:text-[#252578] cursor-help p-0.5"
                      >
                        <Info size={14} />
                      </button>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-80 rounded-xl bg-gray-900 p-3 text-center text-xs text-white shadow-xl group-hover:block z-50 leading-relaxed">
                        Determines default response and resolution windows when no category-specific or contract-specific SLA applies.
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                    Configurable
                  </span>
                </div>

                <div className="mt-5 space-y-2">
                  <label htmlFor="default-sla-select" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                    Response & Resolution Policy
                  </label>
                  <div className="relative">
                    <select
                      id="default-sla-select"
                      value={defaultsConfig.slaPolicy}
                      onChange={(e) => handleSlaPolicyChange(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-[#252578] cursor-pointer appearance-none pr-10 shadow-2xs"
                    >
                      <option value="dynamic">
                        Dynamic (Department & Priority Rule) [Current Behavior]
                      </option>
                      {(items.slas || []).map((sla) => (
                        <option key={sla.sla_ID} value={String(sla.sla_ID)}>
                          {sla.sla_name} (Fixed override: {sla.response_time_minutes ? `${sla.response_time_minutes}m` : 'N/A'} resp / {sla.resolution_time_minutes ? `${Math.round(sla.resolution_time_minutes / 60)}h` : 'N/A'} res)
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-5 pt-3 border-t border-gray-100 leading-relaxed">
                Choosing "Dynamic" derives SLA targets from the assigned department and priority rules. Choosing a named tier overrides that dynamic behavior as a fixed baseline.
              </p>
            </div>
          </div>

          {/* Current Defaults Summary Card */}
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50 p-5 sm:p-6 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              Active Defaults Snapshot
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs">
                <span className="text-xs text-gray-500 block">Initial Status</span>
                <span className="mt-1 inline-flex items-center gap-1.5 font-bold text-gray-900">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {defaultsConfig.status}
                  <Lock size={12} className="text-gray-400" />
                </span>
              </div>
              <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs">
                <span className="text-xs text-gray-500 block">Baseline Priority</span>
                <span className="mt-1 inline-flex items-center gap-1.5 font-bold text-[#252578]">
                  <CheckCircle2 size={13} className="text-green-600" />
                  {defaultsConfig.priority}
                </span>
              </div>
              <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs">
                <span className="text-xs text-gray-500 block">Default SLA Policy</span>
                <span className="mt-1 inline-flex items-center gap-1.5 font-bold text-gray-900 truncate">
                  <CheckCircle2 size={13} className="text-blue-600 shrink-0" />
                  <span className="truncate">
                    {defaultsConfig.slaPolicy === 'dynamic'
                      ? 'Dynamic (Department Rule)'
                      : (items.slas || []).find((s) => String(s.sla_ID) === String(defaultsConfig.slaPolicy))?.sla_name || defaultsConfig.slaPolicy}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : tab === TAB_NUMBER_FORMAT ? (
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900">Ticket Number Format</h2>
                <div className="relative group inline-flex items-center">
                  <button
                    type="button"
                    aria-label="Ticket Number Format explanation"
                    className="text-gray-400 hover:text-[#252578] cursor-help p-0.5 rounded-sm transition-colors"
                  >
                    <Info size={16} />
                  </button>
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-80 rounded-xl bg-gray-900 p-3 text-center text-xs text-white shadow-xl group-hover:block z-50 leading-relaxed animate-in fade-in zoom-in-95 duration-150">
                    Changing this format only affects tickets created after the change. Existing ticket numbers will never be altered or regenerated.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>Changes are not yet saved — persistence coming soon</span>
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Configure how unique ticket identifiers are structured and generated across the system.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleResetNumberFormat}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-[#252578] transition-all cursor-pointer shadow-xs"
              >
                <RotateCcw size={14} />
                Reset to Defaults
              </button>
              <button
                type="button"
                onClick={handleSaveNumberFormat}
                className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1a1a5e] transition-all cursor-pointer shadow-xs"
              >
                <Save size={14} />
                Save Format
              </button>
            </div>
          </div>

          {/* Informational Non-Retroactive Callout Card */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 shrink-0 mt-0.5">
              <Info size={18} />
            </div>
            <div className="text-xs sm:text-sm text-blue-900 leading-relaxed">
              <span className="font-semibold">Non-Retroactive Notice: </span>
              Changing this format only affects tickets created after the change. Existing ticket numbers will never be altered or regenerated.
            </div>
          </div>

          {/* Live Preview Hero Card */}
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/30 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-indigo-100/70">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#252578] text-white shadow-xs">
                  <Eye size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Live Ticket Number Preview</h3>
                  <p className="text-xs text-gray-500">Real-time preview generated from your current configuration</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 shrink-0 self-start sm:self-auto">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Real-time Preview
              </span>
            </div>

            {/* Display Box */}
            <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-gray-200/80 bg-slate-900 p-6 sm:p-8 text-center shadow-inner relative overflow-hidden group">
              <div className="absolute -top-12 -left-12 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-purple-500/10 blur-2xl pointer-events-none" />

              <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-300/80 mb-2">
                Sample Ticket Identifier
              </span>
              <div className="font-mono text-2xl sm:text-4xl font-extrabold tracking-wider text-white drop-shadow-sm select-all">
                {livePreviewTicketNumber}
              </div>
              <p className="text-xs text-slate-400 mt-2 max-w-md">
                Sample sequence #1 applied to the selected format pattern.
              </p>

              {/* Segment Breakdown Chips */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 pt-4 border-t border-slate-800 w-full text-xs">
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-indigo-300 font-mono">
                  <span className="text-slate-400 font-sans text-[10px]">Prefix:</span> {numberFormatConfig.prefix?.trim().toUpperCase() || 'TKT'}
                </span>
                {numberFormatConfig.includeDeptCode && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-amber-300 font-mono">
                    <span className="text-slate-400 font-sans text-[10px]">Dept:</span> {numberFormatConfig.deptCode?.trim().toUpperCase() || 'DEPT'}
                  </span>
                )}
                {numberFormatConfig.dateSegment !== 'none' && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-sky-300 font-mono">
                    <span className="text-slate-400 font-sans text-[10px]">Date:</span> {livePreviewDatePart}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-emerald-300 font-mono">
                  <span className="text-slate-400 font-sans text-[10px]">Seq:</span> {livePreviewSeqPart}
                </span>
              </div>
            </div>
          </div>

          {/* Format Builder Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Card 1: Prefix & Department Code */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between space-y-6">
              <div>
                <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag size={16} className="text-[#252578]" />
                    <h3 className="text-base font-bold text-gray-900">Prefix & Department</h3>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                    Segment 1 & 2
                  </span>
                </div>

                <div className="mt-5 space-y-5">
                  {/* Field 1: Prefix */}
                  <div className="space-y-1.5">
                    <label htmlFor="format-prefix-input" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                      Ticket Prefix <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="format-prefix-input"
                      type="text"
                      maxLength={10}
                      value={numberFormatConfig.prefix}
                      onChange={(e) => handlePrefixChange(e.target.value)}
                      placeholder="TKT"
                      className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold uppercase text-gray-800 outline-none focus:ring-2 focus:ring-[#252578] shadow-2xs transition-all ${
                        numberFormatErrors.prefix ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'
                      }`}
                    />
                    {numberFormatErrors.prefix ? (
                      <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mt-1">
                        <AlertCircle size={13} /> {numberFormatErrors.prefix}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Default prefix is <span className="font-semibold text-gray-700">TKT</span>. Appears at the start of every generated ticket number.
                      </p>
                    )}
                  </div>

                  {/* Field 2: Branch / Department Code Segment */}
                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <div className="flex items-start gap-3">
                      <input
                        id="include-dept-checkbox"
                        type="checkbox"
                        checked={numberFormatConfig.includeDeptCode}
                        onChange={(e) => handleIncludeDeptCodeChange(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-[#252578] focus:ring-[#252578] cursor-pointer"
                      />
                      <label htmlFor="include-dept-checkbox" className="text-xs font-bold text-gray-900 cursor-pointer select-none">
                        Include Branch / Department Code Segment
                        <span className="block text-[11px] font-normal text-gray-500 mt-0.5">
                          Adds an organizational code segment between prefix and timestamp (e.g. TKT-IT-0001).
                        </span>
                      </label>
                    </div>

                    <div className={`space-y-1.5 transition-all ${numberFormatConfig.includeDeptCode ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                      <label htmlFor="dept-code-input" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                        Branch / Department Code {numberFormatConfig.includeDeptCode && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        id="dept-code-input"
                        type="text"
                        maxLength={10}
                        disabled={!numberFormatConfig.includeDeptCode}
                        value={numberFormatConfig.deptCode}
                        onChange={(e) => handleDeptCodeChange(e.target.value)}
                        placeholder="e.g. IT, SVC, HQ"
                        className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold uppercase text-gray-800 outline-none focus:ring-2 focus:ring-[#252578] shadow-2xs transition-all ${
                          numberFormatErrors.deptCode ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'
                        }`}
                      />
                      {numberFormatErrors.deptCode ? (
                        <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mt-1">
                          <AlertCircle size={13} /> {numberFormatErrors.deptCode}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">
                          Enter a short code manually (e.g. IT, SVC) — departments don't have a standardized code yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 text-xs text-gray-400">
                Current system behavior omits department codes from ticket numbers.
              </div>
            </div>

            {/* Card 2: Date & Sequential Number Segments */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs flex flex-col justify-between space-y-6">
              <div>
                <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-[#252578]" />
                    <h3 className="text-base font-bold text-gray-900">Date & Sequential Counter</h3>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                    Segment 3 & 4
                  </span>
                </div>

                <div className="mt-5 space-y-5">
                  {/* Field 3: Date Segment */}
                  <div className="space-y-1.5">
                    <label htmlFor="date-segment-select" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                      Date Segment Pattern
                    </label>
                    <div className="relative">
                      <select
                        id="date-segment-select"
                        value={numberFormatConfig.dateSegment}
                        onChange={(e) => handleDateSegmentChange(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-[#252578] cursor-pointer appearance-none pr-10 shadow-2xs"
                      >
                        {TS094_DATE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    <p className="text-xs text-gray-500">
                      Select date segmentation embedded in the ticket ID based on ticket creation timestamp.
                    </p>
                  </div>

                  {/* Field 4: Sequential Number Digit Length */}
                  <div className="pt-4 border-t border-gray-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="digit-length-input" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                        Sequential Digit Length <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[11px] font-semibold text-gray-400">Min: 3, Max: 8</span>
                    </div>
                    <div className="relative">
                      <input
                        id="digit-length-input"
                        type="number"
                        min={3}
                        max={8}
                        step={1}
                        value={numberFormatConfig.digitLength}
                        onChange={(e) => handleDigitLengthChange(e.target.value)}
                        className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-[#252578] shadow-2xs transition-all pr-12 ${
                          numberFormatErrors.digitLength ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'
                        }`}
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                        digits
                      </span>
                    </div>
                    {numberFormatErrors.digitLength ? (
                      <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mt-1">
                        <AlertCircle size={13} /> {numberFormatErrors.digitLength}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Default length is <span className="font-semibold text-gray-700">4</span> (e.g. 0001). This field is mandatory to guarantee unique ticket numbers.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 text-xs text-gray-400">
                Sequential counter increments globally upon every newly registered ticket.
              </div>
            </div>
          </div>

          {/* Active Configuration Summary Card */}
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50 p-5 sm:p-6 shadow-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
              Configured Format Breakdown
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs">
                <span className="text-xs text-gray-500 block">Prefix</span>
                <span className="mt-1 inline-flex items-center gap-1.5 font-bold text-gray-900 font-mono">
                  <CheckCircle2 size={13} className="text-green-600" />
                  {numberFormatConfig.prefix?.trim().toUpperCase() || 'TKT'}
                </span>
              </div>
              <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs">
                <span className="text-xs text-gray-500 block">Department Segment</span>
                <span className="mt-1 inline-flex items-center gap-1.5 font-bold text-gray-900 font-mono">
                  {numberFormatConfig.includeDeptCode ? (
                    <>
                      <CheckCircle2 size={13} className="text-amber-600" />
                      {numberFormatConfig.deptCode?.trim().toUpperCase() || 'DEPT'}
                    </>
                  ) : (
                    <span className="text-gray-400 font-sans text-xs font-semibold">Excluded</span>
                  )}
                </span>
              </div>
              <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs">
                <span className="text-xs text-gray-500 block">Date Segment</span>
                <span className="mt-1 inline-flex items-center gap-1.5 font-bold text-gray-900">
                  <CheckCircle2 size={13} className="text-blue-600" />
                  {TS094_DATE_OPTIONS.find((o) => o.value === numberFormatConfig.dateSegment)?.value || 'none'}
                </span>
              </div>
              <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-2xs">
                <span className="text-xs text-gray-500 block">Digit Length</span>
                <span className="mt-1 inline-flex items-center gap-1.5 font-bold text-gray-900 font-mono">
                  <CheckCircle2 size={13} className="text-purple-600" />
                  {numberFormatConfig.digitLength} digits ({livePreviewSeqPart})
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : tab === TAB_LIMITS ? (
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900">Max Open Tickets</h2>
                <div className="relative group inline-flex items-center">
                  <button
                    type="button"
                    aria-label="Open tickets definition"
                    className="text-gray-400 hover:text-[#252578] cursor-help p-0.5 rounded-sm transition-colors"
                  >
                    <Info size={16} />
                  </button>
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-80 rounded-xl bg-gray-900 p-3 text-center text-xs text-white shadow-xl group-hover:block z-50 leading-relaxed animate-in fade-in zoom-in-95 duration-150">
                    Open tickets include Open, Pending Assignment, In Progress, Pending, Pending Evaluation, On Hold, Escalated, and Reopened. Closed, Resolved, Discarded, and Cancelled tickets do not count.
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>Changes are not yet saved — persistence coming soon</span>
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                The limit value itself is not yet saved system-wide, but ticket submission blocking uses this value live within your current session for testing.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleResetTicketLimit}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-[#252578] transition-all cursor-pointer shadow-xs"
              >
                <RotateCcw size={14} />
                Reset to Defaults
              </button>
              <button
                type="button"
                onClick={handleSaveTicketLimit}
                className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1a1a5e] transition-all cursor-pointer shadow-xs"
              >
                <Save size={14} />
                Save Limit
              </button>
            </div>
          </div>

          {/* Informational Non-Retroactive Callout Card */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5 flex items-start gap-3.5 shadow-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 shrink-0 mt-0.5">
              <Info size={18} />
            </div>
            <div className="text-xs sm:text-sm text-blue-900 leading-relaxed">
              <span className="font-semibold">Non-Retroactive Notice: </span>
              Lowering this limit will not cancel or close anyone's existing tickets — it will only block new submissions until they fall back under the limit.
            </div>
          </div>

          {/* Configuration Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Card: Threshold Settings */}
            <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-6">
              <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Requester Ticket Limit</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Cap the maximum number of concurrent unresolved tickets a single requester can hold.</p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                  ticketLimitConfig.isUnlimited
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {ticketLimitConfig.isUnlimited ? 'Unlimited Active' : `${ticketLimitConfig.limit} Tickets Limit`}
                </span>
              </div>

              {/* Unlimited Toggle */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 flex items-start gap-3.5">
                <input
                  id="unlimited-tickets-checkbox"
                  type="checkbox"
                  checked={ticketLimitConfig.isUnlimited}
                  onChange={(e) => handleToggleUnlimited(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[#252578] focus:ring-[#252578] cursor-pointer"
                />
                <label htmlFor="unlimited-tickets-checkbox" className="text-xs font-bold text-gray-900 cursor-pointer select-none">
                  Unlimited Open Tickets (Default)
                  <span className="block text-[11px] font-normal text-gray-500 mt-0.5">
                    When checked, requesters can submit tickets without any quota restrictions. Matches standard baseline system behavior.
                  </span>
                </label>
              </div>

              {/* Numeric Limit Input */}
              <div className={`space-y-2 transition-all ${ticketLimitConfig.isUnlimited ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                <div className="flex items-center justify-between">
                  <label htmlFor="max-tickets-input" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                    Maximum Open Tickets Allowed {!ticketLimitConfig.isUnlimited && <span className="text-red-500">*</span>}
                  </label>
                  <span className="text-[11px] font-semibold text-gray-400">Recommended: 3 – 10 tickets</span>
                </div>
                <div className="relative">
                  <input
                    id="max-tickets-input"
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    disabled={ticketLimitConfig.isUnlimited}
                    value={ticketLimitConfig.limit}
                    onChange={(e) => handleLimitNumberChange(e.target.value)}
                    placeholder="5"
                    className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-[#252578] shadow-2xs transition-all pr-14 ${
                      limitError ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'
                    }`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                    tickets
                  </span>
                </div>
                {limitError ? (
                  <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mt-1">
                    <AlertCircle size={13} /> {limitError}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">
                    Once a requester reaches this count of open tickets, new submissions are blocked with an informative message until an existing ticket is resolved or closed.
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between flex-wrap gap-2">
                <span>Customer tickets and Employee internal tickets are counted separately.</span>
                <span className="font-semibold text-indigo-700">Enforced live in current session</span>
              </div>
            </div>

            {/* Right Card: Status Inclusion Legend */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
              <div className="pb-3 border-b border-gray-100">
                <h4 className="text-sm font-bold text-gray-900">What Counts as "Open"?</h4>
                <p className="text-xs text-gray-500 mt-0.5">Statuses evaluated by the quota guard.</p>
              </div>

              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Counts Toward Limit (8 Statuses)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {OPEN_STATUS_SET.map((st) => (
                    <span key={st} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 border border-emerald-200/70">
                      <Check size={11} className="text-emerald-600" />
                      {st}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
                  Exempt / Terminal (Do Not Count)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['Closed', 'Resolved', 'Discarded', 'Cancelled'].map((st) => (
                    <span key={st} className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-500 border border-gray-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                      {st}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : tab === TAB_ESCALATION ? (
        <div className="flex flex-col gap-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Escalation Rules</h2>
              <p className="text-sm text-gray-500 mt-0.5">Define when and how tickets are automatically escalated</p>
            </div>
            <button onClick={handleAddEscalation} className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg shrink-0">
              <Plus size={18} />
              Add Rule
            </button>
          </div>

          {/* Escalation Rule Cards */}
          <div className="flex flex-col gap-4">
            {escalationRules.length === 0 && (
              <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
                No escalation rules configured.
              </div>
            )}
            {escalationRules.map((rule) => (
              <div
                key={rule.id}
                className={`rounded-2xl border bg-white p-6 shadow-sm transition-all ${rule.isActive ? 'border-gray-200' : 'border-gray-100 opacity-55'
                  }`}
              >
                {/* Header: rule name + status badge + actions */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-gray-900">{rule.name}</h3>
                    <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleEscalation(rule.id)}
                      className={`rounded-full p-2 transition-colors ${rule.isActive ? 'text-gray-400 hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-100'
                        }`}
                      title={rule.isActive ? 'Deactivate' : 'Activate'}
                    >
                      <Power size={16} />
                    </button>
                    <button onClick={() => handleEditEscalation(rule)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 transition-colors" title="Edit">
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDeleteEscalation(rule)} className="rounded-full p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Rule details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Trigger</p>
                    <p className="text-sm text-gray-800">{rule.trigger}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Condition</p>
                    <p className="text-sm text-gray-800">
                      {(() => {
                        const parts = rule.condition.text.split(rule.condition.highlight);
                        return parts.map((part, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span className="font-semibold text-orange-600">{rule.condition.highlight}</span>}
                            {part}
                          </React.Fragment>
                        ));
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Action</p>
                    <p className="text-sm text-gray-800">{rule.action}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notify</p>
                    <p className="text-sm font-semibold text-[#252578]">{rule.notify}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : tab === TAB_SLA ? (
        <div className="flex flex-col gap-6">
          {selectedDeptId === null ? (
            /* DEPARTMENT LIST VIEW */
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Departments</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Click a department below to view and configure its SLA priority rules.</p>
                </div>
              </div>

              {items.departments.length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
                  No departments found.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
                  {items.departments.map((dept) => {
                    const summary = getDeptRuleSummary(dept.id);
                    const deptRules = items.slaRules.filter((r) => String(r.department_id) === String(dept.id));

                    return (
                      <div
                        key={dept.id}
                        onClick={() => setSelectedDeptId(String(dept.id))}
                        className="group relative cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:border-[#252578] hover:shadow-lg flex flex-col justify-between gap-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#252578]/10 text-[#252578] transition-all group-hover:bg-[#252578] group-hover:text-white">
                              <Building2 size={24} />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#252578] transition-colors">{dept.name}</h3>
                              <p className="text-xs text-gray-500">{dept.description || 'Department support team'}</p>
                            </div>
                          </div>

                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition-all group-hover:bg-[#252578]/10 group-hover:text-[#252578]">
                            <ChevronRight size={18} />
                          </div>
                        </div>

                        {/* Summary Rules Preview Chips */}
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                          {priorityList.map((p) => {
                            const matchedRule = deptRules.find((r) => r.priority.toLowerCase() === p.name.toLowerCase());
                            return (
                              <div
                                key={p.name}
                                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border ${p.badgeClass}`}
                              >
                                <span>{p.name}:</span>
                                {matchedRule ? (
                                  <span className="font-semibold">{formatMinutes(matchedRule.response_time_limit)} / {formatMinutes(matchedRule.resolution_time_limit)}</span>
                                ) : (
                                  <span className="italic text-gray-400">Not set</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* SELECTED DEPARTMENT DETAILED SLA RULES VIEW */
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <button
                  onClick={() => setSelectedDeptId(null)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#252578] hover:text-[#1a1a5c] transition-colors w-fit"
                >
                  <ArrowLeft size={18} />
                  Back to All Departments
                </button>

                <button
                  onClick={handleSaveDepartmentSla}
                  disabled={savingSla}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50 shrink-0"
                >
                  <Save size={18} />
                  {savingSla ? 'Saving...' : `Save SLA Rules for ${currentDeptObj?.name || 'Department'}`}
                </button>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col gap-6">
                <div className="flex items-center gap-3.5 border-b border-gray-100 pb-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#252578] text-white">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{currentDeptObj?.name} Department SLA Rules</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Fill out response and resolution time limits (in minutes) for every ticket priority level.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {priorityList.map((p) => {
                    const formData = departmentSlaForm[p.name] || { response_time_limit: '', resolution_time_limit: '' };
                    return (
                      <div key={p.name} className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs flex flex-col gap-4 transition-all hover:border-[#252578]/30 hover:shadow-md">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                          <span className={`inline-block rounded-full px-3.5 py-1 text-xs font-semibold border ${p.badgeClass}`}>
                            {p.name} Priority
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Response Time Limit */}
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                              Response Limit (Mins)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={formData.response_time_limit}
                              onChange={(e) => handleSlaInputChange(p.name, 'response_time_limit', e.target.value)}
                              placeholder={`e.g. ${p.defaultResp}`}
                              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-[#252578]"
                            />
                            <p className="mt-1 text-xs font-medium text-[#252578] flex items-center gap-1 min-h-[18px]">
                              {formData.response_time_limit ? (
                                <>
                                  <Clock size={12} />
                                  {formatMinutes(formData.response_time_limit)}
                                </>
                              ) : ''}
                            </p>
                          </div>

                          {/* Resolution Time Limit */}
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-gray-700">
                              Resolution Limit (Mins)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={formData.resolution_time_limit}
                              onChange={(e) => handleSlaInputChange(p.name, 'resolution_time_limit', e.target.value)}
                              placeholder={`e.g. ${p.defaultRes}`}
                              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-[#252578]"
                            />
                            <p className="mt-1 text-xs font-medium text-[#252578] flex items-center gap-1 min-h-[18px]">
                              {formData.resolution_time_limit ? (
                                <>
                                  <Clock size={12} />
                                  {formatMinutes(formData.resolution_time_limit)}
                                </>
                              ) : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-3 border-t border-gray-100">
                  <button
                    onClick={handleSaveDepartmentSla}
                    disabled={savingSla}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
                  >
                    <Save size={18} />
                    {savingSla ? 'Saving SLA Rules...' : `Save SLA Rules for ${currentDeptObj?.name}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            {tab === TAB_EQUIPMENT && (
              <div className="relative w-full max-w-none flex-1">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
                />
              </div>
            )}
            {tab === TAB_PRIORITY && <div className="flex-1" />}
            <button onClick={handleAdd} className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg shrink-0">
              <Plus size={18} />
              Add {tab === TAB_EQUIPMENT ? 'Category' : 'Priority'}
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-left">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-4">ID</th>
                  <th className="px-5 py-4">Name</th>
                  <th className="px-5 py-4 text-center w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-5 py-8 text-center text-sm text-gray-500">
                      No {tab === TAB_EQUIPMENT ? 'categories' : 'priorities'} found.
                    </td>
                  </tr>
                )}
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 text-sm font-semibold text-[#252578]">{item.id}</td>
                    <td className="px-5 py-4 text-sm text-gray-800">
                      {tab === TAB_PRIORITY && item.color ? (
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${item.color}`}>{item.name}</span>
                      ) : (
                        item.name
                      )}
                    </td>
                    <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          if (openMenuId === item.id) { setOpenMenuId(null); setMenuPos(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuPos({ x: rect.right - 132, y: rect.bottom + 4 });
                          setOpenMenuId(item.id);
                        }}
                        className="rounded-full p-2 text-gray-500 hover:bg-gray-100 menu-trigger"
                        aria-label="Actions"
                      >
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {openMenuId && menuPos && createPortal(
        (() => {
          const t = filtered.find((x) => x.id === openMenuId);
          return t ? (
            <div data-menu-id={t.id} style={{ position: 'fixed', left: menuPos.x, top: menuPos.y, zIndex: 9999 }}
              className="w-32 rounded-xl border border-gray-200 bg-white shadow-lg">
              <button onClick={() => { handleEdit(t); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-xl">
                Edit
              </button>
              <button onClick={() => { handleDelete(t); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-b-xl">
                Delete
              </button>
            </div>
          ) : null;
        })(),
        document.body
      )}

      {/* Equipment / Priority Modal */}
      {editingItem !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h2 className="text-lg font-bold text-gray-900">{editingItem.id === null ? 'Add' : 'Edit'} {tab === TAB_EQUIPMENT ? 'Category' : 'Priority'}</h2>
              <button type="button" onClick={() => setEditingItem(null)} className="p-2 text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={`Enter ${tab === TAB_EQUIPMENT ? 'category' : 'priority'} name`}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
                />
              </div>
              {tab === TAB_PRIORITY && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {priorityColorOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditColor(opt.value)}
                        className={`h-8 w-8 rounded-full border-2 transition-all ${opt.value.split(' ')[0]} ${editColor === opt.value ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                        title={opt.label}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-1">
                <button onClick={() => setEditingItem(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
                <button onClick={handleSaveItem} disabled={!editName.trim()} className="rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Status Modal */}
      {editingWorkflow !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h2 className="text-lg font-bold text-gray-900">{editingWorkflow.id === null ? 'Add' : 'Edit'} Workflow Status</h2>
              <button type="button" onClick={() => setEditingWorkflow(null)} className="p-2 text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Status Name</label>
                <input
                  type="text"
                  value={editingWorkflow.name}
                  onChange={(e) => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                  placeholder="Enter status name"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={editingWorkflow.description}
                  onChange={(e) => setEditingWorkflow({ ...editingWorkflow, description: e.target.value })}
                  placeholder="Enter description"
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#252578] resize-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Color</label>
                <div className="flex flex-wrap gap-2">
                  {workflowColorOptions.map((opt) => (
                    <button
                      key={opt.bgColor}
                      type="button"
                      onClick={() => setEditingWorkflow({ ...editingWorkflow, bgColor: opt.bgColor, textColor: opt.textColor })}
                      className={`h-8 w-8 rounded-full border-2 transition-all ${editingWorkflow.bgColor === opt.bgColor ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: opt.bgColor }}
                      title={opt.label}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Order / Position</label>
                <input
                  type="number"
                  min="1"
                  value={editingWorkflow.order}
                  onChange={(e) => setEditingWorkflow({ ...editingWorkflow, order: parseInt(e.target.value, 10) || 1 })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
                />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button onClick={() => setEditingWorkflow(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
                <button onClick={handleSaveWorkflow} disabled={!editingWorkflow.name.trim()} className="rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Escalation Rule Modal */}
      {editingEscalation !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h2 className="text-lg font-bold text-gray-900">{editingEscalation.id === null ? 'Add' : 'Edit'} Escalation Rule</h2>
              <button type="button" onClick={() => setEditingEscalation(null)} className="p-2 text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Rule Name</label>
                  <input
                    type="text"
                    value={editingEscalation.name}
                    onChange={(e) => setEditingEscalation({ ...editingEscalation, name: e.target.value })}
                    placeholder="Enter rule name"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
                  />
                </div>
                <div className="flex items-center gap-2 ml-4 mt-6">
                  <span className="text-sm text-gray-600">Active</span>
                  <button
                    type="button"
                    onClick={() => setEditingEscalation({ ...editingEscalation, isActive: !editingEscalation.isActive })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editingEscalation.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editingEscalation.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Trigger</label>
                <input
                  type="text"
                  value={editingEscalation.trigger}
                  onChange={(e) => setEditingEscalation({ ...editingEscalation, trigger: e.target.value })}
                  placeholder="e.g. Response deadline approaching"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Condition Text</label>
                  <input
                    type="text"
                    value={editingEscalation.condition.text}
                    onChange={(e) => setEditingEscalation({ ...editingEscalation, condition: { ...editingEscalation.condition, text: e.target.value } })}
                    placeholder="e.g. No response within 30 minutes before deadline"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Highlight Value</label>
                  <input
                    type="text"
                    value={editingEscalation.condition.highlight}
                    onChange={(e) => setEditingEscalation({ ...editingEscalation, condition: { ...editingEscalation.condition, highlight: e.target.value } })}
                    placeholder="e.g. 30 minutes"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <p className="mt-1 text-xs text-gray-400">This value will appear highlighted in orange.</p>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Action</label>
                <input
                  type="text"
                  value={editingEscalation.action}
                  onChange={(e) => setEditingEscalation({ ...editingEscalation, action: e.target.value })}
                  placeholder="e.g. Auto-escalate to Senior Engineer"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Notify</label>
                <input
                  type="text"
                  value={editingEscalation.notify}
                  onChange={(e) => setEditingEscalation({ ...editingEscalation, notify: e.target.value })}
                  placeholder="e.g. CS + Manager"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
                />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button onClick={() => setEditingEscalation(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
                <button onClick={handleSaveEscalation} disabled={!editingEscalation.name.trim()} className="rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {showTestEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#252578]/10 text-[#252578]">
                  <Send size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Send Test Email</h3>
                  <p className="text-xs text-gray-500">Verify your Resend delivery gateway setup</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTestEmailModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Recipient Email Address
              </label>
              <input
                type="email"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm outline-none focus:border-[#252578] focus:bg-white focus:ring-2 focus:ring-[#252578]/10"
              />
              {emailConfigErrors.testEmail && (
                <p className="text-xs font-semibold text-red-600">{emailConfigErrors.testEmail}</p>
              )}
              <p className="text-[11px] text-gray-400">
                A sample verification alert will be sent from <span className="font-semibold text-gray-600">{emailConfig?.fromName || newEmailConfig.fromName || 'SBSI Support'}</span> ({emailConfig?.fromEmail || newEmailConfig.fromEmail || 'support@sbs-med.com'}) via Resend.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowTestEmailModal(false)}
                disabled={isTestingEmail}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={isTestingEmail || !testEmailRecipient.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#252578] px-5 py-2 text-xs font-bold text-white transition-all hover:bg-[#1a1a5e] disabled:opacity-60 cursor-pointer shadow-xs"
              >
                {isTestingEmail ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Send Test Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change API Key Modal */}
      {showChangeApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#252578]/10 text-[#252578]">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Change Resend API Key</h3>
                  <p className="text-xs text-gray-500">Enter a new secret key from your Resend dashboard</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowChangeApiKeyModal(false);
                  setChangeApiKeyInput('');
                  setChangeApiKeyError(null);
                }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                New API Key <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <Key size={16} />
                </div>
                <input
                  type={showChangeApiKey ? 'text' : 'password'}
                  value={changeApiKeyInput}
                  onChange={(e) => {
                    setChangeApiKeyInput(e.target.value);
                    setChangeApiKeyError(null);
                  }}
                  placeholder="re_••••••••••••••••••••••••"
                  autoFocus
                  className={`w-full rounded-xl border pl-10 pr-11 py-2.5 text-sm font-mono outline-none transition-all ${
                    changeApiKeyError
                      ? 'border-red-300 bg-red-50/30 text-red-900 focus:ring-2 focus:ring-red-200'
                      : 'border-gray-200 bg-gray-50/50 text-gray-900 focus:border-[#252578] focus:bg-white focus:ring-2 focus:ring-[#252578]/10'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowChangeApiKey(!showChangeApiKey)}
                  aria-label={showChangeApiKey ? 'Hide API key' : 'Show API key'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  {showChangeApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {changeApiKeyError && (
                <p className="text-xs font-semibold text-red-600">{changeApiKeyError}</p>
              )}
              <p className="text-[11px] text-amber-600 font-medium">
                ⚠️ Once you save, you cannot see the API key again. It will be permanently masked as <span className="font-mono font-semibold text-gray-700">re_•••••••••</span>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowChangeApiKeyModal(false);
                  setChangeApiKeyInput('');
                  setChangeApiKeyError(null);
                }}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleChangeApiKey}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#252578] px-5 py-2 text-xs font-bold text-white transition-all hover:bg-[#1a1a5e] cursor-pointer shadow-xs"
              >
                <Save size={14} />
                Update API Key
              </button>
            </div>
          </div>
        </div>
      )}

      <NotificationModal
        isOpen={!!notification}
        type={notification?.type}
        title={notification?.title}
        message={notification?.message}
        onClose={closeNotif}
        onConfirm={notification?.onConfirm}
        onCancel={notification?.onCancel}
        confirmText={notification?.confirmText}
        confirmClassName={notification?.confirmClassName}
      />
    </div>
  );
}
