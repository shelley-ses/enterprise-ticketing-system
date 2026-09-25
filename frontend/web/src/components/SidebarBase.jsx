import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import sbsiLogo from '@/assets/SBSI.png';
import useLockBodyScroll from '@/hooks/useLockBodyScroll';

function NavList({ items, collapsed, expanded }) {
  const location = useLocation();
  const showLabel = expanded;
  const hasActiveChild = (children) => children?.some((child) => location.pathname === child.path);
  return items.map((item) => {
    if (item.children) {
      const active = hasActiveChild(item.children);
      return (
        <div key={item.name}>
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active ? 'glass-highlight' : 'hover:bg-white/8'} min-h-[44px]`}>
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{item.icon}</span>
            <span className={`font-semibold text-sm whitespace-nowrap transition-opacity duration-200 ${showLabel ? 'opacity-100' : 'opacity-0 hidden sm:block'}`}>{item.name}</span>
          </div>
          <div className={`ml-2 mt-0.5 flex flex-col gap-0.5 transition-opacity duration-200 ${showLabel ? 'opacity-100' : 'opacity-0 hidden sm:flex'}`}>
            {item.children.map((child) => (
              <NavLink key={child.name} to={child.path} className={({ isActive }) => `flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-200 min-h-[44px] ${isActive ? 'glass-highlight' : 'hover:bg-white/10'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60`}>
                <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{child.icon}</span>
                <span className="text-xs whitespace-nowrap">{child.name}</span>
              </NavLink>
            ))}
          </div>
        </div>
      );
    }
    return (
      <NavLink key={item.name} to={item.path} className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${isActive ? 'glass-highlight' : 'hover:bg-white/10'}`}>
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{item.icon}</span>
        <span className={`font-semibold text-sm whitespace-nowrap transition-opacity duration-200 ${showLabel ? 'opacity-100' : 'opacity-0 hidden sm:block'}`}>{item.name}</span>
      </NavLink>
    );
  });
}

export default function SidebarBase({ navItems, bottomItems, collapsed = true, onHoverChange }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchOpen, setIsTouchOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const asideRef = useRef(null);
  const hoverCapable = !isCoarsePointer;

  useEffect(() => {
    const coarseMql = window.matchMedia('(pointer: coarse)');
    const mobileMql = window.matchMedia('(max-width: 639px)');
    const updateCoarse = () => setIsCoarsePointer(coarseMql.matches);
    const updateMobile = () => setIsMobile(mobileMql.matches);
    updateCoarse();
    updateMobile();
    coarseMql.addEventListener('change', updateCoarse);
    mobileMql.addEventListener('change', updateMobile);
    return () => {
      coarseMql.removeEventListener('change', updateCoarse);
      mobileMql.removeEventListener('change', updateMobile);
    };
  }, []);

  useLockBodyScroll(isMobile && isMobileOpen);

  const handleMouseEnter = useCallback(() => {
    if (isMobile || isCoarsePointer) return;
    setIsHovered(true);
    onHoverChange?.(true);
  }, [isMobile, isCoarsePointer, onHoverChange]);

  const handleMouseLeave = useCallback(() => {
    if (isMobile || isCoarsePointer) return;
    setIsHovered(false);
    onHoverChange?.(false);
  }, [isMobile, isCoarsePointer, onHoverChange]);

  const handleRailClick = () => {
    if (isMobile) {
      setIsMobileOpen((v) => !v);
      return;
    }
    if (isCoarsePointer) {
      setIsTouchOpen((v) => !v);
    }
  };

  const closeMobile = useCallback(() => setIsMobileOpen(false), []);
  const closeTouch = useCallback(() => setIsTouchOpen(false), []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setIsMobileOpen(false); setIsTouchOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (isMobileOpen && asideRef.current) {
      const first = asideRef.current.querySelector('a, button');
      first?.focus();
    }
  }, [isMobileOpen]);

  const isExpanded = isMobile ? isMobileOpen : isFocusWithin || (hoverCapable ? isHovered : isTouchOpen);
  const showLabel = isExpanded;

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          aria-label={isMobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMobileOpen}
          onClick={() => setIsMobileOpen((v) => !v)}
          className="fixed top-4 left-4 z-[45] sm:hidden w-11 h-11 flex items-center justify-center rounded-xl bg-[#252578] text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        {isMobileOpen && (
          <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] sm:hidden" onClick={closeMobile} aria-hidden="true" />
        )}
        <aside
          ref={asideRef}
          className={`fixed left-0 top-0 h-screen bg-[#252578] text-white flex flex-col overflow-hidden z-40 sm:hidden transition-transform duration-300 ease-in-out shadow-2xl ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} w-4/5 max-w-xs`}
          role="navigation"
          aria-label="Main navigation"
          onFocusCapture={() => setIsFocusWithin(true)}
          onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsFocusWithin(false); }}
        >
          <Link to="/" className="flex items-center h-20 px-3 gap-3 flex-shrink-0 overflow-hidden" onClick={closeMobile}>
            <div className="w-14 h-15 flex-shrink-0 overflow-hidden rounded-lg">
              <img src={sbsiLogo} alt="SBSI" className="w-full h-full object-cover object-left" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold whitespace-nowrap">SCIENTIFIC BIOTECH</span>
              <span className="text-[9px] text-white/70 whitespace-nowrap">SPECIALTIES, INC.</span>
            </div>
          </Link>
          <div className="mx-3 h-px bg-white/20 flex-shrink-0" />
          <nav className="flex flex-col gap-1 px-2 mt-2 overflow-hidden">
            <NavList items={navItems} collapsed={false} expanded={true} />
            {bottomItems && bottomItems.length > 0 && (
              <>
                <div className="mx-3 my-2 h-px bg-white/20 flex-shrink-0" />
                <NavList items={bottomItems} collapsed={false} expanded={true} />
              </>
            )}
          </nav>
        </aside>
      </>
    );
  }

  return (
    <>
      {(isExpanded) && (
        <div className="fixed inset-0 z-30 bg-black/10 hidden sm:block" onClick={() => { setIsTouchOpen(false); setIsHovered(false); onHoverChange?.(false); }} aria-hidden="true" />
      )}
      <aside
        ref={asideRef}
        className={`hidden sm:flex fixed left-0 top-0 h-screen bg-[#252578] text-white flex-col overflow-hidden overflow-x-hidden z-40 transition-all duration-200 ease-in-out ${isExpanded ? 'w-60 shadow-2xl' : 'w-[80px] shadow-none'}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocusCapture={() => setIsFocusWithin(true)}
        onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsFocusWithin(false); }}
        onClick={isCoarsePointer ? handleRailClick : undefined}
        role="navigation"
        aria-label="Main navigation"
        tabIndex={-1}
      >
        <Link to="/" className="flex items-center h-20 px-3 gap-3 flex-shrink-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-xl mx-1">
          <div className="w-14 h-15 flex-shrink-0 overflow-hidden rounded-lg">
            <img src={sbsiLogo} alt="SBSI" className="w-full h-full object-cover object-left" />
          </div>
          <div className={`flex flex-col leading-tight transition-opacity duration-200 ${showLabel ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <span className="text-xs font-semibold whitespace-nowrap">SCIENTIFIC BIOTECH</span>
            <span className="text-[9px] text-white/70 whitespace-nowrap">SPECIALTIES, INC.</span>
          </div>
        </Link>
        <div className="mx-3 h-px bg-white/20 flex-shrink-0" />
        <nav className="flex flex-col gap-1 px-2 mt-2 overflow-hidden overflow-x-hidden">
          <NavList items={navItems} collapsed={!isExpanded} expanded={isExpanded} />
          {bottomItems && bottomItems.length > 0 && (
            <>
              <div className="mx-3 my-2 h-px bg-white/20 flex-shrink-0" />
              <NavList items={bottomItems} collapsed={!isExpanded} expanded={isExpanded} />
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
