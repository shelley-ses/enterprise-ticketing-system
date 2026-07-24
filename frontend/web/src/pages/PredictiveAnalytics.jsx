import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
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
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  TrendingUp, Users, Cpu, AlertTriangle, ShieldAlert, Search, Brain,
  ChevronDown, Download, Info, Calendar, Clock, ArrowUpRight,
  ArrowDownRight, Activity,
} from 'lucide-react';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

// ─── Period Options ──────────────────────────────────────────────────────────
const PERIOD_OPTIONS = ['Next 7 Days', 'Next 30 Days', 'Next Quarter'];

// ─── Chart Color Palette (same as AdminDashboard) ────────────────────────────
const COLORS = {
  blue: { bg: 'rgba(37, 37, 120, 0.12)', border: 'rgb(37, 37, 120)' },
  emerald: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgb(16, 185, 129)' },
  rose: { bg: 'rgba(244, 63, 94, 0.15)', border: 'rgb(244, 63, 94)' },
  amber: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgb(245, 158, 11)' },
  sky: { bg: 'rgba(14, 165, 233, 0.15)', border: 'rgb(14, 165, 233)' },
  violet: { bg: 'rgba(139, 92, 246, 0.15)', border: 'rgb(139, 92, 246)' },
  teal: { bg: 'rgba(20, 184, 166, 0.15)', border: 'rgb(20, 184, 166)' },
};

const BAR_PALETTE = [
  'rgba(37, 37, 120, 0.75)',
  'rgba(59, 130, 246, 0.75)',
  'rgba(245, 158, 11, 0.75)',
  'rgba(244, 63, 94, 0.75)',
  'rgba(14, 165, 233, 0.75)',
  'rgba(139, 92, 246, 0.75)',
  'rgba(20, 184, 166, 0.75)',
  'rgba(251, 146, 60, 0.75)',
];

// ─── Mock Data ──────────────────────────────────────────────────────────────
const DAY_LABELS = {
  'Next 7 Days': ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
  'Next 30 Days': ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
  'Next Quarter': ['Month 1', 'Month 2', 'Month 3'],
};

const EQUIPMENT_LIST = ['Printer HP LaserJet', 'Server Rack Dell', 'Workstation Lenovo', 'Network Switch Cisco', 'UPS APC', 'Scanner Fujitsu'];
const EMPLOYEES = ['Mark Reyes', 'Carlo Tan', 'Ava Santos', 'Jose Cruz', 'Anna Lim', 'Maria Dela Cruz'];
const CATEGORIES = ['Network', 'Hardware', 'Software', 'Printer', 'Security', 'Database'];

// 1. Ticket Volume Prediction
const ticketVolumeMock = {
  'Next 7 Days': { historical: [12, 15, 10, 18, 14, 20, 16], predicted: [14, 17, 12, 21, 16, 23, 19], upper: [17, 21, 15, 25, 20, 27, 23], lower: [11, 13, 9, 17, 12, 19, 15] },
  'Next 30 Days': { historical: [45, 52, 48, 60], predicted: [50, 58, 53, 66], upper: [58, 67, 62, 75], lower: [42, 49, 44, 57] },
  'Next Quarter': { historical: [180, 195, 210], predicted: [198, 215, 232], upper: [218, 237, 255], lower: [178, 193, 209] },
};

const peakDayMock = {
  'Next 7 Days': 'Day 6',
  'Next 30 Days': 'Week 4',
  'Next Quarter': 'Month 3',
};

const predictedCountMock = {
  'Next 7 Days': 142,
  'Next 30 Days': 227,
  'Next Quarter': 645,
};

// 2. Performance Reports
const perfTicketsMock = {
  'Next 7 Days': [28, 35, 22, 18, 31, 14],
  'Next 30 Days': [112, 140, 95, 78, 125, 62],
  'Next Quarter': [340, 420, 290, 235, 380, 190],
};

const perfSlaMock = {
  'Next 7 Days': [94, 90, 96, 88, 92, 85],
  'Next 30 Days': [92, 88, 94, 85, 90, 82],
  'Next Quarter': [91, 87, 93, 84, 89, 81],
};

const perfResponseMock = {
  'Next 7 Days': [12, 10, 18, 8, 14, 22],
  'Next 30 Days': [13, 11, 19, 9, 15, 23],
  'Next Quarter': [12, 10, 18, 8, 14, 22],
};

const perfTrendMock = {
  'Next 7 Days': ['up', 'up', 'down', 'up', 'down', 'up'],
  'Next 30 Days': ['up', 'up', 'down', 'up', 'down', 'up'],
  'Next Quarter': ['up', 'up', 'down', 'up', 'down', 'up'],
};

// 3. Equipment Reports
const equipFailureMock = {
  'Next 7 Days': [18, 8, 12, 5, 3, 9],
  'Next 30 Days': [22, 12, 16, 8, 5, 13],
  'Next Quarter': [28, 16, 20, 11, 7, 17],
};

const equipTicketsMock = {
  'Next 7 Days': [12, 6, 9, 4, 2, 7],
  'Next 30 Days': [18, 10, 14, 7, 4, 11],
  'Next Quarter': [25, 14, 18, 10, 6, 15],
};

const riskLevelMock = ['Critical', 'Moderate', 'High', 'Low', 'Low', 'Moderate'];

// 4. Recurring Issue Prediction
const recFrequencyMock = {
  'Next 7 Days': [22, 18, 15, 12, 8, 6],
  'Next 30 Days': [85, 72, 60, 48, 32, 24],
  'Next Quarter': [260, 218, 185, 148, 98, 72],
};

const recGrowthMock = [12, 8, -3, 15, 5, -2];
const recSeverityMock = ['High', 'Medium', 'High', 'Low', 'Critical', 'Medium'];

// 5. Ticket Escalation Risk
const escalationRiskMock = {
  'Next 7 Days': { low: 45, medium: 28, high: 15, critical: 7 },
  'Next 30 Days': { low: 65, medium: 38, high: 22, critical: 12 },
  'Next Quarter': { low: 82, medium: 52, high: 30, critical: 18 },
};

const expectedEscalationsMock = {
  'Next 7 Days': 22,
  'Next 30 Days': 34,
  'Next Quarter': 48,
};

const avgTimeUntilEscalationMock = {
  'Next 7 Days': '4.2 hrs',
  'Next 30 Days': '5.8 hrs',
  'Next Quarter': '6.1 hrs',
};

// 6. Root Cause Analytics
const rootCauseMock = {
  'Next 7 Days': [
    { name: 'Network Configuration', pct: 24, count: 38, trend: 'up' },
    { name: 'Hardware Failure', pct: 18, count: 29, trend: 'up' },
    { name: 'Software Bug', pct: 16, count: 25, trend: 'down' },
    { name: 'User Error', pct: 14, count: 22, trend: 'down' },
    { name: 'Printer Jam / Issues', pct: 12, count: 19, trend: 'up' },
    { name: 'Security Threat', pct: 10, count: 16, trend: 'stable' },
    { name: 'Database Corruption', pct: 6, count: 10, trend: 'stable' },
  ],
  'Next 30 Days': [
    { name: 'Network Configuration', pct: 26, count: 155, trend: 'up' },
    { name: 'Hardware Failure', pct: 20, count: 120, trend: 'up' },
    { name: 'Software Bug', pct: 17, count: 102, trend: 'down' },
    { name: 'User Error', pct: 13, count: 78, trend: 'down' },
    { name: 'Printer Jam / Issues', pct: 11, count: 66, trend: 'up' },
    { name: 'Security Threat', pct: 8, count: 48, trend: 'stable' },
    { name: 'Database Corruption', pct: 5, count: 30, trend: 'stable' },
  ],
  'Next Quarter': [
    { name: 'Network Configuration', pct: 27, count: 470, trend: 'up' },
    { name: 'Hardware Failure', pct: 21, count: 365, trend: 'up' },
    { name: 'Software Bug', pct: 16, count: 278, trend: 'down' },
    { name: 'User Error', pct: 12, count: 208, trend: 'down' },
    { name: 'Printer Jam / Issues', pct: 11, count: 191, trend: 'up' },
    { name: 'Security Threat', pct: 8, count: 139, trend: 'stable' },
    { name: 'Database Corruption', pct: 5, count: 87, trend: 'stable' },
  ],
};

// AI Insights Mock Data
const aiInsightsMock = [
  'Ticket volume is projected to increase by 18% next week.',
  'Network-related issues are expected to remain the most common ticket category.',
  'Three employees are projected to exceed their average workload.',
  'SLA breach risk is highest for Hardware Support tickets.',
  'Printer equipment is predicted to generate the most incidents.',
];

// ─── Chart Configurations (same style as AdminDashboard) ─────────────────────
const defaultLineOptions = (title, yLabel = '') => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { family: 'Poppins', size: 12 } } },
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
    y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { family: 'Poppins', size: 11 }, color: '#94a3b8' }, title: yLabel ? { display: true, text: yLabel, font: { family: 'Poppins', size: 12 }, color: '#64748b' } : undefined },
  },
});

const defaultHorizontalBarOptions = () => ({
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

const defaultBarOptions = () => ({
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

// ─── Reusable Sub-Components ────────────────────────────────────────────────
function PeriodDropdown({ value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 pr-9 text-sm text-gray-600 font-medium cursor-pointer hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
      >
        {PERIOD_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

function AnalyticCard({ icon, title, description, children, filter, onFilterChange, loading }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-200 hover:shadow-md group">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#252578] to-[#3b82f6] flex items-center justify-center flex-shrink-0 mt-0.5">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800 leading-tight">{title}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <p className="text-xs text-gray-400">{description}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onFilterChange && <PeriodDropdown value={filter} onChange={onFilterChange} />}
          <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-[#252578]" title="Export">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="relative">
        {loading ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="space-y-3 w-full px-4">
              <div className="h-4 bg-gray-200 rounded-lg animate-pulse w-3/4 mx-auto" />
              <div className="h-[200px] bg-gray-100 rounded-xl animate-pulse" />
              <div className="h-4 bg-gray-200 rounded-lg animate-pulse w-1/2 mx-auto" />
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function TrendBadge({ direction }) {
  if (direction === 'up') return <ArrowUpRight className="w-4 h-4 text-rose-500" />;
  if (direction === 'down') return <ArrowDownRight className="w-4 h-4 text-emerald-500" />;
  return <Activity className="w-4 h-4 text-gray-400" />;
}

function RiskBadge({ level }) {
  const map = {
    Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Moderate: 'bg-amber-50 text-amber-700 border-amber-200',
    High: 'bg-rose-50 text-rose-700 border-rose-200',
    Critical: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${map[level] || map.Low}`}>
      {level}
    </span>
  );
}

function SeverityBadge({ level }) {
  const map = {
    Low: 'bg-gray-100 text-gray-600',
    Medium: 'bg-amber-50 text-amber-700',
    High: 'bg-rose-50 text-rose-700',
    Critical: 'bg-red-50 text-red-700',
  };
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${map[level] || map.Low}`}>
      {level}
    </span>
  );
}

function RankBadge({ rank }) {
  const colors = ['bg-amber-100 text-amber-700', 'bg-gray-100 text-gray-600', 'bg-orange-100 text-orange-700'];
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${colors[rank - 1] || 'bg-gray-50 text-gray-400'}`}>
      #{rank}
    </span>
  );
}

function EmptyState({ message }) {
  return (
    <div className="h-[280px] flex flex-col items-center justify-center text-gray-400">
      <Info className="w-10 h-10 mb-3 opacity-50" />
      <p className="text-sm font-medium">{message || 'No data available'}</p>
      <p className="text-xs mt-1">Adjust your filter or check back later.</p>
    </div>
  );
}

// ─── Main Predictive Analytics Component ────────────────────────────────────
export default function PredictiveAnalytics() {
  const [period, setPeriod] = useState('Next 7 Days');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, [period]);

  // ─── 1. Ticket Volume Prediction ──────────────────────────────────────────
  const volumeChart = useMemo(() => {
    const labels = DAY_LABELS[period];
    const data = ticketVolumeMock[period];
    const peak = peakDayMock[period];
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-gray-400">Predicted Volume</span>
              <p className="text-2xl font-bold text-gray-800">{predictedCountMock[period]}</p>
            </div>
            <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-[10px] text-amber-600 font-semibold">Peak: {peak}</span>
            </div>
          </div>
        </div>
        <div className="h-[280px]">
          <Line
            options={defaultLineOptions('Ticket Volume Prediction', 'Tickets')}
            data={{
              labels,
              datasets: [
                {
                  label: 'Confidence Interval',
                  data: data.upper,
                  borderColor: 'transparent',
                  backgroundColor: 'rgba(37, 37, 120, 0.08)',
                  pointRadius: 0,
                  fill: '+1',
                },
                {
                  label: 'Historical',
                  data: data.historical,
                  borderColor: COLORS.sky.border,
                  backgroundColor: COLORS.sky.bg,
                  borderDash: [6, 3],
                  fill: false,
                  tension: 0.4,
                  borderWidth: 2,
                  pointRadius: 4,
                  pointHoverRadius: 7,
                  pointBackgroundColor: '#fff',
                  pointBorderWidth: 2,
                },
                {
                  label: 'Predicted',
                  data: data.predicted,
                  borderColor: COLORS.blue.border,
                  backgroundColor: COLORS.blue.bg,
                  fill: false,
                  tension: 0.4,
                  borderWidth: 2.5,
                  pointRadius: 4,
                  pointHoverRadius: 7,
                  pointBackgroundColor: '#fff',
                  pointBorderWidth: 2.5,
                },
                {
                  label: 'Lower Bound',
                  data: data.lower,
                  borderColor: 'transparent',
                  backgroundColor: 'transparent',
                  pointRadius: 0,
                  fill: false,
                },
              ],
            }}
          />
        </div>
      </div>
    );
  }, [period]);

  // ─── 2. Performance Reports ──────────────────────────────────────────────
  const [perfView, setPerfView] = useState('Tickets Resolved');

  const perfChart = useMemo(() => {
    const labels = EMPLOYEES;
    let data, label, badge;

    switch (perfView) {
      case 'Tickets Resolved':
        data = perfTicketsMock[period];
        label = 'Tickets';
        badge = [1, 2, 3, 5, 4, 6];
        break;
      case 'SLA Compliance':
        data = perfSlaMock[period];
        label = '%';
        badge = [3, 4, 1, 5, 2, 6];
        break;
      case 'Avg Response Time':
        data = perfResponseMock[period];
        label = 'Minutes';
        badge = [4, 2, 5, 1, 3, 6];
        break;
      default:
        data = perfTicketsMock[period];
        label = 'Tickets';
        badge = [1, 2, 3, 5, 4, 6];
    }

    return (
      <div>
        <div className="h-[280px]">
          <Bar
            options={defaultHorizontalBarOptions()}
            data={{
              labels,
              datasets: [{
                label,
                data,
                backgroundColor: BAR_PALETTE.slice(0, labels.length),
                borderRadius: 8,
                barThickness: 20,
              }],
            }}
          />
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-3">
            {EMPLOYEES.slice(0, 3).map((emp, i) => (
              <div key={emp} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <RankBadge rank={i + 1} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-700 truncate">{emp}</p>
                  <div className="flex items-center gap-1">
                    <TrendBadge direction={perfTrendMock[period][EMPLOYEES.indexOf(emp)]} />
                    <span className="text-[10px] text-gray-400">{data[EMPLOYEES.indexOf(emp)]}{label === 'Tickets' ? ' tickets' : label === '%' ? '%' : ' min'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }, [period, perfView]);

  // ─── 3. Equipment Reports ────────────────────────────────────────────────
  const [equipView, setEquipView] = useState('Failure Rate');

  const equipChart = useMemo(() => {
    const labels = EQUIPMENT_LIST;
    const isFailure = equipView === 'Failure Rate';
    const data = isFailure ? equipFailureMock[period] : equipTicketsMock[period];
    const label = isFailure ? '%' : 'Tickets';
    const colors = labels.map((_, i) => {
      const risk = riskLevelMock[i];
      if (risk === 'Critical') return 'rgba(244, 63, 94, 0.75)';
      if (risk === 'High') return 'rgba(245, 158, 11, 0.75)';
      if (risk === 'Moderate') return 'rgba(37, 37, 120, 0.75)';
      return 'rgba(16, 185, 129, 0.75)';
    });

    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          {['Failure Rate', 'Expected Tickets'].map((v) => (
            <button
              key={v}
              onClick={() => setEquipView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                equipView === v
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="h-[280px]">
          <Bar
            options={defaultHorizontalBarOptions()}
            data={{
              labels,
              datasets: [{
                label,
                data,
                backgroundColor: colors,
                borderRadius: 8,
                barThickness: 20,
              }],
            }}
          />
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {EQUIPMENT_LIST.slice(0, 3).map((eq, i) => (
              <div key={eq} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <Cpu className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-700 truncate">{eq}</p>
                  <RiskBadge level={riskLevelMock[EQUIPMENT_LIST.indexOf(eq)]} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }, [period, equipView]);

  // ─── 4. Recurring Issue Prediction ────────────────────────────────────────
  const [recView, setRecView] = useState('Frequency');

  const recChart = useMemo(() => {
    const labels = CATEGORIES;

    if (recView === 'Frequency') {
      return (
        <div>
          <div className="h-[280px]">
            <Bar
              options={defaultHorizontalBarOptions()}
              data={{
                labels,
                datasets: [{
                  label: 'Predicted Frequency',
                  data: recFrequencyMock[period],
                  backgroundColor: BAR_PALETTE.slice(0, labels.length),
                  borderRadius: 8,
                  barThickness: 20,
                }],
              }}
            />
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.slice(0, 4).map((cat) => {
                const idx = CATEGORIES.indexOf(cat);
                return (
                  <div key={cat} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <SeverityBadge level={recSeverityMock[idx]} />
                      <span className="text-xs font-medium text-gray-700 truncate">{cat}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <TrendBadge direction={recGrowthMock[idx] > 0 ? 'up' : recGrowthMock[idx] < 0 ? 'down' : 'stable'} />
                      <span className={`text-[11px] font-semibold ${recGrowthMock[idx] > 0 ? 'text-rose-500' : recGrowthMock[idx] < 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {recGrowthMock[idx] > 0 ? '+' : ''}{recGrowthMock[idx]}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Stacked bar chart for growth comparison
    const growthData = recGrowthMock;
    return (
      <div>
        <div className="h-[280px]">
          <Bar
            options={defaultBarOptions()}
            data={{
              labels,
              datasets: [
                {
                  label: 'Current',
                  data: recFrequencyMock[period].map(v => Math.round(v * 0.7)),
                  backgroundColor: 'rgba(37, 37, 120, 0.6)',
                  borderRadius: 4,
                  barThickness: 18,
                },
                {
                  label: 'Projected Growth',
                  data: recFrequencyMock[period].map(v => Math.round(v * 0.3)),
                  backgroundColor: 'rgba(245, 158, 11, 0.6)',
                  borderRadius: 4,
                  barThickness: 18,
                },
              ],
            }}
          />
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#252578]" />
              <span>Current Base</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-400" />
              <span>Projected Growth</span>
            </div>
          </div>
        </div>
      </div>
    );
  }, [period, recView]);

  // ─── 5. Ticket Escalation Risk Prediction ─────────────────────────────────
  const escalationChart = useMemo(() => {
    const data = escalationRiskMock[period];
    const total = data.low + data.medium + data.high + data.critical;

    return (
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Low Risk', value: data.low, pct: Math.round(data.low / total * 100), color: 'bg-emerald-500' },
            { label: 'Medium Risk', value: data.medium, pct: Math.round(data.medium / total * 100), color: 'bg-amber-500' },
            { label: 'High Risk', value: data.high, pct: Math.round(data.high / total * 100), color: 'bg-rose-500' },
            { label: 'Critical Risk', value: data.critical, pct: Math.round(data.critical / total * 100), color: 'bg-red-600' },
          ].map((item) => (
            <div key={item.label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className="text-xl font-bold text-gray-800">{item.pct}%</p>
              <p className="text-[10px] text-gray-400">{item.value} tickets</p>
              <div className="w-full h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                <div className={`h-full rounded-full ${item.color} transition-all duration-500`} style={{ width: `${item.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="h-[200px] w-[200px] flex-shrink-0">
            <Doughnut
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(30, 30, 60, 0.92)',
                    titleFont: { family: 'Poppins', size: 13 },
                    bodyFont: { family: 'Poppins', size: 12 },
                    padding: 12,
                    cornerRadius: 10,
                    boxPadding: 6,
                    callbacks: {
                      label: (ctx) => `${ctx.label}: ${ctx.parsed}%`,
                    },
                  },
                },
              }}
              data={{
                labels: ['Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk'],
                datasets: [{
                  data: [
                    Math.round(data.low / total * 100),
                    Math.round(data.medium / total * 100),
                    Math.round(data.high / total * 100),
                    Math.round(data.critical / total * 100),
                  ],
                  backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(244, 63, 94, 0.8)', 'rgba(220, 38, 38, 0.8)'],
                  borderWidth: 2,
                  borderColor: '#fff',
                  hoverOffset: 8,
                }],
              }}
            />
          </div>
          <div className="flex-1 space-y-3 min-w-0">
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span className="text-sm text-gray-600">Expected Escalations</span>
              </div>
              <span className="text-lg font-bold text-gray-800">{expectedEscalationsMock[period]}</span>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#252578]" />
                <span className="text-sm text-gray-600">Avg Time Until Escalation</span>
              </div>
              <span className="text-lg font-bold text-gray-800">{avgTimeUntilEscalationMock[period]}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }, [period]);

  // ─── 6. Root Cause Analytics ─────────────────────────────────────────────
  const rootCauseChart = useMemo(() => {
    const data = rootCauseMock[period];
    return (
      <div>
        <div className="h-[280px]">
          <Bar
            options={{
              ...defaultHorizontalBarOptions(),
              indexAxis: 'y',
              scales: {
                x: {
                  ...defaultHorizontalBarOptions().scales.x,
                  max: 100,
                  title: { display: true, text: 'Percentage (%)', font: { family: 'Poppins', size: 11 }, color: '#94a3b8' },
                },
                y: { ...defaultHorizontalBarOptions().scales.y },
              },
            }}
            data={{
              labels: data.map(d => d.name),
              datasets: [{
                label: '% of Total',
                data: data.map(d => d.pct),
                backgroundColor: data.map((d) => {
                  if (d.trend === 'up') return 'rgba(244, 63, 94, 0.7)';
                  if (d.trend === 'down') return 'rgba(16, 185, 129, 0.7)';
                  return 'rgba(37, 37, 120, 0.7)';
                }),
                borderRadius: 8,
                barThickness: 20,
              }],
            }}
          />
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-rose-400" />
              <span>Increasing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-400" />
              <span>Decreasing</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#252578]" />
              <span>Stable</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {data.slice(0, 4).map((cause) => (
              <div key={cause.name} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <TrendBadge direction={cause.trend} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-700 truncate">{cause.name}</p>
                  <p className="text-[10px] text-gray-400">{cause.count} tickets</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }, [period]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded-lg w-64 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded-lg w-96 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${i === 5 || i === 6 ? 'lg:col-span-2' : ''}`}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-gray-200 animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-gray-200 rounded-lg w-1/2 animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded-lg w-2/3 animate-pulse" />
                </div>
              </div>
              <div className="h-[280px] bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Predictive Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI-powered forecasting and intelligent insights to help administrators anticipate ticket trends, resource demands, and operational risks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodDropdown value={period} onChange={setPeriod} />
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#252578] to-[#3b82f6] text-white rounded-xl text-xs font-semibold shadow-sm hover:opacity-95 active:scale-95 transition-all">
            <Download className="w-3.5 h-3.5" />
            Export Report
          </button>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Ticket Volume Prediction */}
        <AnalyticCard
          icon={<TrendingUp className="w-5 h-5 text-white" />}
          title="Ticket Volume Prediction"
          description="Forecast incoming ticket volume with historical comparison and confidence intervals."
          filter={period}
          onFilterChange={setPeriod}
          loading={loading}
        >
          {volumeChart}
        </AnalyticCard>

        {/* 2. Performance Reports */}
        <AnalyticCard
          icon={<Users className="w-5 h-5 text-white" />}
          title="Performance Reports"
          description="Predict future employee performance metrics and productivity trends."
          filter={period}
          onFilterChange={setPeriod}
          loading={loading}
        >
          <div className="flex items-center gap-2 mb-3">
            {['Tickets Resolved', 'SLA Compliance', 'Avg Response Time'].map((v) => (
              <button
                key={v}
                onClick={() => setPerfView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  perfView === v
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {perfChart}
        </AnalyticCard>

        {/* 3. Equipment Reports */}
        <AnalyticCard
          icon={<Cpu className="w-5 h-5 text-white" />}
          title="Equipment Reports"
          description="Forecast equipment likely to generate support requests."
          filter={period}
          onFilterChange={setPeriod}
          loading={loading}
        >
          {equipChart}
        </AnalyticCard>

        {/* 4. Recurring Issue Prediction */}
        <AnalyticCard
          icon={<Activity className="w-5 h-5 text-white" />}
          title="Recurring Issue Prediction"
          description="Predict issue categories expected to recur with growth trends."
          filter={period}
          onFilterChange={setPeriod}
          loading={loading}
        >
          <div className="flex items-center gap-2 mb-3">
            {['Frequency', 'Growth Comparison'].map((v) => (
              <button
                key={v}
                onClick={() => setRecView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  recView === v
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {recChart}
        </AnalyticCard>

        {/* 5. Ticket Escalation Risk Prediction */}
        <AnalyticCard
          icon={<ShieldAlert className="w-5 h-5 text-white" />}
          title="Ticket Escalation Risk Prediction"
          description="Forecast tickets likely to breach SLA and require escalation."
          filter={period}
          onFilterChange={setPeriod}
          loading={loading}
        >
          {escalationChart}
        </AnalyticCard>

        {/* 6. Root Cause Analytics */}
        <AnalyticCard
          icon={<Search className="w-5 h-5 text-white" />}
          title="Root Cause Analytics"
          description="Analyze the most common underlying causes of support tickets."
          filter={period}
          onFilterChange={setPeriod}
          loading={loading}
        >
          {rootCauseChart}
        </AnalyticCard>

        {/* 7. AI Insights — Full Width */}
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#252578] to-[#3b82f6] flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#252578]">AI Insights</h3>
                <p className="text-xs text-blue-600/70">Intelligent predictions based on historical patterns and trend analysis</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {aiInsightsMock.map((insight, i) => (
                <div key={i} className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-blue-100 flex items-start gap-3 hover:bg-white transition-colors">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Brain className="w-3.5 h-3.5 text-[#252578]" />
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}