import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { getSuperAdminHistory } from '@/services/ticketService';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { DataTableSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export default function SuperAdminHistory() {
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSuperAdminHistory();
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to load configuration history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useRealtimeRefresh({
    refresh: loadHistory,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 15000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.trim().toLowerCase();
    return history.filter(
      (log) =>
        (log.user || '').toLowerCase().includes(q) ||
        (log.action || '').toLowerCase().includes(q) ||
        (log.module || '').toLowerCase().includes(q) ||
        (log.target || '').toLowerCase().includes(q) ||
        (log.details || '').toLowerCase().includes(q)
    );
  }, [history, search]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        pattern="B"
        title="Configuration History"
        subtitle="Timeline of all equipment categories and priority level updates."
      />

      <div className="relative w-full">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-muted pointer-events-none" />
        <Input
          type="text"
          placeholder="Search history..."
          title="Search configuration history by user, action, module, target, or details"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10"
        />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {loading && filtered.length === 0 ? (
          <div className="p-4">
            <DataTableSkeleton columns={6} rows={6} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap" title="Event timestamp in ISO/local format">Timestamp</TableHead>
                  <TableHead className="whitespace-nowrap" title="Superadmin or system user account">User</TableHead>
                  <TableHead className="whitespace-nowrap" title="Action type (Created, Updated, Deleted)">Action</TableHead>
                  <TableHead className="whitespace-nowrap" title="Configuration module">Module</TableHead>
                  <TableHead className="whitespace-nowrap" title="Target item or category identifier">Target</TableHead>
                  <TableHead className="whitespace-nowrap" title="Configuration change details">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-muted">
                      No history records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((log) => (
                    <TableRow key={log.id} title={`History #${log.id}`}>
                      <TableCell className="text-slate-muted whitespace-nowrap text-xs font-mono" title={log.timestamp}>{log.timestamp}</TableCell>
                      <TableCell className="font-medium text-slate-dark whitespace-nowrap" title={log.user}>{log.user}</TableCell>
                      <TableCell className="whitespace-nowrap" title={`Action: ${log.action}`}>
                        <Badge
                          variant={
                            log.action === 'Created'
                              ? 'success'
                              : log.action === 'Deleted'
                              ? 'destructive'
                              : 'info'
                          }
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-muted whitespace-nowrap" title={`Module: ${log.module}`}>{log.module}</TableCell>
                      <TableCell className="font-medium text-slate-dark whitespace-nowrap" title={`Target: ${log.target}`}>{log.target}</TableCell>
                      <TableCell className="text-slate-muted" title={log.details}>{log.details}</TableCell>
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
