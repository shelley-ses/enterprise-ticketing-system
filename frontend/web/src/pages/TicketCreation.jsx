import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import NotificationModal from '@/components/NotificationModal';
import TitleCasingModal from '@/components/TitleCasingModal';
import {
  getTicketFormOptions,
  createTicket,
  getCustomerTickets,
  saveTicketDraft,
  getTicketDraft,
  getEscalateHandoff,
} from '@/services/ticketService';
import { normalizeCasing } from '@/utils/normalizeCasing';
import { formatProperTitleCase, needsProperCasing } from '@/utils/titleCaseUtils';
import { useAuth } from '@/context/AuthContext';
import { getMaxOpenTicketsLimit, OPEN_STATUS_SET } from '@/data/ticketLimitConfig';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PersistentBanner } from '@/components/ui/alert-banner';
import { useToast } from '@/context/ToastContext';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export default function TicketCreation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const toast = useToast();
  const effectiveUser = user || JSON.parse(localStorage.getItem('user') || 'null');
  const customerId = effectiveUser?.id || 1;

  const [draftId, setDraftId] = useState(location.state?.draftId || null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [existingDraftAttachments, setExistingDraftAttachments] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    machine_ID: '',
    problem_category_ID: '',
    description: '',
    priority_ID: 1, // default to Low (1)
  });
  const [options, setOptions] = useState({
    equipment_options: [],
    category_options: [],
    machines: [],
    problem_categories: [],
    ticket_priorities: [],
  });
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const [successModal, setSuccessModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState(null);
  const [titleCasingData, setTitleCasingData] = useState(null);
  const [showTitleCasingModal, setShowTitleCasingModal] = useState(false);
  const [customerOpenCount, setCustomerOpenCount] = useState(0);

  const fetchCustomerOpenCount = useCallback(async () => {
    try {
      const ticketsList = await getCustomerTickets({ createdBy: customerId, limit: 100, forceRefresh: true }).catch(() => []);
      const seenIds = new Set();
      const all = [];
      for (const t of (ticketsList || [])) {
        const id = t.ticket_id || t.ticket_ID || t.id;
        if (id && seenIds.has(id)) continue;
        if (id) seenIds.add(id);
        all.push(t);
      }
      const count = all.filter((t) => {
        const matchesCustomer = !t.created_by || String(t.created_by) === String(customerId);
        return !t.is_internal && matchesCustomer && OPEN_STATUS_SET.includes(t.status);
      }).length;
      setCustomerOpenCount(count);
      return count;
    } catch {
      return customerOpenCount;
    }
  }, [customerId, customerOpenCount]);

  useEffect(() => {
    fetchCustomerOpenCount();
    const handleConfigChange = () => {
      fetchCustomerOpenCount();
    };
    window.addEventListener('ticket_limit_config_changed', handleConfigChange);
    return () => window.removeEventListener('ticket_limit_config_changed', handleConfigChange);
  }, [fetchCustomerOpenCount]);

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      setError('');
      try {
        const data = await getTicketFormOptions({ forceRefresh: true });
        setOptions(data);
        if (data.ticket_priorities?.length > 0) {
          setFormData((prev) => ({
            ...prev,
            priority_ID: data.ticket_priorities[0].priority_ID,
          }));
        }
      } catch (err) {
        setError('Failed to load ticket configuration options. Please refresh the page.');
        console.error(err);
      } finally {
        setLoadingOptions(false);
      }
    };
    loadOptions();
  }, []);

  // Load existing draft if opened from "My Drafts"
  useEffect(() => {
    const draftIdFromNav = location.state?.draftId;
    if (draftIdFromNav) {
      getTicketDraft(draftIdFromNav)
        .then((draft) => {
          if (draft) {
            setDraftId(draft.id);
            setFormData((prev) => ({
              ...prev,
              title: draft.raw_title ?? (draft.title === 'Untitled draft' ? '' : draft.title),
              machine_ID: draft.machine_ID || '',
              problem_category_ID: draft.problem_category_ID || '',
              description: draft.description || '',
              priority_ID: draft.priority_ID || prev.priority_ID || 1,
            }));
            if (Array.isArray(draft.attachments) && draft.attachments.length > 0) {
              setExistingDraftAttachments(draft.attachments);
            }
          }
        })
        .catch((err) => {
          console.warn('Could not load draft:', err);
        });
    }
  }, [location.state?.draftId]);

  // Load AI Chatbot escalation handoff if navigated from AI assistant (TS027)
  useEffect(() => {
    const conversationId = location.state?.conversationId || new URLSearchParams(location.search).get('conversation_id');
    if (conversationId && !location.state?.draftId) {
      getEscalateHandoff(conversationId)
        .then((res) => {
          if (res?.fallback) {
            setError(res.notice || "We couldn't carry over your chat details — please fill in your ticket.");
            return;
          }
          const handoff = res?.data;
          if (handoff) {
            setFormData((prev) => ({
              ...prev,
              title: handoff.title || prev.title || '',
              description: handoff.description || prev.description || '',
              problem_category_ID: handoff.problem_category_ID || prev.problem_category_ID || '',
              machine_ID: handoff.machine_ID || prev.machine_ID || '',
              origin: handoff.origin || 'ai_chatbot',
              conversation_id: handoff.conversation_id || conversationId,
            }));
          }
        })
        .catch((err) => {
          console.warn('Could not load AI escalation handoff:', err);
          setError("We couldn't carry over your chat details — please fill in your ticket.");
        });
    }
  }, [location.state?.conversationId, location.search, location.state?.draftId]);

  const handleSaveDraft = async () => {
    if (savingDraft || submitting) return;
    setError('');
    setDraftMessage('');
    setSavingDraft(true);

    try {
      const payload = {
        id: draftId || undefined,
        title: formData.title,
        machine_ID: formData.machine_ID,
        problem_category_ID: formData.problem_category_ID,
        description: formData.description,
        priority_ID: formData.priority_ID,
        attachments: [...existingDraftAttachments, ...files],
      };

      const res = await saveTicketDraft(payload);
      const savedId = res.draft?.id || res.id;
      if (savedId) {
        setDraftId(savedId);
      }
      setDraftMessage('Draft saved successfully. You can return and complete it anytime from My Drafts.');
      setTimeout(() => setDraftMessage(''), 5000);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save draft.';
      setError(msg);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCasingBlur = (field) => (e) => {
    const raw = e.target.value;
    const normalized = normalizeCasing(raw);
    if (normalized !== raw) {
      setFormData((prev) => ({ ...prev, [field]: normalized }));
      e.target.value = normalized;
    }
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setFileError('');
    if (selected.length > 0) {
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
      ];
      const allowedExts = ['pdf', 'png', 'docx', 'doc', 'jpg', 'jpeg'];

      let currentTotal = files.reduce((acc, f) => acc + (f.size || 0), 0);
      const validFiles = [];

      for (const file of selected) {
        const ext = file.name.split('.').pop().toLowerCase();
        const isAllowed = allowedTypes.includes(file.type) || allowedExts.includes(ext);
        if (!isAllowed) {
          setFileError(`Invalid file type: "${file.name}". Supported formats: PDF, PNG, Word (.docx, .doc).`);
          return;
        }
        if (file.size > 15 * 1024 * 1024) {
          setFileError(`File too large: "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB). Max size is 15MB per file.`);
          return;
        }
        currentTotal += file.size || 0;
        validFiles.push(file);
      }

      if (currentTotal > 45 * 1024 * 1024) {
        setFileError(`Total attachments size exceeds 45MB limit (${(currentTotal / (1024 * 1024)).toFixed(2)} MB). Please remove some files.`);
        return;
      }

      setFiles((prev) => [...prev, ...validFiles]);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    // TS096: Before pre-submission validation block, verify requester's open tickets count
    const limitConfig = getMaxOpenTicketsLimit();
    if (!limitConfig.isUnlimited) {
      let openCount = customerOpenCount;
      try {
        const freshCount = await fetchCustomerOpenCount();
        if (typeof freshCount === 'number') {
          openCount = freshCount;
        }
      } catch (err) {
        console.warn('Failed to refresh open ticket count before submit:', err);
      }

      if (openCount >= limitConfig.limit) {
        setError(`You've reached the maximum number of open tickets (${limitConfig.limit}). Resolve or close an existing ticket before submitting another.`);
        return;
      }
    }

    const titleTrim = (formData.title || '').trim();
    const descTrim = (formData.description || '').trim();
    if (!titleTrim || !formData.machine_ID || !formData.problem_category_ID || !descTrim) {
      setError('Please complete all required fields.');
      return;
    }
    if (titleTrim.length < 5) {
      setError('Title must be at least 5 characters.');
      return;
    }
    if (descTrim.length < 20) {
      setError('Description must be at least 20 characters.');
      return;
    }

    if (needsProperCasing(titleTrim)) {
      const proper = formatProperTitleCase(titleTrim);
      setTitleCasingData({
        original: titleTrim,
        formatted: proper,
      });
      setShowTitleCasingModal(true);
      return;
    }

    await submitTicketWithTitle(titleTrim);
  };

  const handleConfirmTitleCasing = async () => {
    if (!titleCasingData) return;
    const limitConfig = getMaxOpenTicketsLimit();
    if (!limitConfig.isUnlimited && customerOpenCount >= limitConfig.limit) {
      setShowTitleCasingModal(false);
      setError(`You've reached the maximum number of open tickets (${limitConfig.limit}). Resolve or close an existing ticket before submitting another.`);
      return;
    }
    const formatted = titleCasingData.formatted;
    setFormData((prev) => ({ ...prev, title: formatted }));
    setShowTitleCasingModal(false);
    await submitTicketWithTitle(formatted);
  };

  const submitTicketWithTitle = async (finalTitle) => {
    setError('');
    setSubmitting(true);

    try {
      const normalizedDesc = normalizeCasing(formData.description);
      setFormData((prev) => ({ ...prev, title: finalTitle, description: normalizedDesc }));
      const payload = new FormData();
      payload.append('title', finalTitle);
      payload.append('machine_ID', formData.machine_ID);
      payload.append('problem_category_ID', formData.problem_category_ID);
      payload.append('description', normalizedDesc);
      payload.append('priority_ID', formData.priority_ID);
      if (draftId) {
        payload.append('draft_id', draftId);
      }
      if (formData.origin) {
        payload.append('origin', formData.origin);
      }
      if (formData.conversation_id) {
        payload.append('conversation_id', formData.conversation_id);
      }
      if (files && files.length > 0) {
        files.forEach((f) => {
          payload.append('attachments[]', f);
        });
      }
      
      const response = await createTicket(payload);
      const newTicketId = response.ticket?.ticket_ID || response.ticket_ID;
      setCreatedTicketId(newTicketId);
      setSuccessModal(true);
      fetchCustomerOpenCount();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit ticket. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModal(false);
    if (createdTicketId) {
      navigate('/messages', { state: { selectedTicketId: createdTicketId } });
    } else {
      navigate('/customer-dashboard');
    }
  };

  const equipmentOptions = options.equipment_options?.length
    ? options.equipment_options
    : (options.machines || []).map((machine) => ({
      value: machine.machine_ID,
      label: `${machine.machine_name} - ${machine.serial_number}`,
    }));

  const categoryOptions = options.category_options?.length
    ? options.category_options
    : (options.problem_categories || []).map((category) => ({
      value: category.problem_category_ID,
      label: category.category_name,
    }));

  const priorityOptions = options.priority_options?.length
    ? options.priority_options
    : (options.ticket_priorities || []).map((p) => ({
      value: p.priority_ID,
      label: p.priority_name,
    }));  return (
    <>
      <div className="max-w-4xl mx-auto space-y-6 font-sans">
        <PageHeader
          title="Create New Ticket"
          subtitle="Submit a new support and diagnostic request for your equipment."
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
          }
        />

        {draftMessage && (
          <PersistentBanner
            variant="success"
            message={draftMessage}
          />
        )}

        {error && (
          <PersistentBanner
            variant="error"
            message={error}
          />
        )}

        <div className="bg-surface border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label htmlFor="ticket-title">Ticket Title <span className="text-destructive">*</span></Label>
                <Input
                  id="ticket-title"
                  name="title"
                  type="text"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  onBlur={() => {
                    const trimmed = (formData.title || '').trim();
                    if (needsProperCasing(trimmed)) {
                      const proper = formatProperTitleCase(trimmed);
                      setTitleCasingData({
                        original: trimmed,
                        formatted: proper,
                      });
                      setShowTitleCasingModal(true);
                    }
                  }}
                  placeholder="Brief description of the issue"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ticket-machine">Equipment Name / ID <span className="text-destructive">*</span></Label>
                <select
                  id="ticket-machine"
                  name="machine_ID"
                  required
                  value={formData.machine_ID}
                  onChange={handleChange}
                  disabled={loadingOptions}
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-surface px-3 py-2 text-sm text-dark-slate shadow-sm focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 outline-none disabled:opacity-50"
                >
                  <option value="">Select Equipment</option>
                  {equipmentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label htmlFor="ticket-category">Problem Category <span className="text-destructive">*</span></Label>
                <select
                  id="ticket-category"
                  name="problem_category_ID"
                  required
                  value={formData.problem_category_ID}
                  onChange={handleChange}
                  disabled={loadingOptions}
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-surface px-3 py-2 text-sm text-dark-slate shadow-sm focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 outline-none disabled:opacity-50"
                >
                  <option value="">Select Category</option>
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ticket-priority">Priority <span className="text-destructive">*</span></Label>
                <select
                  id="ticket-priority"
                  name="priority_ID"
                  required
                  value={formData.priority_ID}
                  onChange={handleChange}
                  disabled={loadingOptions}
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-surface px-3 py-2 text-sm text-dark-slate shadow-sm focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 outline-none disabled:opacity-50"
                >
                  {priorityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ticket-description">Detailed Description <span className="text-destructive">*</span></Label>
              <Textarea
                id="ticket-description"
                name="description"
                required
                rows={5}
                value={formData.description}
                onChange={handleChange}
                onBlur={handleCasingBlur('description')}
                placeholder="Please describe symptoms, error messages, and current machine status in detail..."
              />
            </div>

            <div className="space-y-2">
              <Label>Attachments (Optional)</Label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
                <input
                  type="file"
                  id="ticket-creation-file-upload"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.png,.docx,.doc,.jpg,.jpeg"
                  multiple
                />
                <label htmlFor="ticket-creation-file-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="h-10 w-10 rounded-full bg-blue-50 text-accent flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-primary">Click to upload files</span>
                  <span className="text-xs text-muted-slate mt-1 uppercase tracking-wider">
                    PDF, PNG, Word — max 15MB per file, 45MB total
                  </span>
                </label>
              </div>

              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((f, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-semibold text-dark-slate truncate max-w-xs">{f.name}</span>
                        <span className="text-muted-slate shrink-0">({(f.size / (1024 * 1024)).toFixed(2)} MB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-muted-slate hover:text-destructive hover:bg-red-50 rounded-md transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {fileError && <p className="text-xs text-destructive mt-1">{fileError}</p>}
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={loadingOptions || savingDraft || submitting}
                loading={savingDraft}
              >
                Save as Draft
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={loadingOptions || submitting || savingDraft}
                loading={submitting}
              >
                Submit Ticket
              </Button>
            </div>
          </form>
        </div>
      </div>

      <TitleCasingModal
        isOpen={showTitleCasingModal}
        originalTitle={titleCasingData?.original}
        formattedTitle={titleCasingData?.formatted}
        onConfirm={handleConfirmTitleCasing}
        onCancel={() => setShowTitleCasingModal(false)}
      />

      <NotificationModal
        isOpen={successModal}
        type="success"
        title="Ticket Submitted Successfully!"
        message="Your support ticket has been created and will be reviewed shortly."
        onClose={handleSuccessClose}
      />
    </>
  );
}
