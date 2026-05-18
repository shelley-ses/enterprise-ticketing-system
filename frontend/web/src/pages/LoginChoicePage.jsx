import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginChoicePage() {
  const navigate = useNavigate();

  const choices = [
    {
      title: 'Customer',
      description: '',
      action: () => navigate('/login/customer'),
      accent: 'from-blue-50 to-white',
      border: 'border-blue-200',
      button: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      title: 'Employee',
      description: '',
      action: () => navigate('/login/employee'),
      accent: 'from-blue-50 to-white',
      border: 'border-blue-200',
      button: 'bg-blue-600 hover:bg-blue-700',
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f5f7ff_0%,#eef3ff_45%,#f8fafc_100%)] flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-10">
          <h1 className="mt-3 text-4xl md:text-5xl font-bold text-[#252578]">Welcome</h1>
          <h2 className="mt-2 text-lg text-gray-600">Ticket Management System</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {choices.map((choice) => (
            <button
              key={choice.title}
              type="button"
              onClick={choice.action}
              className={`text-left rounded-3xl border ${choice.border} bg-linear-to-br ${choice.accent} p-8 shadow-[0_16px_50px_rgba(37,37,120,0.08)] transition-transform hover:-translate-y-1`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="mt-2 text-3xl font-bold text-gray-900">{choice.title}</h2>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-white/80 border border-white shadow-sm flex items-center justify-center text-[#252578]">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>

              {/* no description per design */}

              <div className={`mt-8 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white ${choice.button}`}>
                Continue
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
