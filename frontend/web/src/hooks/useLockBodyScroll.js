import { useLayoutEffect } from 'react';

let lockCount = 0;
let originalBodyOverflow = '';
let originalBodyPaddingRight = '';
let originalHtmlOverflow = '';
let originalBodyOverscroll = '';

export default function useLockBodyScroll(active = true) {
  useLayoutEffect(() => {
    if (!active) return undefined;
    lockCount += 1;
    if (lockCount === 1) {
      originalBodyOverflow = document.body.style.overflow;
      originalBodyPaddingRight = document.body.style.paddingRight;
      originalHtmlOverflow = document.documentElement.style.overflow;
      originalBodyOverscroll = document.body.style.overscrollBehavior;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'contain';
    }
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = originalBodyOverflow;
        document.body.style.paddingRight = originalBodyPaddingRight;
        document.documentElement.style.overflow = originalHtmlOverflow;
        document.body.style.overscrollBehavior = originalBodyOverscroll;
      }
    };
  }, [active]);
}
