import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { getSuperAdminAuditLogs } from '@/services/ticketService';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { DataTableSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export default function SuperAdminAuditLogs() {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSuperAdminAuditLogs();
      const serverLogs = Array.isArray(data) ? data : [];

      // SIMULATED: this entry is stored in localStorage as a placeholder since the Knowledge Base backend doesn't yet write to the real audit log table. Remove this merge once KB deletion is logged server-side.
      let simulatedLogs = [];
      try {
        const stored = localStorage.getItem('superadmin_simulated_audit_logs');
        if (stored) {
          simulatedLogs = JSON.parse(stored);
        }
      } catch (e) {
        console.error('Failed to parse simulated audit logs:', e);
      }

      const merged = [...simulatedLogs, ...serverLogs].sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });

      setLogs(merged);
    } catch (err) {
      console.error('Failed to load superadmin audit logs:', err);
      // Fallback: still show simulated logs if backend request fails
      try {
        const stored = localStorage.getItem('superadmin_simulated_audit_logs');
        if (stored) {
          setLogs(JSON.parse(stored));
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useRealtimeRefresh({
    refresh: loadLogs,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 15000,
  });

  const actionOptions = useMemo(() => [...new Set(logs.map((l) => l.action).filter(Boolean))].sort(), [logs]);
  const moduleOptions = useMemo(() => [...new Set(logs.map((l) => l.module).filter(Boolean))].sort(), [logs]);

  const filtered = useMemo(() => {
    let result = logs;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (log) =>
          (log.user || '').toLowerCase().includes(q) ||
          (log.action || '').toLowerCase().includes(q) ||
          (log.module || '').toLowerCase().includes(q) ||
          (log.target || '').toLowerCase().includes(q) ||
          (log.details || '').toLowerCase().includes(q)
      );
    }
    if (filterAction) result = result.filter((l) => l.action === filterAction);
    if (filterModule) result = result.filter((l) => l.module === filterModule);
    return result;
  }, [logs, search, filterAction, filterModule]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        pattern="B"
        title="Audit Logs"
        subtitle="Track who did what, when, and to what."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="relative flex-1 min-w-[280px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-muted pointer-events-none" />
          <Input
            type="text"
            placeholder="Search audit logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-slate-dark outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All actions</option>
          {actionOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={filterModule}
          onChange={(e) => setFilterModule(e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-slate-dark outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All modules</option>
          {moduleOptions.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-4">
            <DataTableSkeleton columns={7} rows={6} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Timestamp</TableHead>
                  <TableHead className="whitespace-nowrap">User</TableHead>
                  <TableHead className="whitespace-nowrap">Role</TableHead>
                  <TableHead className="whitespace-nowrap">Action</TableHead>
                  <TableHead className="whitespace-nowrap">Module</TableHead>
                  <TableHead className="whitespace-nowrap">Target</TableHead>
                  <TableHead className="whitespace-nowrap">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-muted">
                      No logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-slate-muted whitespace-nowrap text-xs font-mono">{log.timestamp}</TableCell>
                      <TableCell className="font-medium text-slate-dark whitespace-nowrap">{log.user}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={log.role === 'Super Admin' ? 'secondary' : 'neutral'}>
                          {log.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-dark whitespace-nowrap font-medium">{log.action}</TableCell>
                      <TableCell className="text-slate-muted whitespace-nowrap">{log.module}</TableCell>
                      <TableCell className="text-slate-dark whitespace-nowrap">{log.target}</TableCell>
                      <TableCell className="text-slate-muted max-w-xs truncate">{log.details}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
