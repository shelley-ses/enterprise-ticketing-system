import React, { useEffect } from 'react';
import {
  ShieldAlert,
  FileText,
  User,
  Hash,
  Clock,
  HardDrive,
  Ticket,
  Lock,
  X,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { formatDisplayDate } from '@/utils/dateUtils';

export default function SecurityIncidentModal({ incident, onClose, onNavigateAuditLogs }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!incident) return null;

  // Extract incident details from payload, handling nested or flat structure
  const data = incident.data
    ? (typeof incident.data === 'string' ? JSON.parse(incident.data || '{}') : incident.data)
    : incident;

  const incidentId = data.incident_id || data.id || incident.id || 'INC-SEC-PENDING';
  const timestamp = data.timestamp || incident.created_at || new Date().toISOString();
  const uploader = data.uploader || {};
  const file = data.file || {};
  const ticketId = data.ticket_id || incident.ticket_id;
  const threatName = file.threat_name || data.threat_name || 'Malware.Detected';
  const originalName = file.original_name || file.name || data.file_name || 'attachment';
  const fileSize = file.size
    ? (file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`)
    : 'Unknown size';
  const fileHash = file.hash_sha256 || data.hash_sha256 || 'SHA-256 Calculated';
  const quarantineRef = file.quarantine_ref || data.quarantine_ref || 'quarantine/isolated';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="security-incident-title"
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-rose-100 overflow-hidden text-gray-800 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Red Warning Accent */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 text-white p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <span className="p-2 rounded-xl bg-white/15 border border-white/20 text-white shadow-inner">
              <ShieldAlert size={24} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-white/20 text-white">
                  Security Incident
                </span>
                <span className="text-[11px] font-mono text-rose-100 opacity-90">
                  {incidentId}
                </span>
              </div>
              <h2 id="security-incident-title" className="text-xl font-bold tracking-tight text-white mt-0.5">
                Malware Detection & Quarantine Event
              </h2>
            </div>
          </div>
          <p className="text-xs text-rose-100 leading-relaxed max-w-xl mt-1">
            An inbound attachment was flagged as malicious during ClamAV antivirus daemon inspection and was immediately quarantined.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Containment Status Card */}
          <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200/80 p-4 flex items-start gap-3.5">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <h3 className="font-bold text-emerald-900">Security Containment: Neutralized</h3>
              <p className="text-emerald-700 mt-0.5 leading-relaxed">
                The payload was intercepted before reaching persistent ticket storage. Quarantined binaries are isolated and blocked from public download and system execution.
              </p>
            </div>
          </div>

          {/* Threat & Scan Result */}
          <div className="rounded-2xl bg-rose-50/60 border border-rose-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-rose-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                Threat Classification
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500 block text-[11px]">Detected Threat</span>
                <span className="font-mono font-bold text-rose-700 text-sm">{threatName}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px]">Scanning Engine</span>
                <span className="font-semibold text-gray-800">ClamAV In-Stream Daemon (`zINSTREAM`)</span>
              </div>
            </div>
          </div>

          {/* File Metadata Details */}
          <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/60 space-y-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[#252578]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                Infected File Metadata
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500 block text-[11px]">Original Filename</span>
                <span className="font-semibold text-gray-900 break-all">{originalName}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px]">File Size</span>
                <span className="font-semibold text-gray-800">{fileSize}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-gray-500 block text-[11px] flex items-center gap-1">
                  <Hash size={12} /> SHA-256 Checksum
                </span>
                <span className="font-mono text-[11px] text-gray-700 break-all bg-white px-2 py-1 rounded-lg border border-gray-200 block mt-0.5">
                  {fileHash}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-gray-500 block text-[11px] flex items-center gap-1">
                  <HardDrive size={12} /> Quarantine Reference
                </span>
                <span className="font-mono text-[11px] text-gray-600 break-all bg-white px-2 py-1 rounded-lg border border-gray-200 block mt-0.5">
                  {quarantineRef}
                </span>
              </div>
            </div>
          </div>

          {/* Uploader & Context */}
          <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/60 space-y-3">
            <div className="flex items-center gap-2">
              <User size={16} className="text-[#252578]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                Uploader & Origin Context
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500 block text-[11px]">Uploader</span>
                <span className="font-semibold text-gray-900">
                  {uploader.email || incident.user || 'Unknown User'}
                </span>
                {uploader.role && (
                  <span className="inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {uploader.role}
                  </span>
                )}
              </div>
              <div>
                <span className="text-gray-500 block text-[11px]">Client IP Address</span>
                <span className="font-mono text-gray-800 font-semibold">{uploader.ip_address || '127.0.0.1'}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px] flex items-center gap-1">
                  <Clock size={12} /> Timestamp
                </span>
                <span className="text-gray-700 font-medium">{formatDisplayDate(timestamp)}</span>
              </div>
              {ticketId && (
                <div>
                  <span className="text-gray-500 block text-[11px] flex items-center gap-1">
                    <Ticket size={12} /> Associated Ticket
                  </span>
                  <span className="font-bold text-[#252578]">TKT-{String(ticketId).padStart(4, '0')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
          <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
            <Lock size={12} className="text-gray-400" />
            Audit logged to security ledger
          </div>
          <div className="flex items-center gap-2">
            {onNavigateAuditLogs && (
              <button
                type="button"
                onClick={onNavigateAuditLogs}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#252578] bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                <ExternalLink size={13} />
                View in Audit Logs
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#252578] hover:bg-[#1d1d60] rounded-xl transition cursor-pointer shadow-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
