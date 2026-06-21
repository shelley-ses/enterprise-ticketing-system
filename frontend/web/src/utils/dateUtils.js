export const parseUTCDate = (dateStr) => {
  if (!dateStr) return null;
  const str = String(dateStr);
  if (!str.includes('T') && !str.includes('Z') && str.includes(' ')) {
    return new Date(str.replace(' ', 'T') + 'Z');
  }
  return new Date(str);
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
