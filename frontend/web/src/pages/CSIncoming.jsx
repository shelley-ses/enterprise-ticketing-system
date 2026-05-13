import React, { useState, useMemo, useEffect } from 'react';
import { SAMPLE_TICKETS, SAMPLE_EMPLOYEES } from '@/data/mockTickets';
import actionIcon from '@/assets/action.png';
import Pagination from '@/components/Pagination';

function AssignModal({ ticket, onClose, onSave }) {
  const [priority, setPriority] = useState(ticket?.priority || 'Low');
  const [department, setDepartment] = useState(ticket?.department || '');
  const [selectedEmployees, setSelectedEmployees] = useState(
    ticket?.assigned || []
  );

  // Lock background scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!ticket) return null;

  const employeesInDept = useMemo(() => {
    const list = SAMPLE_EMPLOYEES.filter((e) =>
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

  const handleAccept = () => {
    const updated = {
      ...ticket,
      priority,
      department: department || null,
      assigned: selectedEmployees,
      status: department ? 'Assigned' : ticket.status,
    };
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      {/* Modal — fixed max height, scrollable internally */}
      <div className="bg-white/90 backdrop-blur-lg rounded-3xl w-[620px] max-w-full max-h-[90vh] flex flex-col relative shadow-[0_8px_32px_rgba(0,0,0,0.08)]">

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-6">

          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-[#252578] transition-colors text-sm"
          >
            ✕
          </button>

          <h3 className="text-xl font-bold text-[#252578] mb-4">
            Assign Ticket
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
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white rounded-xl focus:ring-2 focus:ring-[#252578] outline-none transition-all shadow-sm"
            >
              <option value="">Select department...</option>
              <option value="Hardware">Hardware</option>
              <option value="Software">Software</option>
              <option value="Diagnostics">Diagnostics</option>
              <option value="Support">Support</option>
            </select>
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Priority
            </label>
            <div className="flex gap-2 flex-wrap">
              {['Critical', 'High', 'Medium', 'Low'].map((p) => (
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
            </label>
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
                        <div className="text-xs font-medium text-gray-800">
                          {emp.name}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {emp.department} • {emp.status}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        emp.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
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
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            className="px-7 py-2.5 bg-[#252578] text-white text-xs font-semibold rounded-xl hover:bg-[#1e1e60] transition-colors shadow-lg shadow-[#252578]/30"
          >
            Accept Ticket
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CSIncoming() {
  const [selected, setSelected] = useState(null);
  const [tickets, setTickets] = useState(SAMPLE_TICKETS);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [slaFilter, setSlaFilter] = useState('All SLA');

  const categories = useMemo(
    () => [
      'All Categories',
      ...Array.from(new Set(tickets.map((t) => t.category))),
    ],
    [tickets]
  );

  const slaOptions = ['All SLA', 'On Track', 'At Risk', 'Breached'];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (category !== 'All Categories' && t.category !== category) return false;
      if (slaFilter !== 'All SLA' && t.sla !== slaFilter) return false;
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q)
      );
    });
  }, [tickets, search, category, slaFilter]);

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

  return (
    <div className="p-6">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#252578]">Incoming Tickets</h1>
        <p className="text-gray-500 mt-2">Triage and assign new support tickets</p>
      </div>

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
                    idx === 0 && page === 1
                      ? 'bg-blue-50 rounded-xl'
                      : 'hover:bg-gray-50'
                  } transition-all`}
                >
                  <td className="py-4 px-4 font-medium">{t.id}</td>
                  <td className="py-4 px-4 text-gray-600">{t.customer}</td>
                  <td className="py-4 px-4 text-gray-700">{t.title}</td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-gray-100 rounded-full text-xs">
                      {t.category}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                      {t.sla}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-gray-500">{t.date}</td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => setSelected(t)}
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

      {/* Modal */}
      {selected && (
        <AssignModal
          ticket={selected}
          onClose={() => setSelected(null)}
          onSave={(updated) => {
            setTickets((prev) =>
              prev.map((t) => (t.id === updated.id ? updated : t))
            );
          }}
        />
      )}
    </div>
  );
}