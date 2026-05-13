import React, { useState, useMemo, useEffect } from 'react';
import actionIcon from '@/assets/action.png';

const SAMPLE_TICKETS = [
  { id: 'TKT-1001', customer: "St. Luke's Medical Center", title: 'X-Ray Machine Not Powering On', category: 'Equipment Malfunction', sla: 'On Track', date: '03/26/2026' },
  { id: 'TKT-1002', customer: 'Philippine General Hospital', title: 'MRI Scanner', category: 'Equipment Malfunction', sla: 'On Track', date: '03/26/2026' },
  { id: 'TKT-1003', customer: 'Makati Medical Center', title: 'X-Ray Machine Not Powering On', category: 'Equipment Malfunction', sla: 'On Track', date: '03/26/2026' },
  { id: 'TKT-1004', customer: "St. Luke's Medical Center", title: 'Patient Monitor', category: 'Firmware & Software', sla: 'On Track', date: '03/26/2026' },
  { id: 'TKT-1005', customer: 'National Kidney Institute', title: 'Dialysis Machine', category: 'Equipment Malfunction', sla: 'On Track', date: '03/26/2026' },
];

function AssignModal({ ticket, onClose }) {
  const [engineer, setEngineer] = useState('');
  const [priority, setPriority] = useState('Low');

  if (!ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl w-[720px] max-w-full p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600">✕</button>
        <h3 className="text-lg font-semibold mb-4">Assign Ticket</h3>

        <div className="bg-blue-500 text-white rounded-lg p-4 mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs opacity-80">{ticket.id}</div>
            <div className="text-md font-semibold">{ticket.title}</div>
            <div className="text-xs opacity-80">{ticket.category}</div>
          </div>
          <div>
            <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full">On Track</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Assign Employee</label>
          <select value={engineer} onChange={(e) => setEngineer(e.target.value)} className="w-full border rounded px-3 py-2">
            <option value="">Select an engineer...</option>
            <option>Engineer A</option>
            <option>Engineer B</option>
            <option>Engineer C</option>
          </select>
        </div>

        <div className="mb-4">
          <div className="block text-sm font-medium mb-2">Priority</div>
          <div className="flex gap-3">
            {['Critical','High','Medium','Low'].map((p) => (
              <button key={p} onClick={() => setPriority(p)} className={`px-4 py-2 rounded border ${priority===p? 'bg-red-50 border-red-400' : 'bg-white'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 border rounded-lg p-4">
          <div className="text-sm font-medium mb-2">SLA Preview</div>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <div className="text-xs text-gray-500">Response Deadline</div>
              <div className="font-medium">March 27, 2026</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Resolution Deadline</div>
              <div className="font-medium">April 5, 2026</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-300">Cancel</button>
          <button onClick={() => { alert('Ticket accepted (mock)'); onClose(); }} className="px-4 py-2 rounded bg-green-600 text-white">Accept Ticket</button>
        </div>
      </div>
    </div>
  );
}

export default function CSIncoming() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [slaFilter, setSlaFilter] = useState('All SLA');

  const categories = useMemo(() => [
    'All Categories',
    ...Array.from(new Set(SAMPLE_TICKETS.map((t) => t.category))),
  ], []);

  const slaOptions = ['All SLA', 'On Track', 'At Risk', 'Breached'];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SAMPLE_TICKETS.filter((t) => {
      if (category !== 'All Categories' && t.category !== category) return false;
      if (slaFilter !== 'All SLA' && t.sla !== slaFilter) return false;
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.customer.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q)
      );
    });
  }, [search, category, slaFilter]);

  // Pagination
  const ITEMS_PER_PAGE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  // keep page valid when filtered changes
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [filtered.length, totalPages]);

  const paginated = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Incoming Tickets</h1>
        <p className="text-gray-500">Triage and assign new support tickets</p>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets, customers.."
            className="w-full border rounded-full px-4 py-2 shadow-sm focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-4 py-2 rounded-full border">
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            {slaOptions.map((s) => (
              <button
                key={s}
                onClick={() => setSlaFilter(s)}
                className={`px-3 py-1 rounded-full border ${slaFilter === s ? 'bg-blue-500 text-white' : 'bg-white text-gray-700'}`}>
                {s.replace('All SLA', 'All SLA')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Incoming Tickets</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead>
              <tr className="text-gray-500 border-b">
                <th className="py-3 px-4">Ticket ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">SLA Status</th>
                <th className="py-3 px-4">Date Submitted</th>
                <th className="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {paginated.map((t, idx) => (
                <tr key={t.id} className={`${idx===0 && page===1 ? 'bg-blue-50' : ''} border-b`}> 
                  <td className="py-3 px-4 font-medium text-sm">{t.id}</td>
                  <td className="py-3 px-4 text-gray-600">{t.customer}</td>
                  <td className="py-3 px-4 text-gray-700">{t.title}</td>
                  <td className="py-3 px-4">{t.category}</td>
                  <td className="py-3 px-4">{t.sla}</td>
                  <td className="py-3 px-4">{t.date}</td>
                  <td className="py-3 px-4">
                    <button onClick={() => setSelected(t)} className="p-2 rounded hover:bg-gray-100">
                      <img src={actionIcon} alt="action" className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">Showing {(filtered.length===0)?0: ( (page-1)*ITEMS_PER_PAGE + 1)} - {Math.min(page*ITEMS_PER_PAGE, filtered.length)} of {filtered.length}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p-1))}
              disabled={page===1}
              className="w-8 h-8 flex items-center justify-center rounded border disabled:opacity-50 text-sm"
            >
              {'<'}
            </button>

            {Array.from({ length: totalPages }, (_, i) => i+1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 flex items-center justify-center rounded ${p===page? 'bg-blue-500 text-white' : 'border'}`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p+1))}
              disabled={page===totalPages}
              className="w-8 h-8 flex items-center justify-center rounded border disabled:opacity-50 text-sm"
            >
              {'>'}
            </button>
          </div>
        </div>
      </div>

      {selected && <AssignModal ticket={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
