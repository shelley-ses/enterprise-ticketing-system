import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Send,
  Paperclip,
  X,
  FileText,
  AlertCircle,
  Clock,
  ShieldAlert,
  Loader2,
  Download,
  Eye,
  MessageSquare,
  User,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { getTicketMessages, sendTicketMessage } from '@/services/messagingService';
import { formatDisplayDate } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import FilePreviewModal from '@/components/FilePreviewModal';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

/**
 * TS063: Internal Ticket Message Thread Component
 * Provides direct collaboration between Requestor and Assigned Employee on internal tickets.
 * Strictly separates customer-facing conversation from staff internal notes.
 */
export default function InternalTicketMessageThread({
  ticketId,
  ticket,
  currentUser,
  className = '',
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [inputText, setInputText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [previewFile, setPreviewFile] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const numericTicketId = useMemo(() => {
    if (!ticketId) return null;
    return Number(String(ticketId).replace(/\D/g, ''));
  }, [ticketId]);

  const loadMessages = useCallback(async (isSilent = false) => {
    if (!numericTicketId) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const data = await getTicketMessages(numericTicketId);
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load internal ticket messages:', err);
      if (!isSilent) {
        setError('Unable to load message thread. Please check your network connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [numericTicketId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setValidationError('');

    for (const f of files) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        setValidationError(`File "${f.name}" exceeds the 10MB maximum limit.`);
        return;
      }
    }

    setSelectedFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const textTrimmed = inputText.trim();

    // Inline empty message validation
    if (!textTrimmed && selectedFiles.length === 0) {
      setValidationError('Please enter a message or attach a file to send.');
      return;
    }

    setValidationError('');
    setSendError('');
    setIsSending(true);

    try {
      await sendTicketMessage(numericTicketId, textTrimmed, selectedFiles);
      setInputText('');
      setSelectedFiles([]);
      await loadMessages(true);
    } catch (err) {
      console.error('Failed to send internal ticket message:', err);
      // Preserve typed message so Requestor can retry without losing text
      setSendError('Failed to send message. Your message text has been preserved. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Derive sender role label per TS063 acceptance criteria
  const getSenderRoleBadge = (msg) => {
    const senderRole = String(msg.sender_role || msg.role || '').toLowerCase();
    const senderDept = String(msg.sender_department || msg.department || '').toLowerCase();
    const senderEmail = String(msg.sender_email || msg.email || '').toLowerCase();
    const requestorEmail = String(ticket?.requestor_email || ticket?.customer_email || ticket?.created_by_email || '').toLowerCase();
    const assignedEmpId = Number(ticket?.assigned_to || ticket?.employee_ID);
    const msgSenderId = Number(msg.sender_id || msg.emp_id || msg.user_id);

    if (senderEmail && requestorEmail && senderEmail === requestorEmail) {
      return { label: 'Requestor', variant: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }

    if (assignedEmpId && msgSenderId && assignedEmpId === msgSenderId) {
      return { label: 'Assigned Specialist', variant: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }

    if (senderRole.includes('engineer') || senderRole.includes('technician') || senderDept.includes('service')) {
      return { label: 'Previous Assigned Specialist', variant: 'bg-amber-50 text-amber-700 border-amber-200' };
    }

    if (senderRole.includes('cs') || senderRole.includes('customer service') || senderDept.includes('customer service')) {
      return { label: 'Customer Support', variant: 'bg-blue-50 text-blue-700 border-blue-200' };
    }

    return { label: 'Team Member', variant: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  return (
    <div className={`rounded-2xl border border-border bg-card shadow-xs overflow-hidden flex flex-col font-sans ${className}`}>
      {/* Thread Header */}
      <div className="px-5 py-4 bg-page border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#252578]/10 text-[#252578] flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-dark-slate flex items-center gap-2">
              Internal Collaboration Thread
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                Staff Only
              </span>
            </h4>
            <p className="text-[11px] text-muted-slate mt-0.5">
              Direct collaboration between Ticket Requestor and Assigned Specialists. Excluded from AI chat.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => loadMessages(true)}
          disabled={loading || refreshing}
          className="p-1.5 rounded-lg border border-border bg-card hover:bg-page text-muted-slate hover:text-dark-slate transition-colors cursor-pointer"
          title="Refresh messages"
          aria-label="Refresh messages"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Message List */}
      <div className="p-4 overflow-y-auto max-h-96 min-h-[220px] space-y-4 bg-slate-50/50 flex-1">
        {loading ? (
          <div className="space-y-3 py-6">
            <div className="flex items-center gap-2 max-w-sm animate-pulse">
              <div className="w-8 h-8 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-slate-200 rounded w-24" />
                <div className="h-10 bg-slate-200 rounded-xl" />
              </div>
            </div>
            <div className="flex items-center gap-2 max-w-sm ml-auto flex-row-reverse animate-pulse">
              <div className="w-8 h-8 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-slate-200 rounded w-20 ml-auto" />
                <div className="h-10 bg-slate-200 rounded-xl" />
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadMessages()}
              className="text-xs h-7 px-2.5 bg-white text-rose-700 border-rose-300 hover:bg-rose-100"
            >
              Retry
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-slate space-y-1">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-600">No messages yet in this internal thread.</p>
            <p className="text-[11px] text-slate-400">
              Send a message below to start collaborating with the assigned specialist.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe =
              currentUser?.email &&
              msg.sender_email &&
              currentUser.email.toLowerCase() === msg.sender_email.toLowerCase();
            const senderName = msg.sender_name || msg.sender || msg.user_name || 'Staff Member';
            const roleBadge = getSenderRoleBadge(msg);
            const attachments = msg.attachments || [];

            return (
              <div
                key={msg.id || msg._id || index}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
              >
                {/* Sender Identity & Role Tag */}
                <div className="flex items-center gap-1.5 text-[11px] text-muted-slate px-1">
                  <span className="font-bold text-dark-slate">{senderName}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${roleBadge.variant}`}>
                    {roleBadge.label}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formatDisplayDate(msg.created_at || msg.timestamp)}
                  </span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`p-3.5 rounded-2xl max-w-md text-xs leading-relaxed break-words shadow-xs ${
                    isMe
                      ? 'bg-[#252578] text-white rounded-tr-xs'
                      : 'bg-white text-dark-slate border border-border rounded-tl-xs'
                  }`}
                  style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                >
                  <p className="whitespace-pre-wrap">{msg.message || msg.text || ''}</p>

                  {/* Attachments */}
                  {attachments.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-white/20 space-y-1.5">
                      {attachments.map((att, attIdx) => {
                        const attName = att.name || att.file_name || 'Attachment';
                        const attUrl = att.url || att.file_path || att.path;
                        return (
                          <div
                            key={attIdx}
                            className={`flex items-center justify-between gap-2 p-1.5 rounded-lg text-[11px] ${
                              isMe ? 'bg-white/10 text-white' : 'bg-slate-100 text-dark-slate'
                            }`}
                          >
                            <span className="truncate max-w-[180px] font-medium">{attName}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {attUrl && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewFile(att)}
                                  className="p-1 hover:opacity-75 transition-opacity cursor-pointer"
                                  title="Preview file"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {attUrl && (
                                <a
                                  href={attUrl}
                                  download={attName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 hover:opacity-75 transition-opacity"
                                  title="Download file"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selected Attachments Chip Bar */}
      {selectedFiles.length > 0 && (
        <div className="px-4 py-2 bg-slate-100 border-t border-border flex flex-wrap gap-2">
          {selectedFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded-md text-xs text-dark-slate shadow-2xs"
            >
              <Paperclip className="w-3 h-3 text-slate-400" />
              <span className="truncate max-w-[140px]">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                title="Remove file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Validation / Send Error Alerts */}
      {(validationError || sendError) && (
        <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
            <span>{validationError || sendError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setValidationError('');
              setSendError('');
            }}
            className="text-rose-600 hover:text-rose-800"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Composer Input Area */}
      <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-border flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          className="hidden"
          accept={ALLOWED_FILE_TYPES.join(',')}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending}
          className="p-2.5 rounded-xl border border-border text-slate-500 hover:text-[#252578] hover:bg-page transition-colors cursor-pointer disabled:opacity-50"
          title="Attach file (Max 10MB)"
          aria-label="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <textarea
          rows={1}
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            if (validationError) setValidationError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(e);
            }
          }}
          placeholder="Type a message for the assigned team (Shift+Enter for new line)..."
          className="flex-1 p-2.5 text-xs rounded-xl border border-border bg-page text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-muted-foreground resize-none max-h-32 min-h-[40px]"
          disabled={isSending}
        />

        <Button
          type="submit"
          disabled={isSending || (!inputText.trim() && selectedFiles.length === 0)}
          className="bg-[#252578] hover:bg-[#1e1e60] text-white h-10 px-4 flex items-center gap-1.5 shrink-0"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </>
          )}
        </Button>
      </form>

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
