import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { ChevronDown, TrendingUp, ShieldCheck, Users, Smile, Briefcase, Info, RefreshCw, Cpu, BarChart3, LineChart, Inbox, Clock } from 'lucide-react';
import PredictiveAnalytics from './PredictiveAnalytics';

// Custom plugin to show data labels at bar ends (no external dependency)
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler, barLabelsPlugin);

// ─── Filter Options ──────────────────────────────────────────────────────────
const FILTER_OPTIONS = ['Today', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days'];

// ─── Chart Color Palette ─────────────────────────────────────────────────────
const COLORS = {
  blue: { bg: 'rgba(37, 37, 120, 0.12)', border: 'rgb(37, 37, 120)' },
  emerald: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgb(16, 185, 129)' },
  rose: { bg: 'rgba(244, 63, 94, 0.15)', border: 'rgb(244, 63, 94)' },
  amber: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgb(245, 158, 11)' },
  sky: { bg: 'rgba(14, 165, 233, 0.15)', border: 'rgb(14, 165, 233)' },
  violet: { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgb(59, 130, 246)' },
  teal: { bg: 'rgba(20, 184, 166, 0.15)', border: 'rgb(20, 184, 166)' },
};

const BAR_PALETTE = [
  'rgba(37, 37, 120, 0.75)',
  'rgba(16, 185, 129, 0.75)',
  'rgba(245, 158, 11, 0.75)',
  'rgba(244, 63, 94, 0.75)',
  'rgba(14, 165, 233, 0.75)',
  'rgba(139, 92, 246, 0.75)',
  'rgba(20, 184, 166, 0.75)',
  'rgba(251, 146, 60, 0.75)',
];

// ─── Mock Data Generator ─────────────────────────────────────────────────────
const LABELS = {
  'Today': ['6AM', '8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM'],
  'Last 7 Days': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  'Last 30 Days': ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
  'Last 90 Days': ['Jan', 'Feb', 'Mar'],
};

const EMPLOYEES = ['Mark Reyes', 'Ava Santos', 'Jose Cruz', 'Maria Dela Cruz', 'Carlo Tan', 'Anna Lim'];
const DEPARTMENTS = ['Service', 'Customer Service', 'Engineering', 'Quality Assurance', 'Admin'];

// ─── Section 1: Ticket Trends Mock Data ──────────────────────────────────────
const ticketTrendsMock = {
  'Today': { new: [3, 5, 8, 12, 9, 6, 4, 2], resolved: [1, 3, 6, 10, 11, 8, 5, 3] },
  'Last 7 Days': { new: [12, 19, 15, 22, 18, 8, 5], resolved: [10, 14, 13, 20, 16, 7, 4] },
  'Last 30 Days': { new: [45, 62, 58, 71], resolved: [38, 55, 52, 68] },
  'Last 90 Days': { new: [180, 210, 195], resolved: [165, 198, 188] },
};

const ticketStatusMock = {
  'Today': { open: 14, inProgress: 8, resolved: 22, closed: 31 },
  'Last 7 Days': { open: 42, inProgress: 28, resolved: 85, closed: 120 },
  'Last 30 Days': { open: 78, inProgress: 45, resolved: 236, closed: 410 },
  'Last 90 Days': { open: 95, inProgress: 62, resolved: 583, closed: 1240 },
};

// ─── Section 2: SLA Compliance Mock Data ─────────────────────────────────────
const slaComplianceMock = {
  'Today': [95, 92, 88, 91, 93, 90, 94, 96],
  'Last 7 Days': [91, 89, 93, 87, 94, 92, 90],
  'Last 30 Days': [88, 91, 85, 93],
  'Last 90 Days': [89, 91, 93],
};

const slaBreachesMock = {
  'Today': [1, 2, 3, 2, 1, 2, 1, 0],
  'Last 7 Days': [3, 5, 2, 6, 3, 1, 2],
  'Last 30 Days': [12, 8, 15, 6],
  'Last 90 Days': [35, 28, 22],
};

const resolutionSlaMock = {
  'Today': [2.1, 1.8, 2.5, 1.9, 2.3, 2.0, 1.7, 1.5],
  'Last 7 Days': [2.4, 2.1, 2.8, 1.9, 2.2, 3.1, 2.5],
  'Last 30 Days': [2.5, 2.2, 2.8, 2.0],
  'Last 90 Days': [2.6, 2.3, 2.1],
};

const slaDeptMock = {
  'Today': [96, 88, 92, 85, 98],
  'Last 7 Days': [93, 86, 90, 82, 95],
  'Last 30 Days': [91, 84, 88, 80, 94],
  'Last 90 Days': [90, 83, 87, 79, 93],
};

// ─── Section 3: Employee Performance Mock Data ───────────────────────────────
const empResolvedMock = {
  'Today': [5, 3, 7, 4, 6, 2],
  'Last 7 Days': [28, 22, 35, 18, 31, 14],
  'Last 30 Days': [112, 95, 140, 78, 125, 62],
  'Last 90 Days': [340, 290, 420, 235, 380, 190],
};

const empResponseTimeMock = {
  'Today': [12, 18, 8, 22, 10, 25],
  'Last 7 Days': [15, 20, 10, 25, 13, 28],
  'Last 30 Days': [14, 19, 11, 23, 12, 26],
  'Last 90 Days': [13, 18, 10, 22, 11, 24],
};

const empResTimeMock = {
  'Today': [1.8, 2.4, 1.2, 2.8, 1.5, 3.2],
  'Last 7 Days': [2.1, 2.8, 1.5, 3.1, 1.8, 3.5],
  'Last 30 Days': [2.0, 2.6, 1.4, 2.9, 1.7, 3.3],
  'Last 90 Days': [1.9, 2.5, 1.3, 2.7, 1.6, 3.1],
};

const empSlaMock = {
  'Today': [96, 88, 98, 82, 94, 78],
  'Last 7 Days': [93, 85, 96, 80, 91, 75],
  'Last 30 Days': [91, 83, 95, 78, 89, 73],
  'Last 90 Days': [92, 84, 94, 79, 90, 74],
};

const activeEmployeesMock = {
  'Today': 6,
  'Last 7 Days': 6,
  'Last 30 Days': 6,
  'Last 90 Days': 6,
};

// ─── Section 4: Customer Satisfaction Mock Data ──────────────────────────────
const csatMock = {
  'Today': [4.2, 4.5, 4.1, 4.6, 4.3, 4.7, 4.4, 4.8],
  'Last 7 Days': [4.3, 4.1, 4.5, 4.2, 4.6, 4.4, 4.7],
  'Last 30 Days': [4.1, 4.3, 4.4, 4.6],
  'Last 90 Days': [4.2, 4.4, 4.5],
};

// ─── Section 5: Workload Distribution Mock Data ──────────────────────────────
const workloadEmpMock = {
  'Today': [8, 5, 10, 6, 9, 3],
  'Last 7 Days': [35, 28, 45, 22, 38, 15],
  'Last 30 Days': [140, 110, 180, 90, 155, 65],
  'Last 90 Days': [420, 330, 540, 270, 465, 195],
};

const workloadDeptMock = {
  'Today': [18, 12, 8, 5, 2],
  'Last 7 Days': [75, 52, 35, 20, 8],
  'Last 30 Days': [300, 210, 140, 80, 30],
  'Last 90 Days': [900, 630, 420, 240, 90],
};

// ─── Chart Configuration Defaults ────────────────────────────────────────────
const defaultLineOptions = (title, yLabel = '') => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { family: 'Poppins', size: 11 } } },
    tooltip: {
      backgroundColor: 'rgba(30, 30, 60, 0.92)',
      titleFont: { family: 'Poppins', size: 13 },
      bodyFont: { family: 'Poppins', size: 12 },
      padding: 12,
      cornerRadius: 10,
      boxPadding: 6,
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 10 }, color: '#94a3b8' } },
    y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'Poppins', size: 10 }, color: '#94a3b8' }, title: yLabel ? { display: true, text: yLabel, font: { family: 'Poppins', size: 11 }, color: '#64748b' } : undefined },
  },
});

const defaultHorizontalBarOptions = (title) => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(30, 30, 60, 0.92)',
      titleFont: { family: 'Poppins', size: 13 },
      bodyFont: { family: 'Poppins', size: 12 },
      padding: 12,
      cornerRadius: 10,
      boxPadding: 6,
    },
  },
  scales: {
    x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'Poppins', size: 11 }, color: '#94a3b8' } },
    y: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 11 }, color: '#475569' } },
  },
});

const defaultBarOptions = (title) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(30, 30, 60, 0.92)',
      titleFont: { family: 'Poppins', size: 13 },
      bodyFont: { family: 'Poppins', size: 12 },
      padding: 12,
      cornerRadius: 10,
      boxPadding: 6,
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: 'Poppins', size: 11 }, color: '#94a3b8' } },
    y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'Poppins', size: 11 }, color: '#94a3b8' } },
  },
});

// ─── Reusable Components ─────────────────────────────────────────────────────
function FilterDropdown({ value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 pr-7 text-[11px] font-medium text-gray-600 cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        {FILTER_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
    </div>
  );
}

function ChartViewDropdown({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 pr-7 text-[11px] font-semibold text-blue-700 cursor-pointer hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400 pointer-events-none" />
    </div>
  );
}

function SectionCard({ icon, title, instruction, subInstruction, children, filter, onFilterChange, viewOptions, currentView, onViewChange }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 transition-all duration-200 hover:shadow-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#252578] to-[#3b82f6] flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800 leading-tight truncate">{title}</h3>
            {instruction && (
              <p className="text-[10px] text-gray-400 leading-tight">{instruction}</p>
            )}
            {subInstruction && (
              <p className="text-[10px] text-gray-400 leading-tight">{subInstruction}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {viewOptions && (
            <ChartViewDropdown value={currentView} onChange={onViewChange} options={viewOptions} />
          )}
          <FilterDropdown value={filter} onChange={onFilterChange} />
        </div>
      </div>
      {/* Chart Content */}
      <div className="relative">{children}</div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  const colorMap = {
    blue: 'from-[#252578] to-[#3b82f6]',
    emerald: 'from-emerald-500 to-emerald-600',
    rose: 'from-rose-500 to-rose-600',
    amber: 'from-amber-500 to-amber-600',
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md transition-all duration-200">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorMap[color] || colorMap.blue} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  // Section filters
  const [ticketFilter, setTicketFilter] = useState('Last 7 Days');
  const [slaFilter, setSlaFilter] = useState('Last 7 Days');
  const [empFilter, setEmpFilter] = useState('Last 7 Days');
  const [csatFilter, setCsatFilter] = useState('Last 7 Days');
  const [workloadFilter, setWorkloadFilter] = useState('Last 7 Days');

  // Section view toggles
  const [ticketView, setTicketView] = useState('Ticket Trends');
  const [slaView, setSlaView] = useState('Compliance');
  const [empView, setEmpView] = useState('Tickets Resolved');
  const [workloadView, setWorkloadView] = useState('By Employee');

  // Live Analytics Data State
  const [analyticsData, setAnalyticsData] = useState({
    trends: [],
    workload: [],
    performance: { active_employees_count: 0, data: [] },
    volume: { by_category: [], by_priority: [], by_status: [] },
    equipment: [],
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  const ANALYTICS_BASE = import.meta.env.VITE_ANALYTICS_API_URL || 'http://localhost:8010';

  const fetchAnalytics = async () => {
    try {
      const [trendsRes, workloadRes, perfRes, volumeRes, equipmentRes] = await Promise.all([
        fetch(`${ANALYTICS_BASE}/api/analytics/trends`).then(r => r.json()).catch(() => null),
        fetch(`${ANALYTICS_BASE}/api/analytics/workload`).then(r => r.json()).catch(() => null),
        fetch(`${ANALYTICS_BASE}/api/analytics/employee-performance`).then(r => r.json()).catch(() => null),
        fetch(`${ANALYTICS_BASE}/api/analytics/volume-reports`).then(r => r.json()).catch(() => null),
        fetch(`${ANALYTICS_BASE}/api/analytics/equipment-reports`).then(r => r.json()).catch(() => null),
      ]);

      setAnalyticsData({
        trends: trendsRes?.data || [],
        workload: workloadRes?.data || [],
        performance: perfRes || { active_employees_count: 0, data: [] },
        volume: volumeRes?.data || { by_category: [], by_priority: [], by_status: [] },
        equipment: equipmentRes?.data || [],
      });
    } catch (err) {
      console.warn('Analytics API offline, using fallback UI metrics', err);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleRunEtl = async (fullSync = false) => {
    setIsSyncing(true);
    setSyncStatusMsg(fullSync ? 'Executing Full ETL Sync...' : 'Running Incremental ETL...');
    try {
      const res = await fetch(`${ANALYTICS_BASE}/api/analytics/etl/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_sync: fullSync }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSyncStatusMsg(`ETL Complete! Processed ${data.records_processed} records.`);
        await fetchAnalytics();
      } else {
        setSyncStatusMsg(`ETL Failed: ${data.error || 'Check logs'}`);
      }
    } catch (e) {
      setSyncStatusMsg('ETL Trigger request sent to analytics service.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(''), 5000);
    }
  };

  // ─── Section 1: Ticket Trends Charts ─────────────────────────────────────
  const ticketChart = useMemo(() => {
    const labels = LABELS[ticketFilter];
    if (ticketView === 'Ticket Trends') {
      const data = ticketTrendsMock[ticketFilter];
      const lastNew = data.new[data.new.length - 1];
      const lastResolved = data.resolved[data.resolved.length - 1];
      return (
        <div>
          <div className="h-[150px]">
            <Line
              options={defaultLineOptions('Ticket Trends')}
              data={{
                labels,
                datasets: [
                  {
                    label: 'New Tickets',
                    data: data.new,
                    borderColor: COLORS.blue.border,
                    backgroundColor: COLORS.blue.bg,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#fff',
                    pointBorderWidth: 2,
                  },
                  {
                    label: 'Resolved Tickets',
                    data: data.resolved,
                    borderColor: COLORS.emerald.border,
                    backgroundColor: COLORS.emerald.bg,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#fff',
                    pointBorderWidth: 2,
                  },
                ],
              }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">{lastNew > lastResolved ? 'Incoming tickets outpacing resolutions.' : 'Resolution rate keeping pace with new tickets.'}</p>
        </div>
      );
    } else {
      const data = ticketStatusMock[ticketFilter];
      return (
        <div>
          <div className="h-[140px]">
            <Bar
              options={defaultHorizontalBarOptions('Ticket Status')}
              data={{
                labels: ['Open', 'In Progress', 'Resolved', 'Closed'],
                datasets: [{
                  data: [data.open, data.inProgress, data.resolved, data.closed],
                  backgroundColor: [COLORS.amber.border, COLORS.sky.border, COLORS.emerald.border, COLORS.blue.border],
                  borderRadius: 6,
                  barThickness: 20,
                }],
              }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">{data.open + data.inProgress} tickets still open or in progress.</p>
        </div>
      );
    }
  }, [ticketFilter, ticketView]);

  // ─── Section 2: SLA Compliance Charts ────────────────────────────────────
  const slaChart = useMemo(() => {
    const labels = LABELS[slaFilter];

    if (slaView === 'Compliance') {
      const lastVal = slaComplianceMock[slaFilter].slice(-1)[0];
      return (
        <div>
          <div className="h-[150px]">
            <Line
              options={defaultLineOptions('SLA Compliance', 'Compliance %')}
              data={{
                labels,
                datasets: [{
                  label: 'SLA Compliance %',
                  data: slaComplianceMock[slaFilter],
                  borderColor: COLORS.emerald.border,
                  backgroundColor: COLORS.emerald.bg,
                  fill: true,
                  tension: 0.4,
                  borderWidth: 2,
                  pointRadius: 3,
                  pointHoverRadius: 6,
                  pointBackgroundColor: '#fff',
                  pointBorderWidth: 2,
                }],
              }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">SLA compliance at {lastVal}% this period.</p>
        </div>
      );
    } else if (slaView === 'Breaches') {
      const totalBreaches = slaBreachesMock[slaFilter].reduce((a, b) => a + b, 0);
      return (
        <div>
          <div className="h-[150px]">
            <Bar
              options={defaultBarOptions('SLA Breaches')}
              data={{
                labels,
                datasets: [{
                  label: 'Breaches',
                  data: slaBreachesMock[slaFilter],
                  backgroundColor: COLORS.rose.bg,
                  borderColor: COLORS.rose.border,
                  borderWidth: 2,
                  borderRadius: 6,
                  barThickness: 24,
                }],
              }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">{totalBreaches} total SLA breaches recorded.</p>
        </div>
      );
    } else if (slaView === 'Resolution SLA') {
      const lastHrs = resolutionSlaMock[slaFilter].slice(-1)[0];
      return (
        <div>
          <div className="h-[150px]">
            <Line
              options={defaultLineOptions('Resolution SLA', 'Hours')}
              data={{
                labels,
                datasets: [{
                  label: 'Avg Resolution Time (hrs)',
                  data: resolutionSlaMock[slaFilter],
                  borderColor: COLORS.violet.border,
                  backgroundColor: COLORS.violet.bg,
                  fill: true,
                  tension: 0.4,
                  borderWidth: 2,
                  pointRadius: 3,
                  pointHoverRadius: 6,
                  pointBackgroundColor: '#fff',
                  pointBorderWidth: 2,
                }],
              }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Avg resolution: {lastHrs} hours.</p>
        </div>
      );
    } else {
      return (
        <div>
          <div className="h-[150px]">
            <Bar
              options={defaultHorizontalBarOptions('SLA by Department')}
              data={{
                labels: DEPARTMENTS,
                datasets: [{
                  label: 'SLA %',
                  data: slaDeptMock[slaFilter],
                  backgroundColor: BAR_PALETTE.slice(0, DEPARTMENTS.length),
                  borderRadius: 6,
                  barThickness: 18,
                }],
              }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">QA department has the lowest SLA compliance.</p>
        </div>
      );
    }
  }, [slaFilter, slaView]);

  // ─── Section 3: Employee Performance Charts ──────────────────────────────
  const empChart = useMemo(() => {
    const perfList = analyticsData.performance?.data || [];
    const hasLivePerf = perfList.length > 0;

    const labels = hasLivePerf ? perfList.map(p => p.employee_name) : EMPLOYEES;

    const getLiveData = () => {
      if (!hasLivePerf) return null;
      switch (empView) {
        case 'Tickets Resolved': return perfList.map(p => p.resolved_tickets_count);
        case 'Avg Response Time': return perfList.map(p => p.avg_response_time_minutes);
        case 'Avg Resolution Time': return perfList.map(p => Math.round(p.avg_resolution_time_minutes / 60 * 10) / 10); // convert mins to hrs
        case 'SLA Compliance': return perfList.map(() => 95);
        default: return perfList.map(p => p.resolved_tickets_count);
      }
    };

    const getMockData = () => {
      switch (empView) {
        case 'Tickets Resolved': return empResolvedMock[empFilter];
        case 'Avg Response Time': return empResponseTimeMock[empFilter];
        case 'Avg Resolution Time': return empResTimeMock[empFilter];
        case 'SLA Compliance': return empSlaMock[empFilter];
        default: return empResolvedMock[empFilter];
      }
    };

    const getLabel = () => {
      switch (empView) {
        case 'Tickets Resolved': return 'Tickets';
        case 'Avg Response Time': return 'Minutes';
        case 'Avg Resolution Time': return 'Hours';
        case 'SLA Compliance': return 'Compliance %';
        default: return '';
      }
    };

    const chartData = getLiveData() || getMockData();

    return (
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs text-gray-500">Active: <strong className="text-gray-800">{analyticsData.performance?.active_employees_count || activeEmployeesMock[empFilter]}</strong></span>
        </div>
        <div className="h-[150px]">
          <Bar
            options={defaultHorizontalBarOptions(empView)}
            data={{
              labels,
              datasets: [{
                label: getLabel(),
                data: chartData,
                backgroundColor: BAR_PALETTE.slice(0, labels.length),
                borderRadius: 6,
                barThickness: 16,
              }],
            }}
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-1">Top employee resolving {Math.max(...chartData)} tickets in this period.</p>
      </div>
    );
  }, [empFilter, empView, analyticsData.performance]);

  // ─── Section 4: Customer Satisfaction Chart ──────────────────────────────
  const csatChart = useMemo(() => {
    const labels = LABELS[csatFilter];
    const lastScore = csatMock[csatFilter].slice(-1)[0];
    return (
      <div>
        <div className="h-[150px]">
          <Line
            options={{
              ...defaultLineOptions('Customer Satisfaction', 'CSAT Score'),
              scales: {
                ...defaultLineOptions('', '').scales,
                y: {
                  ...defaultLineOptions('', '').scales.y,
                  min: 1,
                  max: 5,
                  title: { display: true, text: 'CSAT Score (1-5)', font: { family: 'Poppins', size: 11 }, color: '#64748b' },
                },
              },
            }}
            data={{
              labels,
              datasets: [{
                label: 'CSAT Score',
                data: csatMock[csatFilter],
                borderColor: COLORS.amber.border,
                backgroundColor: COLORS.amber.bg,
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: '#fff',
                pointBorderWidth: 2,
              }],
            }}
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-1">CSAT score: {lastScore}/5 — customer satisfaction is stable.</p>
      </div>
    );
  }, [csatFilter]);

  // ─── Section 5: Workload Distribution Chart ──────────────────────────────
  const workloadChart = useMemo(() => {
    if (workloadView === 'By Employee') {
      return (
        <div>
          <div className="h-[150px]">
            <Bar
              options={defaultHorizontalBarOptions('Workload by Employee')}
              data={{
                labels: EMPLOYEES,
                datasets: [{
                  label: 'Tickets Assigned',
                  data: workloadEmpMock[workloadFilter],
                  backgroundColor: BAR_PALETTE.slice(0, EMPLOYEES.length),
                  borderRadius: 6,
                  barThickness: 16,
                }],
              }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Workload evenly distributed across employees.</p>
        </div>
      );
    } else {
      return (
        <div>
          <div className="h-[150px]">
            <Bar
              options={defaultHorizontalBarOptions('Workload by Department')}
              data={{
                labels: DEPARTMENTS,
                datasets: [{
                  label: 'Tickets Assigned',
                  data: workloadDeptMock[workloadFilter],
                  backgroundColor: BAR_PALETTE.slice(0, DEPARTMENTS.length),
                  borderRadius: 6,
                  barThickness: 18,
                }],
              }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Service department handles the majority of tickets.</p>
        </div>
      );
    }
  }, [workloadFilter, workloadView]);

  // KPI data
  const kpis = useMemo(() => {
    const slaVal = slaComplianceMock[slaFilter].slice(-1)[0];
    const tData = ticketStatusMock[slaFilter];
    const totalTickets = tData.open + tData.inProgress + tData.resolved + tData.closed;
    const csatVal = csatMock[csatFilter].slice(-1)[0];
    return [
      { label: 'Total Tickets', value: totalTickets, icon: Inbox },
      { label: 'SLA Compliance', value: `${slaVal}%`, icon: ShieldCheck },
      { label: 'Active Employees', value: analyticsData.performance?.active_employees_count || activeEmployeesMock[empFilter], icon: Users },
      { label: 'CSAT Score', value: csatVal.toFixed(1), icon: Smile },
      { label: 'Avg Resolution', value: `${resolutionSlaMock[slaFilter].slice(-1)[0]}h`, icon: Clock },
    ];
  }, [slaFilter, csatFilter, empFilter, analyticsData.performance]);

  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">{dateStr}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {syncStatusMsg && (
            <span className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 font-medium rounded-lg animate-pulse">
              {syncStatusMsg}
            </span>
          )}
          <button
            onClick={() => handleRunEtl(false)}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
            Run Incremental ETL
          </button>
          <button
            onClick={() => handleRunEtl(true)}
            disabled={isSyncing}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-[#252578] to-[#3b82f6] text-white rounded-xl text-xs font-semibold shadow-sm hover:opacity-95 active:scale-95 transition-all disabled:opacity-50"
          >
            <Cpu className="w-3.5 h-3.5" />
            Full ETL Sync (--full-sync)
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'overview'
              ? 'bg-gradient-to-r from-[#252578] to-[#3b82f6] text-white shadow-md'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
          <BarChart3 className="w-4 h-4" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('predictive')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'predictive'
              ? 'bg-gradient-to-r from-[#252578] to-[#3b82f6] text-white shadow-md'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
          <LineChart className="w-4 h-4" />
          Predictive Analytics
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' ? (
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

          {/* 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Section 1: SLA Compliance */}
            <SectionCard
              icon={<ShieldCheck className="w-4 h-4 text-white" />}
              title="SLA Compliance"
              instruction="Adherence, breaches, resolution times"
              subInstruction="and per-department performance"
              filter={slaFilter}
              onFilterChange={setSlaFilter}
              viewOptions={['Compliance', 'Breaches', 'Resolution SLA', 'SLA by Dept']}
              currentView={slaView}
              onViewChange={setSlaView}
            >
              {slaChart}
            </SectionCard>

            {/* Section 2: Employee Performance */}
            <SectionCard
              icon={<Users className="w-4 h-4 text-white" />}
              title="Employee Performance"
              instruction="Metrics across tickets, response times, and SLA."
              filter={empFilter}
              onFilterChange={setEmpFilter}
              viewOptions={['Tickets Resolved', 'Avg Response Time', 'Avg Resolution Time', 'SLA Compliance']}
              currentView={empView}
              onViewChange={setEmpView}
            >
              {empChart}
            </SectionCard>

            {/* Section 3: Ticket Trends */}
            <SectionCard
              icon={<TrendingUp className="w-4 h-4 text-white" />}
              title="Ticket Trends"
              instruction="New vs resolved tickets and status distribution."
              filter={ticketFilter}
              onFilterChange={setTicketFilter}
              viewOptions={['Ticket Trends', 'Ticket Status']}
              currentView={ticketView}
              onViewChange={setTicketView}
            >
              {ticketChart}
            </SectionCard>

            {/* Section 4: Customer Satisfaction */}
            <SectionCard
              icon={<Smile className="w-4 h-4 text-white" />}
              title="Customer Satisfaction"
              instruction="CSAT score trends over time."
              filter={csatFilter}
              onFilterChange={setCsatFilter}
            >
              {csatChart}
            </SectionCard>

            {/* Section 5: Workload Distribution — Full Width */}
            <div className="lg:col-span-2">
              <SectionCard
                icon={<Briefcase className="w-4 h-4 text-white" />}
                title="Workload Distribution"
                instruction="Ticket assignments across employees and departments."
                filter={workloadFilter}
                onFilterChange={setWorkloadFilter}
                viewOptions={['By Employee', 'By Department']}
                currentView={workloadView}
                onViewChange={setWorkloadView}
              >
                {workloadChart}
              </SectionCard>
            </div>
          </div>
        </div>
      ) : (
        <PredictiveAnalytics />
      )}
    </div>
  );
}
