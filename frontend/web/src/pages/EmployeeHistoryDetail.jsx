import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Paperclip,
  FileText,
  CheckCircle2,
  ArrowUpDown,
  ImageIcon,
} from 'lucide-react';
import { formatDisplayDate } from '@/utils/dateUtils';
import FilePreviewModal from '@/components/FilePreviewModal';
import ReassignmentDisapprovalBanner from '@/components/employee/ReassignmentDisapprovalBanner';
import { getTicketDetails } from '@/services/ticketService';
import { Badge, getStatusBadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function EmployeeHistoryDetail() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { ticketId } = useParams();

  const [ticket, setTicket] = useState(state?.ticket || null);
  const [loading, setLoading] = useState(!state?.ticket);
  const [error, setError] = useState(null);
  const backPath = state?.backPath ?? '/employee/progress';
  const [previewFile, setPreviewFile] = useState(null);
  const [timelineSortOrder, setTimelineSortOrder] = useState('asc');

  const numericId = useMemo(() => {
    if (ticketId) {
      const parsed = parseInt(String(ticketId).replace(/\D/g, ''), 10);
      if (!isNaN(parsed)) return parsed;
    }
    if (state?.ticket?.ticket_ID) return state.ticket.ticket_ID;
    if (state?.ticket?.id) {
      const parsed = parseInt(String(state.ticket.id).replace(/\D/g, ''), 10);
      if (!isNaN(parsed)) return parsed;
    }
    return null;
  }, [ticketId, state?.ticket]);

  useEffect(() => {
    if (!numericId) {
      if (!ticket) setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchDetails = async () => {
      try {
        const fullDetails = await getTicketDetails(numericId);
        if (isMounted && fullDetails) {
          setTicket((prev) => ({
            ...(prev || {}),
            ...fullDetails,
            customer: fullDetails.customer || prev?.customer,
            facility: fullDetails.facility || prev?.facility,
          }));
        }
      } catch (err) {
        console.error('Failed to load full ticket history details:', err);
        if (isMounted && !ticket) {
          setError('Unable to load ticket details.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [numericId]);

  const getAbsoluteUrl = (rawUrl) => {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('blob:')) {
      return rawUrl;
    }
    const backendApiUrl = import.meta.env.VITE_TICKET_API_URL || 'http://localhost:8002/api';
    const backendHost = backendApiUrl.replace(/\/api$/, '').replace(/\/api\/$/, '');
    if (rawUrl.startsWith('/')) {
      return `${backendHost}${rawUrl}`;
    }
    return `${backendHost}/${rawUrl}`;
  };

  const remarksList = useMemo(() => {
    if (!ticket) return [];
    const fromProps = ticket.remarks || ticket.remarks_history || [];
    const list = Array.isArray(fromProps) ? [...fromProps] : [];

    if (ticket.timeline && Array.isArray(ticket.timeline)) {
      ticket.timeline.forEach((evt) => {
        if (evt.type === 'remark' || (evt.text && evt.text.toLowerCase().includes('remark'))) {
          if (!list.some((r) => (r.remark || r.text) === evt.text)) {
            list.push({
              id: evt.id,
              remark: evt.text,
              timestamp: evt.timestamp,
              author: 'Staff Member',
            });
          }
        }
      });
    }

    return list.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return dateB - dateA;
    });
  }, [ticket]);

  const timelineEvents = useMemo(() => {
    if (!ticket) return [];
    const events = [
      {
        id: 'creation',
        type: 'system',
        text: `Ticket created by ${ticket.customer || 'Customer'}.`,
        timestamp: ticket.date || ticket.created_at || ticket.date_created,
      },
    ];
    if (ticket.accepted) {
      events.push({
        id: 'acceptance',
        type: 'system',
        text: 'Assignment accepted by employee.',
        timestamp: ticket.date || ticket.created_at,
      });
    }
    if (ticket.reassignmentRequested) {
      events.push({
        id: 'reassignment',
        type: 'reassign',
        text: `Reassignment requested by employee.${
          ticket.reassignmentReason ? ` Reason: "${ticket.reassignmentReason}"` : ''
        }`,
        timestamp: ticket.lastUpdate ?? ticket.date,
      });
    }
    if (ticket.timeline && Array.isArray(ticket.timeline)) {
      ticket.timeline.forEach((item) => {
        if (!events.some((e) => e.id === item.id || (e.text === item.text && e.timestamp === item.timestamp))) {
          events.push(item);
        }
      });
    }
    return events;
  }, [ticket]);

  const sortedTimelineEvents = useMemo(() => {
    const sorted = [...timelineEvents];
    sorted.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timelineSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    return sorted;
  }, [timelineEvents, timelineSortOrder]);

  const isImage = (fileName) => {
    if (!fileName) return false;
    const ext = fileName.split('.').pop().toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-36 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(backPath)}
          className="text-primary hover:text-primary gap-2 -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </Button>
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-destructive text-sm font-medium">
          {error || 'Ticket not found.'}
        </div>
      </div>
    );
  }

  const assignedEmployeeDisplay =
    ticket.assigned_employee?.name ||
    ticket.assigned_employee ||
    ticket.assignedTo ||
    ticket.assigned_to_name ||
    '—';

  const machineDisplay =
    ticket.equipment ||
    ticket.machine_name ||
    ticket.item_name ||
    ticket.equipment_name ||
    '—';

  const equipmentTypeDisplay =
    ticket.equipment_type ||
    ticket.equipmentType ||
    ticket.model_number ||
    (ticket.serial_number ? `Serial: ${ticket.serial_number}` : '—');

  const resolvedDateDisplay =
    ticket.resolved_at || ticket.closed_at ? formatDisplayDate(ticket.resolved_at || ticket.closed_at) : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(backPath)}
          className="text-primary hover:text-primary gap-2 -ml-2 font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to History
        </Button>
      </div>

      {/* Header Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
            {ticket.id || (ticket.ticket_ID ? `TKT-${String(ticket.ticket_ID).padStart(4, '0')}` : 'Ticket')}
          </span>
          <Badge variant={getStatusBadgeVariant(ticket.status)}>
            {ticket.status}
          </Badge>
          <Badge
            variant={
              ticket.priority?.toLowerCase() === 'critical'
                ? 'destructive'
                : ticket.priority?.toLowerCase() === 'high'
                ? 'warning'
                : 'secondary'
            }
          >
            {ticket.priority}
          </Badge>
          {(ticket.title?.startsWith('[Internal]') || ticket.is_internal || ticket.ticket_type === 'Internal' || ticket.type === 'Internal') && (
            <Badge variant="secondary">
              Internal
            </Badge>
          )}
          {ticket.escalated && (
            <Badge variant="destructive">
              Escalated
            </Badge>
          )}
          {ticket.reassignmentRequested && (
            <Badge variant="warning">
              Reassigned
            </Badge>
          )}
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-1">{ticket.title}</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {machineDisplay !== '—' && `${machineDisplay} · `}
          <span className="font-medium text-foreground">{equipmentTypeDisplay}</span>
          {ticket.category && ` · ${ticket.category}`}
        </p>

        <ReassignmentDisapprovalBanner ticket={ticket} className="mb-5" />

        {/* Info grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
            <p className="text-[11px] uppercase font-bold text-muted-foreground mb-0.5">Requestor</p>
            <p className="text-sm font-semibold text-foreground">{ticket.customer || ticket.requestor || '—'}</p>
            {ticket.facility && (
              <p className="text-xs text-muted-foreground mt-0.5">{ticket.facility}</p>
            )}
          </div>
          <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
            <p className="text-[11px] uppercase font-bold text-muted-foreground mb-0.5">Equipment / Machine</p>
            <p className="text-sm font-semibold text-foreground truncate" title={machineDisplay}>
              {machineDisplay}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
            <p className="text-[11px] uppercase font-bold text-muted-foreground mb-0.5">Equipment Type</p>
            <p className="text-sm font-semibold text-foreground truncate" title={equipmentTypeDisplay}>
              {equipmentTypeDisplay}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
            <p className="text-[11px] uppercase font-bold text-muted-foreground mb-0.5">Assigned Employee</p>
            <p className="text-sm font-semibold text-foreground truncate" title={assignedEmployeeDisplay}>
              {assignedEmployeeDisplay}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
            <p className="text-[11px] uppercase font-bold text-muted-foreground mb-0.5">Category</p>
            <p className="text-sm font-semibold text-foreground">{ticket.category || '—'}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
            <p className="text-[11px] uppercase font-bold text-muted-foreground mb-0.5">Date Filed</p>
            <p className="text-sm font-semibold text-foreground">
              {ticket.date || ticket.created_at ? formatDisplayDate(ticket.date || ticket.created_at) : '—'}
            </p>
          </div>
          {resolvedDateDisplay ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <p className="text-[11px] uppercase font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">Date Resolved</p>
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{resolvedDateDisplay}</p>
            </div>
          ) : (
            <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
              <p className="text-[11px] uppercase font-bold text-muted-foreground mb-0.5">SLA Status</p>
              <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-md bg-card border border-border">
                {ticket.slaStatus || ticket.sla || '—'}
              </span>
            </div>
          )}
          <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
            <p className="text-[11px] uppercase font-bold text-muted-foreground mb-0.5">Last Update</p>
            <p className="text-sm font-semibold text-foreground">
              {ticket.lastUpdate || ticket.updated_at ? formatDisplayDate(ticket.lastUpdate || ticket.updated_at) : '—'}
            </p>
          </div>
        </div>

        {ticket.description && (
          <div className="mt-4 bg-muted/30 rounded-lg p-4 border border-border/50">
            <p className="text-[11px] uppercase font-bold text-muted-foreground mb-1">Description</p>
            <p className="text-sm text-foreground leading-relaxed break-words whitespace-pre-wrap">{ticket.description}</p>
          </div>
        )}
      </div>

      {/* Attached Files / Photos */}
      {ticket.attachments && ticket.attachments.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-primary" />
            Attached Files &amp; Photos ({ticket.attachments.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {ticket.attachments.map((file, idx) => {
              const fileName = typeof file === 'string' ? file.split('/').pop() : (file.name || file.file_name || `File-${idx + 1}`);
              const fileUrl = typeof file === 'string' ? file : (file.url || file.file_path || file.path || '');
              const absUrl = getAbsoluteUrl(fileUrl);

              return (
                <div
                  key={idx}
                  onClick={() => setPreviewFile({ name: fileName, url: fileUrl })}
                  className="border border-border rounded-lg overflow-hidden shadow-xs cursor-pointer hover:border-accent transition-colors"
                >
                  {isImage(fileName) ? (
                    <img
                      src={absUrl}
                      alt={fileName}
                      className="w-full h-36 object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`flex items-center gap-3 p-4 bg-muted/40 h-36 ${isImage(fileName) ? 'hidden' : 'flex'}`}>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{fileName}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Document</p>
                    </div>
                  </div>
                  <div className="px-3 py-2 border-t border-border bg-muted/20 flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground truncate">{fileName}</p>
                    <span className="text-[11px] text-primary font-semibold">Preview</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Proof of Completion */}
      {((ticket.proofFiles && ticket.proofFiles.length > 0) || (ticket.proofAttachments && ticket.proofAttachments.length > 0)) && (
        <div className="rounded-xl border border-emerald-500/20 bg-card p-6 shadow-xs">
          <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Proof of Completion Documents
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Completed service logs and documents submitted by the technician.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {(ticket.proofFiles || ticket.proofAttachments).map((file, idx) => {
              const fileName = typeof file === 'string' ? file.split('/').pop() : (file.name || file.file_name || `Proof-${idx + 1}`);
              const fileUrl = typeof file === 'string' ? file : (file.url || file.file_path || file.path || '');
              const absUrl = getAbsoluteUrl(fileUrl);
              return (
                <div
                  key={idx}
                  onClick={() => setPreviewFile({ name: fileName, url: fileUrl })}
                  className="border border-emerald-500/30 rounded-lg overflow-hidden shadow-xs cursor-pointer hover:border-emerald-600 transition-colors"
                >
                  {isImage(fileName) ? (
                    <img
                      src={absUrl}
                      alt={fileName}
                      className="w-full h-36 object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className={`flex items-center gap-3 p-4 bg-emerald-50/40 dark:bg-emerald-950/20 h-36 ${isImage(fileName) ? 'hidden' : 'flex'}`}>
                    <div className="w-10 h-10 rounded-lg bg-emerald-600/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{fileName}</p>
                      <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Proof Document</p>
                    </div>
                  </div>
                  <div className="px-3 py-2 border-t border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10 flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground truncate">{fileName}</p>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">Preview</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Remarks History */}
      {remarksList && remarksList.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary inline-block" />
            Remarks History ({remarksList.length})
          </h3>
          <div className="space-y-3">
            {remarksList.map((rem, idx) => (
              <div
                key={rem.id || idx}
                className="rounded-lg border border-border bg-muted/30 p-4 text-xs"
              >
                <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary text-xs uppercase tracking-wider">
                      {rem.author || 'Staff Member'}
                    </span>
                    {rem.status && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-muted text-foreground rounded-full border border-border">
                        {rem.status}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDisplayDate(rem.timestamp)}
                  </span>
                </div>
                <p className="text-foreground text-sm leading-relaxed break-words whitespace-pre-wrap font-medium">
                  {rem.remark || rem.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chronological Timeline */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Ticket Timeline &amp; History
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTimelineSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="gap-1.5 text-xs text-primary"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {timelineSortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
          </Button>
        </div>

        {sortedTimelineEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No timeline events recorded.</p>
        ) : (
          <div className="relative pl-6 space-y-4 border-l border-border ml-3 py-1.5">
            {sortedTimelineEvents.map((evt, idx) => {
              const dotBg =
                evt.type === 'system'
                  ? 'bg-primary'
                  : evt.type === 'status'
                  ? 'bg-accent'
                  : evt.type === 'internal_note'
                  ? 'bg-destructive'
                  : evt.type === 'remark'
                  ? 'bg-emerald-600'
                  : evt.type === 'reassign'
                  ? 'bg-amber-500'
                  : 'bg-muted-foreground';

              return (
                <div key={evt.id || idx} className="relative text-sm">
                  <div
                    className={`absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-card shadow-xs ${dotBg}`}
                  />
                  <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                    <span className="font-bold text-primary uppercase text-[10px] tracking-wider">
                      {evt.type === 'system'
                        ? 'System'
                        : evt.type === 'status'
                        ? 'Status Update'
                        : evt.type === 'internal_note'
                        ? 'Internal Note'
                        : evt.type === 'remark'
                        ? 'Remark'
                        : evt.type === 'reassign'
                        ? 'Reassignment'
                        : evt.type || 'Update'}
                    </span>
                    <span>{formatDisplayDate(evt.timestamp)}</span>
                  </div>
                  <p className="text-foreground leading-relaxed font-normal bg-muted/30 p-2.5 rounded-lg border border-border break-words whitespace-pre-wrap">
                    {evt.text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
