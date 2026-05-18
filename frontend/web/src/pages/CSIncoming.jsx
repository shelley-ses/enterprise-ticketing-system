import React, { useState, useMemo, useEffect } from 'react';
import actionIcon from '@/assets/action.png';
import Pagination from '@/components/Pagination';
import { useAuth } from '@/context/AuthContext';
import {
  getCSIncomingTickets,
  getAssignableEmployees,
  
} from '@/services/ticketService';
import { getDepartments, acceptTicket, getTicketFormOptions } from '@/services/ticketService';

/* ─────────────────────────────────────────────
   CONFIRMATION DIALOG
───────────────────────────────────────────── */
function ConfirmDialog({ onConfirm, onCancel, isSaving = false }) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-105 max-w-full shadow-2xl p-7 flex flex-col items-center text-center">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-[#252578]/10 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-[#252578]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h4 className="text-lg font-bold text-gray-800 mb-2">
          Update this ticket?
        </h4>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Are you sure you want to save the changes to this ticket? This will update the assignment and priority.
        </p>

        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#252578] hover:bg-[#1e1e60] rounded-xl transition-colors shadow-lg shadow-[#252578]/30"
          >
            {isSaving ? 'Saving...' : 'Yes, Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TICKET SUMMARY VIEW (post-save / already assigned)
───────────────────────────────────────────── */
function TicketSummary({ ticket, employees, onClose, onEdit }) {
  const assignedEmployees = employees.filter((e) =>
    (ticket.assigned || []).includes(e.id)
  );

  const priorityColors = {
    Critical: 'bg-red-100 text-red-700',
    High: 'bg-orange-100 text-orange-700',
    Medium: 'bg-yellow-100 text-yellow-700',
    Low: 'bg-green-100 text-green-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white/95 backdrop-blur-lg rounded-3xl w-140 max-w-full max-h-[90vh] flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.12)]">

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-[#252578] transition-colors text-sm"
          >
            ✕
          </button>

          {/* Header badge */}
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">
              Ticket Assigned
            </span>
          </div>

          <h3 className="text-xl font-bold text-[#252578] mb-5">
            Ticket Summary
          </h3>

          {/* Ticket card */}
          <div className="bg-[#252578] text-white rounded-2xl p-4 mb-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs opacity-70 mb-1">{ticket.id}</div>
                <div className="text-sm font-semibold leading-snug">{ticket.title}</div>
                <div className="text-xs opacity-60 mt-1">{ticket.category}</div>
              </div>
              <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full font-medium shrink-0">
                {ticket.sla}
              </span>
            </div>
          </div>

          {/* Summary rows */}
          <div className="space-y-3">
            {/* Status */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-xs font-medium text-gray-500">Status</span>
              <span className="text-xs font-semibold px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                {ticket.status || 'Pending'}
              </span>
            </div>

            {/* Department */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-xs font-medium text-gray-500">Department</span>
              <span className="text-xs font-semibold text-gray-800">
                {ticket.department || '—'}
              </span>
            </div>

            {/* Priority */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <span className="text-xs font-medium text-gray-500">Priority</span>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${priorityColors[ticket.priority] || 'bg-gray-100 text-gray-600'}`}>
                {ticket.priority || '—'}
              </span>
            </div>

            {/* Assigned Employees */}
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <div className="text-xs font-medium text-gray-500 mb-2">
                Assigned Employee(s)
              </div>
              {assignedEmployees.length === 0 ? (
                <div className="text-xs text-gray-400 italic">None assigned</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {assignedEmployees.map((emp) => (
                    <div
                      key={emp.id}
                      className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${emp.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="text-xs font-medium text-gray-700">{emp.name}</span>
                      <span className="text-[10px] text-gray-400">{emp.department}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="px-6 py-2.5 bg-[#252578] text-white text-xs font-semibold rounded-xl hover:bg-[#1e1e60] transition-colors shadow-lg shadow-[#252578]/30 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Reassign
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ASSIGN MODAL
───────────────────────────────────────────── */
function AssignModal({ ticket, employees, departments, priorityOptions, onClose, onSave }) {
  const [priority, setPriority] = useState(ticket?.priority || 'Low');
  const [department, setDepartment] = useState(ticket?.department || '');
  const [selectedEmployees, setSelectedEmployees] = useState(ticket?.assigned || []);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Lock background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!ticket) return null;

  const employeesInDept = useMemo(() => {
    const list = employees.filter((e) =>
      department ? e.department === department : true
    );
    list.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [department]);

  const toggleEmp = (id) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAcceptClick = () => {
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (isSaving) return;

    const updated = {
      ...ticket,
      priority,
      department: department || null,
      assigned: selectedEmployees,
      status: department ? 'Assigned' : ticket.status,
    };

    setIsSaving(true);
    try {
      const saved = await onSave(updated);
      if (saved) {
        setShowConfirm(false);
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl w-155 max-w-full max-h-[90vh] flex flex-col relative shadow-[0_8px_32px_rgba(0,0,0,0.08)]">

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 p-6">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-[#252578] transition-colors text-sm"
            >
              ✕
            </button>

            <h3 className="text-xl font-bold text-[#252578] mb-4">
              {ticket.status === 'Assigned' ? 'Reassign Ticket' : 'Assign Ticket'}
            </h3>

            {/* Ticket Info */}
            <div className="bg-[#252578] text-white rounded-2xl p-4 mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs opacity-80">{ticket.id}</div>
                <div className="text-sm font-semibold mt-0.5">{ticket.title}</div>
                <div className="text-xs opacity-70 mt-0.5">{ticket.category}</div>
              </div>
              <span className="bg-white text-[#252578] text-xs px-3 py-1 rounded-full font-medium shrink-0 ml-3">
                {ticket.sla}
              </span>
            </div>

            {/* Department */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setSelectedEmployees([]);
                }}
                className="w-full px-3 py-2.5 text-sm bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm"
              >
                <option value="">Select department...</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Priority
              </label>
              <div className="flex gap-2 flex-wrap">
                {priorityOptions.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`px-4 py-1.5 rounded-xl transition-all text-xs font-medium ${
                      priority === p
                        ? 'bg-[#252578] text-white shadow-lg'
                        : 'bg-white hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Employees */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Assign Employee(s)
                {selectedEmployees.length > 0 && (
                  <span className="ml-2 text-[#252578] font-semibold">
                    ({selectedEmployees.length} selected)
                  </span>
                )}
              </label>

              {/* Selected employee chips */}
              {selectedEmployees.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedEmployees.map((id) => {
                    const emp = employees.find((e) => e.id === id);
                    if (!emp) return null;
                    return (
                      <span
                        key={id}
                        className="flex items-center gap-1 bg-[#252578]/10 text-[#252578] text-[11px] font-medium px-2.5 py-1 rounded-full"
                      >
                        {emp.name}
                        <button
                          type="button"
                          onClick={() => toggleEmp(id)}
                          disabled={isSaving}
                          className="ml-0.5 font-bold hover:text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="max-h-44 overflow-auto bg-gray-50 rounded-2xl p-2">
                {employeesInDept.length === 0 ? (
                  <div className="text-xs text-gray-500 p-2">
                    Select a department to see employees
                  </div>
                ) : (
                  employeesInDept.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex items-center justify-between gap-2 px-2 py-2 hover:bg-white rounded-xl transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(emp.id)}
                          onChange={() => toggleEmp(emp.id)}
                          className="w-3.5 h-3.5 accent-[#252578]"
                        />
                        <div>
                          <div className="text-xs font-medium text-gray-800">{emp.name}</div>
                          <div className="text-[11px] text-gray-500">{emp.department} • {emp.status}</div>
                        </div>
                      </div>
                      <div className={`text-[11px] px-2 py-0.5 rounded-full ${
                        emp.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {emp.status === 'active' ? 'Active' : 'Inactive'}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAcceptClick}
              disabled={isSaving}
              className="px-7 py-2.5 bg-[#252578] text-white text-xs font-semibold rounded-xl hover:bg-[#1e1e60] transition-colors shadow-lg shadow-[#252578]/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : ticket.status === 'Assigned' ? 'Save Changes' : 'Accept Ticket'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation dialog layered on top */}
      {showConfirm && (
        <ConfirmDialog
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
          isSaving={isSaving}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function CSIncoming() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [priorityOptions, setPriorityOptions] = useState(['Low','Medium','High','Critical']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [slaFilter, setSlaFilter] = useState('All SLA');
  const [machineFilter, setMachineFilter] = useState('All Machines');

  // modal state: null | { mode: 'assign'|'summary', ticket }
  const [modal, setModal] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [incoming, assignees, deps, options] = await Promise.all([
          getCSIncomingTickets({ limit: 100 }),
          getAssignableEmployees(),
          getDepartments(),
          getTicketFormOptions(),
        ]);

        if (!mounted) return;
        setTickets(incoming);
        setEmployees(
          assignees.map((row) => ({
            id: Number(row.id),
            name: row.name,
            status: row.is_active ? 'active' : 'inactive',
            department: row.department || 'Unassigned',
          }))
        );
        setDepartments((deps?.departments || []).map((d) => d.name));
        setPriorityOptions((options?.ticket_priorities || []).map((p) => p.priority_name));
      } catch {
        if (!mounted) return;
        setError('Unable to load incoming tickets from ticket-service.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(
    () => ['All Categories', ...Array.from(new Set(tickets.map((t) => t.category)))],
    [tickets]
  );

  const machines = useMemo(
    () => ['All Machines', ...Array.from(new Set(tickets.map((t) => t.equipment).filter(Boolean)))],
    [tickets]
  );

  const slaOptions = ['All SLA', 'On Track', 'At Risk', 'Breached'];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (category !== 'All Categories' && t.category !== category) return false;
      if (slaFilter !== 'All SLA' && t.sla !== slaFilter) return false;
      if (machineFilter !== 'All Machines' && t.equipment !== machineFilter) return false;
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.equipment && t.equipment.toLowerCase().includes(q))
      );
    });
  }, [tickets, search, category, slaFilter, machineFilter]);

  const ITEMS_PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [filtered.length, totalPages, page]);

  const paginated = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  const handleRowAction = (t) => {
    // If already assigned → show summary first; otherwise go straight to assign
    if (t.status === 'Assigned') {
      setModal({ mode: 'summary', ticket: t });
    } else {
      setModal({ mode: 'assign', ticket: t });
    }
  };

  const handleSave = async (updated) => {
    const priorityMap = {
      Low: 1,
      Medium: 2,
      High: 3,
      Critical: 4,
    };

    try {
      await acceptTicket({
        ticketId: updated.ticket_ID,
        employeeIds: updated.assigned,
        assignedByEmail: user?.email,
        priorityId: priorityMap[updated.priority] ?? 1,
      });

      // Soft data refetch
      try {
        const incoming = await getCSIncomingTickets({ limit: 100 });
        setTickets(incoming);
        
        // Find the newly updated ticket to show in summary
        const refreshedTicket = incoming.find(t => t.ticket_ID === updated.ticket_ID) || {
          ...updated,
          status: 'Assigned',
        };
        setModal({ mode: 'summary', ticket: refreshedTicket });
      } catch (e) {
        // Fallback to local state if refetch fails
        const refreshed = {
          ...updated,
          status: 'Assigned',
        };
        setTickets((prev) => prev.map((t) => (t.ticket_ID === updated.ticket_ID ? refreshed : t)));
        setModal({ mode: 'summary', ticket: refreshed });
      }
      return true;
    } catch (err) {
      setError('Failed to assign ticket. Please try again.');
      console.error(err);
      return false;
    }
  };

  return (
    <div className="p-6">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#252578]">Incoming Tickets</h1>
        <p className="text-gray-500 mt-2">Triage and assign new support tickets</p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center text-gray-500">Loading incoming tickets...</div>
      ) : (
        <>

      {/* Search & Filters */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets, customers..."
            className="w-full px-4 py-3 bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            className="px-4 py-3 bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm"
          >
            {machines.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-4 py-3 bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 flex-wrap">
            {slaOptions.map((s) => (
              <button
                key={s}
                onClick={() => setSlaFilter(s)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  slaFilter === s
                    ? 'bg-[#252578] text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-6">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-[#252578]">Incoming Tickets</h2>
          <div className="text-sm text-gray-500">{filtered.length} tickets</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead>
              <tr className="text-gray-500">
                <th className="py-4 px-4">Ticket ID</th>
                <th className="py-4 px-4">Customer</th>
                <th className="py-4 px-4">Title</th>
                <th className="py-4 px-4">Category</th>
                <th className="py-4 px-4">SLA Status</th>
                <th className="py-4 px-4">Date Submitted</th>
                <th className="py-4 px-4">Action</th>
              </tr>
            </thead>

            <tbody className="text-gray-700">
              {paginated.map((t, idx) => (
                <tr
                  key={t.id}
                  className={`${
                    idx === 0 && page === 1 ? 'bg-blue-50' : 'hover:bg-gray-50'
                  } transition-all`}
                >
                  <td className="py-4 px-4 font-medium">{t.id}</td>
                  <td className="py-4 px-4 text-gray-600">{t.customer}</td>
                  <td className="py-4 px-4 text-gray-700">{t.title}</td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-gray-100 rounded-full text-xs">{t.category}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">{t.sla}</span>
                  </td>
                  <td className="py-4 px-4 text-gray-500">{t.date}</td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => handleRowAction(t)}
                      className="p-2 rounded-xl hover:bg-gray-100 transition-all"
                    >
                      <img src={actionIcon} alt="action" className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing{' '}
            {filtered.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1}
            {' '}-{' '}
            {Math.min(page * ITEMS_PER_PAGE, filtered.length)}
            {' '}of {filtered.length}
          </div>
          <Pagination
            totalItems={filtered.length}
            itemsPerPage={ITEMS_PER_PAGE}
            currentPage={page}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      </div>
        </>
      )}

      {/* Modals */}
      {modal?.mode === 'summary' && (
        <TicketSummary
          ticket={modal.ticket}
          employees={employees}
          onClose={() => setModal(null)}
          onEdit={() => setModal({ mode: 'assign', ticket: modal.ticket })}
        />
      )}

      {modal?.mode === 'assign' && (
        <AssignModal
          ticket={modal.ticket}
          employees={employees}
          departments={departments}
          priorityOptions={priorityOptions}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}