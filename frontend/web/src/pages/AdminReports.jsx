import React, { useState, useEffect } from 'react';
import {
  BarChart3, FileText, Download, Printer, ShieldCheck,
  TrendingUp, Users, Smile, Clock, Activity, Cpu, Search, ShieldAlert,
} from 'lucide-react';
import { exportMasterReportToCsv, downloadPdfFromElement, triggerPdfPrint } from '@/utils/reportExportUtils';

export default function AdminReports() {
  const [csatData, setCsatData] = useState(null);
  const [predictiveData, setPredictiveData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchReportData = async () => {
      try {
        const [csatRes, predRes] = await Promise.all([
          fetch('/api/ticketing/analytics/csat', { headers: { 'Accept': 'application/json' } }),
          fetch('/api/ticketing/analytics/predictive-metrics', { headers: { 'Accept': 'application/json' } }),
        ]);

        if (csatRes.ok) {
          const cJson = await csatRes.json();
          if (cJson.status === 'success' && isMounted) setCsatData(cJson.data);
        }
        if (predRes.ok) {
          const pJson = await predRes.json();
          if (pJson.status === 'success' && isMounted) setPredictiveData(pJson.data);
        }
      } catch (err) {
        console.warn('Reports API offline, using standard reporting state.', err);
      }
    };
    fetchReportData();
    return () => { isMounted = false; };
  }, []);

  const masterPayload = {
    csat: csatData || { average_score: 4.67, satisfaction_percentage: 100, total_reviews: 3 },
    sla: { overall_compliance: 92.5, sla_met: 45, sla_breached: 4 },
    predictive: predictiveData || {},
    period: 'Next 7 Days',
  };

  return (
    <div className="space-y-6 animate-fadeSlideIn">
      {/* Header Export Action Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm print:hidden">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Master Operational & Predictive Analytics Report</h1>
          <p className="text-xs text-gray-500 mt-1">Full operational metrics, SLA compliance, employee performance, CSAT scores, and predictive risk models.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadPdfFromElement('master-analytics-report', 'Enterprise_Master_Analytics_Report.pdf')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm"
            title="Download Master PDF Report"
          >
            <FileText className="w-4 h-4 text-white" />
            Export to PDF
          </button>
          <button
            onClick={() => exportMasterReportToCsv(masterPayload)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors"
            title="Download Master CSV Spreadsheet for Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Export to Excel / CSV
          </button>
          <button
            onClick={triggerPdfPrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#252578] hover:bg-[#1e1e60] rounded-xl transition-colors"
            title="Print Printable Document"
          >
            <Printer className="w-4 h-4 text-white" />
            Print Master Report
          </button>
        </div>
      </div>

      {/* Master Report Canvas Container */}
      <div id="master-analytics-report" className="space-y-6 bg-[#f4f7fb] p-4 rounded-2xl">

        {/* Executive KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-[#252578]">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Ticket Volume</p>
              <p className="text-xl font-bold text-gray-800">2,450</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500">SLA Compliance</p>
              <p className="text-xl font-bold text-gray-800">92.5%</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
              <Smile className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500">CSAT Score</p>
              <p className="text-xl font-bold text-gray-800">{csatData?.average_score || 4.67} / 5.0</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Active Staff</p>
              <p className="text-xl font-bold text-gray-800">18</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-rose-50 rounded-lg flex items-center justify-center text-rose-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Escalation Risk</p>
              <p className="text-xl font-bold text-gray-800">Low (7% Crit)</p>
            </div>
          </div>
        </div>

        {/* --- SECTION I: OPERATIONAL ANALYTICS --- */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#252578]" />
              Section I: Operational Analytics & Performance
            </h2>
            <p className="text-xs text-gray-500">Real-time status breakdown, SLA performance, employee metrics, CSAT scores, and workloads.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Ticket Trends */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                1. Ticket Trends & Volume
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                  <span className="text-gray-500">Open Tickets</span>
                  <p className="text-base font-bold text-blue-600 mt-0.5">12</p>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                  <span className="text-gray-500">In Progress</span>
                  <p className="text-base font-bold text-amber-600 mt-0.5">18</p>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                  <span className="text-gray-500">Resolved</span>
                  <p className="text-base font-bold text-emerald-600 mt-0.5">15</p>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                  <span className="text-gray-500">Closed</span>
                  <p className="text-base font-bold text-gray-700 mt-0.5">5</p>
                </div>
              </div>
            </div>

            {/* 2. SLA Compliance */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                2. SLA Compliance & Breaches
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-600 font-medium">Overall Compliance</span>
                  <span className="font-bold text-emerald-700">92.5%</span>
                </div>
                <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-600 font-medium">SLA Met Count</span>
                  <span className="font-bold text-gray-800">45 tickets</span>
                </div>
                <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-600 font-medium">SLA Breached Count</span>
                  <span className="font-bold text-rose-600">4 tickets</span>
                </div>
              </div>
            </div>

            {/* 3. Employee Performance */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                3. Employee Performance Metrics
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-200">
                      <th className="pb-1 font-semibold">Employee</th>
                      <th className="pb-1 font-semibold">Dept</th>
                      <th className="pb-1 font-semibold text-right">Resolved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr><td className="py-1.5 font-medium text-gray-800">Alice Smith</td><td className="text-gray-500">Support</td><td className="text-right font-semibold">28</td></tr>
                    <tr><td className="py-1.5 font-medium text-gray-800">Bob Jones</td><td className="text-gray-500">Infra</td><td className="text-right font-semibold">22</td></tr>
                    <tr><td className="py-1.5 font-medium text-gray-800">Charlie Brown</td><td className="text-gray-500">Service</td><td className="text-right font-semibold">35</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Customer Satisfaction */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Smile className="w-4 h-4 text-amber-500" />
                4. Customer Satisfaction (CSAT)
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-600 font-medium">Average Score</span>
                  <span className="font-bold text-amber-600">{csatData?.average_score || 4.67} / 5.00</span>
                </div>
                <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-600 font-medium">Satisfaction Percentage</span>
                  <span className="font-bold text-emerald-600">{csatData?.satisfaction_percentage || 100}%</span>
                </div>
                <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-600 font-medium">Total Reviews</span>
                  <span className="font-bold text-gray-800">{csatData?.total_reviews || 3} feedback entries</span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Workload Distribution */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              5. Workload Distribution Across Departments
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-gray-200 flex justify-between items-center">
                <span className="font-medium text-gray-700">Support Department</span>
                <span className="font-bold text-indigo-600">75 tickets</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-gray-200 flex justify-between items-center">
                <span className="font-medium text-gray-700">Infrastructure</span>
                <span className="font-bold text-indigo-600">52 tickets</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-gray-200 flex justify-between items-center">
                <span className="font-medium text-gray-700">Service Department</span>
                <span className="font-bold text-indigo-600">35 tickets</span>
              </div>
            </div>
          </div>
        </div>

        {/* --- SECTION II: PREDICTIVE ANALYTICS --- */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-rose-600" />
              Section II: Predictive Analytics & Forecasting Models
            </h2>
            <p className="text-xs text-gray-500">Forecasting risk escalations, root causes, volume trajectories, equipment breakdowns, and recurring issues.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 6. Escalation Risk */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                6. Escalation Risk Forecast
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 flex justify-between">
                  <span>Low Risk</span><strong className="font-bold">16 tickets</strong>
                </div>
                <div className="p-2.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 flex justify-between">
                  <span>Medium Risk</span><strong className="font-bold">10 tickets</strong>
                </div>
                <div className="p-2.5 bg-rose-50 text-rose-800 rounded-lg border border-rose-200 flex justify-between">
                  <span>High Risk</span><strong className="font-bold">5 tickets</strong>
                </div>
                <div className="p-2.5 bg-red-100 text-red-900 rounded-lg border border-red-300 flex justify-between">
                  <span>Critical Risk</span><strong className="font-bold">2 tickets</strong>
                </div>
              </div>
            </div>

            {/* 7. Root Causes */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" />
                7. Root Cause Analytics
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="font-medium text-gray-800">Calibration Required</span>
                  <span className="font-bold text-rose-600">65% (20 incidents) ↑</span>
                </div>
                <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="font-medium text-gray-800">Machine Failure</span>
                  <span className="font-bold text-rose-600">35% (11 incidents) ↑</span>
                </div>
              </div>
            </div>

            {/* 8. Volume Prediction */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                8. Volume Trajectory Prediction
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-600">Next 7 Days Forecast</span>
                  <span className="font-bold text-gray-800">56 total (Peak: Day 6)</span>
                </div>
                <div className="flex justify-between bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-600">Next 30 Days Forecast</span>
                  <span className="font-bold text-gray-800">60 total (Peak: Week 4)</span>
                </div>
                <div className="flex justify-between bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="text-gray-600">Next Quarter Forecast</span>
                  <span className="font-bold text-gray-800">64 total (Peak: Month 3)</span>
                </div>
              </div>
            </div>

            {/* 9. Equipment Risk */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-600" />
                9. Equipment Risk Ratings
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="font-medium text-gray-800">MRI 3T Scanner</span>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded">Critical (35% failure)</span>
                </div>
                <div className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-gray-200">
                  <span className="font-medium text-gray-800">Bedside Monitor</span>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold rounded">Critical (65% failure)</span>
                </div>
              </div>
            </div>
          </div>

          {/* 10. Recurring Issues */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-600" />
              10. Recurring Issue Forecast
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-gray-200 flex justify-between items-center">
                <div>
                  <span className="font-medium text-gray-800">Calibration Required</span>
                  <p className="text-[11px] text-gray-400">Freq: 20 incidents (Growth: +10%)</p>
                </div>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded">High Severity</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-gray-200 flex justify-between items-center">
                <div>
                  <span className="font-medium text-gray-800">Machine Failure</span>
                  <p className="text-[11px] text-gray-400">Freq: 11 incidents (Growth: +10%)</p>
                </div>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded">High Severity</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
