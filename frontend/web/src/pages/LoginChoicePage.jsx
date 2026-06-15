import React, { useEffect } from 'react';

export default function LoginChoicePage() {
  useEffect(() => {
    window.location.href = '/';
  }, []);

  return (
    <div className="min-h-screen bg-[#07071a] flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-lg text-slate-300 animate-pulse">Redirecting to employee login...</p>
      </div>
    </div>
  );
}
