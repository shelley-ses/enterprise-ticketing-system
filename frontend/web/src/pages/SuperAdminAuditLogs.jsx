import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, ShieldAlert, Layers, AlertTriangle, ShieldCheck } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('all');
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
      setActiveTab('security');
      setSelectedIncident({ incident_id: incidentId, id: incidentId });
    } else if (query) {
      setSearch(query);
    }
  }, [location.search]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSuperAdminAuditLogs();
      const serverLogs = Array.isArray(data) ? data : [];

      // SIMULATED: stored in localStorage as placeholder until knowledge base backend logs server side
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

  const isSecurityLog = useCallback((log) => {
    return Boolean(
      log.module === 'Security' ||
      log.module === 'Security & System' ||
      log.action === 'System Alert' ||
      log.action === 'Alert Burst' ||
      log.incident_id ||
      /malware|quarantine|threat|infected|system alert/i.test((log.action || '') + ' ' + (log.details || ''))
    );
  }, []);

  const actionOptions = useMemo(() => [...new Set(logs.map((l) => l.action).filter(Boolean))].sort(), [logs]);
  const moduleOptions = useMemo(() => [...new Set(logs.map((l) => l.module).filter(Boolean))].sort(), [logs]);

  const securityCount = useMemo(() => logs.filter(isSecurityLog).length, [logs, isSecurityLog]);

  const filtered = useMemo(() => {
    let result = logs;

    if (activeTab === 'security') {
      result = result.filter(isSecurityLog);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (log) =>
          (log.user || '').toLowerCase().includes(q) ||
          (log.action || '').toLowerCase().includes(q) ||
          (log.module || '').toLowerCase().includes(q) ||
          (log.target || '').toLowerCase().includes(q) ||
          (log.details || '').toLowerCase().includes(q) ||
          (log.incident_id || '').toLowerCase().includes(q)
      );
    }
    if (filterAction) result = result.filter((l) => l.action === filterAction);
    if (filterModule) result = result.filter((l) => l.module === filterModule);
    return result;
  }, [logs, activeTab, isSecurityLog, search, filterAction, filterModule]);

  const handleOpenIncident = (log) => {
    const incId = log.incident_id || log.target || log.id;
    setSelectedIncident({
      id: incId,
      incident_id: incId,
      user: log.user,
      data: {
        incident_id: incId,
        timestamp: log.timestamp,
        severity: log.severity || 'high',
        burst_count: log.burst_count || 1,
        title: log.action,
        message: log.details,
        uploader: { email: log.user, role: log.role },
        file: {
          original_name: log.details?.match(/file\s+'([^']+)'/i)?.[1] || log.target || 'attachment',
          threat_name: log.details?.match(/threat\s+'([^']+)'/i)?.[1] || 'Malware.Detected',
        },
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        pattern="B"
        title="Audit Logs"
        subtitle="Track system events, administrative changes, and security incidents."
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'all'
              ? 'bg-[#252578] text-white shadow-sm'
              : 'bg-card text-muted-slate hover:text-dark-slate hover:bg-slate-100 border border-border'
          }`}
        >
          <ShieldCheck size={14} />
          All Audit Logs
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {logs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'security'
              ? 'bg-destructive text-white shadow-sm'
              : 'bg-card text-muted-slate hover:text-dark-slate hover:bg-slate-100 border border-border'
          }`}
        >
          <ShieldAlert size={14} />
          Security & System Incidents
          {securityCount > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === 'security' ? 'bg-white text-destructive' : 'bg-destructive/10 text-destructive'}`}>
              {securityCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full">
        <div className="relative flex-1 min-w-[280px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-muted pointer-events-none" />
          <Input
            type="text"
            placeholder={activeTab === 'security' ? 'Search incidents, errors, or incident IDs...' : 'Search audit logs...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-3 text-xs text-slate-dark outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">All actions</option>
          {actionOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={filterModule}
          onChange={(e) => setFilterModule(e.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-3 text-xs text-slate-dark outline-none focus:ring-2 focus:ring-accent"
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
                  <TableHead className="whitespace-nowrap text-[11px] font-bold text-muted-slate uppercase tracking-wider py-2.5 px-3">Timestamp</TableHead>
                  <TableHead className="whitespace-nowrap text-[11px] font-bold text-muted-slate uppercase tracking-wider py-2.5 px-3">User</TableHead>
                  <TableHead className="whitespace-nowrap text-[11px] font-bold text-muted-slate uppercase tracking-wider py-2.5 px-3">Role</TableHead>
                  <TableHead className="whitespace-nowrap text-[11px] font-bold text-muted-slate uppercase tracking-wider py-2.5 px-3">Action</TableHead>
                  <TableHead className="whitespace-nowrap text-[11px] font-bold text-muted-slate uppercase tracking-wider py-2.5 px-3">Module</TableHead>
                  <TableHead className="whitespace-nowrap text-[11px] font-bold text-muted-slate uppercase tracking-wider py-2.5 px-3">Target</TableHead>
                  <TableHead className="whitespace-nowrap text-[11px] font-bold text-muted-slate uppercase tracking-wider py-2.5 px-3">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-muted">
                      No logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((log) => {
                    const isSecurity = isSecurityLog(log);
                    const isBurst = Boolean(log.burst_count && log.burst_count > 1);

                    return (
                      <TableRow
                        key={log.id}
                        onClick={() => {
                          if (isSecurity) {
                            handleOpenIncident(log);
                          }
                        }}
                        className={`transition-colors ${
                          isSecurity
                            ? 'bg-destructive/5 hover:bg-destructive/10 cursor-pointer'
                            : ''
                        }`}
                      >
                        <TableCell className="text-slate-muted whitespace-nowrap text-xs font-mono py-2.5 px-3">{log.timestamp}</TableCell>
                        <TableCell className="font-semibold text-slate-dark whitespace-nowrap text-xs py-2.5 px-3">{log.user}</TableCell>
                        <TableCell className="whitespace-nowrap py-2.5 px-3">
                          <Badge size="sm" variant={log.role === 'Super Admin' ? 'secondary' : isSecurity ? 'destructive' : 'neutral'}>
                            {log.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-dark whitespace-nowrap font-medium text-xs py-2.5 px-3">
                          {isSecurity ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1.5 font-bold text-destructive">
                                <ShieldAlert size={13} className="text-destructive shrink-0" />
                                {log.action}
                              </span>
                              {log.severity && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                  {log.severity}
                                </span>
                              )}
                              {isBurst && (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                  <Layers size={10} />
                                  +{log.burst_count} bursts
                                </span>
                              )}
                            </div>
                          ) : (
                            log.action
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2.5 px-3">
                          {isSecurity ? (
                            <Badge variant="destructive" size="sm" className="text-[10px] uppercase font-bold">
                              {log.module}
                            </Badge>
                          ) : (
                            <span className="text-slate-muted text-xs">{log.module}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-dark whitespace-nowrap font-mono text-xs py-2.5 px-3">{log.target}</TableCell>
                        <TableCell className="text-slate-muted max-w-xs text-xs py-2.5 px-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate text-xs ${isSecurity ? 'text-destructive font-medium' : ''}`}>
                              {log.details}
                            </span>
                            {isSecurity && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenIncident(log);
                                }}
                                className="shrink-0 text-xs font-bold text-destructive hover:underline ml-2 cursor-pointer"
                              >
                                Inspect Incident
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
