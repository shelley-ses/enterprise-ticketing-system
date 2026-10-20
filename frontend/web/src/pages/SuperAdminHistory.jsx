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
                  <TableHead className="whitespace-nowrap">Timestamp</TableHead>
                  <TableHead className="whitespace-nowrap">User</TableHead>
                  <TableHead className="whitespace-nowrap">Action</TableHead>
                  <TableHead className="whitespace-nowrap">Module</TableHead>
                  <TableHead className="whitespace-nowrap">Target</TableHead>
                  <TableHead className="whitespace-nowrap">Details</TableHead>
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
                    <TableRow key={log.id}>
                      <TableCell className="text-slate-muted whitespace-nowrap text-xs font-mono">{log.timestamp}</TableCell>
                      <TableCell className="font-medium text-slate-dark whitespace-nowrap">{log.user}</TableCell>
                      <TableCell className="whitespace-nowrap">
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
                      <TableCell className="text-slate-muted whitespace-nowrap">{log.module}</TableCell>
                      <TableCell className="font-medium text-slate-dark whitespace-nowrap">{log.target}</TableCell>
                      <TableCell className="text-slate-muted">{log.details}</TableCell>
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
