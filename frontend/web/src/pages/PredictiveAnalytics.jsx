import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  TrendingUp, Users, Cpu, ShieldAlert, Search, Brain,
  ChevronDown, Download, ShieldCheck, Activity,
} from 'lucide-react';

const barLabelsPlugin = {
  id: 'barLabels',
  afterDraw(chart) {
    const { ctx, data, scales } = chart;
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

const PERIODS = ['Next 7 Days', 'Next 30 Days', 'Next Quarter'];

const DAYS = {
  'Next 7 Days': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  'Next 30 Days': ['Wk1', 'Wk2', 'Wk3', 'Wk4'],
  'Next Quarter': ['M1', 'M2', 'M3'],
};

const EQUIPMENT = ['Printer HP LaserJet', 'Server Rack Dell', 'Workstation Lenovo', 'Network Switch Cisco', 'UPS APC', 'Scanner Fujitsu'];
const EMPLOYEES = ['Mark Reyes', 'Ava Santos', 'Jose Cruz', 'Anna Lim', 'Carlo Tan', 'Maria Dela Cruz'];
const CATEGORIES = ['Network', 'Hardware', 'Software', 'Printer', 'Security', 'Database'];

const COLORS = {
  blue: { bg: 'rgba(37,37,120,0.12)', border: 'rgb(37,37,120)' },
  emerald: { bg: 'rgba(16,185,129,0.15)', border: 'rgb(16,185,129)' },
  rose: { bg: 'rgba(244,63,94,0.15)', border: 'rgb(244,63,94)' },
  amber: { bg: 'rgba(245,158,11,0.15)', border: 'rgb(245,158,11)' },
  sky: { bg: 'rgba(14,165,233,0.15)', border: 'rgb(14,165,233)' },
};

// ─── Mock Data ──────────────────────────────────────────────────────────
const ticketVol = {
  'Next 7 Days': { hist: [12, 15, 10, 18, 14, 20, 16], pred: [14, 17, 12, 21, 16, 23, 19], upper: [17, 21, 15, 25, 20, 27, 23], lower: [11, 13, 9, 17, 12, 19, 15] },
  'Next 30 Days': { hist: [45, 52, 48, 60], pred: [50, 58, 53, 66], upper: [58, 67, 62, 75], lower: [42, 49, 44, 57] },
  'Next Quarter': { hist: [180, 195, 210], pred: [198, 215, 232], upper: [218, 237, 255], lower: [178, 193, 209] },
};
const peakDay = { 'Next 7 Days': 'Day 6', 'Next 30 Days': 'Week 4', 'Next Quarter': 'Month 3' };
const predTotal = { 'Next 7 Days': 142, 'Next 30 Days': 227, 'Next Quarter': 645 };

const perfTickets = { 'Next 7 Days': [28, 35, 22, 18, 31, 14], 'Next 30 Days': [112, 140, 95, 78, 125, 62], 'Next Quarter': [340, 420, 290, 235, 380, 190] };
const perfSla = { 'Next 7 Days': [94, 90, 96, 88, 92, 85], 'Next 30 Days': [92, 88, 94, 85, 90, 82], 'Next Quarter': [91, 87, 93, 84, 89, 81] };
const perfResp = { 'Next 7 Days': [12, 10, 18, 8, 14, 22], 'Next 30 Days': [13, 11, 19, 9, 15, 23], 'Next Quarter': [12, 10, 18, 8, 14, 22] };
const perfTrend = ['up', 'up', 'down', 'up', 'down', 'up'];

const equipFail = { 'Next 7 Days': [18, 8, 12, 5, 3, 9], 'Next 30 Days': [22, 12, 16, 8, 5, 13], 'Next Quarter': [28, 16, 20, 11, 7, 17] };
const equipTickets = { 'Next 7 Days': [12, 6, 9, 4, 2, 7], 'Next 30 Days': [18, 10, 14, 7, 4, 11], 'Next Quarter': [25, 14, 18, 10, 6, 15] };
const riskLevel = ['Critical', 'Moderate', 'High', 'Low', 'Low', 'Moderate'];

const recFreq = { 'Next 7 Days': [22, 18, 15, 12, 8, 6], 'Next 30 Days': [85, 72, 60, 48, 32, 24], 'Next Quarter': [260, 218, 185, 148, 98, 72] };
const recGrowth = [12, 8, -3, 15, 5, -2];
const recSev = ['High', 'Medium', 'High', 'Low', 'Critical', 'Medium'];

const escRisk = {
  'Next 7 Days': { low: 45, medium: 28, high: 15, critical: 7 },
  'Next 30 Days': { low: 65, medium: 38, high: 22, critical: 12 },
  'Next Quarter': { low: 82, medium: 52, high: 30, critical: 18 },
};
const escTotal = { 'Next 7 Days': 22, 'Next 30 Days': 34, 'Next Quarter': 48 };
const escAvg = { 'Next 7 Days': '4.2 hrs', 'Next 30 Days': '5.8 hrs', 'Next Quarter': '6.1 hrs' };

const rootCause = {
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

const insights = [
  'Ticket volume is projected to increase by 18% next week.',
  'Network-related issues are expected to remain the most common ticket category.',
  'Three employees are projected to exceed their average workload.',
  'SLA breach risk is highest for Hardware Support tickets.',
  'Printer equipment is predicted to generate the most incidents.',
];

// ─── Helpers ────────────────────────────────────────────────────────────
const barBase = (labels) => ({
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
  const PERIODS = ['Next 7 Days', 'Next 30 Days', 'Next Quarter'];
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
export default function PredictiveAnalytics() {
  const [volPeriod, setVolPeriod] = useState('Next 7 Days');
  const [perfPeriod, setPerfPeriod] = useState('Next 7 Days');
  const [equipPeriod, setEquipPeriod] = useState('Next 7 Days');
  const [recPeriod, setRecPeriod] = useState('Next 7 Days');
  const [escPeriod, setEscPeriod] = useState('Next 7 Days');
  const [rootPeriod, setRootPeriod] = useState('Next 7 Days');
  const [showAllEmp, setShowAllEmp] = useState(false);

  const data = useMemo(() => {
    const d = ticketVol['Next 7 Days'];
    const e = escRisk['Next 7 Days'];
    const total = e.low + e.medium + e.high + e.critical;
    const topCat = CATEGORIES.reduce((best, c, i) => recFreq['Next 7 Days'][i] > recFreq['Next 7 Days'][CATEGORIES.indexOf(best)] ? c : best, CATEGORIES[0]);
    return { peak: peakDay['Next 7 Days'], predTotal: predTotal['Next 7 Days'], escTotal: escTotal['Next 7 Days'], critPct: Math.round(e.critical / total * 100), topCat, topCatFreq: Math.max(...recFreq['Next 7 Days']) };
  }, []);

  // ─── Chart builders ──────────────────────────────────────────────────
  const volChart = useMemo(() => {
    const labels = DAYS[volPeriod];
    const d = ticketVol[volPeriod];
    return (
      <div className="min-h-[180px]">
        <div className="flex items-center gap-4 mb-2 text-xs">
          <span className="text-gray-500">Predicted: <strong className="text-gray-800">{predTotal[volPeriod]}</strong></span>
          <span className="px-2 py-0.5 bg-amber-50 rounded text-amber-700 font-semibold">Peak: {peakDay[volPeriod]}</span>
        </div>
        <div className="h-[150px]">
          <Line
            options={lineBase()}
            data={{
              labels,
              datasets: [
                { label: 'Upper', data: d.upper, borderColor: 'transparent', backgroundColor: 'rgba(37,37,120,0.06)', pointRadius: 0, fill: '+1' },
                { label: 'Historical', data: d.hist, borderColor: COLORS.sky.border, backgroundColor: COLORS.sky.bg, borderDash: [5,3], fill: false, tension: 0.4, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#fff', pointBorderWidth: 2 },
                { label: 'Predicted', data: d.pred, borderColor: COLORS.blue.border, backgroundColor: COLORS.blue.bg, fill: false, tension: 0.4, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#fff', pointBorderWidth: 2 },
                { label: 'Lower', data: d.lower, borderColor: 'transparent', backgroundColor: 'transparent', pointRadius: 0, fill: false },
              ],
            }}
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-1">Volume forecast to remain elevated; peak expected on {peakDay[volPeriod]}.</p>
      </div>
    );
  }, [volPeriod]);

  const perfChart = useMemo(() => {
    const labels = showAllEmp ? EMPLOYEES : EMPLOYEES.slice(0, 3);
    const vals = perfTickets[perfPeriod];
    const slice = showAllEmp ? vals : vals.slice(0, 3);
    return (
      <div>
        <div className="h-[160px]">
          <Bar
            options={barBase(labels)}
            data={{
              labels,
              datasets: [{
                data: slice,
                backgroundColor: ['rgba(37,37,120,0.75)', 'rgba(16,185,129,0.75)', 'rgba(245,158,11,0.75)', 'rgba(99,102,241,0.75)', 'rgba(14,165,233,0.75)', 'rgba(244,63,94,0.75)'].slice(0, slice.length),
                borderRadius: 6, barThickness: 16,
              }],
            }}
          />
        </div>
        <button onClick={() => setShowAllEmp(!showAllEmp)} className="text-[11px] font-semibold text-[#252578] hover:underline mt-1">
          {showAllEmp ? 'Show top 3' : 'View all 6 employees'}
        </button>
        <p className="text-[11px] text-gray-500 mt-1">Top performers resolving 20% more tickets than average.</p>
      </div>
    );
  }, [perfPeriod, showAllEmp]);

  const equipChart = useMemo(() => {
    const labels = [EQUIPMENT[0], EQUIPMENT[1], EQUIPMENT[2]];
    const vals = equipFail[equipPeriod];
    const colors = ['rgba(244,63,94,0.75)', 'rgba(99,102,241,0.75)', 'rgba(245,158,11,0.75)'];
    return (
      <div>
        <div className="h-[140px]">
          <Bar
            options={barBase(labels)}
            data={{
              labels,
              datasets: [{ data: [vals[0], vals[1], vals[2]], backgroundColor: colors, borderRadius: 6, barThickness: 16 }],
            }}
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-1">Printer HP LaserJet has the highest predicted failure rate at {vals[0]}%.</p>
      </div>
    );
  }, [equipPeriod]);

  const recChart = useMemo(() => {
    const labels = CATEGORIES.slice(0, 4);
    const vals = recFreq[recPeriod].slice(0, 4);
    return (
      <div>
        <div className="h-[140px]">
          <Bar
            options={barBase(labels)}
            data={{
              labels,
              datasets: [{
                data: vals,
                backgroundColor: ['rgba(37,37,120,0.75)', 'rgba(245,158,11,0.75)', 'rgba(244,63,94,0.75)', 'rgba(16,185,129,0.75)'],
                borderRadius: 6, barThickness: 16,
              }],
            }}
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-1">Network issues recur most frequently; up 12% from last period.</p>
      </div>
    );
  }, [recPeriod]);

  const escChart = useMemo(() => {
    const e = escRisk[escPeriod];
    const total = e.low + e.medium + e.high + e.critical;
    const pct = (v) => Math.round(v / total * 100);
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
            { label: 'Low', v: e.low, p: pct(e.low), color: 'bg-emerald-500' },
            { label: 'Medium', v: e.medium, p: pct(e.medium), color: 'bg-amber-500' },
            { label: 'High', v: e.high, p: pct(e.high), color: 'bg-rose-500' },
            { label: 'Critical', v: e.critical, p: pct(e.critical), color: 'bg-red-600' },
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
            <span className="text-gray-500">Escalations: <strong className="text-gray-800">{escTotal[escPeriod]}</strong></span>
            <span className="text-gray-500">Avg: <strong className="text-gray-800">{escAvg[escPeriod]}</strong></span>
          </div>
        </div>
      </div>
    );
  }, [escPeriod]);

  const rootChart = useMemo(() => {
    const items = rootCause[rootPeriod];
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
                    className={`h-full rounded-full transition-all duration-500 ${
                      c.trend === 'up' ? 'bg-rose-400' : c.trend === 'down' ? 'bg-emerald-400' : 'bg-blue-400'
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
  }, [rootPeriod]);

  // ─── KPI data ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const e = escRisk['Next 7 Days'];
    const total = e.low + e.medium + e.high + e.critical;
    return [
      { label: 'Predicted Tickets', value: predTotal['Next 7 Days'], icon: TrendingUp },
      { label: 'Expected Escalations', value: escTotal['Next 7 Days'], icon: ShieldAlert },
      { label: 'Critical Risk', value: `${Math.round(e.critical / total * 100)}%`, icon: ShieldCheck },
      { label: 'Top Issue', value: data.topCat, icon: Search },
      { label: 'SLA Trend', value: '92%', icon: Activity },
    ];
  }, [data]);

  return (
    <div className="space-y-4 animate-fadeSlideIn">
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

      {/* 12-col Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 1. Ticket Escalation Risk */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#252578]" />
              <h3 className="text-sm font-bold text-gray-800">Escalation Risk</h3>
            </div>
            <FilterDropdown value={escPeriod} onChange={setEscPeriod} />
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
            <FilterDropdown value={rootPeriod} onChange={setRootPeriod} />
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
            <FilterDropdown value={volPeriod} onChange={setVolPeriod} />
          </div>
          {volChart}
        </div>

        {/* 4. Performance Reports */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#252578]" />
              <h3 className="text-sm font-bold text-gray-800">Performance</h3>
            </div>
            <FilterDropdown value={perfPeriod} onChange={setPerfPeriod} />
          </div>
          {perfChart}
        </div>

        {/* 5. Equipment Reports */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#252578]" />
              <h3 className="text-sm font-bold text-gray-800">Equipment Risk</h3>
            </div>
            <FilterDropdown value={equipPeriod} onChange={setEquipPeriod} />
          </div>
          {equipChart}
        </div>

        {/* 6. Recurring Issue Prediction */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#252578]" />
              <h3 className="text-sm font-bold text-gray-800">Recurring Issues</h3>
            </div>
            <FilterDropdown value={recPeriod} onChange={setRecPeriod} />
          </div>
          {recChart}
        </div>

        {/* AI Insights — Full Width */}
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-[#252578]" />
              <h3 className="text-sm font-bold text-[#252578]">AI Insights</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {insights.map((ins, i) => (
                <div key={i} className="bg-white/80 rounded-xl px-3 py-2 border border-blue-100 flex items-start gap-2">
                  <Brain className="w-3.5 h-3.5 text-[#252578] mt-0.5 shrink-0" />
                  <p className="text-[12px] text-gray-700">{ins}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}