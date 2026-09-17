import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';
import tokenStore from '@/auth/tokenStore';

export default function FilePreviewModal({ file, onClose }) {
  useLockBodyScroll(!!file);

  if (!file) return null;

  const fileName =
    file?.name ||
    file?.file_name ||
    (typeof file === 'string' ? file.split('/').pop() : '') ||
    'Attachment';

  const rawUrl =
    file?.url ||
    file?.file_path ||
    file?.path ||
    (typeof file === 'string' ? file : '');

  const [imgError, setImgError] = useState(false);
  const [blobUrl, setBlobUrl] = useState('');
  const [blobLoading, setBlobLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const getAbsoluteUrl = (inputUrl) => {
    if (!inputUrl) return '';
    if (inputUrl.startsWith('blob:') || inputUrl.startsWith('data:')) return inputUrl;

    const cleaned = String(inputUrl).trim();

    // If it contains /storage/ anywhere (e.g. http://localhost:8006/storage/... or http://attachment-service:8000/storage/...)
    const storageIdx = cleaned.indexOf('/storage/');
    if (storageIdx !== -1) {
      return cleaned.substring(storageIdx);
    }

    if (cleaned.startsWith('storage/')) {
      return `/${cleaned}`;
    }

    if (cleaned.startsWith('/storage/')) {
      return cleaned;
    }

    // If it contains /download/ anywhere
    const downloadIdx = cleaned.indexOf('/download/');
    if (downloadIdx !== -1) {
      return cleaned.substring(downloadIdx);
    }

    // If it is a relative path to ticket-attachments/
    const attIdx = cleaned.indexOf('ticket-attachments/');
    if (attIdx !== -1) {
      return `/storage/${cleaned.substring(attIdx)}`;
    }

    if (cleaned.startsWith('/')) {
      return `/storage${cleaned}`;
    }

    return `/storage/${cleaned}`;
  };

  const absoluteUrl = getAbsoluteUrl(rawUrl);
  const previewUrl = blobUrl || absoluteUrl;

  const getExt = (filename) => {
    if (!filename) return '';
    const clean = String(filename).split('?')[0].split('#')[0];
    return clean.split('.').pop().toLowerCase();
  };

  const ext = getExt(fileName) || getExt(rawUrl) || '';
  const isImg = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  const isPdf = ext === 'pdf';
  const isDocx = ['docx', 'doc'].includes(ext);
  const isOtherOffice = ['xlsx', 'xls', 'pptx', 'ppt', 'txt'].includes(ext);

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.'));

  const getGoogleDocsUrl = (fileUrl) => {
    let fullUrl = fileUrl;
    if (fileUrl.startsWith('/')) {
      fullUrl = window.location.origin + fileUrl;
    }
    return `https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}&embedded=true`;
  };

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;

    const loadBlob = async () => {
      if (!absoluteUrl || absoluteUrl.startsWith('blob:') || absoluteUrl.startsWith('data:')) {
        return;
      }

      try {
        setBlobLoading(true);
        setImgError(false);

        const headers = {};
        const token = tokenStore?.getToken ? tokenStore.getToken() : null;
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(absoluteUrl, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();

        let finalBlob = blob;
        if (isPdf && blob.type !== 'application/pdf') {
          finalBlob = new Blob([blob], { type: 'application/pdf' });
        } else if (isImg && !blob.type.startsWith('image/')) {
          finalBlob = new Blob([blob], { type: ext === 'png' ? 'image/png' : 'image/jpeg' });
        }

        objectUrl = URL.createObjectURL(finalBlob);
        if (!cancelled) setBlobUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      } catch (err) {
        console.warn('FilePreviewModal: Direct blob fetch fallback:', err);
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
  }, [absoluteUrl, isPdf, isImg, ext]);

  const handleDownload = async (e) => {
    if (e) e.preventDefault();
    setIsDownloading(true);
    try {
      let downloadEndpoint = absoluteUrl;
      if (absoluteUrl.includes('/storage/')) {
        downloadEndpoint = absoluteUrl.replace('/storage/', '/download/');
      }

      const headers = {};
      const token = tokenStore?.getToken ? tokenStore.getToken() : null;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let blobData = null;
      try {
        const response = await fetch(downloadEndpoint, { headers });
        if (response.ok) {
          blobData = await response.blob();
        } else {
          const fallbackResp = await fetch(absoluteUrl, { headers });
          if (fallbackResp.ok) blobData = await fallbackResp.blob();
        }
      } catch {
        // Fallback to direct window.open if fetch fails
      }

      if (blobData) {
        const downloadBlobUrl = window.URL.createObjectURL(blobData);
        const link = document.createElement('a');
        link.href = downloadBlobUrl;
        link.setAttribute('download', fileName || 'attachment');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadBlobUrl);
      } else {
        window.open(absoluteUrl, '_blank');
      }
    } catch {
      window.open(absoluteUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-[1.5px] p-4 transition-all duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#252578]/10 flex items-center justify-center shrink-0">
              {isImg ? (
                <svg className="w-4 h-4 text-[#252578]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ) : isPdf ? (
                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ) : isDocx ? (
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gray-800 truncate" title={fileName}>
                {fileName}
              </h3>
              <p className="text-[11px] text-gray-400 uppercase font-semibold">
                {isImg ? 'Image File' : isPdf ? 'PDF Document' : isDocx ? 'Word Document' : ext ? `${ext.toUpperCase()} File` : 'Attachment'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 hover:bg-gray-200/60 rounded-full cursor-pointer"
            title="Close Preview"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Preview Container */}
        <div className="flex-1 min-h-[45vh] max-h-[72vh] bg-gray-950 flex items-center justify-center p-4 overflow-auto">
          {blobLoading ? (
            <div className="text-center text-gray-400 py-16">
              <div className="w-9 h-9 border-3 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-medium">Loading preview...</p>
            </div>
          ) : isImg && !imgError ? (
            <img
              src={previewUrl}
              alt={fileName}
              className="max-w-full max-h-[68vh] object-contain rounded-lg shadow-lg mx-auto"
              onError={() => {
                if (blobUrl && previewUrl === blobUrl) {
                  setBlobUrl('');
                } else {
                  setImgError(true);
                }
              }}
            />
          ) : isImg && imgError ? (
            <div className="text-center text-gray-400 py-16">
              <svg className="w-14 h-14 mx-auto mb-3 opacity-60 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-sm font-semibold text-gray-300">Could not render image</p>
              <p className="text-xs text-gray-500 mt-1">Please use the download button below to view the file.</p>
            </div>
          ) : isPdf ? (
            <object
              data={previewUrl}
              type="application/pdf"
              className="w-full h-[68vh] rounded-lg border-0 bg-white shadow-md"
            >
              <iframe
                src={previewUrl}
                title={fileName}
                className="w-full h-[68vh] rounded-lg border-0 bg-white"
              >
                <div className="p-8 text-center text-gray-400">
                  <p className="text-sm">Unable to render PDF preview in this browser.</p>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="mt-3 text-xs text-blue-400 underline font-semibold cursor-pointer"
                  >
                    Click here to download and view PDF
                  </button>
                </div>
              </iframe>
            </object>
          ) : isDocx ? (
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center border border-gray-150">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold uppercase rounded-full tracking-wider mb-2">
                Microsoft Word Document
              </span>
              <h4 className="text-base font-bold text-gray-900 break-words mb-2">{fileName}</h4>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                Word documents can be downloaded and viewed directly in Microsoft Word or any compatible office viewer.
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="w-full py-2.5 px-4 bg-[#252578] hover:bg-[#1a1a5c] text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-[#252578]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {isDownloading ? 'Downloading...' : 'Download & Open Document'}
                </button>
                {!isLocalhost && (
                  <a
                    href={getGoogleDocsUrl(absoluteUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-xl transition-colors inline-block"
                  >
                    Open with Google Docs Viewer ↗
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400 py-16">
              <svg className="w-14 h-14 mx-auto mb-3 opacity-60 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-semibold text-gray-300">No direct preview available</p>
              <p className="text-xs text-gray-500 mt-1">Please download the file below to view its contents.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex items-center justify-between border-t border-gray-100">
          <p className="text-[11px] text-gray-400 truncate max-w-sm" title={fileName}>
            {fileName}
          </p>
          <div className="flex items-center gap-2.5">
            <a
              href={absoluteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
            >
              Open in New Tab
            </a>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="px-5 py-2 bg-[#252578] hover:bg-[#1a1a5c] text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-[#252578]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {isDownloading ? 'Downloading...' : 'Download File'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
