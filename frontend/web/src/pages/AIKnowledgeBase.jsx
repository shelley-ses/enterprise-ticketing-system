import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Book, Search, Filter, ChevronDown, X, Upload, FileText, Download,
  Trash2, Edit3, Eye, RefreshCw, Plus, FolderOpen, CheckCircle,
  AlertTriangle, Loader, File, FileSpreadsheet, Archive, ArrowUpDown,
  Info, History, Globe,
} from 'lucide-react';
import axios from 'axios';
import axiosInstance from '@/api/axiosInstance';
import { AI_API_URL, KB_API_URL } from '@/config/api.config';
import echo from '@/services/echo';

function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

const MOCK_CATEGORIES = [
  'User Manuals', 'Troubleshooting Guides', 'FAQs',
  'Product Specifications', 'Maintenance Guides', 'Installation Guides', 'Warranty Documents',
];

const MOCK_STATUSES = ['Draft', 'Published', 'Archived', 'Processing'];
const MOCK_PUBLISH_STATES = ['Draft', 'Published', 'Archived'];

const MOCK_MACHINES = ['Canon X120', 'Canon X220', 'Epson L3110', 'HP LaserJet Pro', 'Brother MFC', 'No Machine'];

const MOCK_DOCUMENTS = [
  {
    id: 1,
    title: 'Canon X120 User Manual',
    category: 'User Manuals',
    machine: 'Canon X120',
    version: '2.1',
    fileType: 'PDF',
    uploadedBy: 'Admin',
    uploadDate: '2026-06-15',
    size: '4.2 MB',
    status: 'Ready',
    publishState: 'Published',
    processingStatus: 'Ready for AI Search',
    tags: ['manual', 'canon'],
    description: 'Official user manual for Canon X120 printer.',
    history: [
      { id: 101, type: 'created', timestamp: '2026-06-15 09:30', actor: 'Admin' },
      { id: 1011, type: 'published', timestamp: '2026-06-15 10:00', actor: 'Super Admin' },
    ],
  },
  {
    id: 2,
    title: 'Troubleshooting Guide v2.1',
    category: 'Troubleshooting Guides',
    machine: 'No Machine',
    version: '2.1',
    fileType: 'PDF',
    uploadedBy: 'Admin',
    uploadDate: '2026-06-14',
    size: '1.8 MB',
    status: 'Ready',
    publishState: 'Published',
    processingStatus: 'Ready for AI Search',
    tags: ['troubleshooting'],
    description: 'General troubleshooting guide for common issues.',
    history: [
      { id: 102, type: 'created', timestamp: '2026-06-14 14:15', actor: 'Admin' },
      { id: 1021, type: 'published', timestamp: '2026-06-14 15:00', actor: 'Super Admin' },
    ],
  },
  {
    id: 3,
    title: 'Common FAQs 2026',
    category: 'FAQs',
    machine: 'No Machine',
    version: '1.0',
    fileType: 'DOCX',
    uploadedBy: 'Admin',
    uploadDate: '2026-06-13',
    size: '876 KB',
    status: 'Draft',
    publishState: 'Draft',
    processingStatus: 'Processing',
    tags: ['faq'],
    description: 'Frequently asked questions compilation.',
    history: [
      { id: 103, type: 'created', timestamp: '2026-06-13 11:00', actor: 'Admin' },
    ],
  },
  {
    id: 4,
    title: 'Product Spec Sheet',
    category: 'Product Specifications',
    machine: 'Epson L3110',
    version: '3.0',
    fileType: 'PDF',
    uploadedBy: 'Admin',
    uploadDate: '2026-06-12',
    size: '2.1 MB',
    status: 'Draft',
    publishState: 'Draft',
    processingStatus: 'Ready for AI Search',
    tags: ['specs'],
    description: 'Product specifications for Epson L3110.',
    history: [
      { id: 104, type: 'created', timestamp: '2026-06-12 16:45', actor: 'Admin' },
    ],
  },
  {
    id: 5,
    title: 'Maintenance Schedule',
    category: 'Maintenance Guides',
    machine: 'Canon X220',
    version: '1.2',
    fileType: 'DOCX',
    uploadedBy: 'Admin',
    uploadDate: '2026-06-11',
    size: '1.2 MB',
    status: 'Archived',
    publishState: 'Archived',
    processingStatus: 'Ready for AI Search',
    tags: ['maintenance'],
    description: 'Maintenance schedule and procedures.',
    history: [
      { id: 105, type: 'created', timestamp: '2026-06-11 10:20', actor: 'Admin' },
      { id: 1051, type: 'archived', timestamp: '2026-06-11 16:00', actor: 'Super Admin' },
    ],
  },
];

const UPLOAD_STEPS = [
  'Scanning for Malware',
  'Uploading Document',
  'Upload Complete',
  'Extracting Text',
  'Chunking Document',
  'Generating Embeddings',
  'Indexing Knowledge Base',
  'Ready for AI Search',
];

const AI_PROCESSING_STEPS = [
  { label: 'Upload Successful', done: true },
  { label: 'Text Extracted', done: true },
  { label: 'Document Chunked', done: true },
  { label: 'Embeddings Generated', done: false },
  { label: 'Indexed into Knowledge Base', done: false },
  { label: 'Ready for AI Search', done: false },
];

const statusColors = {
  Ready: 'bg-green-50 text-green-700 border-green-200',
  Published: 'bg-green-50 text-green-700 border-green-200',
  Draft: 'bg-amber-50 text-amber-700 border-amber-200',
  Processing: 'bg-blue-50 text-blue-700 border-blue-200',
  Failed: 'bg-red-50 text-red-700 border-red-200',
  Archived: 'bg-gray-100 text-gray-700 border-gray-200',
};

const statusIcons = {
  Ready: CheckCircle,
  Published: CheckCircle,
  Draft: FileText,
  Processing: Loader,
  Failed: AlertTriangle,
  Archived: Archive,
};

const publishStateColors = {
  Published: 'bg-green-50 text-green-700 border-green-200',
  Draft: 'bg-amber-50 text-amber-700 border-amber-200',
  Archived: 'bg-gray-100 text-gray-700 border-gray-200',
};

const publishStateIcons = {
  Published: CheckCircle,
  Draft: FileText,
  Archived: Archive,
};

const processingColors = {
  'Ready for AI Search': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Ready': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Processing': 'bg-blue-50 text-blue-700 border-blue-200',
  'Failed': 'bg-red-50 text-red-700 border-red-200',
};

const fileTypeIcons = {
  PDF: FileText,
  DOCX: FileSpreadsheet,
  DOC: FileSpreadsheet,
  TXT: File,
};

function StatCard({ icon: Icon, label, value, sub, bgClass }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${bgClass || 'bg-[#252578]/10 text-[#252578]'}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function EmptyState({ onUpload }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <FolderOpen size={36} className="text-gray-300" />
      </div>
      <h3 className="text-lg font-bold text-gray-700 mb-1">No knowledge documents have been uploaded yet.</h3>
      <p className="text-sm text-gray-400 mb-6">Upload PDF, DOC, DOCX, or TXT files to build your AI knowledge base.</p>
      <button
        onClick={onUpload}
        className="flex items-center gap-2 px-5 py-2.5 bg-[#252578] text-white rounded-xl text-sm font-semibold hover:bg-[#1f1f66] transition-all cursor-pointer"
      >
        <Upload size={16} />
        Upload First Document
      </button>
    </div>
  );
}

function ArchiveConfirmModal({ isOpen, onClose, onConfirm, doc }) {
  if (!isOpen || !doc) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Archive size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Archive Knowledge Article</h2>
              <p className="text-xs text-gray-500">Deactivate from active chatbot knowledge</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Target Document Details */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs space-y-1">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Target Article</span>
          <p className="font-semibold text-gray-900 text-sm truncate" title={doc.title}>
            {doc.title}
          </p>
          <p className="text-[11px] text-gray-500">
            {doc.category} · {doc.fileType} · Version {doc.version || '1.0'}
          </p>
        </div>

        {/* Archiving Description Notice */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-800 space-y-1.5 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
            <span>Chatbot Deactivation</span>
          </div>
          <p>
            Archiving will remove this article from the chatbot's active knowledge. The article record and file will remain intact and can be re-published later.
          </p>
        </div>

        {/* Reversibility Tooltip */}
        <div className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-gray-700 font-medium">
            <span>Is this permanent?</span>
            <div className="relative group inline-flex items-center">
              <Info size={14} className="text-[#252578] hover:text-[#1f1f66] transition-colors cursor-pointer" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 w-64 p-2.5 bg-gray-900 text-white text-[11px] rounded-lg shadow-lg pointer-events-none text-left leading-normal font-normal">
                Archiving is reversible — you can re-publish this article anytime. This is different from permanent deletion, which cannot be undone.
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Reversible Action</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-all cursor-pointer shadow-sm"
          >
            Confirm Archive
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, doc, title, isDeleting = false, errorMessage = '' }) {
  const [confirmText, setConfirmText] = useState('');
  const targetTitle = doc?.title || title || '';

  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
    }
  }, [isOpen, doc, title]);

  if (!isOpen) return null;

  const isMatch = Boolean(
    targetTitle && (
      confirmText === targetTitle ||
      confirmText === 'DELETE'
    )
  );

  const handleClose = () => {
    if (isDeleting) return;
    setConfirmText('');
    onClose();
  };

  const handleConfirm = () => {
    if (!isMatch || isDeleting) return;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <Trash2 size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Delete Knowledge Article</h2>
              <p className="text-xs text-gray-500">Super Admin verification required</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Server Error Alert if blocked */}
        {errorMessage && (
          <div className="rounded-xl bg-red-50 border border-red-300 p-3 text-xs text-red-900 flex items-start gap-2">
            <AlertTriangle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        {/* Permanent Warning */}
        <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-800 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-red-900">
            <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
            <span>Permanent & Irreversible</span>
          </div>
          <p className="text-red-700 leading-relaxed">
            This action is permanent and cannot be undone. The article record, its file, and its embeddings will be completely removed from the system.
          </p>
        </div>

        {/* Target Document Summary */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Target Article</span>
            {doc?.category && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-200/70 text-gray-700">
                {doc.category}
              </span>
            )}
          </div>
          <p className="font-semibold text-gray-900 text-sm truncate" title={targetTitle}>
            {targetTitle}
          </p>
          {doc && (
            <p className="text-[11px] text-gray-500">
              {doc.fileType} · {doc.size} · Version {doc.version || '1.0'}
            </p>
          )}
        </div>

        {/* Delete vs Archive Tooltip Notice */}
        <div className="flex items-center justify-between text-xs bg-amber-50/70 border border-amber-200/70 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-amber-900 font-medium">
            <span>Need to hide this temporarily?</span>
            <div className="relative group inline-flex items-center">
              <Info size={14} className="text-amber-600 hover:text-amber-800 transition-colors cursor-pointer" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 w-64 p-2.5 bg-gray-900 text-white text-[11px] rounded-lg shadow-lg pointer-events-none text-left leading-normal font-normal">
                Delete permanently removes this article forever. Archive only hides it from the chatbot while keeping the file and record intact for later re-publishing.
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Delete vs Archive</span>
        </div>

        {/* Type to Confirm Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-700">
            To confirm, type <span className="font-mono font-bold text-red-600 select-all">"{targetTitle}"</span> or <span className="font-mono font-bold text-red-600">DELETE</span> below:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={isDeleting}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isMatch && !isDeleting) {
                handleConfirm();
              }
            }}
            placeholder={`Type "${targetTitle}" or "DELETE"`}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 font-mono transition-all disabled:bg-gray-100"
            autoFocus
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isMatch || isDeleting}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center gap-2 ${isMatch && !isDeleting
                ? 'bg-red-600 hover:bg-red-700 cursor-pointer shadow-sm'
                : 'bg-red-300 cursor-not-allowed opacity-60'
              }`}
          >
            {isDeleting && <Loader size={14} className="animate-spin" />}
            {isDeleting ? 'Deleting...' : 'Delete Article'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DiscardConfirmModal({ isOpen, onClose, onConfirm, title, description }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle size={24} className="text-amber-600" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900 text-center">{title || 'Discard Unsaved Changes?'}</h2>
        <p className="mt-2 text-sm text-gray-600 text-center">
          {description || 'You have unsaved knowledge article information. Are you sure you want to discard your changes?'}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-all cursor-pointer"
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function PipelineProgressView({
  selectedFile,
  progress,
  currentStepIdx,
  uploadError,
  successTitle = 'Knowledge Article Created Successfully!',
  successMessage = 'Status set to Draft. It will be indexed and ready for AI search, but hidden from the chatbot until published.',
  steps = UPLOAD_STEPS,
}) {
  const totalSize = selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(1) : 0;
  return (
    <div className="space-y-4">
      {selectedFile && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <FileText size={24} className="text-[#252578] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-700 truncate">{selectedFile.name}</p>
            <p className="text-xs text-gray-400">{totalSize} MB · {selectedFile.name.split('.').pop()?.toUpperCase()}</p>
          </div>
          <span className="text-xs font-semibold text-[#252578]">{Math.round(progress)}%</span>
        </div>
      )}

      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${uploadError ? 'bg-red-500' : 'bg-[#252578]'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2">
        {steps.map((s, i) => {
          const isCurrent = i === currentStepIdx;
          const isPast = i < currentStepIdx;
          const isFailedStep = isCurrent && uploadError;

          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 text-sm ${isFailedStep
                  ? 'text-red-600 font-semibold'
                  : isPast
                    ? 'text-green-600'
                    : isCurrent
                      ? 'text-[#252578] font-semibold'
                      : 'text-gray-300'
                }`}
            >
              {isFailedStep ? (
                <AlertTriangle size={16} className="text-red-600 shrink-0" />
              ) : isPast ? (
                <CheckCircle size={16} className="text-green-600 shrink-0" />
              ) : isCurrent ? (
                <Loader size={16} className="animate-spin text-[#252578] shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
              )}
              <span>{s}</span>
            </div>
          );
        })}
      </div>

      {progress >= 100 && !uploadError && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <CheckCircle size={14} className="text-green-600" />
            {successTitle}
          </p>
          <p className="text-green-700">
            {successMessage}
          </p>
        </div>
      )}
    </div>
  );
}

function ReplaceConfirmModal({ isOpen, doc, onClose, onReplaceComplete, onProcessingStatusChange }) {
  const [step, setStep] = useState('form');
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [isMalwareError, setIsMalwareError] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const reset = () => {
    setStep('form');
    setSelectedFile(null);
    setDragOver(false);
    setErrors({});
    setProgress(0);
    setCurrentStepIdx(0);
    setUploadError('');
    setIsMalwareError(false);
    setShowDiscardModal(false);
  };

  useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen, doc]);

  if (!isOpen || !doc) return null;

  const handleAttemptClose = () => {
    if (step === 'processing') {
      if (progress >= 100 || uploadError) {
        handleForceClose();
      } else {
        setShowDiscardModal(true);
      }
      return;
    }

    if (selectedFile) {
      setShowDiscardModal(true);
      return;
    }

    handleForceClose();
  };

  const handleForceClose = () => {
    setShowDiscardModal(false);
    if (step === 'processing' && progress < 100 && onProcessingStatusChange) {
      onProcessingStatusChange(doc.id, 'Ready for AI Search');
    }
    reset();
    onClose();
  };

  const handleFileValidateAndSet = (file) => {
    if (!file) return;

    // Check extension: PDF, DOCX only
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      setErrors((prev) => ({
        ...prev,
        file: 'Invalid file type. Only PDF and DOCX files are supported.',
      }));
      setSelectedFile(null);
      return;
    }

    // Check byte size: 10 MB limit (10 * 1024 * 1024 = 10,485,760 bytes)
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        file: 'File size exceeds maximum limit of 10 MB.',
      }));
      setSelectedFile(null);
      return;
    }

    setErrors((prev) => ({ ...prev, file: '' }));
    setSelectedFile(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (file) handleFileValidateAndSet(file);
  };

  const startReplacementPipeline = async () => {
    if (!selectedFile) {
      setErrors({ file: 'Please upload a replacement PDF or DOCX file.' });
      return;
    }

    setStep('processing');
    setProgress(0);
    setCurrentStepIdx(0);
    setUploadError('');
    setIsMalwareError(false);

    // SIMULATED: Models the spec requirement that the chatbot keeps serving old content until new content is ready.
    // While replacement is mid-pipeline, the document's publish status remains visibly "Ready"/"Published" and unaffected in the table,
    // while the processing-status badge shows "Processing".
    if (onProcessingStatusChange) {
      onProcessingStatusChange(doc.id, 'Processing');
    }

    // Step 0: Scanning for Malware
    setCurrentStepIdx(0);
    setProgress(12);
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Simulated malware scan failure condition:
    // Triggers failure if filename contains 'malware', 'eicar', 'virus', or 'infected'
    const lowerName = (selectedFile?.name || '').toLowerCase();
    const isMalware = lowerName.includes('eicar') || lowerName.includes('malware') || lowerName.includes('virus') || lowerName.includes('infected');

    if (isMalware) {
      setUploadError('File failed malware scan and was not processed.');
      setIsMalwareError(true);
      if (onProcessingStatusChange) {
        onProcessingStatusChange(doc.id, 'Ready for AI Search');
      }
      return;
    }

    // Step 1: Uploading Document
    setCurrentStepIdx(1);
    setProgress(25);
    await new Promise((resolve) => setTimeout(resolve, 450));

    // Step 2: Upload Complete
    setCurrentStepIdx(2);
    setProgress(40);
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Simulated processing failure path:
    // Triggers if filename contains 'corrupt', 'fail', 'error', or 'broken'
    const isCorrupt = lowerName.includes('corrupt') || lowerName.includes('fail') || lowerName.includes('error') || lowerName.includes('broken');

    // Step 3: Extracting Text
    setCurrentStepIdx(3);
    setProgress(55);
    await new Promise((resolve) => setTimeout(resolve, 450));

    if (isCorrupt) {
      setUploadError('Document processing failed: text extraction encountered unreadable or corrupted data stream.');
      if (onProcessingStatusChange) {
        onProcessingStatusChange(doc.id, 'Ready for AI Search');
      }
      return;
    }

    // Step 4: Chunking Document
    setCurrentStepIdx(4);
    setProgress(70);
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Step 5: Generating Embeddings
    setCurrentStepIdx(5);
    setProgress(85);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 6: Indexing Knowledge Base
    setCurrentStepIdx(6);
    setProgress(95);
    await new Promise((resolve) => setTimeout(resolve, 450));

    // Step 7: Ready for AI Search
    setCurrentStepIdx(7);
    setProgress(100);

    if (onReplaceComplete) {
      onReplaceComplete(doc.id, selectedFile);
    }
  };

  const newFileSizeMb = selectedFile ? (selectedFile.size / (1024 * 1024)).toFixed(1) : 0;

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
        <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                <RefreshCw size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Replace Article Document</h2>
                <p className="text-xs text-gray-500 truncate max-w-[360px]">{doc.title}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAttemptClose}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
            {step === 'form' ? (
              <>
                {/* Target Document Card */}
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Target Article</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColors[doc.status] || 'bg-gray-100 text-gray-700'}`}>
                      {doc.status}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-800 text-sm">{doc.title}</p>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-gray-500 border-t border-gray-200/50">
                    <div>
                      <span className="text-gray-400 block text-[9px] uppercase">Category</span>
                      <span className="font-medium text-gray-700 truncate block">{doc.category}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[9px] uppercase">Machine</span>
                      <span className="font-medium text-gray-700 truncate block">{doc.machine}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[9px] uppercase">Current File</span>
                      <span className="font-medium text-gray-700 truncate block">{doc.fileType} · {doc.size}</span>
                    </div>
                  </div>
                </div>

                {/* Upload Zone */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Upload Replacement File <span className="text-red-500">*</span>
                  </label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${dragOver
                        ? 'border-[#252578] bg-[#252578]/5'
                        : errors.file
                          ? 'border-red-400 bg-red-50/30'
                          : selectedFile
                            ? 'border-green-400 bg-green-50/20'
                            : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    {selectedFile ? (
                      <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-green-200 shadow-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText size={20} className="text-[#252578] shrink-0" />
                          <div className="text-left truncate">
                            <p className="text-xs font-semibold text-gray-800 truncate">{selectedFile.name}</p>
                            <p className="text-[10px] text-gray-400">{newFileSizeMb} MB · {selectedFile.name.split('.').pop()?.toUpperCase()}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-red-500 cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} className="mx-auto text-gray-400 mb-1.5" />
                        <p className="text-xs font-medium text-gray-700">Drag & drop new file here, or click to browse</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Supports PDF and DOCX up to 10 MB</p>
                        <label className="mt-2.5 inline-block px-3 py-1.5 bg-[#252578] text-white text-xs font-semibold rounded-lg hover:bg-[#1f1f66] transition-all cursor-pointer">
                          Browse File
                          <input
                            type="file"
                            accept=".pdf,.docx"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileValidateAndSet(file);
                            }}
                          />
                        </label>
                      </>
                    )}
                  </div>
                  {errors.file && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      {errors.file}
                    </p>
                  )}
                </div>

                {/* Serving notice callout */}
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Seamless Serving Notice:</strong> The existing file content will continue to be served by the AI chatbot during re-indexing. Once the replacement pipeline completes, the new document will be indexed and activated.
                  </p>
                </div>
              </>
            ) : (
              <PipelineProgressView
                selectedFile={selectedFile}
                progress={progress}
                currentStepIdx={currentStepIdx}
                uploadError={uploadError}
                successTitle="File Replaced & Re-indexed Successfully!"
                successMessage="The replacement document has completed malware scanning, chunking, and vector indexing. New content is now active for AI search."
                steps={UPLOAD_STEPS}
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            {step === 'form' ? (
              <>
                <button
                  type="button"
                  onClick={handleAttemptClose}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={startReplacementPipeline}
                  disabled={!selectedFile}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-all cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirm & Replace
                </button>
              </>
            ) : (
              <>
                {uploadError && (
                  <button
                    type="button"
                    onClick={() => {
                      setStep('form');
                      setUploadError('');
                      setIsMalwareError(false);
                    }}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all cursor-pointer"
                  >
                    Back to File Selection
                  </button>
                )}
                {progress >= 100 && (
                  <button
                    type="button"
                    onClick={handleForceClose}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#252578] hover:bg-[#1f1f66] transition-all cursor-pointer shadow-sm"
                  >
                    Done
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <DiscardConfirmModal
        isOpen={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onConfirm={handleForceClose}
        title="Discard File Replacement?"
        description="Are you sure you want to cancel? Any selected replacement file will not be processed and the existing document will remain unchanged."
      />
    </>
  );
}

function CreateArticleConfirmModal({ isOpen, onClose, onConfirm, form, selectedFile }) {
  if (!isOpen) return null;
  const fileSizeMb = selectedFile ? (selectedFile.size / (1024 * 1024)).toFixed(2) : '0';

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#252578]/10 text-[#252578]">
          <FileText size={24} className="text-[#252578]" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900 text-center">Confirm Knowledge Article Creation</h2>
        <p className="mt-2 text-sm text-gray-600 text-center">
          Please review the article details before starting the document processing pipeline.
        </p>

        <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-2.5 text-xs">
          <div className="flex justify-between items-start gap-2">
            <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Title:</span>
            <span className="font-medium text-gray-900 text-right truncate max-w-[240px]">{form.title}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Category:</span>
            <span className="font-medium text-gray-900">{form.category}</span>
          </div>
          <div className="flex justify-between items-start gap-2">
            <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">File:</span>
            <span className="font-medium text-gray-900 text-right truncate max-w-[240px]">
              {selectedFile?.name} ({fileSizeMb} MB)
            </span>
          </div>
          {form.machine && (
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Machine:</span>
              <span className="font-medium text-gray-900">{form.machine}</span>
            </div>
          )}
          {form.version && (
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Version:</span>
              <span className="font-medium text-gray-900">{form.version}</span>
            </div>
          )}
          <div className="pt-2 border-t border-gray-200/70 flex justify-between items-center text-[11px]">
            <span className="font-semibold text-amber-800">Initial State:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Draft
            </span>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-gray-400 text-center">
          Note: This article will be created in Draft status and will not be accessible to the AI chatbot until published.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#252578] hover:bg-[#1f1f66] transition-all cursor-pointer"
          >
            Confirm & Upload
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoriesManager({ isOpen, onClose }) {
  const [categories, setCategories] = useState(MOCK_CATEGORIES);
  const [newCat, setNewCat] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editVal, setEditVal] = useState('');

  if (!isOpen) return null;

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (trimmed) { setCategories(prev => [...prev, trimmed]); setNewCat(''); }
  };

  const handleEdit = (idx) => {
    const trimmed = editVal.trim();
    if (trimmed) {
      setCategories(prev => prev.map((c, i) => i === idx ? trimmed : c));
      setEditingIdx(null);
    }
  };

  const handleDelete = (idx) => {
    setCategories(prev => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Manage Categories</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"><X size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {categories.map((cat, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {editingIdx === idx ? (
                <input
                  type="text" value={editVal} autoFocus
                  onChange={e => setEditVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleEdit(idx); if (e.key === 'Escape') setEditingIdx(null); }}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578]"
                />
              ) : (
                <span className="flex-1 text-sm text-gray-700">{cat}</span>
              )}
              {editingIdx === idx ? (
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(idx)} className="px-2 py-1 text-xs font-semibold text-white bg-[#252578] rounded-lg hover:bg-[#1f1f66] cursor-pointer">Save</button>
                  <button onClick={() => setEditingIdx(null)} className="px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <button onClick={() => { setEditingIdx(idx); setEditVal(cat); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#252578] cursor-pointer"><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete(idx)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 cursor-pointer"><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <input
              type="text" value={newCat} placeholder="New category name..."
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578]"
            />
            <button onClick={handleAdd} disabled={!newCat.trim()} className="flex items-center gap-1.5 px-4 py-2 bg-[#252578] text-white rounded-lg text-sm font-semibold hover:bg-[#1f1f66] transition-all disabled:opacity-40 cursor-pointer"><Plus size={16} />Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadModal({ isOpen, onClose, onUploadComplete }) {
  const [step, setStep] = useState('form');
  const [progress, setProgress] = useState(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [form, setForm] = useState({ title: '', category: '', machine: '', version: '', description: '', tags: '' });
  const [errors, setErrors] = useState({});
  const [uploadError, setUploadError] = useState('');
  const [isMalwareError, setIsMalwareError] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const reset = () => {
    setStep('form');
    setProgress(0);
    setCurrentStepIdx(0);
    setSelectedFile(null);
    setForm({ title: '', category: '', machine: '', version: '', description: '', tags: '' });
    setErrors({});
    setUploadError('');
    setIsMalwareError(false);
    setShowConfirmModal(false);
    setShowDiscardModal(false);
  };

  if (!isOpen) return null;

  const hasUnsavedData = Boolean(
    form.title.trim() ||
    form.category ||
    selectedFile ||
    form.machine.trim() ||
    form.version.trim() ||
    form.description.trim() ||
    form.tags.trim()
  );

  const handleAttemptClose = () => {
    if (step === 'uploading') {
      if (progress >= 100 || uploadError) {
        handleForceClose();
      } else {
        setShowDiscardModal(true);
      }
      return;
    }

    if (hasUnsavedData) {
      setShowDiscardModal(true);
      return;
    }

    handleForceClose();
  };

  const handleForceClose = () => {
    setShowDiscardModal(false);
    setShowConfirmModal(false);
    reset();
    onClose();
  };

  const handleFileValidateAndSet = (file) => {
    if (!file) return;

    // Check extension: PDF, DOCX only
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      setErrors((prev) => ({
        ...prev,
        file: 'Invalid file type. Only PDF and DOCX files are supported.',
      }));
      setSelectedFile(null);
      return;
    }

    // Check byte size: 10 MB limit (10 * 1024 * 1024 = 10,485,760 bytes)
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        file: 'File size exceeds maximum limit of 10 MB.',
      }));
      setSelectedFile(null);
      return;
    }

    setErrors((prev) => ({ ...prev, file: '' }));
    setSelectedFile(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (file) handleFileValidateAndSet(file);
  };

  const handleValidateAndPromptConfirm = (e) => {
    if (e) e.preventDefault();
    const newErrors = {};

    if (!form.title.trim()) {
      newErrors.title = 'Document title is required.';
    }

    if (!form.category) {
      newErrors.category = 'Please select a category.';
    }

    if (!selectedFile) {
      newErrors.file = 'Please upload a PDF or DOCX file.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setShowConfirmModal(true);
  };

  const startSimulatedUpload = async () => {
    setShowConfirmModal(false);
    setStep('uploading');
    setProgress(0);
    setCurrentStepIdx(0);
    setUploadError('');
    setIsMalwareError(false);

    // SIMULATED: no real KB backend exists (port 8009 serves a different service, configuration-service). Replace with a real upload/processing endpoint once available.

    // Step 0: Scanning for Malware
    setCurrentStepIdx(0);
    setProgress(12);

    await new Promise((resolve) => setTimeout(resolve, 600));

    // Simulated malware scan failure condition:
    // Triggers failure if filename contains 'malware', 'eicar', 'virus', or 'infected'
    const lowerName = (selectedFile?.name || '').toLowerCase();
    const isMalware = lowerName.includes('eicar') || lowerName.includes('malware') || lowerName.includes('virus') || lowerName.includes('infected');

    if (isMalware) {
      setUploadError('File failed malware scan and was not processed.');
      setIsMalwareError(true);
      return;
    }

    // Step 1: Uploading Document
    setCurrentStepIdx(1);
    setProgress(25);
    await new Promise((resolve) => setTimeout(resolve, 450));

    // Step 2: Upload Complete
    setCurrentStepIdx(2);
    setProgress(40);
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Step 3: Extracting Text
    setCurrentStepIdx(3);
    setProgress(55);
    await new Promise((resolve) => setTimeout(resolve, 450));

    // Step 4: Chunking Document
    setCurrentStepIdx(4);
    setProgress(70);
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Step 5: Generating Embeddings
    setCurrentStepIdx(5);
    setProgress(85);
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 6: Indexing Knowledge Base
    setCurrentStepIdx(6);
    setProgress(95);
    await new Promise((resolve) => setTimeout(resolve, 450));

    // Step 7: Ready for AI Search
    setCurrentStepIdx(7);
    setProgress(100);

    // TS080 Dependency: Draft articles are not exposed to the AI chatbot until Super Admin explicitly publishes them.
    const newDoc = {
      id: Date.now(),
      title: form.title.trim(),
      category: form.category,
      machine: form.machine.trim() || 'No Machine',
      version: form.version.trim() || '1.0',
      fileType: selectedFile.name.split('.').pop().toUpperCase(),
      uploadedBy: 'Super Admin',
      uploadDate: new Date().toISOString().split('T')[0],
      size: `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`,
      status: 'Draft',
      publishState: 'Draft',
      processingStatus: 'Ready for AI Search',
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      description: form.description.trim(),
      history: [
        {
          id: Date.now(),
          type: 'created',
          timestamp: new Date().toISOString(),
          actor: 'Super Admin',
        },
      ],
    };

    if (onUploadComplete) {
      onUploadComplete(newDoc);
    }
  };

  const totalSize = selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(1) : 0;

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
        <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <h2 className="text-lg font-bold text-gray-900">Upload Knowledge Document</h2>
            <button
              type="button"
              onClick={handleAttemptClose}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {step === 'form' && (
            <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Document Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => {
                      setForm({ ...form, title: e.target.value });
                      if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
                    }}
                    placeholder="e.g. Printer Configuration Guide"
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all ${errors.title
                        ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                        : 'border-gray-200 focus:border-transparent focus:ring-2 focus:ring-[#252578]'
                      }`}
                  />
                  {errors.title && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      {errors.title}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <div className="relative group inline-flex items-center">
                      <Info size={14} className="text-gray-400 hover:text-[#252578] transition-colors cursor-pointer" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 w-56 p-2 bg-gray-900 text-white text-[11px] rounded-lg shadow-lg pointer-events-none text-center leading-normal">
                        Category determines which chatbot topics this article will be used to answer.
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                      </div>
                    </div>
                  </div>
                  <select
                    value={form.category}
                    onChange={(e) => {
                      setForm({ ...form, category: e.target.value });
                      if (errors.category) setErrors((prev) => ({ ...prev, category: '' }));
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all bg-white ${errors.category
                        ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                        : 'border-gray-200 focus:border-transparent focus:ring-2 focus:ring-[#252578]'
                      }`}
                  >
                    <option value="">Select category</option>
                    {MOCK_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      {errors.category}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Machine Model</label>
                  <input
                    type="text"
                    value={form.machine}
                    onChange={(e) => setForm({ ...form, machine: e.target.value })}
                    placeholder="e.g. Canon X120"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Version</label>
                  <input
                    type="text"
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    placeholder="e.g. 1.0"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tags</label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    placeholder="Comma separated"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578]"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578] resize-none"
                    placeholder="Brief summary of document content..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Upload File <span className="text-red-500">*</span>
                </label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${errors.file
                      ? 'border-red-400 bg-red-50/20'
                      : dragOver
                        ? 'border-[#252578] bg-[#252578]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  {selectedFile ? (
                    <div className="space-y-2">
                      <FileText size={32} className="mx-auto text-[#252578]" />
                      <p className="text-sm font-semibold text-gray-700">{selectedFile.name}</p>
                      <p className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-xs text-red-500 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">Drag & drop a file here, or <span className="text-[#252578] font-semibold">browse</span></p>
                      <p className="text-xs text-gray-400 mt-1">Supported: PDF, DOCX (max 10 MB)</p>
                      <input
                        type="file"
                        accept=".pdf,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileValidateAndSet(file);
                        }}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="inline-block mt-3 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:border-[#252578] hover:text-[#252578] transition-all cursor-pointer"
                      >
                        Choose File
                      </label>
                    </>
                  )}
                </div>
                {errors.file && (
                  <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    {errors.file}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 'uploading' && (
            <div className="px-6 py-6 space-y-5 flex-1">
              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">{isMalwareError ? 'Security Alert' : 'Upload Failed'}</p>
                    <p className="text-xs text-red-600 mt-0.5">{uploadError}</p>
                  </div>
                </div>
              )}

              <PipelineProgressView
                selectedFile={selectedFile}
                progress={progress}
                currentStepIdx={currentStepIdx}
                uploadError={uploadError}
                successTitle="Knowledge Article Created Successfully!"
                successMessage="Status set to Draft. It will be indexed and ready for AI search, but hidden from the chatbot until published."
                steps={UPLOAD_STEPS}
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            {step === 'form' && (
              <>
                <button
                  type="button"
                  onClick={handleAttemptClose}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleValidateAndPromptConfirm}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#252578] hover:bg-[#1f1f66] transition-all cursor-pointer shadow-sm"
                >
                  Upload & Process
                </button>
              </>
            )}

            {step === 'uploading' && uploadError && (
              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setUploadError('');
                  setIsMalwareError(false);
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all cursor-pointer"
              >
                Back to Form
              </button>
            )}

            {step === 'uploading' && progress >= 100 && (
              <button
                type="button"
                onClick={handleForceClose}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#252578] hover:bg-[#1f1f66] transition-all cursor-pointer shadow-sm"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>

      <CreateArticleConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={startSimulatedUpload}
        form={form}
        selectedFile={selectedFile}
      />

      <DiscardConfirmModal
        isOpen={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onConfirm={handleForceClose}
      />
    </>
  );
}

function DocumentDetailModal({ isOpen, doc, onClose, onPublish, onArchivePrompt }) {
  if (!isOpen || !doc) return null;

  const isPublished = (doc.publishState || doc.status) === 'Published';
  const canPublish = (doc.processingStatus === 'Ready for AI Search' || doc.processingStatus === 'Ready') && doc.status !== 'Processing';
  const PublishStateIcon = publishStateIcons[doc.publishState || 'Draft'] || FileText;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate" title={doc.title}>{doc.title}</h2>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${publishStateColors[doc.publishState || 'Draft']}`}>
              {PublishStateIcon && <PublishStateIcon size={10} />}
              {doc.publishState || 'Draft'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isPublished ? (
              <button
                type="button"
                onClick={() => onArchivePrompt && onArchivePrompt(doc)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all cursor-pointer"
              >
                <Archive size={14} />
                Archive Article
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onPublish && onPublish(doc)}
                disabled={!canPublish}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${canPublish
                    ? 'text-white bg-green-600 hover:bg-green-700 cursor-pointer shadow-xs'
                    : 'text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed opacity-60'
                  }`}
                title={
                  canPublish
                    ? "Publish to AI Chatbot"
                    : "This article's content hasn't been successfully processed yet. Fix or replace the file before publishing."
                }
              >
                <Globe size={14} />
                Publish Article
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"><X size={20} /></button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-5 flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Category</p><p className="text-sm font-medium text-gray-800 mt-0.5">{doc.category}</p></div>
            <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Machine Model</p><p className="text-sm font-medium text-gray-800 mt-0.5">{doc.machine}</p></div>
            <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Version</p><p className="text-sm font-medium text-gray-800 mt-0.5">{doc.version || '—'}</p></div>
            <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">File Type</p><p className="text-sm font-medium text-gray-800 mt-0.5">{doc.fileType}</p></div>
            <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Uploaded By</p><p className="text-sm font-medium text-gray-800 mt-0.5">{doc.uploadedBy}</p></div>
            <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Upload Date</p><p className="text-sm font-medium text-gray-800 mt-0.5">{doc.uploadDate}</p></div>
            <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">File Size</p><p className="text-sm font-medium text-gray-800 mt-0.5">{doc.size}</p></div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Publish State</p>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border mt-1 ${publishStateColors[doc.publishState || 'Draft']}`}>
                {PublishStateIcon && <PublishStateIcon size={10} />}
                {doc.publishState || 'Draft'}
              </span>
            </div>
          </div>
          {doc.description && (
            <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</p><p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">{doc.description}</p></div>
          )}
          {doc.tags && (
            <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Tags</p><div className="flex flex-wrap gap-1.5">{doc.tags.map(t => <span key={t} className="px-2 py-0.5 bg-[#252578]/5 text-[#252578] text-xs rounded-full font-medium">{t}</span>)}</div></div>
          )}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">AI Processing Status</p>
              {(doc.publishState || doc.status) === 'Draft' && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  Publish State: Draft (Excluded from AI Chatbot)
                </span>
              )}
              {(doc.publishState || doc.status) === 'Archived' && (
                <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-0.5 rounded-full">
                  Publish State: Archived (Excluded from AI Chatbot)
                </span>
              )}
              {(doc.publishState || doc.status) === 'Published' && (
                <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
                  Publish State: Published (Active in AI Chatbot)
                </span>
              )}
            </div>
            <div className="space-y-2">
              {AI_PROCESSING_STEPS.map((step, i) => (
                <div key={i} className={`flex items-center gap-2.5 text-sm ${step.done ? 'text-gray-700' : 'text-gray-300'}`}>
                  {step.done ? <CheckCircle size={16} className="text-green-500" /> : <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}
                  {step.label}
                </div>
              ))}
            </div>
          </div>

          {/* TS078 / TS080: Version & Change History (Audit Trail) */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <History size={13} className="text-gray-400" />
                Version & Change History
              </p>
              <span className="text-[10px] text-gray-400 font-medium">
                {(doc.history || []).length} {(doc.history || []).length === 1 ? 'event' : 'events'} recorded
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(!doc.history || doc.history.length === 0) ? (
                <p className="text-xs text-gray-400 italic">No history records available.</p>
              ) : (
                doc.history.map((entry, idx) => {
                  const isReplacement = entry.type === 'file_replacement';
                  const isMetadata = entry.type === 'metadata';
                  const isPublishedEntry = entry.type === 'published';
                  const isArchivedEntry = entry.type === 'archived';

                  const Icon = isReplacement
                    ? RefreshCw
                    : isMetadata
                      ? Edit3
                      : isPublishedEntry
                        ? Globe
                        : isArchivedEntry
                          ? Archive
                          : Plus;

                  const badgeClass = isReplacement
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : isMetadata
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : isPublishedEntry
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : isArchivedEntry
                          ? 'bg-gray-100 text-gray-700 border-gray-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200';

                  const typeLabel = isReplacement
                    ? 'File Replaced'
                    : isMetadata
                      ? 'Metadata Updated'
                      : isPublishedEntry
                        ? 'Article Published'
                        : isArchivedEntry
                          ? 'Article Archived'
                          : 'Article Created';

                  return (
                    <div key={entry.id || idx} className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-xs">
                      <div className={`p-1.5 rounded-md border ${badgeClass} flex-shrink-0 mt-0.5`}>
                        <Icon size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-gray-800">{typeLabel}</span>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatTimestamp(entry.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                          <span>By <strong className="text-gray-700">{entry.actor || 'Super Admin'}</strong></span>
                          {entry.fileName && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[200px] text-gray-600 font-medium">{entry.fileName}</span>
                              {entry.fileSize && <span className="text-gray-400">({entry.fileSize})</span>}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Document Preview</p>
            <div className="bg-gray-50 rounded-lg border border-gray-100 p-6 text-center">
              <FileText size={36} className="mx-auto text-gray-300 mb-2" />
              <p className="text-xs text-gray-400">Preview not available for this file type.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditMetadataModal({ isOpen, doc, onClose, onSave }) {
  const [form, setForm] = useState({ title: '', category: '', machine: '', version: '', description: '', tags: '' });
  const [errors, setErrors] = useState({});
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  React.useEffect(() => {
    if (doc) {
      setForm({
        title: doc.title || '',
        category: doc.category || '',
        machine: doc.machine || '',
        version: doc.version || '',
        description: doc.description || '',
        tags: (doc.tags || []).join(', '),
      });
      setErrors({});
      setShowDiscardModal(false);
    }
  }, [doc, isOpen]);

  if (!isOpen || !doc) return null;

  const hasChanges = Boolean(
    doc && (
      form.title !== (doc.title || '') ||
      form.category !== (doc.category || '') ||
      form.machine !== (doc.machine || '') ||
      form.version !== (doc.version || '') ||
      form.description !== (doc.description || '') ||
      form.tags !== ((doc.tags || []).join(', '))
    )
  );

  const handleAttemptClose = () => {
    if (hasChanges) {
      setShowDiscardModal(true);
    } else {
      handleForceClose();
    }
  };

  const handleForceClose = () => {
    setShowDiscardModal(false);
    setErrors({});
    onClose();
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!form.title.trim()) {
      setErrors({ title: 'Document title is required.' });
      return;
    }
    setErrors({});
    // Metadata-only edits are non-disruptive: directly save without confirmation modal or re-triggering pipeline
    onSave(form);
  };

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
        <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Edit Metadata</h2>
            <button onClick={handleAttemptClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"><X size={20} /></button>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Document Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => {
                  setForm({ ...form, title: e.target.value });
                  if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all ${errors.title
                    ? 'border-red-500 focus:ring-2 focus:ring-red-200'
                    : 'border-gray-200 focus:border-transparent focus:ring-2 focus:ring-[#252578]'
                  }`}
              />
              {errors.title && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {errors.title}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="relative group inline-flex items-center">
                    <Info size={14} className="text-gray-400 hover:text-[#252578] transition-colors cursor-pointer" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 w-56 p-2 bg-gray-900 text-white text-[11px] rounded-lg shadow-lg pointer-events-none text-center leading-normal">
                      Category determines which chatbot topics this article will be used to answer.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
                    </div>
                  </div>
                </div>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578] bg-white">
                  {MOCK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Machine Model</label>
                <select value={form.machine} onChange={e => setForm({ ...form, machine: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578] bg-white">
                  {MOCK_MACHINES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Version</label>
                <input type="text" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Tags</label>
                <input type="text" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578]" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578] resize-none" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
            <button onClick={handleAttemptClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer">Cancel</button>
            <button onClick={handleSubmit} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#252578] hover:bg-[#1f1f66] transition-all cursor-pointer">Save Changes</button>
          </div>
        </div>
      </div>

      <DiscardConfirmModal
        isOpen={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onConfirm={handleForceClose}
        title="Discard Unsaved Metadata Changes?"
        description="You have unsaved changes to this article's metadata. Are you sure you want to discard your changes?"
      />
    </>
  );
}

function AISidePanel({ summary }) {
  return (
    <div className="w-full xl:w-48 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col flex-shrink-0 self-start">
      <div className="p-3.5 border-b border-gray-100">
        <h3 className="text-xs font-bold text-gray-800">Knowledge Base Status</h3>
      </div>
      <div className="p-3.5 space-y-3.5">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Documents Indexed</p>
          <p className="text-base font-bold text-gray-800 mt-0.5">{summary?.ready || 0}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Categories</p>
          <p className="text-base font-bold text-gray-800 mt-0.5">{summary?.categories || 0}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">AI Service Status</p>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Operational
          </span>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Processing</p>
          <p className="text-base font-bold text-gray-800 mt-0.5">{summary?.processing || 0}</p>
        </div>
      </div>
    </div>
  );
}

function AIKnowledgeBase() {
  const normalizeDocs = (rawDocs) => {
    return rawDocs.map((doc, idx) => {
      const publishState = doc.publishState || (
        doc.status === 'Ready'
          ? (doc.id === 1 || doc.id === 2 ? 'Published' : 'Draft')
          : doc.status === 'Archived'
            ? 'Archived'
            : 'Draft'
      );

      return {
        ...doc,
        publishState,
        status: doc.status === 'Processing' ? 'Processing' : (publishState === 'Published' ? 'Ready' : publishState),
        processingStatus: doc.processingStatus || (doc.status === 'Processing' ? 'Processing' : 'Ready for AI Search'),
        history: Array.isArray(doc.history) && doc.history.length > 0 ? doc.history : [
          {
            id: doc.id ? doc.id * 100 + 1 : idx + 100,
            type: 'created',
            timestamp: doc.uploadDate ? `${doc.uploadDate} 09:00` : '2026-06-15 09:00',
            actor: doc.uploadedBy || 'Super Admin',
          },
        ],
      };
    });
  };

  const [documents, setDocuments] = useState(() => {
    try {
      const stored = localStorage.getItem('ai_kb_documents');
      if (stored) return normalizeDocs(JSON.parse(stored));
    } catch { }
    return MOCK_DOCUMENTS;
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMachine, setFilterMachine] = useState('');
  const [filterFileType, setFilterFileType] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [deleteBlockedMsg, setDeleteBlockedMsg] = useState('');
  const [publishBlockedMsg, setPublishBlockedMsg] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState('');

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`${AI_API_URL}/articles`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        const mapped = res.data.data.map((item) => {
          const publishState = item.status;
          return {
            id: item.id,
            title: item.title,
            category: item.category,
            machine: item.machine || 'No Machine',
            version: item.version || '1.0',
            fileType: item.file_type || 'PDF',
            size: item.size || item.file_size || '1.0 MB',
            uploadedBy: item.uploaded_by || 'Super Admin',
            uploadDate: item.created_at ? item.created_at.split('T')[0] : '2026-06-15',
            status: publishState === 'Published' ? 'Ready' : publishState,
            publishState,
            processingStatus: item.processing_status || (publishState === 'Published' ? 'Ready for AI Search' : 'Ready'),
            tags: Array.isArray(item.tags) ? item.tags : [],
            description: item.description || '',
            history: Array.isArray(item.history) && item.history.length > 0 ? item.history : [
              {
                id: item.id * 100 + 1,
                type: 'created',
                timestamp: item.created_at ? item.created_at.substring(0, 16).replace('T', ' ') : '2026-06-15 09:00',
                actor: item.uploaded_by || 'Super Admin',
              },
            ],
          };
        });
        setDocuments(mapped);
        try { localStorage.setItem('ai_kb_documents', JSON.stringify(mapped)); } catch { }
        return;
      }
    } catch (err) {
      console.warn('Could not fetch KB articles from AI-service API, using local fallback:', err);
    }

    try {
      const stored = localStorage.getItem('ai_kb_documents');
      if (stored) {
        setDocuments(normalizeDocs(JSON.parse(stored)));
      } else {
        setDocuments(MOCK_DOCUMENTS);
        localStorage.setItem('ai_kb_documents', JSON.stringify(MOCK_DOCUMENTS));
      }
    } catch {
      setDocuments(MOCK_DOCUMENTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Real-time event bus listener for knowledge-base broadcast events
  useEffect(() => {
    try {
      const channel = echo.channel('knowledge-base');
      const handleArticleDeleted = (payload) => {
        if (payload?.article_id) {
          setDocuments((prev) => {
            const next = prev.filter(d => d.id !== payload.article_id);
            try { localStorage.setItem('ai_kb_documents', JSON.stringify(next)); } catch {}
            return next;
          });
        }
      };

      channel.listen('.article.deleted', handleArticleDeleted);
      channel.listen('.article.published', () => fetchDocuments());
      channel.listen('.article.archived', () => fetchDocuments());

      return () => {
        channel.stopListening('.article.deleted');
        channel.stopListening('.article.published');
        channel.stopListening('.article.archived');
      };
    } catch (e) {
      console.warn('Echo knowledge-base subscription notice:', e);
    }
  }, [fetchDocuments]);

  const filteredDocs = useMemo(() => {
    let docs = [...documents];
    if (search) { const q = search.toLowerCase(); docs = docs.filter(d => d.title.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q) || (d.tags || []).some(t => t.includes(q))); }
    if (filterCategory) docs = docs.filter(d => d.category === filterCategory);
    if (filterStatus) {
      if (filterStatus === 'Processing') {
        docs = docs.filter(d => d.processingStatus === 'Processing' || d.status === 'Processing');
      } else {
        docs = docs.filter(d => (d.publishState || d.status) === filterStatus || (filterStatus === 'Published' && d.status === 'Ready'));
      }
    }
    if (filterMachine) docs = docs.filter(d => d.machine === filterMachine);
    if (filterFileType) docs = docs.filter(d => d.fileType === filterFileType);
    docs.sort((a, b) => sortOrder === 'newest' ? new Date(b.uploadDate) - new Date(a.uploadDate) : new Date(a.uploadDate) - new Date(b.uploadDate));
    return docs;
  }, [documents, search, filterCategory, filterStatus, filterMachine, filterFileType, sortOrder]);

  const summary = useMemo(() => ({
    total: documents.length,
    published: documents.filter(d => (d.publishState || d.status) === 'Published' || d.status === 'Ready').length,
    draft: documents.filter(d => (d.publishState || d.status) === 'Draft').length,
    archived: documents.filter(d => (d.publishState || d.status) === 'Archived').length,
    processing: documents.filter(d => d.processingStatus === 'Processing' || d.status === 'Processing').length,
    categories: MOCK_CATEGORIES.length,
  }), [documents]);

  const allFileTypes = useMemo(() => [...new Set(documents.map(d => d.fileType).filter(Boolean))], [documents]);

  const handleDocumentCreated = (newDoc) => {
    setDocuments((prev) => {
      const next = [newDoc, ...prev];
      try {
        localStorage.setItem('ai_kb_documents', JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save document to localStorage:', err);
      }
      return next;
    });

    // Synchronize document creation and RAG indexing with AI-service backend
    axiosInstance.post(`${AI_API_URL}/articles`, {
      title: newDoc.title,
      category: newDoc.category,
      machine: newDoc.machine,
      version: newDoc.version,
      file_type: newDoc.fileType,
      file_size: newDoc.size,
      status: newDoc.publishState || (newDoc.status === 'Ready' ? 'Published' : newDoc.status) || 'Draft',
      tags: newDoc.tags,
      description: newDoc.description,
      content: newDoc.description || newDoc.title,
    }).then((res) => {
      if (res.data?.data?.id) {
        const backendDoc = res.data.data;
        setDocuments((prev) => prev.map((d) => d.id === newDoc.id ? { ...d, id: backendDoc.id } : d));
      }
    }).catch((err) => {
      console.warn('Failed to sync created document with AI service:', err);
    });
  };

  const handleView = (doc) => { setSelectedDoc(doc); setShowDetailModal(true); };
  const handleEdit = (doc) => { setSelectedDoc(doc); setShowEditModal(true); };
  const handleDelete = (doc) => {
    if (doc.processingStatus === 'Processing' || doc.status === 'Processing') {
      setDeleteBlockedMsg('This article is currently being processed and cannot be deleted until that finishes.');
      return;
    }
    setDeleteBlockedMsg('');
    setDeleteModalError('');
    setSelectedDoc(doc);
    setShowDeleteModal(true);
  };
  const handleReplace = (doc) => { setSelectedDoc(doc); setShowReplaceModal(true); };

  // TS080: Publish action (Draft/Archived -> Published)
  // Direct state update (no confirmation modal needed per spec).
  // Blocked if content was not successfully processed (processingStatus !== 'Ready for AI Search').
  const handlePublish = async (doc) => {
    if (!doc) return;
    const isReady = (doc.processingStatus === 'Ready for AI Search' || doc.processingStatus === 'Ready') && doc.status !== 'Processing';
    if (!isReady) {
      setPublishBlockedMsg("This article's content hasn't been successfully processed yet. Fix or replace the file before publishing.");
      return;
    }

    setPublishBlockedMsg('');
    const now = new Date().toISOString();
    const historyEntry = {
      id: Date.now(),
      type: 'published',
      timestamp: now,
      actor: 'Super Admin',
    };

    const previousDocs = documents;

    // Immediate optimistic update
    setDocuments((prev) => {
      const next = prev.map(d => d.id === doc.id ? {
        ...d,
        publishState: 'Published',
        status: 'Ready',
        history: [historyEntry, ...(d.history || [])],
      } : d);
      try { localStorage.setItem('ai_kb_documents', JSON.stringify(next)); } catch { }
      return next;
    });

    setSelectedDoc((prev) => (prev && prev.id === doc.id) ? {
      ...prev,
      publishState: 'Published',
      status: 'Ready',
      history: [historyEntry, ...(prev.history || [])],
    } : prev);

    // Synchronize publish state immediately to AI-service backend
    try {
      const res = await axiosInstance.post(`${AI_API_URL}/articles/${doc.id}/publish`, {
        actor: 'Super Admin',
      });
      if (res.data?.success && res.data?.data) {
        const backendDoc = res.data.data;
        const normalized = {
          ...doc,
          ...backendDoc,
          status: backendDoc.publishState === 'Published' || backendDoc.status === 'Published' ? 'Ready' : backendDoc.status,
          publishState: backendDoc.publishState || 'Published',
          history: Array.isArray(backendDoc.history) && backendDoc.history.length > 0 ? backendDoc.history : [historyEntry, ...(doc.history || [])],
        };
        setDocuments((prev) => {
          const next = prev.map(d => d.id === doc.id ? normalized : d);
          try { localStorage.setItem('ai_kb_documents', JSON.stringify(next)); } catch { }
          return next;
        });
        setSelectedDoc((prev) => (prev && prev.id === doc.id) ? normalized : prev);
      }
    } catch (err) {
      console.warn('Failed to publish article on AI service:', err);
      const errMsg = err.response?.data?.message || "Failed to publish article. Please ensure document content is processed.";
      setPublishBlockedMsg(errMsg);
      // Revert optimistic update
      setDocuments(previousDocs);
      try { localStorage.setItem('ai_kb_documents', JSON.stringify(previousDocs)); } catch { }
      setSelectedDoc(doc);
    }
  };

  // TS080: Archive action (Published -> Archived)
  // Requires confirmation modal (reversible; keeps file and record intact).
  const handleArchivePrompt = (doc) => {
    setSelectedDoc(doc);
    setShowArchiveModal(true);
  };

  const handleConfirmArchive = async () => {
    if (!selectedDoc) return;
    const docToArchive = selectedDoc;
    setShowArchiveModal(false);

    const now = new Date().toISOString();
    const historyEntry = {
      id: Date.now(),
      type: 'archived',
      timestamp: now,
      actor: 'Super Admin',
    };

    const previousDocs = documents;

    // Immediate optimistic update
    setDocuments((prev) => {
      const next = prev.map(d => d.id === docToArchive.id ? {
        ...d,
        publishState: 'Archived',
        status: 'Archived',
        history: [historyEntry, ...(d.history || [])],
      } : d);
      try { localStorage.setItem('ai_kb_documents', JSON.stringify(next)); } catch { }
      return next;
    });

    setSelectedDoc((prev) => (prev && prev.id === docToArchive.id) ? {
      ...prev,
      publishState: 'Archived',
      status: 'Archived',
      history: [historyEntry, ...(prev.history || [])],
    } : prev);

    // Synchronize archive state immediately to AI-service backend
    try {
      const res = await axiosInstance.post(`${AI_API_URL}/articles/${docToArchive.id}/archive`, {
        actor: 'Super Admin',
      });
      if (res.data?.success && res.data?.data) {
        const backendDoc = res.data.data;
        const normalized = {
          ...docToArchive,
          ...backendDoc,
          status: 'Archived',
          publishState: 'Archived',
          history: Array.isArray(backendDoc.history) && backendDoc.history.length > 0 ? backendDoc.history : [historyEntry, ...(docToArchive.history || [])],
        };
        setDocuments((prev) => {
          const next = prev.map(d => d.id === docToArchive.id ? normalized : d);
          try { localStorage.setItem('ai_kb_documents', JSON.stringify(next)); } catch { }
          return next;
        });
        setSelectedDoc((prev) => (prev && prev.id === docToArchive.id) ? normalized : prev);
      }
    } catch (err) {
      console.warn('Failed to archive article on AI service:', err);
      // Revert optimistic update
      setDocuments(previousDocs);
      try { localStorage.setItem('ai_kb_documents', JSON.stringify(previousDocs)); } catch { }
      setSelectedDoc(docToArchive);
    }
  };

  // Metadata-only edit handler:
  // Non-disruptive, NO confirmation modal, NO pipeline re-triggering.
  // Appends { type: 'metadata', timestamp, actor: 'Super Admin' } to document's history.
  const handleSaveEdit = (form) => {
    if (!selectedDoc) return;
    const now = new Date().toISOString();
    const historyEntry = {
      id: Date.now(),
      type: 'metadata',
      timestamp: now,
      actor: 'Super Admin',
    };

    setDocuments((prev) => {
      const next = prev.map(d => d.id === selectedDoc.id ? {
        ...d,
        title: form.title.trim(),
        category: form.category,
        machine: form.machine,
        version: form.version.trim(),
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        description: form.description.trim(),
        history: [historyEntry, ...(d.history || [])],
      } : d);
      try { localStorage.setItem('ai_kb_documents', JSON.stringify(next)); } catch { }
      return next;
    });

    setSelectedDoc((prev) => prev ? {
      ...prev,
      title: form.title.trim(),
      category: form.category,
      machine: form.machine,
      version: form.version.trim(),
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      description: form.description.trim(),
      history: [historyEntry, ...(prev.history || [])],
    } : null);

    setShowEditModal(false);

    // Sync metadata updates to AI-service backend
    axiosInstance.put(`${AI_API_URL}/articles/${selectedDoc.id}`, {
      title: form.title.trim(),
      category: form.category,
      machine: form.machine,
      version: form.version.trim(),
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      description: form.description.trim(),
    }).catch((err) => {
      console.warn('Failed to update article on AI service:', err);
    });
  };

  // File replacement completion handler:
  // Updates file details, upload date, processing status, and appends { type: 'file_replacement', ... } to history.
  const handleReplaceComplete = (docId, newFile) => {
    const now = new Date().toISOString();
    const historyEntry = {
      id: Date.now(),
      type: 'file_replacement',
      timestamp: now,
      actor: 'Super Admin',
      fileName: newFile.name,
      fileSize: `${(newFile.size / (1024 * 1024)).toFixed(1)} MB`,
    };

    setDocuments((prev) => {
      const next = prev.map(d => d.id === docId ? {
        ...d,
        fileType: newFile.name.split('.').pop()?.toUpperCase() || d.fileType,
        size: `${(newFile.size / (1024 * 1024)).toFixed(1)} MB`,
        uploadDate: now.split('T')[0],
        processingStatus: 'Ready for AI Search',
        history: [historyEntry, ...(d.history || [])],
      } : d);
      try { localStorage.setItem('ai_kb_documents', JSON.stringify(next)); } catch { }
      return next;
    });

    setSelectedDoc((prev) => (prev && prev.id === docId) ? {
      ...prev,
      fileType: newFile.name.split('.').pop()?.toUpperCase() || prev.fileType,
      size: `${(newFile.size / (1024 * 1024)).toFixed(1)} MB`,
      uploadDate: now.split('T')[0],
      processingStatus: 'Ready for AI Search',
      history: [historyEntry, ...(prev.history || [])],
    } : prev);
  };

  // Dynamic processing status updater while replacement is mid-pipeline:
  // SIMULATED: Models the spec requirement that the chatbot keeps serving old content until new content is ready.
  // While replacement is mid-pipeline, the document's publish status (d.status) remains visibly unaffected,
  // while only the processingStatus updates to "Processing".
  const handleProcessingStatusChange = (docId, newProcessingStatus) => {
    setDocuments((prev) => {
      const next = prev.map(d => d.id === docId ? {
        ...d,
        processingStatus: newProcessingStatus,
      } : d);
      try { localStorage.setItem('ai_kb_documents', JSON.stringify(next)); } catch { }
      return next;
    });

    setSelectedDoc((prev) => (prev && prev.id === docId) ? {
      ...prev,
      processingStatus: newProcessingStatus,
    } : prev);
  };

  const handleConfirmDelete = async () => {
    if (!selectedDoc) return;
    const docToDelete = selectedDoc;

    if (docToDelete.processingStatus === 'Processing' || docToDelete.status === 'Processing') {
      setDeleteModalError('Cannot delete article while an extraction or indexing process is currently in progress. Please wait for the process to complete or cancel it.');
      setDeleteBlockedMsg('Cannot delete article while an extraction or indexing process is currently in progress.');
      return;
    }

    setIsDeleting(true);
    setDeleteModalError('');

    try {
      await axiosInstance.delete(`${AI_API_URL}/articles/${docToDelete.id}`, {
        data: { actor: 'Super Admin' },
      });

      // Synchronize state immediately
      setDocuments((prev) => {
        const next = prev.filter(d => d.id !== docToDelete.id);
        try { localStorage.setItem('ai_kb_documents', JSON.stringify(next)); } catch { }
        return next;
      });

      setShowDeleteModal(false);
      setSelectedDoc(null);
      setIsDeleting(false);

      // Append audit log entry matching ticket_audit_logs shape
      try {
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const simulatedLogEntry = {
          id: `kb-del-${Date.now()}`,
          timestamp: now,
          user: 'Super Admin',
          role: 'Super Admin',
          action: 'Deleted',
          module: 'Knowledge Base',
          target: docToDelete.title,
          details: `Permanently deleted knowledge article "${docToDelete.title}" and purged active RAG index.`,
        };

        const existingLogs = JSON.parse(localStorage.getItem('superadmin_simulated_audit_logs') || '[]');
        const updatedLogs = [simulatedLogEntry, ...existingLogs];
        localStorage.setItem('superadmin_simulated_audit_logs', JSON.stringify(updatedLogs));
      } catch (err) {
        console.error('Failed to append to audit logs:', err);
      }
    } catch (err) {
      console.warn('Failed to delete article on AI service:', err);
      const errMsg = err.response?.data?.message || 'Failed to delete article. Please try again.';
      setDeleteModalError(errMsg);
      setDeleteBlockedMsg(errMsg);
      setIsDeleting(false);
    }
  };

  const toggleSelectDoc = (id) => {
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">AI Knowledge Base</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage documents for the AI Support Assistant</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategories(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:border-gray-300 transition-all cursor-pointer"
          >
            <FolderOpen size={16} />
            Categories
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#252578] text-white rounded-xl text-sm font-semibold hover:bg-[#1f1f66] transition-all cursor-pointer"
          >
            <Upload size={16} />
            Upload Document
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={FileText} label="Total Documents" value={summary.total} bgClass="bg-purple-100 text-purple-700" sub={`${summary.published} published · ${summary.draft} draft`} />
        <StatCard icon={CheckCircle} label="Published" value={summary.published} bgClass="bg-green-100 text-green-700" />
        <StatCard icon={FileText} label="Drafts" value={summary.draft} bgClass="bg-amber-100 text-amber-700" />
        <StatCard icon={Archive} label="Archived" value={summary.archived} bgClass="bg-gray-100 text-gray-700" />
        <StatCard icon={Loader} label="Processing" value={summary.processing} bgClass="bg-blue-100 text-blue-700" />
      </div>

      {publishBlockedMsg && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
            <span>{publishBlockedMsg}</span>
          </div>
          <button
            onClick={() => setPublishBlockedMsg('')}
            className="p-1 text-amber-600 hover:text-amber-800 rounded-lg hover:bg-amber-100 cursor-pointer"
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {deleteBlockedMsg && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
            <span>{deleteBlockedMsg}</span>
          </div>
          <button
            onClick={() => setDeleteBlockedMsg('')}
            className="p-1 text-amber-600 hover:text-amber-800 rounded-lg hover:bg-amber-100 cursor-pointer"
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-5 items-start">
        <div className="flex-1 min-w-0 w-full">
          {loading ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center py-20">
              <Loader size={24} className="animate-spin text-[#252578]" />
              <span className="ml-3 text-sm text-gray-500">Loading documents...</span>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <EmptyState onUpload={() => setShowUploadModal(true)} />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578]" />
                  </div>
                  <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578] bg-white">
                    <option value="">All Categories</option>
                    {MOCK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578] bg-white">
                    <option value="">All Statuses</option>
                    {MOCK_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <select value={filterFileType} onChange={e => setFilterFileType(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578] bg-white">
                    <option value="">All Types</option>
                    {allFileTypes.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <button onClick={() => setSortOrder(s => s === 'newest' ? 'oldest' : 'newest')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all cursor-pointer">
                    <ArrowUpDown size={14} />
                    {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-8">
                        <input type="checkbox" onChange={e => setSelectedDocs(e.target.checked ? documents.map(d => d.id) : [])} checked={selectedDocs.length === documents.length && documents.length > 0} className="rounded border-gray-300" />
                      </th>
                      <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[160px]">Document Title</th>
                      <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Category</th>
                      <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Machine Model</th>
                      <th className="text-center px-3 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Version</th>
                      <th className="text-center px-3 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">File Type</th>
                      <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Upload Date</th>
                      <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                      <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map(doc => {
                      const FileIcon = fileTypeIcons[doc.fileType] || FileText;
                      const isMidProcess = doc.processingStatus === 'Processing' || doc.status === 'Processing';
                      const isPublished = (doc.publishState || doc.status) === 'Published';
                      const canPublish = (doc.processingStatus === 'Ready for AI Search' || doc.processingStatus === 'Ready') && doc.status !== 'Processing';
                      const PublishIcon = publishStateIcons[doc.publishState || 'Draft'] || FileText;

                      return (
                        <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-all">
                          <td className="px-3 py-3 w-8"><input type="checkbox" checked={selectedDocs.includes(doc.id)} onChange={() => toggleSelectDoc(doc.id)} className="rounded border-gray-300" /></td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <FileIcon size={16} className="text-gray-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-gray-800 truncate max-w-[200px] xl:max-w-none" title={doc.title}>{doc.title}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{doc.category}</td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{doc.machine}</td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap text-center">{doc.version || '—'}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-center"><span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{doc.fileType}</span></td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap font-medium">{doc.uploadDate}</td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {/* TS080: Distinct badges for Publish State & Processing Status */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Publish State Badge */}
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${publishStateColors[doc.publishState || 'Draft']}`}>
                                {PublishIcon && <PublishIcon size={10} />}
                                {doc.publishState || 'Draft'}
                              </span>

                              {/* Processing Status Badge */}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isMidProcess
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : doc.processingStatus === 'Failed'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                {isMidProcess ? (
                                  <Loader size={10} className="animate-spin" />
                                ) : doc.processingStatus === 'Failed' ? (
                                  <AlertTriangle size={10} />
                                ) : (
                                  <CheckCircle size={10} />
                                )}
                                {doc.processingStatus || 'Ready for AI Search'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* TS080: Conditional Publish / Archive Action Button */}
                              {isPublished ? (
                                <button
                                  onClick={() => handleArchivePrompt(doc)}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-600 transition-all cursor-pointer"
                                  title="Archive Article (remove from chatbot)"
                                >
                                  <Archive size={15} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handlePublish(doc)}
                                  disabled={!canPublish}
                                  className={`p-1.5 rounded-lg transition-all ${canPublish
                                      ? 'hover:bg-gray-100 text-gray-400 hover:text-green-600 cursor-pointer'
                                      : 'text-gray-300 cursor-not-allowed opacity-40'
                                    }`}
                                  title={
                                    canPublish
                                      ? "Publish Article (make active for chatbot)"
                                      : "This article's content hasn't been successfully processed yet. Fix or replace the file before publishing."
                                  }
                                >
                                  <Globe size={15} />
                                </button>
                              )}

                              <button onClick={() => handleView(doc)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#252578] transition-all cursor-pointer" title="View"><Eye size={15} /></button>
                              <button onClick={() => handleEdit(doc)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#252578] transition-all cursor-pointer" title="Edit Metadata"><Edit3 size={15} /></button>
                              <button onClick={() => handleReplace(doc)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-600 transition-all cursor-pointer" title="Replace File"><RefreshCw size={15} /></button>
                              <button
                                onClick={() => handleDelete(doc)}
                                disabled={isMidProcess}
                                className={`p-1.5 rounded-lg transition-all ${isMidProcess
                                    ? 'text-gray-300 cursor-not-allowed opacity-40'
                                    : 'hover:bg-gray-100 text-gray-400 hover:text-red-500 cursor-pointer'
                                  }`}
                                title={isMidProcess ? "Cannot delete while this document is processing." : "Delete"}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>{filteredDocs.length} of {documents.length} documents</span>
                {selectedDocs.length > 0 && <span>{selectedDocs.length} selected</span>}
              </div>
            </div>
          )}
        </div>

        <AISidePanel summary={summary} />
      </div>

      <UploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} onUploadComplete={handleDocumentCreated} />
      <DocumentDetailModal
        isOpen={showDetailModal}
        doc={selectedDoc}
        onClose={() => setShowDetailModal(false)}
        onPublish={handlePublish}
        onArchivePrompt={handleArchivePrompt}
      />
      <EditMetadataModal isOpen={showEditModal} doc={selectedDoc} onClose={() => setShowEditModal(false)} onSave={handleSaveEdit} />
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        doc={selectedDoc}
        title={selectedDoc?.title}
        isDeleting={isDeleting}
        errorMessage={deleteModalError}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteModal(false);
            setDeleteModalError('');
          }
        }}
        onConfirm={handleConfirmDelete}
      />
      <ArchiveConfirmModal
        isOpen={showArchiveModal}
        doc={selectedDoc}
        onClose={() => setShowArchiveModal(false)}
        onConfirm={handleConfirmArchive}
      />
      <ReplaceConfirmModal
        isOpen={showReplaceModal}
        doc={selectedDoc}
        onClose={() => setShowReplaceModal(false)}
        onReplaceComplete={handleReplaceComplete}
        onProcessingStatusChange={handleProcessingStatusChange}
      />
      <CategoriesManager isOpen={showCategories} onClose={() => setShowCategories(false)} />
    </div>
  );
}

export default AIKnowledgeBase;
