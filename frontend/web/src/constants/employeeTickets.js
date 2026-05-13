/** Shared mock tickets for employee dashboard & assigned views */
export const allTickets = [
  {
    id: 'TKT-0001',
    title: 'MRI Machine Not Powering On',
    customer: 'Dr. Maria Santos',
    facility: 'MediClinic Manila',
    equipment: 'MRI',
    status: 'In Progress',
    priority: 'Critical',
    category: 'MRI',
    date: '2026-03-22',
    slaStatus: 'At Risk',
    lastUpdate: 'Mar 22, 2026',
    accepted: true,
    escalated: true,
  },
  {
    id: 'TKT-0002',
    title: 'CT Scan Gantry Error',
    customer: 'Dr. Jose Reyes',
    facility: 'Philippine General Hospital',
    equipment: 'CT Scan',
    status: 'Open',
    priority: 'Critical',
    category: 'CT Scan',
    date: '2026-03-21',
    slaStatus: 'Breached',
    lastUpdate: 'Mar 21, 2026',
    accepted: false,
    escalated: false,
  },
  {
    id: 'TKT-0003',
    title: 'Ultrasound Display Flicker',
    customer: 'Dr. Ana Cruz',
    facility: 'St Lukes Taguig',
    equipment: 'Ultrasound',
    status: 'Open',
    priority: 'Medium',
    category: 'Ultrasound',
    date: '2026-03-20',
    slaStatus: 'On Track',
    lastUpdate: 'Mar 20, 2026',
    accepted: false,
    escalated: false,
  },
  {
    id: 'TKT-0004',
    title: 'X-Ray Calibration Issue',
    customer: 'Dr. Luis Tan',
    facility: 'The Medical City',
    equipment: 'X-Ray',
    status: 'Resolved',
    priority: 'Low',
    category: 'X-Ray',
    date: '2026-03-19',
    slaStatus: 'On Track',
    lastUpdate: 'Mar 19, 2026',
    accepted: true,
    escalated: false,
  },
  {
    id: 'TKT-0005',
    title: 'Ventilator Pressure Alarm',
    customer: 'Nurse R. Dela Cruz',
    facility: 'General Hospital — ICU Ward',
    equipment: 'Ventilator',
    status: 'Escalated',
    priority: 'Critical',
    category: 'Ventilator',
    date: '2026-03-18',
    slaStatus: 'Breached',
    lastUpdate: 'Mar 18, 2026',
    accepted: true,
    escalated: true,
  },
  {
    id: 'TKT-0006',
    title: 'Defibrillator Battery Fail',
    customer: 'Dr. Maria Santos',
    facility: 'MediClinic Manila',
    equipment: 'Defibrillator',
    status: 'In Progress',
    priority: 'High',
    category: 'Defibrillator',
    date: '2026-03-17',
    slaStatus: 'At Risk',
    lastUpdate: 'Mar 17, 2026',
    accepted: true,
    escalated: false,
  },
];

export const recentProgress = [
  {
    id: 'TKT-0001',
    title: 'MRI Machine Not Powering On',
    time: 'Mar 22, 02:30 PM',
    desc: 'Conducted on-site inspection. Power distribution board is confirmed faulty — all capacitors on Line ...',
    attachments: 2,
  },
];

export const priorityColors = {
  Critical: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-green-700',
};

export const statusColors = {
  'In Progress': 'bg-blue-100 text-blue-700',
  Open: 'bg-amber-100 text-amber-700',
  Resolved: 'bg-green-100 text-green-700',
  Escalated: 'bg-red-100 text-red-700',
  Closed: 'bg-gray-100 text-gray-700',
};

export const slaStatusColors = {
  'At Risk': 'bg-amber-100 text-amber-800',
  Breached: 'bg-red-100 text-red-800',
  'On Track': 'bg-green-100 text-green-800',
};

const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export function sortTicketsByPriority(list, direction = 'desc') {
  const mul = direction === 'desc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 9;
    const pb = PRIORITY_ORDER[b.priority] ?? 9;
    return (pa - pb) * mul;
  });
}
