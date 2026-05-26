import React, { useState, useMemo, useEffect } from 'react';
import actionIcon from '@/assets/action.png';
import Pagination from '@/components/Pagination';
import { useAuth } from '@/context/AuthContext';
import {
  getCSIncomingTickets,
  getAssignableEmployees,
  getDepartments,
  acceptTicket,
  getTicketFormOptions,
  updateEmployeeTicketOverride,
} from '@/services/ticketService';
import { TicketSummary, AssignModal } from '@/components/CSModals';

export default function CSAssigned() {
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
        // Assigned page: only show properly assigned tickets (not reassignment-requested ones)
        // Reassignment-requested tickets should be handled from the Incoming page
        const assignedTickets = incoming.filter(t =>
          (t.status === 'Assigned' || t.status === 'In Progress' ||
           t.status === 'Pending Validation' || t.status === 'Resolved') &&
          !t.reassignmentRequested
        );
        setTickets(assignedTickets);
        
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
        setError('Unable to load assigned tickets from ticket-service.');
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

  const slaOptions = ['All SLA', 'On Track', 'At Risk', 'Breached', 'Closed'];

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
    // Always show summary first for already assigned tickets
    setModal({ mode: 'summary', ticket: t });
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
        ticketId: updated.ticket_ID || updated.id.replace(/\D/g, ''),
        employeeIds: updated.assigned,
        assignedByEmail: user?.email,
        priorityId: priorityMap[updated.priority] ?? 1,
      });

      // Soft data refetch
      try {
        const incoming = await getCSIncomingTickets({ limit: 100, forceRefresh: true });
        const assignedTickets = incoming.filter(t => t.status !== 'New' && t.status !== 'Pending');
        setTickets(assignedTickets);
        
        const refreshedTicket = assignedTickets.find(t => t.ticket_ID === updated.ticket_ID) || {
          ...updated,
          status: 'Assigned',
        };
        setModal({ mode: 'summary', ticket: refreshedTicket });
      } catch (e) {
        const refreshed = { ...updated, status: 'Assigned' };
        setTickets((prev) => prev.map((t) => ((t.ticket_ID === updated.ticket_ID || t.id === updated.id) ? refreshed : t)));
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
        <h1 className="text-3xl font-bold text-[#252578]">Assigned Tickets</h1>
        <p className="text-gray-500 mt-2">Manage and track ongoing assigned support tickets</p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 text-red-700 px-4 py-2 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center text-gray-500">Loading assigned tickets...</div>
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

          <select
            value={slaFilter}
            onChange={(e) => setSlaFilter(e.target.value)}
            className="px-4 py-3 bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm font-semibold text-xs text-gray-700 cursor-pointer"
          >
            {slaOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-6">

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-[#252578]">Assigned Tickets</h2>
          <div className="text-sm text-gray-500">{filtered.length} tickets</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead>
              <tr className="text-gray-500 border-b border-gray-100">
                <th className="py-4 px-4 font-semibold">Ticket ID</th>
                <th className="py-4 px-4 font-semibold">Customer</th>
                <th className="py-4 px-4 font-semibold">Title</th>
                <th className="py-4 px-4 font-semibold">Category</th>
                <th className="py-4 px-4 font-semibold">Status</th>
                <th className="py-4 px-4 font-semibold">SLA Status</th>
                <th className="py-4 px-4 font-semibold">Date Submitted</th>
                <th className="py-4 px-4 font-semibold text-center">Action</th>
              </tr>
            </thead>

            <tbody className="text-gray-700">
              {paginated.map((t, idx) => {
                const isReassignmentReq = t.reassignmentRequested;
                
                return (
                  <tr
                    key={t.id}
                    onClick={() => handleRowAction(t)}
                    className={`cursor-pointer transition-all border-b border-gray-50 ${
                      isReassignmentReq 
                        ? 'bg-red-50 hover:bg-red-100' 
                        : (idx === 0 && page === 1 ? 'bg-blue-50/50 hover:bg-gray-50' : 'hover:bg-gray-50')
                    }`}
                  >
                    <td className="py-4 px-4 font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span className={isReassignmentReq ? 'text-red-700 font-bold' : ''}>{t.id}</span>
                        {isReassignmentReq && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-600 text-white shrink-0 w-max mt-1 animate-pulse shadow-sm">
                            Immediate Action Required
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-600">{t.customer}</td>
                    <td className="py-4 px-4 text-gray-700">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold">{t.title}</span>
                        {t.status === 'Pending Validation' && !isReassignmentReq && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 shrink-0 w-max mt-0.5 animate-pulse">
                            Pending Validation
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-3 py-1 bg-gray-100 rounded-full text-xs">{t.category}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        t.status === 'Pending Validation' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}>{t.status}</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        t.sla === 'Breached' ? 'bg-red-100 text-red-700' :
                        t.sla === 'At Risk' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>{t.sla}</span>
                    </td>
                    <td className="py-4 px-4 text-gray-500">{t.date}</td>
                    <td className="py-4 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowAction(t);
                        }}
                        className={`p-2 rounded-xl transition-all ${
                          isReassignmentReq ? 'bg-red-100 hover:bg-red-200' : 'hover:bg-gray-200 bg-gray-50'
                        }`}
                      >
                        <img src={actionIcon} alt="action" className="w-5 h-5 opacity-70" />
                      </button>
                    </td>
                  </tr>
                );
              })}
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
          onStatusUpdate={async (updatedFields) => {
            updateEmployeeTicketOverride(updatedFields.id || modal.ticket.id, updatedFields);
            
            // Soft reload the list to reflect updates immediately
            try {
              const incoming = await getCSIncomingTickets({ limit: 100, forceRefresh: true });
              const assignedTickets = incoming.filter(t => t.status !== 'New' && t.status !== 'Pending');
              setTickets(assignedTickets);
            } catch (e) {
              setTickets(prev => prev.map(t => (t.id === (updatedFields.id || modal.ticket.id)) ? { ...t, ...updatedFields } : t));
            }
          }}
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
