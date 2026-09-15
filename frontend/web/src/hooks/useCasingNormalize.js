import { useCallback } from 'react';
import { normalizeCasing } from '@/utils/normalizeCasing';

export default function useCasingNormalize() {
  const handleBlur = useCallback((e, setter, field) => {
    const raw = e.target.value;
    const normalized = normalizeCasing(raw);
    if (normalized !== raw) {
      if (setter && field) {
        setter((prev) => ({ ...prev, [field]: normalized }));
      } else if (setter && !field) {
        setter(normalized);
      }
      e.target.value = normalized;
    }
  }, []);

  const normalizeField = useCallback((value) => normalizeCasing(value), []);

  return { handleBlur, normalizeField, normalizeCasing };
}
