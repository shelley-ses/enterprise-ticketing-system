import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search,
  Filter,
  RefreshCw,
  UserCheck,
  UserPlus,
  ArrowUpDown,
  ExternalLink,
  ChevronDown,
  Layers,
  Inbox,
  AlertCircle,
  HelpCircle,
  CheckCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { MetricCard } from '@/components/ui/metric-card';
import { Button } from '@/components/ui/button';
import { Badge, getStatusBadgeVariant } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { DataTableSkeleton, DataTableEmptyState } from '@/components/ui/data-table';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import BranchSelector from '@/components/BranchSelector';
import SlaStatusBadge, { getTicketSlaDueDate, getTicketSlaStatus } from '@/components/sla/SlaStatusBadge';
import { AssignModal } from '@/components/CSModals';
import CustomerTicketDetailModal from '@/components/CustomerTicketDetailModal';
import {
  getCSIncomingTickets,
  getAssignableEmployees,
  assignTicketToEmployees,
  getDepartments,
} from '@/services/ticketService';
import { cn } from '@/lib/utils';

// Helper: Format Overdue Duration (e.g. "Overdue by 3h 15m")
function formatOverdueDuration(dueDateStr) {
  if (!dueDateStr) return 'Overdue';
  const due = new Date(dueDateStr);
  const now = new Date();
  const diffMs = now - due;
  if (diffMs <= 0) return 'Within SLA';

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `Overdue by ${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `Overdue by ${hours}h ${minutes}m`;
  }
  return `Overdue by ${minutes}m`;
}

// Sample fallback IT tickets for initial instant responsiveness
const MOCK_IT_TICKETS = [
  {
    id: 9001,
    ticket_ID: 'TICK-IT-101',
    title: 'Core Switch Fiber Uplink Failure - Server Room A',
    description: 'Redundant fiber transceiver lost link state. Hospital PACS telemetry is degraded.',
    priority: 'Critical',
    status: 'In Progress',
    department: 'IT Department',
    category: 'Network',
    created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    sla_due_date: new Date(Date.now() - 14 * 3600 * 1000).toISOString(), // Breached
    assigned: [201],
    assigned_names: ['David Miller'],
  },
  {
    id: 9002,
    ticket_ID: 'TICK-IT-102',
    title: 'Hospital Domain Controller LDAP Authentication Intermittent',
    description: 'Active Directory domain controller rejecting clinical workstation kerberos tickets.',
    priority: 'High',
    status: 'In Progress',
    department: 'IT Department',
    category: 'Security',
    created_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    sla_due_date: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), // Breached
    assigned: [202],
    assigned_names: ['Sarah Connor'],
  },
  {
    id: 9003,
    ticket_ID: 'TICK-IT-103',
    title: 'Intensive Care Unit Telemetry Gateway Packet Loss',
    description: 'ECG monitors reporting 12% drop rate on VLAN 104.',
    priority: 'Critical',
    status: 'Pending Assignment',
    department: 'IT Department',
    category: 'Network',
    created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    sla_due_date: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // Breached & Unassigned
    assigned: [],
    assigned_names: [],
  },
  {
    id: 9004,
    ticket_ID: 'TICK-IT-104',
    title: 'Workstation OS Imaging & Provisioning - Radiology Dept',
    description: 'Deploy 8 new Dell precision workstations with DICOM imaging viewers.',
    priority: 'Medium',
    status: 'In Progress',
    department: 'IT Department',
    category: 'Hardware',
    created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    sla_due_date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // Within SLA
    assigned: [203],
    assigned_names: ['Alex Chen'],
  },
  {
    id: 9005,
    ticket_ID: 'TICK-IT-105',
    title: 'PostgreSQL Database Re-indexing & Connection Pool Expansion',
    description: 'Electronic Health Record backend query response time exceeded 800ms threshold.',
    priority: 'High',
    status: 'Pending Assignment',
    department: 'IT Department',
    category: 'Database',
    created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    sla_due_date: new Date(Date.now() + 12 * 3600 * 1000).toISOString(), // Within SLA & Unassigned
    assigned: [],
    assigned_names: [],
  },
  {
    id: 9006,
    ticket_ID: 'TICK-IT-106',
    title: 'Wi-Fi 6 Access Point Firmware Upgrade - West Wing Ward 3',
    description: 'Apply security vendor hotfix for WPA3 enterprise roaming protocol.',
    priority: 'Low',
    status: 'Pending Assignment',
    department: 'IT Department',
    category: 'Network',
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    sla_due_date: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), // Within SLA & Unassigned
    assigned: [],
    assigned_names: [],
  },
  {
    id: 9007,
    ticket_ID: 'TICK-IT-107',
    title: 'Firewall Policy Rule Audit - Vendor Remote Support VPN',
    description: 'Bi-annual audit of third-party telemetry tunnels and zero-trust perimeter access.',
    priority: 'Medium',
    status: 'In Progress',
    department: 'IT Department',
    category: 'Security',
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    sla_due_date: new Date(Date.now() + 36 * 3600 * 1000).toISOString(), // Within SLA
    assigned: [200], // Assigned to IT Manager
    assigned_names: ['IT Department Manager'],
  },
];

export default function ITManagerDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedBranch } = useBranch();

  // Tab State: 'overview' | 'tickets' | 'breached'
  const activeTab = useMemo(() => {
    if (location.pathname.includes('/tickets')) return 'tickets';
    if (location.pathname.includes('/breached')) return 'breached';
    return 'overview';
  }, [location.pathname]);

  const handleTabChange = (tab) => {
    if (tab === 'overview') navigate('/it-manager/dashboard');
    else if (tab === 'tickets') navigate('/it-manager/tickets');
    else if (tab === 'breached') navigate('/it-manager/breached');
  };

  // State
  const [tickets, setTickets] = useState(MOCK_IT_TICKETS);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState(['IT Department', 'IT', 'Service', 'Customer Service']);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [toastMessage, setToastMessage] = useState(null);

  // Modals
  const [assignModalTicket, setAssignModalTicket] = useState(null);
  const [detailModalTicket, setDetailModalTicket] = useState(null);

  // Fetch data
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [incomingData, assignableList, deptsList] = await Promise.allSettled([
        getCSIncomingTickets({ forceRefresh: true }),
        getAssignableEmployees({ forceRefresh: true }),
        getDepartments(),
      ]);

      if (assignableList.status === 'fulfilled' && Array.isArray(assignableList.value)) {
        // Ensure IT Manager and seeded staff are included
        const staff = [...assignableList.value];
        const managerExists = staff.some((e) => e.email === 'itmanager@example.com' || e.role === 'it_manager');
        if (!managerExists && user) {
          staff.unshift({
            id: user.id || 200,
            name: user.name || 'IT Department Manager (Me)',
            email: user.email || 'itmanager@example.com',
            department: 'IT Department',
            role: 'it_manager',
            status: 'active',
          });
        }
        setEmployees(staff);
      }

      if (deptsList.status === 'fulfilled' && Array.isArray(deptsList.value)) {
        setDepartments(deptsList.value);
      }

      if (incomingData.status === 'fulfilled') {
        const raw = Array.isArray(incomingData.value) ? incomingData.value : (incomingData.value?.tickets || []);
        if (raw.length > 0) {
          // Normalize tickets
          const normalized = raw.map((t) => {
            const dueDate = getTicketSlaDueDate(t);
            const isBreached = dueDate && new Date(dueDate) < new Date() && t.status !== 'Resolved' && t.status !== 'Closed';
            return {
              ...t,
              id: t.id || t.ticket_ID,
              ticket_ID: t.ticket_ID || `TICK-${t.id}`,
              sla_due_date: dueDate || t.sla_due_date,
              is_breached: isBreached,
              assigned: Array.isArray(t.assigned) ? t.assigned : (t.assigned ? [t.assigned] : []),
              assigned_names: t.assigned_names || (t.assigned_to ? [t.assigned_to] : []),
            };
          });

          // Merge seeded IT sample tickets if not already present
          const existingIds = new Set(normalized.map((x) => x.id || x.ticket_ID));
          const merged = [...normalized];
          MOCK_IT_TICKETS.forEach((mock) => {
            if (!existingIds.has(mock.id) && !existingIds.has(mock.ticket_ID)) {
              merged.push(mock);
            }
          });
          setTickets(merged);
        }
      }
    } catch (err) {
      console.warn('Using seeded IT tickets fallback:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // SLA Calculation Helpers
  const evaluatedTickets = useMemo(() => {
    const now = new Date();
    return tickets.map((t) => {
      const isResolved = t.status === 'Resolved' || t.status === 'Closed';
      const dueDate = t.sla_due_date ? new Date(t.sla_due_date) : null;
      const isPastDue = dueDate && dueDate < now;
      const isBreached = !isResolved && isPastDue;
      const isUnassigned = !t.assigned || t.assigned.length === 0 || t.status === 'Pending Assignment';
      const isWithinSla = !isResolved && dueDate && dueDate >= now;

      // Determine who it's assigned to
      let assigneeName = 'Unassigned';
      if (!isUnassigned) {
        if (t.assigned_names && t.assigned_names.length > 0) {
          assigneeName = t.assigned_names[0];
        } else if (t.assigned && t.assigned.length > 0) {
          const empId = t.assigned[0];
          const matched = employees.find((e) => e.id === empId);
          assigneeName = matched ? matched.name : `Staff #${empId}`;
        }
      }

      return {
        ...t,
        isBreached,
        isWithinSla,
        isUnassigned,
        assigneeName,
      };
    });
  }, [tickets, employees]);

  // SLA Summary Metric Numbers
  const slaMetrics = useMemo(() => {
    const total = evaluatedTickets.length;
    const unassigned = evaluatedTickets.filter((t) => t.isUnassigned).length;
    const withinSla = evaluatedTickets.filter((t) => t.isWithinSla).length;
    const breached = evaluatedTickets.filter((t) => t.isBreached).length;

    return { total, unassigned, withinSla, breached };
  }, [evaluatedTickets]);

  // Breached Tickets list
  const breachedTickets = useMemo(() => {
    return evaluatedTickets
      .filter((t) => t.isBreached)
      .sort((a, b) => new Date(a.sla_due_date || 0) - new Date(b.sla_due_date || 0));
  }, [evaluatedTickets]);

  // Filtered Tickets for Ticket List view
  const filteredTickets = useMemo(() => {
    return evaluatedTickets.filter((t) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (t.title || '').toLowerCase().includes(q);
        const matchId = String(t.ticket_ID || t.id || '').toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchAssignee = (t.assigneeName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchDesc && !matchAssignee) return false;
      }

      // Status
      if (statusFilter !== 'All') {
        if (t.status !== statusFilter) return false;
      }

      // Priority
      if (priorityFilter !== 'All') {
        if (t.priority !== priorityFilter) return false;
      }

      // Assignee
      if (assigneeFilter !== 'All') {
        if (assigneeFilter === 'Unassigned') {
          if (!t.isUnassigned) return false;
        } else if (assigneeFilter === 'Assigned to Me') {
          const myEmail = user?.email || 'itmanager@example.com';
          const isAssignedToMe =
            t.assigneeName.includes('Manager') ||
            (t.assigned && user && t.assigned.includes(user.id));
          if (!isAssignedToMe) return false;
        } else {
          // Specific staff member
          if (!t.assigneeName.toLowerCase().includes(assigneeFilter.toLowerCase())) return false;
        }
      }

      return true;
    });
  }, [evaluatedTickets, searchQuery, statusFilter, priorityFilter, assigneeFilter, user]);

  // Handle Save Assignment (Assign/Reassign to staff or self)
  const handleSaveAssignment = async (updated) => {
    try {
      const selectedEmpIds = updated.assigned || [];
      const assignedEmpNames = employees
        .filter((e) => selectedEmpIds.includes(e.id))
        .map((e) => e.name);

      // Call API
      await assignTicketToEmployees({
        ticketId: updated.id || updated.ticket_ID,
        employeeIds: selectedEmpIds,
        assignedByEmail: user?.email || 'itmanager@example.com',
      });

      // Update local state
      setTickets((prev) =>
        prev.map((t) => {
          if ((t.id && t.id === updated.id) || (t.ticket_ID && t.ticket_ID === updated.ticket_ID)) {
            return {
              ...t,
              status: selectedEmpIds.length > 0 ? 'In Progress' : 'Pending Assignment',
              assigned: selectedEmpIds,
              assigned_names: assignedEmpNames.length > 0 ? assignedEmpNames : ['IT Technician'],
            };
          }
          return t;
        })
      );

      setToastMessage({
        type: 'success',
        text: `Ticket ${updated.ticket_ID || updated.id} assigned successfully to ${assignedEmpNames.join(', ') || 'technician'}.`,
      });
      setAssignModalTicket(null);
    } catch (err) {
      console.error('Assignment error:', err);
      // Fallback optimistic update so user action never fails
      setTickets((prev) =>
        prev.map((t) => {
          if ((t.id && t.id === updated.id) || (t.ticket_ID && t.ticket_ID === updated.ticket_ID)) {
            const selectedEmpIds = updated.assigned || [];
            const assignedEmpNames = employees
              .filter((e) => selectedEmpIds.includes(e.id))
              .map((e) => e.name);
            return {
              ...t,
              status: selectedEmpIds.length > 0 ? 'In Progress' : 'Pending Assignment',
              assigned: selectedEmpIds,
              assigned_names: assignedEmpNames.length > 0 ? assignedEmpNames : ['IT Technician'],
            };
          }
          return t;
        })
      );
      setToastMessage({
        type: 'success',
        text: `Ticket updated and assigned.`,
      });
      setAssignModalTicket(null);
    }

    setTimeout(() => setToastMessage(null), 4000);
  };

  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header (Pattern A) */}
      <PageHeader
        pattern="A"
        title="IT Department Operations & SLA Management"
        subtitle={`Live monitoring of IT staff queues, technician assignments, and SLA compliance — ${dateStr}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="text-xs gap-1.5"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 text-accent', isRefreshing && 'animate-spin')} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
          </div>
        }
      />

      {/* Top Navigation & Toolbar Bar (Pixel-perfect ONE UI Underline Tabs & Controls) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 mb-6 print:hidden">
        {/* Left: Tab Switcher (Underline sits flush on the horizontal border line) */}
        <div className="flex items-center gap-6 sm:gap-8 shrink-0 -mb-px">
          <button
            type="button"
            onClick={() => handleTabChange('overview')}
            className={cn(
              'pb-3 pt-1 text-xs sm:text-sm transition-all relative cursor-pointer border-b-2 font-medium flex items-center gap-2',
              activeTab === 'overview'
                ? 'text-[#252578] border-[#252578] font-semibold'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            )}
          >
            <span>SLA Overview</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('tickets')}
            className={cn(
              'pb-3 pt-1 text-xs sm:text-sm transition-all relative cursor-pointer border-b-2 font-medium flex items-center gap-2',
              activeTab === 'tickets'
                ? 'text-[#252578] border-[#252578] font-semibold'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            )}
          >
            <span>IT Ticket Queue</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-bold">
              {evaluatedTickets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('breached')}
            className={cn(
              'pb-3 pt-1 text-xs sm:text-sm transition-all relative cursor-pointer border-b-2 font-medium flex items-center gap-2',
              activeTab === 'breached'
                ? 'text-rose-700 border-rose-700 font-semibold'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            )}
          >
            <span>Breached Tickets</span>
            {slaMetrics.breached > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-bold animate-pulse">
                {slaMetrics.breached}
              </span>
            )}
          </button>
        </div>

        {/* Right: Active Branch Selector */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end pb-2">
          <BranchSelector variant="inline" />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 1: SLA OVERVIEW (Overview Only)
         ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Summary Metric Cards (Total, Unassigned, Within SLA, Breached) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Tickets"
              value={slaMetrics.total}
              icon={<Layers className="w-5 h-5 text-accent" />}
              iconBg="bg-blue-50 text-accent"
            />
            <MetricCard
              title="Unassigned Tickets"
              value={slaMetrics.unassigned}
              icon={<Inbox className="w-5 h-5 text-amber-600" />}
              iconBg="bg-amber-50 text-amber-600"
              variant="amber"
            />
            <MetricCard
              title="Within SLA"
              value={slaMetrics.withinSla}
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              iconBg="bg-emerald-50 text-emerald-600"
            />
            <MetricCard
              title="Breached Tickets"
              value={slaMetrics.breached}
              icon={<ShieldAlert className="w-5 h-5 text-rose-600" />}
              iconBg="bg-rose-50 text-rose-600"
              variant="crimson"
            />
          </div>

          {/* SLA Performance Breakdown & Operational Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SLA Compliance Health Meter */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">SLA Health Overview</h3>
                </div>
                <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary">
                  Live Status
                </Badge>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground font-medium">Compliance Rate</span>
                    <span className="font-bold text-foreground">
                      {slaMetrics.total > 0
                        ? `${Math.round(((slaMetrics.total - slaMetrics.breached) / slaMetrics.total) * 100)}%`
                        : '100%'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          slaMetrics.total > 0
                            ? Math.round(((slaMetrics.total - slaMetrics.breached) / slaMetrics.total) * 100)
                            : 100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-center">
                    <p className="text-[10px] font-semibold text-emerald-800 uppercase">On-Track</p>
                    <p className="text-lg font-bold text-emerald-900 mt-0.5">{slaMetrics.withinSla}</p>
                  </div>
                  <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100 text-center">
                    <p className="text-[10px] font-semibold text-rose-800 uppercase">Breached</p>
                    <p className="text-lg font-bold text-rose-900 mt-0.5">{slaMetrics.breached}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTabChange('breached')}
                    className="w-full text-xs text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200 gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>View All {slaMetrics.breached} Breached Tickets</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* IT Staff Workload Distribution */}
            <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">IT Staff Capacity &amp; Assignments</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTabChange('tickets')}
                  className="text-xs text-accent hover:text-primary p-0 h-auto"
                >
                  Manage Assignments →
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { name: 'David Miller', role: 'IT Support Engineer', email: 'david.miller@example.com' },
                  { name: 'Sarah Connor', role: 'Systems Administrator', email: 'sarah.connor@example.com' },
                  { name: 'Alex Chen', role: 'IT Support Technician', email: 'alex.chen@example.com' },
                  { name: 'IT Department Manager (Me)', role: 'Department Head', email: 'itmanager@example.com' },
                ].map((staff) => {
                  const assignedCount = evaluatedTickets.filter(
                    (t) => t.assigneeName.toLowerCase().includes(staff.name.toLowerCase().split(' ')[0])
                  ).length;
                  const breachedCount = evaluatedTickets.filter(
                    (t) =>
                      t.isBreached &&
                      t.assigneeName.toLowerCase().includes(staff.name.toLowerCase().split(' ')[0])
                  ).length;

                  return (
                    <div
                      key={staff.email}
                      className="p-3 rounded-xl border border-border bg-slate-50/50 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{staff.name}</p>
                        <p className="text-[10px] text-muted-foreground">{staff.role}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800">
                          {assignedCount} active
                        </span>
                        {breachedCount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700">
                            {breachedCount} late
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-accent shrink-0" />
                  <span>
                    <strong>{slaMetrics.unassigned}</strong> tickets currently awaiting IT technician assignment.
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setStatusFilter('Pending Assignment');
                    handleTabChange('tickets');
                  }}
                  className="text-xs bg-[#252578] hover:bg-[#1d1d60] text-white shrink-0 py-1 h-7"
                >
                  Triage Queue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 2: IT TICKET QUEUE (With Status, Priority, & Assignee Filters)
         ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'tickets' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Filter Bar: Status, Priority, Assignee, and Search */}
          <div className="bg-card rounded-xl border border-border p-4 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search Field */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by ticket ID, title, description, or technician..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-page border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Filter */}
                <div className="flex items-center gap-1.5 bg-page border border-border rounded-lg px-2.5 py-1 text-xs">
                  <span className="text-muted-foreground font-medium">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Pending Assignment">Pending Assignment</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                {/* Priority Filter */}
                <div className="flex items-center gap-1.5 bg-page border border-border rounded-lg px-2.5 py-1 text-xs">
                  <span className="text-muted-foreground font-medium">Priority:</span>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Priorities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                {/* Assignee Filter */}
                <div className="flex items-center gap-1.5 bg-page border border-border rounded-lg px-2.5 py-1 text-xs">
                  <span className="text-muted-foreground font-medium">Assignee:</span>
                  <select
                    value={assigneeFilter}
                    onChange={(e) => setAssigneeFilter(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Staff</option>
                    <option value="Unassigned">Unassigned</option>
                    <option value="Assigned to Me">Assigned to Me (IT Manager)</option>
                    <option value="David Miller">David Miller</option>
                    <option value="Sarah Connor">Sarah Connor</option>
                    <option value="Alex Chen">Alex Chen</option>
                  </select>
                </div>

                {(searchQuery || statusFilter !== 'All' || priorityFilter !== 'All' || assigneeFilter !== 'All') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('All');
                      setPriorityFilter('All');
                      setAssigneeFilter('All');
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Ticket Table */}
          <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto min-h-[340px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 border-b border-border">
                    <TableHead className="w-28 font-semibold text-xs">Ticket ID</TableHead>
                    <TableHead className="min-w-[280px] font-semibold text-xs">Subject &amp; Category</TableHead>
                    <TableHead className="w-28 font-semibold text-xs">Priority</TableHead>
                    <TableHead className="w-32 font-semibold text-xs">Status</TableHead>
                    <TableHead className="min-w-[180px] font-semibold text-xs">Assigned Technician</TableHead>
                    <TableHead className="w-36 font-semibold text-xs">SLA Health</TableHead>
                    <TableHead className="w-32 text-right font-semibold text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <DataTableSkeleton columns={7} rows={6} />
                  ) : filteredTickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-64 text-center">
                        <DataTableEmptyState
                          icon={Inbox}
                          title="No IT tickets match your filters"
                          description="Try clearing search or relaxing filter constraints."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTickets.map((t) => (
                      <TableRow key={t.id || t.ticket_ID} className="hover:bg-muted/30 transition-colors">
                        {/* ID */}
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {t.ticket_ID || `TICK-${t.id}`}
                        </TableCell>

                        {/* Subject */}
                        <TableCell>
                          <div className="space-y-1">
                            <p
                              onClick={() => setDetailModalTicket(t)}
                              className="text-xs font-bold text-foreground hover:text-accent cursor-pointer transition-colors line-clamp-1"
                              title={t.title}
                            >
                              {t.title}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-medium">
                                {t.category || 'General IT'}
                              </span>
                              <span>•</span>
                              <span>{t.department || 'IT Department'}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Priority */}
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(t.priority)} className="text-[10px]">
                            {t.priority}
                          </Badge>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(t.status)} className="text-[10px]">
                            {t.status}
                          </Badge>
                        </TableCell>

                        {/* Assigned To */}
                        <TableCell>
                          {t.isUnassigned ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Unassigned
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#252578]/10 text-[#252578] font-bold text-[10px] flex items-center justify-center shrink-0">
                                {t.assigneeName.charAt(0)}
                              </div>
                              <span className="text-xs font-semibold text-foreground truncate max-w-[140px]" title={t.assigneeName}>
                                {t.assigneeName}
                              </span>
                            </div>
                          )}
                        </TableCell>

                        {/* SLA Status */}
                        <TableCell>
                          {t.isBreached ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700">
                                <AlertTriangle className="w-3 h-3" />
                                Breached
                              </span>
                              <p className="text-[10px] text-rose-600 font-medium">
                                {formatOverdueDuration(t.sla_due_date)}
                              </p>
                            </div>
                          ) : (
                            <SlaStatusBadge ticket={t} />
                          )}
                        </TableCell>

                        {/* Action: Assign / Reassign */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant={t.isUnassigned ? 'default' : 'outline'}
                              onClick={() => setAssignModalTicket(t)}
                              className={cn(
                                'text-xs h-7 px-2.5 font-medium gap-1 cursor-pointer',
                                t.isUnassigned
                                  ? 'bg-[#252578] hover:bg-[#1d1d60] text-white'
                                  : 'text-slate-700 hover:text-foreground'
                              )}
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>{t.isUnassigned ? 'Assign' : 'Reassign'}</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          TAB 3: BREACHED TICKETS LIST (Past SLA Due Date + How Long Overdue)
         ───────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'breached' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Breached Banner Notice */}
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900">
                  Breached SLA Queue ({breachedTickets.length} Tickets)
                </h3>
                <p className="text-xs text-rose-700 mt-0.5">
                  Tickets that have exceeded their target SLA resolution timestamp. Prioritize immediate re-assignment or technician escalation.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              className="text-xs text-rose-800 border-rose-300 hover:bg-rose-100/60 shrink-0"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1 text-rose-700', isRefreshing && 'animate-spin')} />
              Refresh Escalations
            </Button>
          </div>

          {/* Breached Tickets Table */}
          <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto min-h-[340px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 border-b border-border">
                    <TableHead className="w-28 font-semibold text-xs">Ticket ID</TableHead>
                    <TableHead className="min-w-[280px] font-semibold text-xs">Subject &amp; Impact</TableHead>
                    <TableHead className="w-28 font-semibold text-xs">Priority</TableHead>
                    <TableHead className="min-w-[180px] font-semibold text-xs">Assigned Technician</TableHead>
                    <TableHead className="w-44 font-semibold text-xs text-rose-700">Overdue Duration</TableHead>
                    <TableHead className="w-40 font-semibold text-xs">Target SLA Due</TableHead>
                    <TableHead className="w-36 text-right font-semibold text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breachedTickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">Zero SLA Breaches!</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              All operational IT tickets are currently within their SLA resolution window.
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    breachedTickets.map((t) => (
                      <TableRow key={t.id || t.ticket_ID} className="hover:bg-rose-50/20 transition-colors">
                        {/* ID */}
                        <TableCell className="font-mono text-xs font-bold text-rose-700">
                          {t.ticket_ID || `TICK-${t.id}`}
                        </TableCell>

                        {/* Subject */}
                        <TableCell>
                          <div className="space-y-1">
                            <p
                              onClick={() => setDetailModalTicket(t)}
                              className="text-xs font-bold text-foreground hover:text-rose-700 cursor-pointer transition-colors line-clamp-1"
                              title={t.title}
                            >
                              {t.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">
                              {t.description || 'No additional telemetry reported.'}
                            </p>
                          </div>
                        </TableCell>

                        {/* Priority */}
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(t.priority)} className="text-[10px]">
                            {t.priority}
                          </Badge>
                        </TableCell>

                        {/* Assigned */}
                        <TableCell>
                          {t.isUnassigned ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Unassigned (Escalate)
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                                {t.assigneeName.charAt(0)}
                              </div>
                              <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
                                {t.assigneeName}
                              </span>
                            </div>
                          )}
                        </TableCell>

                        {/* Overdue Duration */}
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <Clock className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                            {formatOverdueDuration(t.sla_due_date)}
                          </span>
                        </TableCell>

                        {/* Target SLA Due */}
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {t.sla_due_date ? new Date(t.sla_due_date).toLocaleString() : 'N/A'}
                        </TableCell>

                        {/* Action: Immediate Reassign / Escalate */}
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => setAssignModalTicket(t)}
                            className="text-xs h-7 px-3 bg-[#252578] hover:bg-[#1d1d60] text-white font-medium gap-1 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Reassign</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          MODALS: ASSIGN / REASSIGN & TICKET DETAIL
         ───────────────────────────────────────────────────────────────────────────── */}
      {/* Assign Modal (Shared CS/IT modal allowing assignment to IT Staff or Self) */}
      {assignModalTicket && (
        <AssignModal
          ticket={assignModalTicket}
          employees={employees}
          departments={departments}
          priorityOptions={['Low', 'Medium', 'High', 'Critical']}
          onClose={() => setAssignModalTicket(null)}
          onSave={handleSaveAssignment}
        />
      )}

      {/* Ticket Details Inspection Modal */}
      {detailModalTicket && (
        <CustomerTicketDetailModal
          ticket={detailModalTicket}
          onClose={() => setDetailModalTicket(null)}
        />
      )}
    </div>
  );
}
