export function normalizeCasing(value) {
  if (value == null || typeof value !== 'string') return value;
  if (!value.trim()) return value;
  const hasLetter = /[a-zA-Z]/.test(value);
  if (!hasLetter) return value;
  const isAllUpper = value === value.toUpperCase();
  const isAllLower = value === value.toLowerCase();
  if (!isAllUpper && !isAllLower) return value;
  const lower = value.toLowerCase();
  return lower.replace(/(^|[\s\-'])([a-z])/g, (_, sep, char) => sep + char.toUpperCase());
}

export function createCasingBlurHandler(setter, field) {
  return (e) => {
    const raw = e.target.value;
    const normalized = normalizeCasing(raw);
    if (normalized !== raw) {
      if (typeof setter === 'function') {
        if (field) {
          setter((prev) => ({ ...prev, [field]: normalized }));
        } else {
          setter(normalized);
        }
      } else if (e.target) {
        e.target.value = normalized;
      }
    }
  };
}
