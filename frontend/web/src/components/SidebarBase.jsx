import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import sbsiLogo from '@/assets/SBSI.png';

function NavList({ items, collapsed, hovered }) {
  const location = useLocation();
  const effective = collapsed && !hovered;

  const hasActiveChild = (children) =>
    children?.some((child) => location.pathname === child.path);

  return items.map((item) => {
    if (item.children) {
      const active = hasActiveChild(item.children);
      return (
        <div key={item.name}>
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-default ${
              active ? 'glass-highlight' : 'hover:bg-white/8'
            }`}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span className={`font-semibold text-sm whitespace-nowrap transition-opacity duration-300 ${effective ? 'opacity-0' : 'opacity-100'}`}>
              {item.name}
            </span>
          </div>
          <div className={`ml-2 mt-0.5 flex flex-col gap-0.5 transition-opacity duration-300 ${effective ? 'opacity-0' : 'opacity-100'}`}>
            {item.children.map((child) => (
              <NavLink
                key={child.name}
                to={child.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 rounded-xl transition-all duration-200 ${
                    isActive ? 'glass-highlight' : 'hover:bg-white/10'
                  }`
                }
              >
                <span className="flex-shrink-0">{child.icon}</span>
                <span className="text-xs whitespace-nowrap">{child.name}</span>
              </NavLink>
            ))}
          </div>
        </div>
      );
    }

    return (
      <NavLink
        key={item.name}
        to={item.path}
        className={({ isActive }) =>
          `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
            isActive ? 'glass-highlight' : 'hover:bg-white/10'
          }`
        }
      >
        <span className="flex-shrink-0">{item.icon}</span>
        <span className={`font-semibold text-sm whitespace-nowrap transition-opacity duration-300 ${effective ? 'opacity-0' : 'opacity-100'}`}>
          {item.name}
        </span>
      </NavLink>
    );
  });
}

export default function SidebarBase({ navItems, bottomItems, collapsed, onHoverChange }) {
  const [isHovered, setIsHovered] = useState(false);
  const effective = collapsed && !isHovered;

  const handleMouseEnter = () => {
    setIsHovered(true);
    onHoverChange?.(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    onHoverChange?.(false);
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-[#252578] text-white transition-all duration-300 ease-in-out flex flex-col overflow-hidden ${
        effective ? 'w-[80px] z-[70]' : 'w-60 z-[80]'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center h-20 px-3 gap-3 flex-shrink-0 overflow-hidden">
        <div className="w-14 h-15 flex-shrink-0 overflow-hidden rounded-lg">
          <img src={sbsiLogo} alt="SBSI" className="w-full h-full object-cover object-left" />
        </div>
        <div className={`flex flex-col leading-tight transition-opacity duration-300 ${effective ? 'opacity-0' : 'opacity-100'}`}>
          <span className="text-xs font-semibold whitespace-nowrap">SCIENTIFIC BIOTECH</span>
          <span className="text-[9px] text-white/70 whitespace-nowrap">SPECIALTIES, INC.</span>
        </div>
      </div>

      <div className="mx-3 h-px bg-white/20 flex-shrink-0" />

      <nav className="flex flex-col gap-1 px-2 mt-2">
        <NavList items={navItems} collapsed={collapsed} hovered={isHovered} />
      </nav>

      {bottomItems && bottomItems.length > 0 && (
        <>
          <div className="mx-3 my-2 h-px bg-white/20 flex-shrink-0" />
          <nav className="flex flex-col gap-1 px-2">
            <NavList items={bottomItems} collapsed={collapsed} hovered={isHovered} />
          </nav>
        </>
      )}
    </aside>
  );
}
