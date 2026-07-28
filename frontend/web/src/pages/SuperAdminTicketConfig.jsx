import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Plus, MoreVertical, Clock, Save, Building2, ChevronRight, ArrowLeft, CheckCircle2, Edit3, Trash2, Power } from 'lucide-react';
import { createPortal } from 'react-dom';
import NotificationModal from '@/components/NotificationModal';
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

const TAB_EQUIPMENT = 'equipment';
const TAB_PRIORITY = 'priority';
const TAB_SLA = 'sla';
const TAB_WORKFLOW = 'workflow';
const TAB_ESCALATION = 'escalation';

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

export default function SuperAdminTicketConfig() {
  const [tab, setTab] = useState(TAB_EQUIPMENT);
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-[#252578]">Ticket Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">Manage equipment categories, priority levels, and SLA requirements.</p>
      </div>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit flex-wrap">
        <button onClick={() => { setTab(TAB_EQUIPMENT); setSelectedDeptId(null); }} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === TAB_EQUIPMENT ? 'bg-white text-[#252578] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
          Equipment Categories
        </button>
        <button onClick={() => { setTab(TAB_PRIORITY); setSelectedDeptId(null); }} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === TAB_PRIORITY ? 'bg-white text-[#252578] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
          Priority Levels
        </button>
        <button onClick={() => setTab(TAB_SLA)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === TAB_SLA ? 'bg-white text-[#252578] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
          SLA Rules
        </button>
        <button onClick={() => setTab(TAB_WORKFLOW)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === TAB_WORKFLOW ? 'bg-white text-[#252578] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
          Workflow Rules
        </button>
        <button onClick={() => setTab(TAB_ESCALATION)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === TAB_ESCALATION ? 'bg-white text-[#252578] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
          Escalation Rules
        </button>
      </div>

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
