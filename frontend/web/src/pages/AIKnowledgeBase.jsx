import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Book, Search, Filter, ChevronDown, X, Upload, FileText, Download,
  Trash2, Edit3, Eye, RefreshCw, Plus, FolderOpen, CheckCircle,
  AlertTriangle, Loader, File, FileSpreadsheet, Archive, ArrowUpDown,
  Info,
} from 'lucide-react';
import axios from 'axios';
import { KB_API_URL } from '@/config/api.config';

const MOCK_CATEGORIES = [
  'User Manuals', 'Troubleshooting Guides', 'FAQs',
  'Product Specifications', 'Maintenance Guides', 'Installation Guides', 'Warranty Documents',
];

const MOCK_STATUSES = ['Draft', 'Ready', 'Processing', 'Failed', 'Archived'];

const MOCK_MACHINES = ['Canon X120', 'Canon X220', 'Epson L3110', 'HP LaserJet Pro', 'Brother MFC', 'No Machine'];

const MOCK_DOCUMENTS = [
  { id: 1, title: 'Canon X120 User Manual', category: 'User Manuals', machine: 'Canon X120', version: '2.1', fileType: 'PDF', uploadedBy: 'Admin', uploadDate: '2026-06-15', size: '4.2 MB', status: 'Ready', tags: ['manual', 'canon'], description: 'Official user manual for Canon X120 printer.' },
  { id: 2, title: 'Troubleshooting Guide v2.1', category: 'Troubleshooting Guides', machine: 'No Machine', version: '2.1', fileType: 'PDF', uploadedBy: 'Admin', uploadDate: '2026-06-14', size: '1.8 MB', status: 'Ready', tags: ['troubleshooting'], description: 'General troubleshooting guide for common issues.' },
  { id: 3, title: 'Common FAQs 2026', category: 'FAQs', machine: 'No Machine', version: '1.0', fileType: 'DOCX', uploadedBy: 'Admin', uploadDate: '2026-06-13', size: '876 KB', status: 'Processing', tags: ['faq'], description: 'Frequently asked questions compilation.' },
  { id: 4, title: 'Product Spec Sheet', category: 'Product Specifications', machine: 'Epson L3110', version: '3.0', fileType: 'PDF', uploadedBy: 'Admin', uploadDate: '2026-06-12', size: '2.1 MB', status: 'Ready', tags: ['specs'], description: 'Product specifications for Epson L3110.' },
  { id: 5, title: 'Maintenance Schedule', category: 'Maintenance Guides', machine: 'Canon X220', version: '1.2', fileType: 'DOCX', uploadedBy: 'Admin', uploadDate: '2026-06-11', size: '1.2 MB', status: 'Failed', tags: ['maintenance'], description: 'Maintenance schedule and procedures.' },
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
  Draft: 'bg-amber-50 text-amber-700 border-amber-200',
  Processing: 'bg-blue-50 text-blue-700 border-blue-200',
  Failed: 'bg-red-50 text-red-700 border-red-200',
  Archived: 'bg-gray-50 text-gray-600 border-gray-200',
};

const statusIcons = {
  Ready: CheckCircle,
  Draft: FileText,
  Processing: Loader,
  Failed: AlertTriangle,
  Archived: Archive,
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

function DeleteConfirmModal({ isOpen, onClose, onConfirm, title }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <Trash2 size={24} className="text-red-600" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900 text-center">Delete Document</h2>
        <p className="mt-2 text-sm text-gray-600 text-center">
          Deleting <strong>{title}</strong> will remove it from the AI Knowledge Base and it will no longer be available to the AI Support Assistant.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer">Cancel</button>
          <button onClick={onConfirm} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all cursor-pointer">Delete</button>
        </div>
      </div>
    </div>
  );
}

function ReplaceConfirmModal({ isOpen, onClose, onConfirm, title }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <RefreshCw size={24} className="text-amber-600" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900 text-center">Replace Document</h2>
        <p className="mt-2 text-sm text-gray-600 text-center">
          This will replace the file for <strong>{title}</strong>. The document metadata will be preserved.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer">Cancel</button>
          <button onClick={onConfirm} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 transition-all cursor-pointer">Replace</button>
        </div>
      </div>
    </div>
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

function DiscardConfirmModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle size={24} className="text-amber-600" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900 text-center">Discard Unsaved Changes?</h2>
        <p className="mt-2 text-sm text-gray-600 text-center">
          You have unsaved knowledge article information. Are you sure you want to discard your changes?
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
      processingStatus: 'Ready for AI Search',
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      description: form.description.trim(),
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
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all ${
                      errors.title
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
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-all bg-white ${
                      errors.category
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
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    errors.file
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

              {selectedFile && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <FileText size={24} className="text-[#252578]" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700">{selectedFile.name}</p>
                    <p className="text-xs text-gray-400">{totalSize} MB · {selectedFile.name.split('.').pop()?.toUpperCase()}</p>
                  </div>
                  <span className="text-xs font-semibold text-[#252578]">{Math.round(progress)}%</span>
                </div>
              )}

              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${uploadError ? 'bg-red-500' : 'bg-[#252578]'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="space-y-2">
                {UPLOAD_STEPS.map((s, i) => {
                  const isCurrent = i === currentStepIdx;
                  const isPast = i < currentStepIdx;
                  const isFailedStep = isCurrent && uploadError;

                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2.5 text-sm ${
                        isFailedStep
                          ? 'text-red-600 font-semibold'
                          : isPast
                          ? 'text-green-600'
                          : isCurrent
                          ? 'text-[#252578] font-semibold'
                          : 'text-gray-300'
                      }`}
                    >
                      {isFailedStep ? (
                        <AlertTriangle size={16} className="text-red-600" />
                      ) : isPast ? (
                        <CheckCircle size={16} />
                      ) : isCurrent ? (
                        <Loader size={16} className="animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                      )}
                      <span>{s}</span>
                    </div>
                  );
                })}
              </div>

              {progress >= 100 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-green-600" />
                    Knowledge Article Created Successfully!
                  </p>
                  <p className="text-green-700">
                    Status set to <strong>Draft</strong>. It will be indexed and ready for AI search, but hidden from the chatbot until published.
                  </p>
                </div>
              )}
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

function DocumentDetailModal({ isOpen, doc, onClose }) {
  if (!isOpen || !doc) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{doc.title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"><X size={20} /></button>
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
            <div><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</p><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border mt-1 ${statusColors[doc.status]}`}>{doc.status}</span></div>
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
              {doc.status === 'Draft' && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  Publish State: Draft (Excluded from AI Chatbot)
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
  React.useEffect(() => {
    if (doc) setForm({ title: doc.title, category: doc.category, machine: doc.machine, version: doc.version || '', description: doc.description || '', tags: (doc.tags || []).join(', ') });
  }, [doc]);

  if (!isOpen || !doc) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Edit Metadata</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"><X size={20} /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Title</label>
            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Category</label>
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
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer">Cancel</button>
          <button onClick={() => onSave(form)} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#252578] hover:bg-[#1f1f66] transition-all cursor-pointer">Save Changes</button>
        </div>
      </div>
    </div>
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
  const [documents, setDocuments] = useState(() => {
    try {
      const stored = localStorage.getItem('ai_kb_documents');
      if (stored) return JSON.parse(stored);
    } catch {}
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
  const [showCategories, setShowCategories] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedDocs, setSelectedDocs] = useState([]);

  const fetchDocuments = useCallback(() => {
    setLoading(true);
    // SIMULATED: no real KB backend exists (port 8009 serves a different service, configuration-service). Replace with a real upload/processing endpoint once available.
    try {
      const stored = localStorage.getItem('ai_kb_documents');
      if (stored) {
        setDocuments(JSON.parse(stored));
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

  const filteredDocs = useMemo(() => {
    let docs = [...documents];
    if (search) { const q = search.toLowerCase(); docs = docs.filter(d => d.title.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q) || (d.tags || []).some(t => t.includes(q))); }
    if (filterCategory) docs = docs.filter(d => d.category === filterCategory);
    if (filterStatus) docs = docs.filter(d => d.status === filterStatus);
    if (filterMachine) docs = docs.filter(d => d.machine === filterMachine);
    if (filterFileType) docs = docs.filter(d => d.fileType === filterFileType);
    docs.sort((a, b) => sortOrder === 'newest' ? new Date(b.uploadDate) - new Date(a.uploadDate) : new Date(a.uploadDate) - new Date(b.uploadDate));
    return docs;
  }, [documents, search, filterCategory, filterStatus, filterMachine, filterFileType, sortOrder]);

  const summary = useMemo(() => ({
    total: documents.length,
    ready: documents.filter(d => d.status === 'Ready').length,
    draft: documents.filter(d => d.status === 'Draft').length,
    processing: documents.filter(d => d.status === 'Processing').length,
    failed: documents.filter(d => d.status === 'Failed').length,
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
  };

  const handleView = (doc) => { setSelectedDoc(doc); setShowDetailModal(true); };
  const handleEdit = (doc) => { setSelectedDoc(doc); setShowEditModal(true); };
  const handleDelete = (doc) => { setSelectedDoc(doc); setShowDeleteModal(true); };
  const handleReplace = (doc) => { setSelectedDoc(doc); setShowReplaceModal(true); };

  const handleSaveEdit = (form) => {
    if (!selectedDoc) return;
    setDocuments((prev) => {
      const next = prev.map(d => d.id === selectedDoc.id ? {
        ...d,
        title: form.title,
        category: form.category,
        machine: form.machine,
        version: form.version,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        description: form.description,
      } : d);
      try { localStorage.setItem('ai_kb_documents', JSON.stringify(next)); } catch {}
      return next;
    });
    setShowEditModal(false);
  };

  const handleConfirmDelete = () => {
    if (!selectedDoc) return;
    setDocuments((prev) => {
      const next = prev.filter(d => d.id !== selectedDoc.id);
      try { localStorage.setItem('ai_kb_documents', JSON.stringify(next)); } catch {}
      return next;
    });
    setShowDeleteModal(false);
  };

  const handleConfirmReplace = () => {
    // The replace modal should have a file input; for now close and re-upload
    setShowReplaceModal(false);
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
        <StatCard icon={FileText} label="Total Documents" value={summary.total} bgClass="bg-purple-100 text-purple-700" sub={`${summary.ready} ready · ${summary.draft} draft`} />
        <StatCard icon={CheckCircle} label="Ready for AI Search" value={summary.ready} bgClass="bg-green-100 text-green-700" />
        <StatCard icon={Loader} label="Processing" value={summary.processing} bgClass="bg-blue-100 text-blue-700" />
        <StatCard icon={AlertTriangle} label="Failed" value={summary.failed} bgClass="bg-red-100 text-red-700" />
        <StatCard icon={Book} label="Categories" value={summary.categories} bgClass="bg-amber-100 text-amber-700" />
      </div>

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
                      const StatusIcon = statusIcons[doc.status];
                      const FileIcon = fileTypeIcons[doc.fileType] || FileText;
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
                          <td className="px-3 py-3 whitespace-nowrap"><span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusColors[doc.status] || 'bg-gray-100 text-gray-700'}`}>{StatusIcon && <StatusIcon size={10} className={doc.status === 'Processing' ? 'animate-spin' : ''} />}{doc.status}</span></td>
                          <td className="px-3 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleView(doc)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#252578] transition-all cursor-pointer" title="View"><Eye size={15} /></button>
                              <button onClick={() => handleEdit(doc)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#252578] transition-all cursor-pointer" title="Edit Metadata"><Edit3 size={15} /></button>
                              <button onClick={() => handleReplace(doc)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-amber-600 transition-all cursor-pointer" title="Replace File"><RefreshCw size={15} /></button>
                              <button onClick={() => handleDelete(doc)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-all cursor-pointer" title="Delete"><Trash2 size={15} /></button>
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
      <DocumentDetailModal isOpen={showDetailModal} doc={selectedDoc} onClose={() => setShowDetailModal(false)} />
      <EditMetadataModal isOpen={showEditModal} doc={selectedDoc} onClose={() => setShowEditModal(false)} onSave={handleSaveEdit} />
      <DeleteConfirmModal isOpen={showDeleteModal} title={selectedDoc?.title} onClose={() => setShowDeleteModal(false)} onConfirm={handleConfirmDelete} />
      <ReplaceConfirmModal isOpen={showReplaceModal} title={selectedDoc?.title} onClose={() => setShowReplaceModal(false)} onConfirm={handleConfirmReplace} />
      <CategoriesManager isOpen={showCategories} onClose={() => setShowCategories(false)} />
    </div>
  );
}

export default AIKnowledgeBase;
