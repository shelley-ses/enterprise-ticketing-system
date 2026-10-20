export const parseUTCDate = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  const str = String(dateStr).trim();
  if (!str) return null;

  // Standard ISO with Z or timezone offset: let Date parse directly
  if (str.includes('T') || str.includes('Z')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  // Direct parse first (handles "10/20/2026, 1:20:00 PM", "Oct 20, 2026 1:20 PM", etc.)
  const direct = new Date(str);
  if (!isNaN(direct.getTime())) {
    return direct;
  }

  // Handle standard SQL datetime "YYYY-MM-DD HH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(str)) {
    const isoStr = str.replace(/\s+/, 'T') + 'Z';
    const d = new Date(isoStr);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
};

export const formatDisplayDate = (dateStr) => {
  const date = parseUTCDate(dateStr);
  if (!date || isNaN(date.getTime())) return '—';
  
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = parseUTCDate(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
