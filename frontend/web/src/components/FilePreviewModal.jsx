import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';

export default function FilePreviewModal({ file, onClose }) {
  useLockBodyScroll(!!file);

  if (!file) return null;

  const { name, url } = file;
  const [imgError, setImgError] = useState(false);
  const [blobUrl, setBlobUrl] = useState('');
  const [blobLoading, setBlobLoading] = useState(false);

  const getAbsoluteUrl = (rawUrl) => {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('blob:')) return rawUrl;
    let cleaned = rawUrl;
    if (cleaned.includes('attachment-service')) {
      try {
        const u = new URL(cleaned);
        cleaned = u.pathname + (u.search || '');
      } catch {
        const idx = cleaned.indexOf('/storage/');
        if (idx !== -1) cleaned = cleaned.substring(idx);
      }
    }
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
      return cleaned;
    }
    if (cleaned.startsWith('/storage/')) {
      return cleaned;
    }
    if (cleaned.startsWith('/')) {
      return `/storage${cleaned}`;
    }
    return `/storage/${cleaned}`;
  };

  const absoluteUrl = getAbsoluteUrl(url);
  const previewUrl = blobUrl || absoluteUrl;
  const downloadUrl = blobUrl || absoluteUrl;

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    const loadBlob = async () => {
      if (!absoluteUrl || absoluteUrl.startsWith('blob:') || absoluteUrl.startsWith('http')) return;
      try {
        setBlobLoading(true);
        const res = await fetch(absoluteUrl);
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setBlobUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      } catch {
        // fallback to direct url
      } finally {
        if (!cancelled) setBlobLoading(false);
      }
    };
    loadBlob();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [absoluteUrl]);

  const getExt = (filename) => {
    if (!filename) return '';
    return filename.split('.').pop().toLowerCase();
  };

  const ext = getExt(name);
  const isImg = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  const isPdf = ext === 'pdf';
  const isDocx = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext);

  const getGoogleDocsUrl = (fileUrl) => {
    let fullUrl = fileUrl;
    if (fileUrl.startsWith('/')) {
      fullUrl = window.location.origin + fileUrl;
    }
    return `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-[1.5px] p-4 transition-all duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-5 h-5 text-[#252578] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-field-value text-gray-800 truncate" title={name}>{name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 hover:bg-gray-200/50 rounded-full"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Preview Container */}
        <div className="flex-1 min-h-[40vh] max-h-[70vh] bg-gray-950 flex items-center justify-center p-4 overflow-auto">
          {blobLoading ? (
            <div className="text-center text-gray-400 py-12">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-timestamp">Loading preview...</p>
            </div>
          ) : isImg && !imgError ? (
            <img
              src={previewUrl}
              alt={name}
              className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg"
              onError={() => setImgError(true)}
            />
          ) : isImg && imgError ? (
            <div className="text-center text-gray-400 py-12">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-55 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-field-value">Could not load image</p>
              <p className="text-timestamp mt-1">The file may not be accessible. Try downloading it.</p>
            </div>
          ) : isPdf ? (
            <iframe
              src={previewUrl}
              title={name}
              className="w-full h-[65vh] rounded-lg border-0 bg-white"
            />
          ) : isDocx ? (
            <iframe
              src={getGoogleDocsUrl(previewUrl)}
              title={name}
              className="w-full h-[65vh] rounded-lg border-0 bg-white"
            />
          ) : (
            <div className="text-center text-gray-400 py-12">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-55 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-field-value">No preview available for this file type</p>
              <p className="text-timestamp mt-1">Please download the file to view its contents.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
          <a
            href={downloadUrl}
            download={name}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (downloadUrl.startsWith('blob:')) return;
              e.preventDefault();
              fetch(absoluteUrl).then(r => r.blob()).then(blob => {
                const u = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = u;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 1000);
              });
            }}
            className="px-6 py-2.5 bg-[#252578] hover:bg-[#1a1a5c] text-white text-button rounded-xl transition-all shadow-md shadow-[#252578]/20 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download File
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
