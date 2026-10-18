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
import { useAuth } from '@/context/AuthContext';
import { getMaxOpenTicketsLimit, OPEN_STATUS_SET } from '@/data/ticketLimitConfig';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';

export default function TicketCreation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
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

  // Handle prefill data carried over from AI Support escalation
  useEffect(() => {
    if (location.state?.prefillData) {
      const p = location.state.prefillData;
      setFormData((prev) => ({
        ...prev,
        title: p.problemSummary || p.title || prev.title,
        description: p.conversationSummary || p.description || prev.description,
        machine_ID: p.machine_ID || prev.machine_ID,
      }));
    }
  }, [location.state?.prefillData]);

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

    // Guard against saving draft while attachments are actively scanning or quarantined
    const hasScanning = files.some((f) => f.status === 'scanning');
    if (hasScanning) {
      setError('Please wait for attachment security scanning to complete before saving draft.');
      return;
    }
    const hasQuarantined = files.some((f) => f.status === 'quarantined');
    if (hasQuarantined) {
      setError('Your attachments contain a quarantined file. Please remove the quarantined file before saving.');
      return;
    }

    setSavingDraft(true);

    try {
      const cleanRawFiles = files.filter((f) => f.status === 'clean').map((f) => f.file || f);
      const payload = {
        id: draftId || undefined,
        title: formData.title,
        machine_ID: formData.machine_ID,
        problem_category_ID: formData.problem_category_ID,
        description: formData.description,
        priority_ID: formData.priority_ID,
        attachments: [...existingDraftAttachments, ...cleanRawFiles],
      };

      const res = await saveTicketDraft(payload);
      const savedId = res.draft?.id || res.id;
      if (savedId) {
        setDraftId(savedId);
      }
      if (res.draft?.attachments) {
        setExistingDraftAttachments(res.draft.attachments);
        setFiles([]);
      }
      setDraftMessage('Draft saved successfully! You can return and complete it anytime from My Drafts.');
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

  const scanUploadedFile = async (item) => {
    try {
      const uploaded = await uploadAttachments([item.file]);
      const record = uploaded?.[0];
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? {
                ...f,
                status: 'clean',
                attachmentId: record?.id || record?.attachment_id,
                attachmentUrl: record?.url,
              }
            : f
        )
      );
    } catch (err) {
      const isThreat = Boolean(
        err?.response?.data?.virus_detected ||
        err?.response?.data?.has_threats ||
        err?.response?.status === 422
      );
      const threatName = err?.response?.data?.quarantined?.[0]?.threat_name || 'Malware.Detected';
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? {
                ...f,
                status: isThreat ? 'quarantined' : 'clean',
                threatName: isThreat ? threatName : null,
                errorMessage: isThreat
                  ? 'This file was flagged by security scanning and quarantined for your protection. Please remove it and select a clean file.'
                  : null,
              }
            : f
        )
      );
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
      const newItems = [];

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
        newItems.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          status: 'scanning', // Immediate scanning state
        });
      }

      if (currentTotal > 45 * 1024 * 1024) {
        setFileError(`Total attachments size exceeds 45MB limit (${(currentTotal / (1024 * 1024)).toFixed(2)} MB). Please remove some files.`);
        return;
      }

      setFiles((prev) => [...prev, ...newItems]);
      e.target.value = '';

      // Trigger automatic ClamAV malware scanning
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

    // Pre-submission guard: Ensure all attachments have completed security scanning
    const hasScanning = files.some((f) => f.status === 'scanning');
    if (hasScanning) {
      setError('Security scan in progress. Please wait for attachment verification to complete before submitting.');
      return;
    }

    // Pre-submission guard: Block quarantined malicious files
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

  return (
    <>
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-[#252578] flex items-center gap-2 text-sm font-medium mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-[#252578]">Create New Ticket</h1>
        <p className="text-gray-500 mt-2">Submit a new support request for your equipment.</p>
      </div>

      {draftMessage && (
        <div className="mb-6 rounded-xl p-4 text-sm font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs flex items-center gap-3">
          <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>{draftMessage}</div>
        </div>
      )}

      {draftMessage && (
        <div className="mb-6 rounded-xl p-4 text-sm font-medium border border-emerald-200 bg-emerald-50 text-emerald-800 flex items-start gap-3 transition-all animate-in fade-in">
          <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
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
        <div className="mb-6 rounded-xl p-3.5 bg-blue-50/70 border border-blue-200 text-xs text-[#252578] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] bg-blue-100 px-2 py-0.5 rounded-md">Draft Mode</span>
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
            className="text-gray-500 hover:text-gray-700 text-xs font-semibold underline hover:no-underline cursor-pointer"
          >
            Clear and start fresh
          </button>
        </div>
      )}

      {error && (
        <div className={`mb-6 rounded-xl p-4 text-sm font-medium border flex items-start gap-3 transition-all ${
          error.includes('Security threat')
            ? 'bg-red-50/90 text-red-800 border-red-200 shadow-md ring-2 ring-red-500/20'
            : 'bg-red-50 text-red-700 border-red-100'
        }`}>
          {error.includes('Security threat') && (
            <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          )}
          <div>{error}</div>
        </div>
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

      <div className="bg-white/70 backdrop-blur-lg border border-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ticket Title</label>
              <input 
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
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Equipment Name / ID</label>
              <select 
                name="machine_ID"
                required 
                value={formData.machine_ID}
                onChange={handleChange}
                disabled={loadingOptions}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all"
              >
                <option value="">Select Equipment</option>
                {equipmentOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select 
                name="problem_category_ID"
                required 
                value={formData.problem_category_ID}
                onChange={handleChange}
                disabled={loadingOptions}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all"
              >
                <option value="">Select Category</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select 
                name="priority_ID"
                required 
                value={formData.priority_ID}
                onChange={handleChange}
                disabled={loadingOptions}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all"
              >
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Detailed Description</label>
            <textarea 
              name="description"
              required 
              rows="5" 
              value={formData.description}
              onChange={handleChange}
              onBlur={handleCasingBlur('description')}
              placeholder="Please provide as much detail as possible..." 
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all resize-y"
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Attachments (Optional)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors">
              <input type="file" id="ticket-creation-file-upload" className="hidden" onChange={handleFileChange} accept=".pdf,.png,.docx,.doc,.jpg,.jpeg" multiple />
              <label htmlFor="ticket-creation-file-upload" className="cursor-pointer flex flex-col items-center">
                <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                <span className="text-sm font-medium text-[#252578]">Click to upload</span>
                <span className="text-xs text-gray-500 mt-1">Supported formats: PDF, PNG, Word (max. 15MB per file, max. 45MB total)</span>
              </label>
            </div>
            {/* Existing Resumed Attachments */}
            {existingDraftAttachments.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Saved Draft Attachments ({existingDraftAttachments.length})</p>
                {existingDraftAttachments.map((att, idx) => {
                  const attName = att.name || att.file_name || (typeof att === 'string' ? att.split('/').pop() : `Attachment #${idx + 1}`);
                  return (
                    <div key={`existing-${idx}`} className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-[#252578]">
                        <svg className="w-4 h-4 shrink-0 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium truncate max-w-xs">{attName}</span>
                        <span className="text-[10px] text-blue-600 font-semibold px-2 py-0.5 rounded-full bg-blue-100">Draft File</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExistingDraftAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors cursor-pointer"
                        title="Remove draft attachment"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {files.length > 0 && (
              <div className="mt-3 space-y-2.5">
                {files.map((item, idx) => {
                  const isScanning = item.status === 'scanning';
                  const isQuarantined = item.status === 'quarantined';
                  const isClean = item.status === 'clean';

                  return (
                    <div
                      key={item.id || idx}
                      className={`rounded-2xl border p-3.5 transition-all ${
                        isQuarantined
                          ? 'border-rose-300 bg-rose-50/70 shadow-xs'
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
                            <ShieldAlert size={18} className="text-rose-600 shrink-0" />
                          ) : (
                            <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-sm font-semibold truncate max-w-xs ${
                                  isQuarantined ? 'text-rose-950 line-through' : 'text-gray-800'
                                }`}
                              >
                                {item.name}
                              </span>
                              <span className="text-xs text-gray-400">
                                ({(item.size / (1024 * 1024)).toFixed(2)} MB)
                              </span>

                              {/* State Badges */}
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
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 border border-rose-300">
                                  Blocked
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Remove Action */}
                        <button
                          type="button"
                          onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className={`p-1.5 rounded-xl transition-colors cursor-pointer shrink-0 ${
                            isQuarantined
                              ? 'text-rose-700 hover:text-white hover:bg-rose-600 bg-rose-100'
                              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                          }`}
                          title="Remove attachment"
                          aria-label="Remove attachment"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Non-technical block message for Quarantined Files */}
                      {isQuarantined && (
                        <div className="mt-2.5 pt-2 border-t border-rose-200/80 text-xs text-rose-800 flex items-start justify-between gap-3">
                          <p className="leading-relaxed">
                            <strong>Security Alert:</strong> This file was flagged by security scanning and quarantined for your protection. Please remove it and select a clean file.
                          </p>
                          <button
                            type="button"
                            onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className="shrink-0 text-xs font-bold text-rose-700 hover:text-rose-900 underline"
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
            {fileError && <p className="text-sm text-red-500 mt-2 font-medium">{fileError}</p>}
          </div>

          <div className="flex flex-wrap justify-end gap-3 mt-4 border-t border-gray-100 pt-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={loadingOptions || savingDraft || submitting || systemStatus === 'Under Maintenance'}
              className="px-6 py-3 border border-[#252578] text-[#252578] hover:bg-[#252578]/5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {savingDraft ? 'Saving Draft...' : 'Save as Draft'}
            </button>
            <button 
              type="submit" 
              disabled={loadingOptions || submitting || savingDraft || systemStatus === 'Under Maintenance'}
              className="px-8 py-3 bg-[#252578] text-white text-sm font-semibold rounded-xl hover:bg-[#1e1e60] transition-colors shadow-lg shadow-[#252578]/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? 'Submitting...' : systemStatus === 'Under Maintenance' ? 'Maintenance Active' : 'Submit Ticket'}
            </button>
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
