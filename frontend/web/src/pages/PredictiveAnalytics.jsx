import React, { useState, useEffect, useMemo } from 'react';
import { exportPredictiveToCsv, downloadPdfFromElement, triggerPdfPrint } from '@/utils/reportExportUtils';
import { FileText, Download, Printer } from 'lucide-react';
import {
  Chart as ChartJS,
  ArcElement, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  TrendingUp, Cpu, ShieldAlert, Search,
  ChevronDown, ShieldCheck, Activity,
} from 'lucide-react';

const barLabelsPlugin = {
  id: 'barLabels',
  afterDraw(chart) {
    const { ctx, data } = chart;
    if (!data || !data.datasets || chart.options?.indexAxis !== 'y') return;
    ctx.save();
    ctx.font = '600 10px Poppins, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      meta.data.forEach((bar, j) => {
        const val = dataset.data[j];
        if (val === undefined || val === null) return;
        const x = bar.x + 6;
        const y = bar.y;
        ctx.fillStyle = '#475569';
        ctx.fillText(String(val), x, y);
      });
    });
    ctx.restore();
  },
};

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler, barLabelsPlugin);

const PERIODS = ['Today', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Next 7 Days', 'Next 30 Days', 'Next Quarter'];

const DAYS = {
  'Today': ['8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM'],
  'Last 7 Days': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  'Last 30 Days': ['Wk1', 'Wk2', 'Wk3', 'Wk4'],
  'Last 90 Days': ['Month 1', 'Month 2', 'Month 3'],
  'Next 7 Days': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  'Next 30 Days': ['Wk1', 'Wk2', 'Wk3', 'Wk4'],
  'Next Quarter': ['M1', 'M2', 'M3'],
};

const DEFAULT_CATEGORIES = ['Network', 'Hardware', 'Software', 'Printer', 'Security', 'Database'];
const DEFAULT_EQUIPMENT = ['Printer HP LaserJet', 'Server Rack Dell', 'Workstation Lenovo', 'Network Switch Cisco', 'UPS APC', 'Scanner Fujitsu'];

const COLORS = {
  blue: { bg: 'rgba(37,37,120,0.12)', border: 'rgb(37,37,120)' },
  sky: { bg: 'rgba(14,165,233,0.15)', border: 'rgb(14,165,233)' },
};

// ─── Default Fallback Datasets ──────────────────────────────────────────
const defaultTicketVol = {
  'Today': { hist: [3, 5, 8, 12, 9, 6, 4, 2], pred: [1, 3, 6, 10, 11, 8, 5, 3], upper: [4, 6, 9, 13, 10, 7, 5, 3], lower: [2, 4, 7, 11, 8, 5, 3, 1] },
  'Last 7 Days': { hist: [12, 19, 15, 22, 18, 8, 5], pred: [10, 14, 13, 20, 16, 7, 4], upper: [15, 22, 18, 25, 21, 10, 7], lower: [9, 16, 12, 19, 15, 6, 3] },
  'Last 30 Days': { hist: [45, 62, 58, 71], pred: [38, 55, 52, 68], upper: [50, 68, 63, 76], lower: [40, 56, 53, 66] },
  'Last 90 Days': { hist: [180, 210, 195], pred: [165, 198, 188], upper: [190, 220, 205], lower: [170, 200, 185] },
  'Next 7 Days': { hist: [12, 15, 10, 18, 14, 20, 16], pred: [14, 17, 12, 21, 16, 23, 19], upper: [17, 21, 15, 25, 20, 27, 23], lower: [11, 13, 9, 17, 12, 19, 15] },
  'Next 30 Days': { hist: [45, 52, 48, 60], pred: [50, 58, 53, 66], upper: [58, 67, 62, 75], lower: [42, 49, 44, 57] },
  'Next Quarter': { hist: [180, 195, 210], pred: [198, 215, 232], upper: [218, 237, 255], lower: [178, 193, 209] },
};
const defaultPeakDay = { 'Today': '12PM', 'Last 7 Days': 'Thursday', 'Last 30 Days': 'Week 4', 'Last 90 Days': 'Month 2', 'Next 7 Days': 'Day 6', 'Next 30 Days': 'Week 4', 'Next Quarter': 'Month 3' };
const defaultPredTotal = { 'Today': 47, 'Last 7 Days': 99, 'Last 30 Days': 236, 'Last 90 Days': 585, 'Next 7 Days': 142, 'Next 30 Days': 227, 'Next Quarter': 645 };

const defaultEquipFail = {
  'Today': [8, 4, 6, 2, 1, 4],
  'Last 7 Days': [15, 8, 12, 5, 3, 9],
  'Last 30 Days': [22, 12, 16, 8, 5, 13],
  'Last 90 Days': [28, 16, 20, 11, 7, 17],
  'Next 7 Days': [18, 8, 12, 5, 3, 9],
  'Next 30 Days': [22, 12, 16, 8, 5, 13],
  'Next Quarter': [28, 16, 20, 11, 7, 17],
};

const defaultRecFreq = {
  'Today': [5, 4, 3, 2, 1, 1],
  'Last 7 Days': [22, 18, 15, 12, 8, 6],
  'Last 30 Days': [85, 72, 60, 48, 32, 24],
  'Last 90 Days': [260, 218, 185, 148, 98, 72],
  'Next 7 Days': [22, 18, 15, 12, 8, 6],
  'Next 30 Days': [85, 72, 60, 48, 32, 24],
  'Next Quarter': [260, 218, 185, 148, 98, 72],
};

const defaultEscRisk = {
  'Today': { low: 10, medium: 5, high: 3, critical: 1 },
  'Last 7 Days': { low: 45, medium: 28, high: 15, critical: 7 },
  'Last 30 Days': { low: 65, medium: 38, high: 22, critical: 12 },
  'Last 90 Days': { low: 82, medium: 52, high: 30, critical: 18 },
  'Next 7 Days': { low: 45, medium: 28, high: 15, critical: 7 },
  'Next 30 Days': { low: 65, medium: 38, high: 22, critical: 12 },
  'Next Quarter': { low: 82, medium: 52, high: 30, critical: 18 },
};
const defaultEscTotal = { 'Today': 5, 'Last 7 Days': 22, 'Last 30 Days': 34, 'Last 90 Days': 48, 'Next 7 Days': 22, 'Next 30 Days': 34, 'Next Quarter': 48 };
const defaultEscAvg = { 'Today': '2.1 hrs', 'Last 7 Days': '4.2 hrs', 'Last 30 Days': '5.8 hrs', 'Last 90 Days': '6.1 hrs', 'Next 7 Days': '4.2 hrs', 'Next 30 Days': '5.8 hrs', 'Next Quarter': '6.1 hrs' };

const defaultRootCause = {
  'Today': [
    { name: 'Network Config', pct: 25, count: 5, trend: 'up' },
    { name: 'Hardware Failure', pct: 20, count: 4, trend: 'up' },
    { name: 'Software Bug', pct: 15, count: 3, trend: 'down' },
    { name: 'User Error', pct: 15, count: 3, trend: 'down' },
    { name: 'Printer Issues', pct: 10, count: 2, trend: 'up' },
  ],
  'Last 7 Days': [
    { name: 'Network Config', pct: 24, count: 38, trend: 'up' },
    { name: 'Hardware Failure', pct: 18, count: 29, trend: 'up' },
    { name: 'Software Bug', pct: 16, count: 25, trend: 'down' },
    { name: 'User Error', pct: 14, count: 22, trend: 'down' },
    { name: 'Printer Issues', pct: 12, count: 19, trend: 'up' },
  ],
  'Last 30 Days': [
    { name: 'Network Config', pct: 26, count: 155, trend: 'up' },
    { name: 'Hardware Failure', pct: 20, count: 120, trend: 'up' },
    { name: 'Software Bug', pct: 17, count: 102, trend: 'down' },
    { name: 'User Error', pct: 13, count: 78, trend: 'down' },
    { name: 'Printer Issues', pct: 11, count: 66, trend: 'up' },
  ],
  'Last 90 Days': [
    { name: 'Network Config', pct: 27, count: 470, trend: 'up' },
    { name: 'Hardware Failure', pct: 21, count: 365, trend: 'up' },
    { name: 'Software Bug', pct: 16, count: 278, trend: 'down' },
    { name: 'User Error', pct: 12, count: 208, trend: 'down' },
    { name: 'Printer Issues', pct: 11, count: 191, trend: 'up' },
  ],
  'Next 7 Days': [
    { name: 'Network Config', pct: 24, count: 38, trend: 'up' },
    { name: 'Hardware Failure', pct: 18, count: 29, trend: 'up' },
    { name: 'Software Bug', pct: 16, count: 25, trend: 'down' },
    { name: 'User Error', pct: 14, count: 22, trend: 'down' },
    { name: 'Printer Issues', pct: 12, count: 19, trend: 'up' },
  ],
  'Next 30 Days': [
    { name: 'Network Config', pct: 26, count: 155, trend: 'up' },
    { name: 'Hardware Failure', pct: 20, count: 120, trend: 'up' },
    { name: 'Software Bug', pct: 17, count: 102, trend: 'down' },
    { name: 'User Error', pct: 13, count: 78, trend: 'down' },
    { name: 'Printer Issues', pct: 11, count: 66, trend: 'up' },
  ],
  'Next Quarter': [
    { name: 'Network Config', pct: 27, count: 470, trend: 'up' },
    { name: 'Hardware Failure', pct: 21, count: 365, trend: 'up' },
    { name: 'Software Bug', pct: 16, count: 278, trend: 'down' },
    { name: 'User Error', pct: 12, count: 208, trend: 'down' },
    { name: 'Printer Issues', pct: 11, count: 191, trend: 'up' },
  ],
};

// ─── Chart Options Helpers ─────────────────────────────────────────────
const barBase = () => ({
  responsive: true, maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: 'rgba(30,30,60,0.92)', titleFont: { family: 'Poppins', size: 12 }, bodyFont: { family: 'Poppins', size: 11 }, padding: 10, cornerRadius: 8 },
  },
  scales: {
    x: { grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { font: { family: 'Poppins', size: 10 }, color: '#94a3b8' } },
    y: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 10 }, color: '#475569' } },
  },
});

const lineBase = () => ({
  responsive: true, maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { family: 'Poppins', size: 11 } } },
    tooltip: { backgroundColor: 'rgba(30,30,60,0.92)', titleFont: { family: 'Poppins', size: 12 }, bodyFont: { family: 'Poppins', size: 11 }, padding: 10, cornerRadius: 8 },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 10 }, color: '#94a3b8' } },
    y: { grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { font: { family: 'Poppins', size: 10 }, color: '#94a3b8' } },
  },
});

function FilterDropdown({ value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 pr-7 text-[11px] font-medium text-gray-600 cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────
export default function PredictiveAnalytics({ selectedPreset = 'Last 7 Days', analyticsData = null }) {
  const activePeriod = selectedPreset !== 'Custom Range' ? selectedPreset : 'Last 7 Days';

  // Backend state fallback
  const [apiData, setApiData] = useState(null);

  const effectiveApiData = analyticsData?.predictive || apiData;

  // Derived datasets with fallback
  const ticketVol = effectiveApiData?.ticket_volume || defaultTicketVol;
  const peakDay = effectiveApiData?.peak_day || defaultPeakDay;
  const predTotal = effectiveApiData?.pred_total || defaultPredTotal;
  const equipData = effectiveApiData?.equipment;
  const equipFail = equipData?.equipFail || defaultEquipFail;
  const equipment = equipData?.equipment || DEFAULT_EQUIPMENT;
  const escData = effectiveApiData?.escalation;
  const escRisk = escData?.escRisk || defaultEscRisk;
  const escTotal = escData?.escTotal || defaultEscTotal;
  const escAvg = escData?.escAvg || defaultEscAvg;
  const rootCause = effectiveApiData?.root_causes || defaultRootCause;
  const recData = effectiveApiData?.recurring;
  const recFreq = recData?.recFreq || defaultRecFreq;
  const categories = recData?.categories || DEFAULT_CATEGORIES;

  const summary = useMemo(() => {
    const e = escRisk[activePeriod] || escRisk['Last 7 Days'] || defaultEscRisk['Last 7 Days'];
    const total = (e.low || 0) + (e.medium || 0) + (e.high || 0) + (e.critical || 0) || 1;
    const topCat = categories[0] || 'Network';
    return {
      peak: peakDay[activePeriod] || peakDay['Last 7 Days'] || 'Thursday',
      predTotal: predTotal[activePeriod] || predTotal['Last 7 Days'] || 99,
      escTotal: escTotal[activePeriod] || escTotal['Last 7 Days'] || 16,
      critPct: Math.round(((e.critical || 0) / total) * 100),
      topCat,
    };
  }, [activePeriod, escRisk, peakDay, predTotal, escTotal, categories]);

  // ─── 1. Escalation Risk Chart ──────────────────────────────────────
  const escChart = useMemo(() => {
    const e = escRisk[activePeriod] || escRisk['Last 7 Days'] || defaultEscRisk['Last 7 Days'];
    const total = (e.low || 0) + (e.medium || 0) + (e.high || 0) + (e.critical || 0) || 1;
    const pct = (v) => Math.round(((v || 0) / total) * 100);
    return (
      <div className="flex gap-4 items-center">
        <div className="h-[130px] w-[130px] shrink-0">
          <Doughnut
            options={{
              responsive: true, maintainAspectRatio: false, cutout: '60%',
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: 'rgba(30,30,60,0.92)',
                  callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}%` },
                },
              },
            }}
            data={{
              labels: ['Low', 'Medium', 'High', 'Critical'],
              datasets: [{
                data: [pct(e.low), pct(e.medium), pct(e.high), pct(e.critical)],
                backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)', 'rgba(244,63,94,0.8)', 'rgba(220,38,38,0.8)'],
                borderWidth: 2, borderColor: '#fff',
              }],
            }}
          />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          {[
            { label: 'Low', v: e.low || 0, p: pct(e.low), color: 'bg-emerald-500' },
            { label: 'Medium', v: e.medium || 0, p: pct(e.medium), color: 'bg-amber-500' },
            { label: 'High', v: e.high || 0, p: pct(e.high), color: 'bg-rose-500' },
            { label: 'Critical', v: e.critical || 0, p: pct(e.critical), color: 'bg-red-600' },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${r.color}`} />
              <span className="text-[11px] text-gray-600 w-14">{r.label}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.p}%` }} />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 w-8 text-right">{r.p}%</span>
            </div>
          ))}
          <div className="flex gap-3 pt-1 text-[11px]">
            <span className="text-gray-500">Escalations: <strong className="text-gray-800">{escTotal[activePeriod] || escTotal['Last 7 Days'] || 16}</strong></span>
            <span className="text-gray-500">Avg: <strong className="text-gray-800">{escAvg[activePeriod] || escAvg['Last 7 Days'] || '2.4 hrs'}</strong></span>
          </div>
        </div>
      </div>
    );
  }, [activePeriod, escRisk, escTotal, escAvg]);

  // ─── 2. Root Causes Chart ──────────────────────────────────────────
  const rootChart = useMemo(() => {
    const items = rootCause[activePeriod] || rootCause['Last 7 Days'] || defaultRootCause['Last 7 Days'];
    return (
      <div>
        <div className="space-y-1.5">
          {items.map((c) => (
            <div key={c.name} className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <span className="text-gray-700 font-medium truncate">{c.name}</span>
                  <span className="text-gray-500 font-semibold">{c.pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${c.trend === 'up' ? 'bg-rose-400' : c.trend === 'down' ? 'bg-emerald-400' : 'bg-blue-400'
                      }`}
                    style={{ width: `${c.pct}%` }}
                  />
                </div>
              </div>
              {c.trend === 'up' ? <TrendingUp className="w-3 h-3 text-rose-500" /> : c.trend === 'down' ? <TrendingUp className="w-3 h-3 text-emerald-500 rotate-180" /> : <Activity className="w-3 h-3 text-gray-400" />}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Network Config is the top cause, trending upward 12%.</p>
      </div>
    );
  }, [activePeriod, rootCause]);

  // ─── 3. Volume Prediction Chart ────────────────────────────────────
  const volChart = useMemo(() => {
    const labels = DAYS[activePeriod] || DAYS['Last 7 Days'];
    const d = ticketVol[activePeriod] || ticketVol['Last 7 Days'] || defaultTicketVol['Last 7 Days'];
    const histSeries = d.historical || d.hist || [12, 19, 15, 22, 18, 8, 5];
    const predSeries = d.predicted || d.pred || [10, 14, 13, 20, 16, 7, 4];
    const upperSeries = d.upper_bound || d.upper || [15, 22, 18, 25, 21, 10, 7];
    const lowerSeries = d.lower_bound || d.lower || [9, 16, 12, 19, 15, 6, 3];
    const peak = peakDay[activePeriod] || peakDay['Last 7 Days'] || 'Thursday';
    const total = predTotal[activePeriod] || predTotal['Last 7 Days'] || 99;

    return (
      <div className="min-h-[180px]">
        <div className="flex items-center gap-4 mb-2 text-xs">
          <span className="text-gray-500">Predicted: <strong className="text-gray-800">{total}</strong></span>
          <span className="px-2 py-0.5 bg-amber-50 rounded text-amber-700 font-semibold">Peak: {peak}</span>
        </div>
        <div className="h-[150px]">
          <Line
            options={lineBase()}
            data={{
              labels,
              datasets: [
                { label: 'Upper', data: upperSeries, borderColor: 'transparent', backgroundColor: 'rgba(37,37,120,0.06)', pointRadius: 0, fill: '+1' },
                { label: 'Historical', data: histSeries, borderColor: COLORS.sky.border, backgroundColor: COLORS.sky.bg, borderDash: [5, 3], fill: false, tension: 0.4, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#fff', pointBorderWidth: 2 },
                { label: 'Predicted', data: predSeries, borderColor: COLORS.blue.border, backgroundColor: COLORS.blue.bg, fill: false, tension: 0.4, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#fff', pointBorderWidth: 2 },
                { label: 'Lower', data: lowerSeries, borderColor: 'transparent', backgroundColor: 'transparent', pointRadius: 0, fill: false },
              ],
            }}
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-1">Volume forecast to remain elevated; peak expected on {peak}.</p>
      </div>
    );
  }, [activePeriod, ticketVol, predTotal, peakDay]);

  // ─── 4. Equipment Risk Chart ───────────────────────────────────────
  const equipChart = useMemo(() => {
    const labels = [equipment[0], equipment[1], equipment[2]];
    const vals = equipFail[activePeriod] || equipFail['Last 7 Days'] || defaultEquipFail['Last 7 Days'];
    const colors = ['rgba(244,63,94,0.75)', 'rgba(99,102,241,0.75)', 'rgba(245,158,11,0.75)'];
    return (
      <div>
        <div className="h-[140px]">
          <Bar
            options={barBase()}
            data={{
              labels,
              datasets: [{ data: [vals[0], vals[1], vals[2]], backgroundColor: colors, borderRadius: 6, barThickness: 16 }],
            }}
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-1">{equipment[0]} has the highest predicted failure rate at {vals[0]}%.</p>
      </div>
    );
  }, [activePeriod, equipFail, equipment]);

  // ─── 5. Recurring Issues Chart ──────────────────────────────────────
  const recChart = useMemo(() => {
    const labels = categories.slice(0, 4);
    const vals = (recFreq[activePeriod] || recFreq['Last 7 Days'] || defaultRecFreq['Last 7 Days']).slice(0, 4);
    return (
      <div>
        <div className="h-[150px]">
          <Bar
            options={barBase()}
            data={{
              labels,
              datasets: [{
                data: vals,
                backgroundColor: ['rgba(37,37,120,0.75)', 'rgba(245,158,11,0.75)', 'rgba(244,63,94,0.75)', 'rgba(16,185,129,0.75)'],
                borderRadius: 6, barThickness: 18,
              }],
            }}
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-1">Network issues recur most frequently; up 12% from last period.</p>
      </div>
    );
  }, [activePeriod, recFreq, categories]);

  // ─── KPI Strip Data ────────────────────────────────────────────────
  const kpis = useMemo(() => [
    { label: 'Predicted Tickets', value: summary.predTotal, icon: TrendingUp },
    { label: 'Expected Escalations', value: summary.escTotal, icon: ShieldAlert },
    { label: 'Critical Risk', value: `${summary.critPct}%`, icon: ShieldCheck },
    { label: 'Top Issue', value: summary.topCat, icon: Search },
    { label: 'SLA Trend', value: '92%', icon: Activity },
  ], [summary]);

  return (
    <div id="predictive-analytics-report" className="space-y-4 animate-fadeSlideIn">

      {/* Sticky KPI Strip */}
      <div className="sticky top-0 z-20 py-2 bg-[#f4f7fb] -mx-4 lg:-mx-12 px-4 lg:px-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4 hover:shadow-lg transition-all">
                <div className="w-14 h-14 bg-[#f1f5f9] rounded-lg flex items-center justify-center shrink-0 text-[#252578]">
                  <Icon className="w-7 h-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-500 truncate">{k.label}</p>
                  <p className="text-2xl font-semibold text-gray-800">{k.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid for 5 Predictive Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 1. Ticket Escalation Risk */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#252578]" />
              <h3 className="text-sm font-bold text-gray-800">Escalation Risk</h3>
            </div>
          </div>
          {escChart}
        </div>

        {/* 2. Root Cause Analytics */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#252578]" />
              <h3 className="text-sm font-bold text-gray-800">Root Causes</h3>
            </div>
          </div>
          {rootChart}
        </div>

        {/* 3. Ticket Volume Prediction */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#252578]" />
              <h3 className="text-sm font-bold text-gray-800">Volume Prediction</h3>
            </div>
          </div>
          {volChart}
        </div>

        {/* 4. Equipment Risk */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#252578]" />
              <h3 className="text-sm font-bold text-gray-800">Equipment Risk</h3>
            </div>
          </div>
          {equipChart}
        </div>

        {/* 5. Recurring Issue Prediction (Full Width) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#252578]" />
              <h3 className="text-sm font-bold text-gray-800">Recurring Issues</h3>
            </div>
          </div>
          {recChart}
        </div>

      </div>
    </div>
  );
}