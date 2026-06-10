import React from 'react';

export default function FilePreviewModal({ file, onClose }) {
  if (!file) return null;

  const { name, url } = file;
  
  const getAbsoluteUrl = (rawUrl) => {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('blob:')) {
      return rawUrl;
    }
    // Resolve relative URL to backend ticket-service host
    const backendApiUrl = import.meta.env.VITE_TICKET_API_URL || 'http://localhost:8002/api';
    const backendHost = backendApiUrl.replace(/\/api$/, '').replace(/\/api\/$/, '');
    
    if (rawUrl.startsWith('/')) {
      return `${backendHost}${rawUrl}`;
    }
    return `${backendHost}/${rawUrl}`;
  };

  const absoluteUrl = getAbsoluteUrl(url);

  const isImage = (filename) => {
    if (!filename) return false;
    const ext = filename.split('.').pop().toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  };

  const isPDF = (filename) => {
    if (!filename) return false;
    const ext = filename.split('.').pop().toLowerCase();
    return ext === 'pdf';
  };

  const isImg = isImage(name);
  const isPdf = isPDF(name);

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 transition-all duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-5 h-5 text-[#252578] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-sm font-bold text-gray-800 truncate" title={name}>{name}</h3>
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
          {isImg ? (
            <img 
              src={absoluteUrl} 
              alt={name} 
              className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg"
            />
          ) : isPdf ? (
            <iframe 
              src={absoluteUrl} 
              title={name} 
              className="w-full h-[65vh] rounded-lg border-0 bg-white"
            />
          ) : (
            <div className="text-center text-gray-400 py-12">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-55 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-semibold">No preview available for this file type</p>
              <p className="text-xs mt-1">Please download the file to view its contents.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-white transition-colors"
          >
            Close Preview
          </button>
          <a 
            href={absoluteUrl} 
            download={name}
            target="_blank" 
            rel="noopener noreferrer"
            className="px-6 py-2.5 bg-[#252578] hover:bg-[#1a1a5c] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-[#252578]/20 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download File
          </a>
        </div>
      </div>
    </div>
  );
}
