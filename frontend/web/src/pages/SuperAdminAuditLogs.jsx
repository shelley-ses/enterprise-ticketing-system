import React, { useState, useMemo } from 'react';
import { Search, Filter } from 'lucide-react';

const sampleLogs = [
  { id: 1, timestamp: '2026-06-19 10:32', user: 'John Smith', role: 'Super Admin', action: 'Added', module: 'Equipment Categories', target: 'MRI Machine', details: 'Added new equipment category' },
  { id: 2, timestamp: '2026-06-19 09:45', user: 'Super Admin', role: 'Super Admin', action: 'Updated', module: 'Priority Levels', target: 'High Priority', details: 'Changed color from orange to red' },
  { id: 3, timestamp: '2026-06-19 08:20', user: 'John Smith', role: 'Super Admin', action: 'Deleted', module: 'Equipment Categories', target: 'Old Monitor', details: 'Removed obsolete equipment category' },
  { id: 4, timestamp: '2026-06-18 16:45', user: 'Super Admin', role: 'Super Admin', action: 'Added', module: 'Priority Levels', target: 'Critical Priority', details: 'Created new priority level' },
  { id: 5, timestamp: '2026-06-18 14:02', user: 'Maria Cruz', role: 'Admin', action: 'Updated Rule', module: 'Automation', target: 'Auto-Assign Rule #3', details: 'Changed assignment from Queue A to Queue B' },
  { id: 6, timestamp: '2026-06-18 11:30', user: 'John Smith', role: 'Super Admin', action: 'Updated', module: 'Equipment Categories', target: 'X-Ray', details: 'Renamed category from "X-Ray Machine" to "X-Ray"' },
  { id: 7, timestamp: '2026-06-17 15:10', user: 'Maria Cruz', role: 'Admin', action: 'Created User', module: 'User Management', target: 'CS Agent #15', details: 'Added new CS account' },
  { id: 8, timestamp: '2026-06-17 13:45', user: 'Super Admin', role: 'Super Admin', action: 'Changed Permission', module: 'Roles', target: 'CS Agent Role', details: 'Granted export access' },
  { id: 9, timestamp: '2026-06-17 10:00', user: 'John Smith', role: 'Super Admin', action: 'Deleted', module: 'Priority Levels', target: 'Urgent Priority', details: 'Removed unused priority level' },
  { id: 10, timestamp: '2026-06-16 09:20', user: 'Super Admin', role: 'Super Admin', action: 'Added', module: 'Equipment Categories', target: 'Ventilator', details: 'Added new equipment category for ICU' },
];

const actionOptions = [...new Set(sampleLogs.map((l) => l.action))];
const moduleOptions = [...new Set(sampleLogs.map((l) => l.module))];

export default function SuperAdminAuditLogs() {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = sampleLogs;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (log) =>
          log.user.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.module.toLowerCase().includes(q) ||
          log.target.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q)
      );
    }
    if (filterAction) result = result.filter((l) => l.action === filterAction);
    if (filterModule) result = result.filter((l) => l.module === filterModule);
    return result;
  }, [search, filterAction, filterModule]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-[#252578]">Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-500">Track who did what, when, and to what.</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search audit logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${showFilters ? 'bg-[#252578] text-white border-[#252578]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <Filter size={16} />
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">Action</label>
            <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
              <option value="">All</option>
              {actionOptions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">Module</label>
            <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#252578]">
              <option value="">All</option>
              {moduleOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-5 py-4 whitespace-nowrap">Timestamp</th>
              <th className="px-5 py-4 whitespace-nowrap">User</th>
              <th className="px-5 py-4 whitespace-nowrap">Role</th>
              <th className="px-5 py-4 whitespace-nowrap">Action</th>
              <th className="px-5 py-4 whitespace-nowrap">Module</th>
              <th className="px-5 py-4 whitespace-nowrap">Target</th>
              <th className="px-5 py-4 whitespace-nowrap">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan="7" className="px-5 py-8 text-center text-sm text-gray-500">No logs found.</td>
              </tr>
            )}
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{log.timestamp}</td>
                <td className="px-5 py-4 text-sm text-gray-800 whitespace-nowrap">{log.user}</td>
                <td className="px-5 py-4 text-sm whitespace-nowrap">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${log.role === 'Super Admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{log.role}</span>
                </td>
                <td className="px-5 py-4 text-sm text-gray-800 whitespace-nowrap">{log.action}</td>
                <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{log.module}</td>
                <td className="px-5 py-4 text-sm text-gray-800 whitespace-nowrap">{log.target}</td>
                <td className="px-5 py-4 text-sm text-gray-500">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
