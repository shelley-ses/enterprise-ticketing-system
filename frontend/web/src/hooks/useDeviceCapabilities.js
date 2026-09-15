import { useState, useEffect } from 'react';

export default function useDeviceCapabilities() {
  const [cap, setCap] = useState({
    hasHover: false,
    isCoarse: false,
    isTouch: false,
    isMouse: false,
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
  });

  useEffect(() => {
    const hoverMql = window.matchMedia('(hover: hover) and (pointer: fine)');
    const coarseMql = window.matchMedia('(pointer: coarse)');
    const hoverNoneMql = window.matchMedia('(hover: none)');

    const update = () => {
      const hasHover = hoverMql.matches;
      const isCoarse = coarseMql.matches;
      const isTouch = isCoarse || hoverNoneMql.matches;
      setCap({
        hasHover,
        isCoarse,
        isTouch,
        isMouse: hasHover && !isCoarse,
        width: window.innerWidth,
      });
    };
    update();
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    hoverMql.addEventListener('change', update);
    coarseMql.addEventListener('change', update);
    hoverNoneMql.addEventListener('change', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', onResize);
      hoverMql.removeEventListener('change', update);
      coarseMql.removeEventListener('change', update);
      hoverNoneMql.removeEventListener('change', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return cap;
}
