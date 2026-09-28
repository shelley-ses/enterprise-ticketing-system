import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Plus, MoreVertical, Clock, Save, Building2, ChevronRight, ChevronDown, ArrowLeft, CheckCircle2, Edit3, Trash2, Power, AlertCircle, RotateCcw, GitBranch, ArrowRight, Lock, Info, ShieldCheck, ShieldAlert, FileUp, Check, HardDrive, Bell, Users, UserCheck, Mail, Layers } from 'lucide-react';
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
  deleteEscalationRule
} from '@/services/ticketService';

import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';

export const GROUP_CLASSIFICATION = 'classification';
export const GROUP_LIFECYCLE = 'lifecycle';
export const GROUP_SLA_ESCALATION = 'sla-escalation';
export const GROUP_NOTIFICATIONS = 'notifications';
export const GROUP_SECURITY = 'security';

export const TAB_EQUIPMENT = 'equipment';
export const TAB_PRIORITY = 'priority';
export const TAB_SLA = 'sla';
export const TAB_WORKFLOW = 'workflow';
export const TAB_TRANSITIONS = 'transitions';
export const TAB_FILES = 'files';
export const TAB_WINDOWS = 'windows';
export const TAB_NOTIFICATIONS = 'notifications';
export const TAB_ESCALATION = 'escalation';

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
  const [items, setItems] = useState({ equipment: [], priorities: [], slaRules: [], departments: [] });
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

  // TS093 Transition Rules state (local component state for this sprint)
  const [transitionRules, setTransitionRules] = useState(TS093_DEFAULT_RULES);
  const [selectedTransitionStatus, setSelectedTransitionStatus] = useState(TS093_STATUSES[0]);

  // TS098 File Upload & Security Limits state (local component state for this sprint)
  const [fileConfig, setFileConfig] = useState(TS098_DEFAULT_FILE_CONFIG);
  const [fileConfigErrors, setFileConfigErrors] = useState({});

  // TS100 Reopen & Auto-Close Windows state (local component state for this sprint)
  const [windowConfig, setWindowConfig] = useState(TS100_DEFAULT_WINDOW_CONFIG);
  const [windowConfigErrors, setWindowConfigErrors] = useState({});

  // TS099 & TS103 Notifications state (managed via two-level activeGroup / activeSubTabs state)

  // TS099 Notification Recipient Routing state (local component state for this sprint)
  const [routingConfig, setRoutingConfig] = useState(TS099_DEFAULT_ROUTING);
  const [configuredAlerts, setConfiguredAlerts] = useState({});
  const [routingErrors, setRoutingErrors] = useState({});
  const [expandedRecipientAlert, setExpandedRecipientAlert] = useState(null);

  // TS103 Notification Channel Configuration state (local component state for this sprint)
  const [channelConfig, setChannelConfig] = useState(TS103_DEFAULT_CHANNELS);
  const [configuredChannels, setConfiguredChannels] = useState({});
  const [channelErrors, setChannelErrors] = useState({});

  const closeNotif = () => setNotification(null);
  const showSuccess = (title, message) => setNotification({ type: 'success', title, message });
  const showConfirm = (title, message, onConfirm, opts = {}) => setNotification({ type: 'confirm', title, message, onConfirm, onCancel: closeNotif, ...opts });

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [configData, slaData, deptsData, workflowData, escalationData] = await Promise.all([
        getSuperAdminConfig().catch(() => ({ equipment: [], priorities: [] })),
        getSLARules().catch(() => ({ sla_rules: [] })),
        getDepartments().catch(() => ({ departments: [] })),
        getWorkflowStatuses().catch(() => ({ workflow_statuses: [] })),
        getEscalationRules().catch(() => ({ escalation_rules: [] })),
      ]);

      const depts = deptsData.departments || deptsData || [];
      const rules = slaData.sla_rules || [];

      setItems({
        equipment: configData.equipment || [],
        priorities: configData.priorities || [],
        slaRules: rules,
        departments: depts,
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
          className={`hover:text-[#252578] hover:underline cursor-pointer font-medium transition-colors ${
            currentGroup.subTabs.length <= 1 ? 'text-gray-900 font-semibold cursor-default hover:no-underline' : ''
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
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                isActive
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
                    className={`pb-3 pt-1 text-[13px] font-semibold border-b-2 transition-all cursor-pointer ${
                      isSubActive
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
                    <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full font-bold text-lg shadow-sm"
                         style={{ backgroundColor: status.bgColor, color: status.textColor }}>
                      {idx + 1}
                    </div>
                    <span className="mt-2.5 text-sm font-bold" style={{ color: status.textColor }}>{status.name}</span>
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
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm"
                     style={{ backgroundColor: status.bgColor, color: status.textColor }}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900">{status.name}</h4>
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
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
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
                      <h3 className="text-base font-bold text-gray-900">{selectedTransitionStatus}</h3>
                      <span className="text-xs text-gray-500">Source status</span>
                    </div>
                  </div>

                  {/* Status Type Badge */}
                  {(() => {
                    const rule = transitionRules[selectedTransitionStatus];
                    if (!rule) return null;
                    if (rule.type === 'terminal') {
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 border border-red-200">
                          <Lock size={12} />
                          Terminal Status
                        </span>
                      );
                    }
                    if (rule.type === 'fixed') {
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                          <Lock size={12} />
                          Automated / Non-Editable
                        </span>
                      );
                    }
                    if (rule.type === 'contextual') {
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700 border border-purple-200">
                          <Lock size={12} />
                          Contextual / Non-Editable
                        </span>
                      );
                    }
                    return (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700 border border-green-200">
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
                    <span>{transitionRules[selectedTransitionStatus].caption}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Next Allowed Transitions Section */}
            <div className="border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
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
                      <h5 className="text-base font-bold text-gray-800">Terminal Status</h5>
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
                          <p className="font-bold">System-Enforced Automated Transition</p>
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
                                <span className="text-sm font-bold text-gray-900">{targetStatus}</span>
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
                      <h5 className="text-base font-bold text-purple-900">Contextual Resume Transition</h5>
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
                          className={`flex items-start gap-3.5 rounded-xl border p-4 transition-all cursor-pointer select-none ${
                            isChecked
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
                                <span className="inline-block rounded-full bg-[#252578] px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider shrink-0">
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
                  <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
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
                    className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition-all ${
                      fileConfigErrors.maxFileSizeMB
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
                  <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
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
                    className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition-all ${
                      fileConfigErrors.maxFileCount
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
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-[#252578]" />
                  Allowed File Types
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select which file extensions are permitted across ticket attachments, messages, and knowledge base documents.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-[#252578]/5 px-3 py-1 text-xs font-bold text-[#252578] border border-[#252578]/20">
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
                    className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all cursor-pointer select-none ${
                      isChecked
                        ? 'border-[#252578] bg-[#252578]/5 shadow-xs ring-1 ring-[#252578]'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-xs transition-colors shrink-0 ${
                          isChecked ? 'bg-[#252578] text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {item.ext}
                      </div>
                      <div className="truncate">
                        <p className={`text-sm font-bold truncate ${isChecked ? 'text-[#252578]' : 'text-gray-700'}`}>
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
                  <h3 className="text-base font-bold text-gray-900">Malware & Antivirus Scanning</h3>
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
                  <h4 className="text-sm font-bold text-gray-900">ClamAV In-Stream Daemon Inspection</h4>
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700 border border-green-200">
                    <ShieldCheck size={13} />
                    Active Scanning
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 border border-red-200">
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
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer ${
                    fileConfig.malwareScanningEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                  title={fileConfig.malwareScanningEnabled ? 'Click to disable scanning' : 'Click to enable scanning'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                      fileConfig.malwareScanningEnabled ? 'translate-x-6' : 'translate-x-1'
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
            <div className={`rounded-2xl border bg-white p-6 shadow-sm flex flex-col justify-between transition-all ${
              windowConfig.reopenEnabled ? 'border-gray-100' : 'border-gray-200 bg-gray-50/40'
            }`}>
              <div>
                {/* Header with Switch */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-gray-900">Customer Reopen Window</h3>
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 border border-green-200">
                        <CheckCircle2 size={12} />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600 border border-gray-200">
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
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer ${
                        windowConfig.reopenEnabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      title={windowConfig.reopenEnabled ? 'Click to disable reopen' : 'Click to enable reopen'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                          windowConfig.reopenEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Duration Input & Caption */}
                <div className="mt-5">
                  {windowConfig.reopenEnabled ? (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
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
                          className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition-all ${
                            windowConfigErrors.reopenWindowDays
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
                        <p className="font-bold text-gray-700">Reopen Disabled</p>
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
            <div className={`rounded-2xl border bg-white p-6 shadow-sm flex flex-col justify-between transition-all ${
              windowConfig.autoCloseEnabled ? 'border-gray-100' : 'border-gray-200 bg-gray-50/40'
            }`}>
              <div>
                {/* Header with Switch */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-gray-900">Auto-Close Resolved Tickets</h3>
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                        <Clock size={12} />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600 border border-gray-200">
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
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#252578]/20 cursor-pointer ${
                        windowConfig.autoCloseEnabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      title={windowConfig.autoCloseEnabled ? 'Click to disable auto-close' : 'Click to enable auto-close'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                          windowConfig.autoCloseEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Duration Input & Caption */}
                <div className="mt-5">
                  {windowConfig.autoCloseEnabled ? (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
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
                          className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition-all ${
                            windowConfigErrors.autoCloseWindowDays
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
                        <p className="font-bold text-gray-700">Auto-Close Disabled</p>
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
                          <span className="hidden sm:inline-flex items-center rounded-full bg-[#252578]/5 px-3 py-1 text-xs font-bold text-[#252578] border border-[#252578]/20">
                            {selectedRecipients.length} selected
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
                              <h3 className="text-base font-bold text-gray-900">{alert.title}</h3>
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
                  <h2 className="text-xl font-bold text-gray-900">Email Delivery</h2>
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    Not configured
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Prepare the notification service for transactional email without mixing provider setup with recipient or channel routing.
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800 flex items-start gap-3">
                <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Email delivery is coming soon. API keys must live in notification-service environment variables or managed secrets and are never exposed in browser state.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#252578]/10 text-[#252578] shrink-0">
                      <Mail size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Planned provider</p>
                      <h3 className="text-lg font-bold text-gray-900">Resend</h3>
                    </div>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
                    Not configured
                  </span>
                </div>

                <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 flex items-start gap-3">
                    <Building2 size={18} className="text-[#252578] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Sender identity and domain</h4>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        A verified sending domain, From address, and sender name must be configured by the backend team.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 flex items-start gap-3">
                    <Lock size={18} className="text-[#252578] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">API credential</h4>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        The Resend API credential is backend-managed in notification-service environment or secret storage only.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 bg-gray-50/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs text-gray-500">No provider settings are saved from this browser panel.</p>
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-200 px-5 py-2.5 text-xs font-semibold text-gray-500 cursor-not-allowed"
                  >
                    <Save size={14} />
                    Save email settings (Coming soon)
                  </button>
                </div>
              </div>
            </div>
          ) : null}
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
                className={`rounded-2xl border bg-white p-6 shadow-sm transition-all ${
                  rule.isActive ? 'border-gray-200' : 'border-gray-100 opacity-55'
                }`}
              >
                {/* Header: rule name + status badge + actions */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-gray-900">{rule.name}</h3>
                    <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${
                      rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleEscalation(rule.id)}
                      className={`rounded-full p-2 transition-colors ${
                        rule.isActive ? 'text-gray-400 hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-100'
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
                              <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#252578] transition-colors">{dept.name}</h3>
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
                                  <span className="font-bold">{formatMinutes(matchedRule.response_time_limit)} / {formatMinutes(matchedRule.resolution_time_limit)}</span>
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
                          <span className={`inline-block rounded-full px-3.5 py-1 text-xs font-bold border ${p.badgeClass}`}>
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
