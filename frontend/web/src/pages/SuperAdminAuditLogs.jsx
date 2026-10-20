import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, ShieldAlert } from 'lucide-react';
import { getSuperAdminAuditLogs } from '@/services/ticketService';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { DataTableSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import SecurityIncidentModal from '@/components/security/SecurityIncidentModal';

export default function SuperAdminAuditLogs() {
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const incidentId = params.get('incidentId');
    const query = params.get('q');
    if (incidentId) {
      setSearch(incidentId);
    } else if (query) {
      setSearch(query);
    }
  }, [location.search]);

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

      <div className="flex flex-wrap items-center gap-3 w-full">
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
                  filtered.map((log) => {
                    const isSecurity = Boolean(
                      log.module === 'Security' ||
                      /malware|quarantine|threat|infected/i.test(log.action + ' ' + log.details)
                    );

                    return (
                      <TableRow
                        key={log.id}
                        onClick={() => {
                          if (isSecurity) {
                            setSelectedIncident({
                              id: log.target || log.id,
                              user: log.user,
                              data: {
                                incident_id: log.target || log.id,
                                timestamp: log.timestamp,
                                uploader: { email: log.user, role: log.role },
                                file: {
                                  original_name: log.details?.match(/file\s+'([^']+)'/i)?.[1] || log.target || 'attachment',
                                  threat_name: log.details?.match(/threat\s+'([^']+)'/i)?.[1] || 'Malware.Detected',
                                },
                              },
                            });
                          }
                        }}
                        className={`transition-colors ${
                          isSecurity
                            ? 'bg-destructive/5 hover:bg-destructive/10 cursor-pointer'
                            : ''
                        }`}
                      >
                        <TableCell className="text-slate-muted whitespace-nowrap text-xs font-mono">{log.timestamp}</TableCell>
                        <TableCell className="font-medium text-slate-dark whitespace-nowrap">{log.user}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={log.role === 'Super Admin' ? 'secondary' : isSecurity ? 'destructive' : 'neutral'}>
                            {log.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-dark whitespace-nowrap font-medium">
                          {isSecurity ? (
                            <span className="inline-flex items-center gap-1.5 font-bold text-destructive">
                              <ShieldAlert size={14} className="text-destructive shrink-0" />
                              {log.action}
                            </span>
                          ) : (
                            log.action
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {isSecurity ? (
                            <Badge variant="destructive" className="text-[10px] uppercase font-bold">
                              Security
                            </Badge>
                          ) : (
                            <span className="text-slate-muted">{log.module}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-dark whitespace-nowrap font-mono text-xs">{log.target}</TableCell>
                        <TableCell className="text-slate-muted max-w-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate ${isSecurity ? 'text-destructive font-medium' : ''}`}>
                              {log.details}
                            </span>
                            {isSecurity && (
                              <button
                                type="button"
                                className="shrink-0 text-xs font-bold text-destructive hover:underline ml-2 cursor-pointer"
                              >
                                View Details
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedIncident && (
        <SecurityIncidentModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </div>
  );
}
