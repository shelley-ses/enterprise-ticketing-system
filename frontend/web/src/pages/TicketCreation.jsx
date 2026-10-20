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
  uploadAttachments,
  getEscalateHandoff,
} from '@/services/ticketService';
import { getSystemStatus } from '@/services/configurationService';
import { normalizeCasing } from '@/utils/normalizeCasing';
import { formatProperTitleCase, needsProperCasing } from '@/utils/titleCaseUtils';
import { cleanAndSanitizeSummary } from '@/pages/AISupportPage';
import { useAuth } from '@/context/AuthContext';
import { getMaxOpenTicketsLimit, OPEN_STATUS_SET } from '@/data/ticketLimitConfig';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PersistentBanner } from '@/components/ui/alert-banner';
import { useToast } from '@/context/ToastContext';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

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
  const [systemStatus, setSystemStatus] = useState('Operational');

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
    getSystemStatus()
      .then((status) => setSystemStatus(status))
      .catch(() => setSystemStatus('Operational'));

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
              priority_ID: draft.priority_ID || 1,
            }));
            if (draft.attachments && Array.isArray(draft.attachments)) {
              setExistingDraftAttachments(draft.attachments);
            }
          }
        })
        .catch((err) => console.error('Failed to load draft:', err));
    }
  }, [location.state]);

  // Load escalated AI handoff prefill if redirected from AI Support triage
  useEffect(() => {
    const convId = location.state?.fromConversationId || location.state?.conversation_id;
    if (convId && !draftId) {
      getEscalateHandoff(convId)
        .then((handoff) => {
          if (handoff) {
            setFormData((prev) => ({
              ...prev,
              title: cleanAndSanitizeSummary(handoff.title || prev.title),
              description: cleanAndSanitizeSummary(handoff.description || prev.description),
              origin: 'ai_escalation',
              conversation_id: convId,
            }));
          }
        })
        .catch((err) => {
          console.warn('Could not prefill escalation handoff payload:', err);
        });
    }
  }, [location.state, draftId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'problem_category_ID') {
      const catObj = (options.problem_categories || []).find(c => String(c.problem_category_ID) === String(value))
        || (options.category_options || []).find(c => String(c.value) === String(value));
      const catName = catObj?.category_name || catObj?.label || '';
      const isIt = Boolean(catName && (catName.trim().toLowerCase() === 'it' || catName.trim().toLowerCase().startsWith('it') || catName === 'IT Support'));
      setFormData((prev) => ({
        ...prev,
        problem_category_ID: value,
        machine_ID: isIt ? '' : prev.machine_ID,
      }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCasingBlur = (field) => () => {
    setFormData((prev) => ({
      ...prev,
      [field]: normalizeCasing(prev[field]),
    }));
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setDraftMessage('');
    setError('');
    try {
      const payload = {
        title: (formData.title || '').trim(),
        machine_ID: (!isItCategory && formData.machine_ID) ? Number(formData.machine_ID) : null,
        problem_category_ID: formData.problem_category_ID ? Number(formData.problem_category_ID) : null,
        description: formData.description || '',
        priority_ID: formData.priority_ID ? Number(formData.priority_ID) : 1,
      };
      if (draftId) {
        payload.id = draftId;
      }
      const res = await saveTicketDraft(payload);
      if (res?.draft?.id) {
        setDraftId(res.draft.id);
      }
      setDraftMessage('Draft saved successfully. You can safely leave and resume editing anytime from My Drafts.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save draft. Please try again.');
    } finally {
      setSavingDraft(false);
    }
  };

  const scanUploadedFile = async (fileItem) => {
    const formData = new FormData();
    formData.append('files[]', fileItem.file);

    try {
      const res = await uploadAttachments(formData);
      const uploaded = res?.attachments?.[0] || res?.data?.[0];

      if (uploaded?.status === 'quarantined') {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? {
                  ...f,
                  status: 'quarantined',
                  attachmentId: uploaded.id || uploaded.attachment_ID,
                  threatName: uploaded.threat_name || 'Malware detected',
                }
              : f
          )
        );
      } else {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? {
                  ...f,
                  status: 'clean',
                  attachmentId: uploaded?.id || uploaded?.attachment_ID,
                }
              : f
          )
        );
      }
    } catch (err) {
      console.warn('Security scan inspection error:', err);
      // Fallback: If upload endpoint returned a 422 with quarantine or security error
      if (err?.response?.status === 422 && /malware|threat|virus|quarantin/i.test(err?.response?.data?.message || '')) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? {
                  ...f,
                  status: 'quarantined',
                  threatName: 'Threat signature identified',
                }
              : f
          )
        );
      } else {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileItem.id
              ? {
                  ...f,
                  status: 'clean',
                }
              : f
          )
        );
      }
    }
  };

  const handleFileChange = (e) => {
    setFileError('');
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      const maxIndividual = 15 * 1024 * 1024; // 15MB
      const maxTotal = 45 * 1024 * 1024; // 45MB
      const allowedExts = ['.pdf', '.png', '.docx', '.doc', '.jpg', '.jpeg'];

      let currentTotalSize = files.reduce((acc, f) => acc + f.size, 0);

      const newItems = [];
      for (const file of selectedFiles) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowedExts.includes(ext)) {
          setFileError(`Invalid file type "${file.name}". Supported formats: PDF, PNG, Word (DOC, DOCX), JPEG.`);
          return;
        }

        if (file.size > maxIndividual) {
          setFileError(`File "${file.name}" exceeds the maximum limit of 15MB.`);
          return;
        }

        currentTotalSize += file.size;
        if (currentTotalSize > maxTotal) {
          setFileError('Total attachments size exceeds the maximum limit of 45MB.');
          return;
        }

        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
          size: file.size,
          status: 'scanning',
        });
      }

      setFiles((prev) => [...prev, ...newItems]);
      e.target.value = '';

      for (const item of newItems) {
        scanUploadedFile(item);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (systemStatus === 'Under Maintenance') {
      setError('Ticket submission is currently disabled. The system is undergoing scheduled maintenance.');
      return;
    }

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
    if (!titleTrim || (!isItCategory && !formData.machine_ID) || !formData.problem_category_ID || !descTrim) {
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

    const hasScanning = files.some((f) => f.status === 'scanning');
    if (hasScanning) {
      setError('Security scan in progress. Please wait for attachment verification to complete before submitting.');
      return;
    }

    const hasQuarantined = files.some((f) => f.status === 'quarantined');
    if (hasQuarantined) {
      setError('One or more attachments were blocked and quarantined by the security scanner. Please remove quarantined files to proceed.');
      return;
    }

    setSubmitting(true);

    try {
      const normalizedDesc = normalizeCasing(formData.description);
      setFormData((prev) => ({ ...prev, title: finalTitle, description: normalizedDesc }));
      const payload = new FormData();
      payload.append('title', finalTitle);
      if (!isItCategory && formData.machine_ID) {
        payload.append('machine_ID', formData.machine_ID);
      }
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
      if (existingDraftAttachments && existingDraftAttachments.length > 0) {
        existingDraftAttachments.forEach((att) => {
          const id = att.id || att.attachment_id || att.attachment_ID;
          if (id) {
            payload.append('attachments[]', id);
          }
        });
      }
      if (files && files.length > 0) {
        const cleanFiles = files.filter((f) => f.status === 'clean');
        cleanFiles.forEach((f) => {
          if (f.attachmentId) {
            payload.append('attachments[]', f.attachmentId);
          } else if (f.file) {
            payload.append('attachments[]', f.file);
          }
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
    }));

  const selectedCategoryObj = (options.problem_categories || []).find(
    (c) => String(c.problem_category_ID) === String(formData.problem_category_ID)
  ) || (options.category_options || []).find(
    (c) => String(c.value) === String(formData.problem_category_ID)
  );
  const selectedCategoryName = selectedCategoryObj?.category_name || selectedCategoryObj?.label || '';
  const isItCategory = Boolean(
    selectedCategoryName &&
    (selectedCategoryName.trim().toLowerCase() === 'it' ||
     selectedCategoryName.trim().toLowerCase().startsWith('it') ||
     selectedCategoryName === 'IT Support')
  );

  return (
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
              className="cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
          }
        />

        {draftMessage && (
          <div className="mb-6 rounded-xl p-4 text-sm font-medium border border-emerald-200 bg-emerald-50 text-emerald-800 flex items-start gap-3 transition-all animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 flex justify-between items-center">
              <span>{draftMessage}</span>
              <button
                type="button"
                onClick={() => navigate('/my-tickets', { state: { tab: 'drafts' } })}
                className="text-xs font-bold text-emerald-900 underline hover:no-underline ml-3 cursor-pointer"
              >
                View My Drafts
              </button>
            </div>
          </div>
        )}

        {draftId && (
          <div className="mb-6 rounded-xl p-3.5 bg-blue-50/70 border border-blue-200 text-xs text-primary flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-[10px] bg-blue-100 px-2 py-0.5 rounded-md text-primary">Draft Mode</span>
              <span>You are editing draft #{draftId}. Your changes can be re-saved as draft or submitted.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraftId(null);
                setFormData({ title: '', machine_ID: '', problem_category_ID: '', description: '', priority_ID: 1 });
                setExistingDraftAttachments([]);
                setFiles([]);
              }}
              className="text-muted-slate hover:text-dark-slate text-xs font-semibold underline hover:no-underline cursor-pointer"
            >
              Clear and start fresh
            </button>
          </div>
        )}

        {error && (
          <PersistentBanner
            variant="error"
            message={error}
          />
        )}

        {systemStatus === 'Under Maintenance' && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">System Under Maintenance</h3>
              <p className="text-xs text-amber-800 mt-1">
                The ticketing system is currently undergoing scheduled maintenance. Ticket creation is temporarily disabled. Please check back later.
              </p>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`space-y-1.5 ${isItCategory ? 'md:col-span-2' : ''}`}>
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

              {!isItCategory && (
                <div className="space-y-1.5">
                  <Label htmlFor="ticket-machine">Equipment Name / ID <span className="text-destructive">*</span></Label>
                  <select
                    id="ticket-machine"
                    name="machine_ID"
                    required={!isItCategory}
                    value={formData.machine_ID}
                    onChange={handleChange}
                    disabled={loadingOptions}
                    className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-dark-slate shadow-xs focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 outline-none disabled:opacity-50"
                  >
                    <option value="">Select Equipment</option>
                    {equipmentOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
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
                  className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-dark-slate shadow-xs focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 outline-none disabled:opacity-50"
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
                  className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-dark-slate shadow-xs focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 outline-none disabled:opacity-50"
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
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
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

              {/* Saved Draft Attachments */}
              {existingDraftAttachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-slate uppercase tracking-wide">Saved Draft Attachments ({existingDraftAttachments.length})</p>
                  {existingDraftAttachments.map((att, idx) => {
                    const attName = att.name || att.file_name || (typeof att === 'string' ? att.split('/').pop() : `Attachment #${idx + 1}`);
                    return (
                      <div key={`existing-${idx}`} className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-primary">
                          <span className="font-medium truncate max-w-xs">{attName}</span>
                          <span className="text-[10px] text-accent font-semibold px-2 py-0.5 rounded-full bg-blue-100">Draft File</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setExistingDraftAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-muted-slate hover:text-destructive hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                          title="Remove draft attachment"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Uploaded Files with Malware Inspection States */}
              {files.length > 0 && (
                <div className="mt-3 space-y-2.5">
                  {files.map((item, idx) => {
                    const isScanning = item.status === 'scanning';
                    const isQuarantined = item.status === 'quarantined';
                    const isClean = item.status === 'clean';

                    return (
                      <div
                        key={item.id || idx}
                        className={`rounded-xl border p-3.5 transition-all ${
                          isQuarantined
                            ? 'border-destructive/40 bg-destructive/5 shadow-xs'
                            : isScanning
                              ? 'border-amber-200 bg-amber-50/40 shadow-xs'
                              : 'border-emerald-200 bg-emerald-50/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isScanning ? (
                              <RefreshCw size={18} className="animate-spin text-amber-600 shrink-0" />
                            ) : isQuarantined ? (
                              <ShieldAlert size={18} className="text-destructive shrink-0" />
                            ) : (
                              <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-sm font-semibold truncate max-w-xs ${
                                    isQuarantined ? 'text-destructive line-through' : 'text-dark-slate'
                                  }`}
                                >
                                  {item.name}
                                </span>
                                <span className="text-xs text-muted-slate">
                                  ({(item.size / (1024 * 1024)).toFixed(2)} MB)
                                </span>

                                {isScanning && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                    Scanning…
                                  </span>
                                )}
                                {isClean && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Clean &amp; Verified
                                  </span>
                                )}
                                {isQuarantined && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
                                    Blocked
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                              isQuarantined
                                ? 'text-destructive hover:text-white hover:bg-destructive bg-destructive/10'
                                : 'text-muted-slate hover:text-destructive hover:bg-red-50'
                            }`}
                            title="Remove attachment"
                            aria-label="Remove attachment"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {isQuarantined && (
                          <div className="mt-2.5 pt-2 border-t border-destructive/20 text-xs text-destructive flex items-start justify-between gap-3">
                            <p className="leading-relaxed">
                              <strong>Security Alert:</strong> This file was flagged by security scanning and quarantined for your protection. Please remove it and select a clean file.
                            </p>
                            <button
                              type="button"
                              onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                              className="shrink-0 text-xs font-bold text-destructive hover:underline cursor-pointer"
                            >
                              Remove file
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {fileError && <p className="text-xs text-destructive mt-1 font-medium">{fileError}</p>}
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={loadingOptions || savingDraft || submitting || systemStatus === 'Under Maintenance'}
                className="cursor-pointer"
              >
                {savingDraft ? 'Saving Draft...' : 'Save as Draft'}
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={loadingOptions || submitting || savingDraft || systemStatus === 'Under Maintenance'}
                className="cursor-pointer"
              >
                {submitting ? 'Submitting...' : systemStatus === 'Under Maintenance' ? 'Maintenance Active' : 'Submit Ticket'}
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
