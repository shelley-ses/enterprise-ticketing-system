import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Image as ImageIcon, FileText, File, X, Download, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';
import tokenStore from '@/auth/tokenStore';
import { Button } from '@/components/ui/button';

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
  const [fetchError, setFetchError] = useState(false);
  const [blobUrl, setBlobUrl] = useState('');
  const [blobLoading, setBlobLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const extractCleanSubPath = (inputUrl) => {
    if (!inputUrl) return '';
    let cleaned = String(inputUrl).trim().replace(/^https?:\/\/[^\/]+/, '');
    if (cleaned.includes('/api/ticketing/attachment/storage/')) {
      cleaned = cleaned.substring(cleaned.indexOf('/api/ticketing/attachment/storage/') + '/api/ticketing/attachment/storage/'.length);
    } else if (cleaned.includes('/api/ticketing/attachment/download/')) {
      cleaned = cleaned.substring(cleaned.indexOf('/api/ticketing/attachment/download/') + '/api/ticketing/attachment/download/'.length);
    } else if (cleaned.includes('/storage/')) {
      cleaned = cleaned.substring(cleaned.indexOf('/storage/') + '/storage/'.length);
    } else if (cleaned.includes('/download/')) {
      cleaned = cleaned.substring(cleaned.indexOf('/download/') + '/download/'.length);
    } else if (cleaned.startsWith('storage/')) {
      cleaned = cleaned.substring('storage/'.length);
    } else if (cleaned.startsWith('/')) {
      cleaned = cleaned.substring(1);
    }
    return cleaned.replace(/^\/+/, '');
  };

  const getAbsoluteUrl = (inputUrl) => {
    if (!inputUrl) return '';
    if (inputUrl.startsWith('blob:') || inputUrl.startsWith('data:')) return inputUrl;

    const subPath = extractCleanSubPath(inputUrl);
    if (!subPath) return '';
    return `/api/ticketing/attachment/storage/${subPath}`;
  };

  const getDownloadUrl = (inputUrl) => {
    if (!inputUrl) return '';
    if (inputUrl.startsWith('blob:') || inputUrl.startsWith('data:')) return inputUrl;

    const subPath = extractCleanSubPath(inputUrl);
    if (!subPath) return '';
    return `/api/ticketing/attachment/download/${subPath}`;
  };

  const absoluteUrl = getAbsoluteUrl(rawUrl);
  const downloadUrl = getDownloadUrl(rawUrl);
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
        setFetchError(false);

        const headers = {};
        const token = tokenStore?.getToken ? tokenStore.getToken() : null;
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        let res = await fetch(absoluteUrl, { headers });
        let contentType = res.headers.get('content-type') || '';

        // If gateway route returned HTML (proxy fallback) or 404, try /storage/ subpath fallback
        if ((!res.ok || contentType.includes('text/html')) && !absoluteUrl.startsWith('/storage/')) {
          const subPath = extractCleanSubPath(rawUrl);
          const fallbackDirectUrl = `/storage/${subPath}`;
          try {
            const altRes = await fetch(fallbackDirectUrl, { headers });
            const altType = altRes.headers.get('content-type') || '';
            if (altRes.ok && !altType.includes('text/html')) {
              res = altRes;
              contentType = altType;
            }
          } catch {
            // retain primary response
          }
        }

        if (!res.ok || contentType.includes('text/html')) {
          throw new Error(`HTTP ${res.status} or unexpected content type`);
        }

        const blob = await res.blob();
        let finalBlob = blob;
        if (isPdf && blob.type !== 'application/pdf') {
          finalBlob = new Blob([blob], { type: 'application/pdf' });
        } else if (isImg && !blob.type.startsWith('image/')) {
          finalBlob = new Blob([blob], { type: ext === 'png' ? 'image/png' : 'image/jpeg' });
        }

        objectUrl = URL.createObjectURL(finalBlob);
        if (!cancelled) {
          setBlobUrl(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      } catch (err) {
        console.warn('FilePreviewModal: Direct preview load failed:', err);
        if (!cancelled) {
          setFetchError(true);
        }
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
  }, [absoluteUrl, rawUrl, isPdf, isImg, ext]);

  const handleDownload = async (e) => {
    if (e) e.preventDefault();
    setIsDownloading(true);
    try {
      const headers = {};
      const token = tokenStore?.getToken ? tokenStore.getToken() : null;
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let blobData = null;
      const targets = [downloadUrl, absoluteUrl, `/storage/${extractCleanSubPath(rawUrl)}`];

      for (const endpoint of targets) {
        if (!endpoint) continue;
        try {
          const response = await fetch(endpoint, { headers });
          const cType = response.headers.get('content-type') || '';
          if (response.ok && !cType.includes('text/html')) {
            blobData = await response.blob();
            break;
          }
        } catch {
          // try next target
        }
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
        window.open(downloadUrl || absoluteUrl, '_blank');
      }
    } catch {
      window.open(downloadUrl || absoluteUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 transition-all duration-300 font-sans"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-2xl border border-border w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              {isImg ? (
                <ImageIcon className="w-4 h-4 text-primary" />
              ) : isPdf ? (
                <FileText className="w-4 h-4 text-red-600" />
              ) : isDocx ? (
                <FileText className="w-4 h-4 text-accent" />
              ) : (
                <File className="w-4 h-4 text-muted-slate" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-dark-slate truncate" title={fileName}>
                {fileName}
              </h3>
              <p className="text-[11px] text-muted-slate uppercase font-semibold">
                {isImg ? 'Image File' : isPdf ? 'PDF Document' : isDocx ? 'Word Document' : ext ? `${ext.toUpperCase()} File` : 'Attachment'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-slate hover:text-dark-slate transition-colors p-1.5 hover:bg-slate-200/60 rounded-full cursor-pointer"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Preview Container */}
        <div className="flex-1 min-h-[45vh] max-h-[72vh] bg-slate-950 flex items-center justify-center p-4 overflow-auto">
          {blobLoading ? (
            <div className="text-center text-slate-400 py-16">
              <Loader2 className="w-9 h-9 animate-spin mx-auto mb-3 text-white/80" />
              <p className="text-xs font-medium">Loading preview...</p>
            </div>
          ) : fetchError ? (
            <div className="text-center text-slate-400 py-16 max-w-md mx-auto">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-75 text-amber-400" />
              <p className="text-sm font-semibold text-slate-200">Attachment preview unavailable</p>
              <p className="text-xs text-slate-400 mt-1">
                The file could not be displayed directly. You can try downloading it or opening it in a new window.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <Button
                  size="sm"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="cursor-pointer gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isDownloading ? 'Downloading...' : 'Download File'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="cursor-pointer gap-1.5 bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800"
                >
                  <a href={downloadUrl || absoluteUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in New Tab
                  </a>
                </Button>
              </div>
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
            <div className="text-center text-slate-400 py-16">
              <AlertTriangle className="w-14 h-14 mx-auto mb-3 opacity-60 text-red-400" />
              <p className="text-sm font-semibold text-slate-300">Could not render image</p>
              <p className="text-xs text-slate-500 mt-1">Please use the download button below to view the file.</p>
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
                <div className="p-8 text-center text-slate-400">
                  <p className="text-sm">Unable to render PDF preview in this browser.</p>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="mt-3 text-xs text-accent underline font-semibold cursor-pointer"
                  >
                    Click here to download and view PDF
                  </button>
                </div>
              </iframe>
            </object>
          ) : isDocx ? (
            <div className="bg-card rounded-xl p-8 max-w-md w-full shadow-2xl text-center border border-border">
              <div className="w-16 h-16 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-accent" />
              </div>
              <span className="inline-block px-2.5 py-1 bg-blue-100 text-primary text-[10px] font-bold uppercase rounded-full tracking-wider mb-2">
                Microsoft Word Document
              </span>
              <h4 className="text-base font-bold text-dark-slate break-words mb-2">{fileName}</h4>
              <p className="text-xs text-muted-slate mb-6 leading-relaxed">
                Word documents can be downloaded and viewed directly in Microsoft Word or any compatible office viewer.
              </p>
              <div className="flex flex-col gap-2.5">
                <Button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="w-full cursor-pointer gap-2"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download & Open Document
                    </>
                  )}
                </Button>
                {!isLocalhost && (
                  <a
                    href={getGoogleDocsUrl(absoluteUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-dark-slate text-xs font-medium rounded-xl transition-colors inline-block"
                  >
                    Open with Google Docs Viewer ↗
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400 py-16">
              <File className="w-14 h-14 mx-auto mb-3 opacity-60 text-slate-400" />
              <p className="text-sm font-semibold text-slate-300">No direct preview available</p>
              <p className="text-xs text-slate-500 mt-1">Please download the file below to view its contents.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 flex items-center justify-between border-t border-border">
          <p className="text-[11px] text-muted-slate truncate max-w-sm" title={fileName}>
            {fileName}
          </p>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="cursor-pointer gap-1.5"
            >
              <a
                href={absoluteUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in New Tab
              </a>
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
              className="cursor-pointer gap-1.5"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  Download File
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

