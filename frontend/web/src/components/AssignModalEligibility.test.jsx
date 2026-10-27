import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssignModal } from './CSModals';
import * as ticketService from '@/services/ticketService';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'CS Agent', email: 'cs@sbsi.com.ph', role: 'cs' },
  }),
}));

describe('AssignModal Eligibility & Reassignment Escalation Tests', () => {
  const mockTicket = {
    id: 'TKT-00101',
    ticket_ID: 101,
    title: 'Centrifuge Motor Overheating',
    category: 'Biomedical Equipment',
    priority: 'High',
    branch: 'Manila Main Branch',
    branch_name: 'Manila Main Branch',
    sla: '4h Remaining',
    status: 'Open',
    assigned: [],
  };

  const mockDepartments = ['Service', 'IT', 'Customer Service', 'Others'];
  const mockPriorityOptions = ['Low', 'Medium', 'High', 'Urgent'];

  const mockEligibleData = {
    ticket_id: 101,
    category: 'Biomedical Equipment',
    track: 'biomedical',
    branch: 'Manila Main Branch',
    rule: {
      department: ['Service', 'Biomedical Engineering'],
      min_position_level: 'Senior',
      allowed_roles: ['Biomedical Engineer', 'Lead Service Engineer'],
      allow_cross_branch: false,
    },
    department_managers: {
      service: {
        id: 1028,
        name: 'Carlos Mendoza',
        email: 'carlos.mendoza@sbsi.com.ph',
        phone: '+63 917 123 4567',
        department: 'Service',
      },
      it: {
        id: 1005,
        name: 'Maria Santos',
        email: 'maria.santos@sbsi.com.ph',
        phone: '+63 918 234 5678',
        department: 'IT',
      },
      cs: {
        id: 1002,
        name: 'Rowena Dizon',
        email: 'rowena.dizon@sbsi.com.ph',
        phone: '+63 919 345 6789',
        department: 'Customer Service',
      },
    },
    eligible_count: 1,
    ineligible_count: 1,
    eligible_employees: [
      {
        id: 10,
        name: 'Juan Dela Cruz',
        department: 'Service',
        branch: 'Manila Main Branch',
        position_level: 'Senior',
        technical_role: 'Lead Service Engineer',
        availability: 'Available',
        status: 'active',
      },
    ],
    ineligible_employees: [
      {
        id: 12,
        name: 'Pedro Reyes',
        department: 'Service',
        branch: 'Manila Main Branch',
        position_level: 'Junior',
        technical_role: 'Biomedical Technician',
        ineligibility_reason: "Position level 'Junior' is below the required 'Senior' seniority level.",
      },
    ],
    empty_state_guidance: 'No active personnel at this branch meet category requirements. Escalate to Carlos Mendoza.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders AssignModal and fetches eligible employees based on category escalation rules', async () => {
    vi.spyOn(ticketService, 'getEligibleEmployees').mockResolvedValue(mockEligibleData);

    render(
      <AssignModal
        ticket={mockTicket}
        employees={[]}
        departments={mockDepartments}
        priorityOptions={mockPriorityOptions}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Assign Ticket' })).toBeInTheDocument();

    await waitFor(() => {
      expect(ticketService.getEligibleEmployees).toHaveBeenCalled();
    });

    expect(screen.getByText('Eligible Staff (1)')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getAllByText('Lead Service Engineer').length).toBeGreaterThan(0);
  });

  it('displays ineligible candidates with explicit ineligibility reasons on Ineligible tab', async () => {
    vi.spyOn(ticketService, 'getEligibleEmployees').mockResolvedValue(mockEligibleData);

    render(
      <AssignModal
        ticket={mockTicket}
        employees={[]}
        departments={mockDepartments}
        priorityOptions={mockPriorityOptions}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Ineligible (1)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ineligible (1)'));

    expect(screen.getByText('Pedro Reyes')).toBeInTheDocument();
    expect(screen.getByText("Position level 'Junior' is below the required 'Senior' seniority level.")).toBeInTheDocument();
    expect(screen.getByText('Disqualified')).toBeInTheDocument();
  });

  it('displays Department Managers with contact information on the Managers tab', async () => {
    vi.spyOn(ticketService, 'getEligibleEmployees').mockResolvedValue(mockEligibleData);

    render(
      <AssignModal
        ticket={mockTicket}
        employees={[]}
        departments={mockDepartments}
        priorityOptions={mockPriorityOptions}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Department Managers')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Department Managers'));

    expect(screen.getByText('Carlos Mendoza')).toBeInTheDocument();
    expect(screen.getByText('carlos.mendoza@sbsi.com.ph')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('Rowena Dizon')).toBeInTheDocument();
  });

  it('distinguishes empty state with escalation guidance when no eligible candidates exist', async () => {
    vi.spyOn(ticketService, 'getEligibleEmployees').mockResolvedValue({
      ...mockEligibleData,
      eligible_count: 0,
      eligible_employees: [],
      empty_state_guidance: 'Escalate to Service Manager Carlos Mendoza immediately.',
    });

    render(
      <AssignModal
        ticket={mockTicket}
        employees={[]}
        departments={mockDepartments}
        priorityOptions={mockPriorityOptions}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No Eligible Employees Found')).toBeInTheDocument();
    });

    expect(screen.getByText('Escalate to Service Manager Carlos Mendoza immediately.')).toBeInTheDocument();
    expect(screen.getByText('View Escalation Managers')).toBeInTheDocument();
  });

  it('displays clear error state with retry action when eligibility fetch fails', async () => {
    vi.spyOn(ticketService, 'getEligibleEmployees')
      .mockRejectedValueOnce(new Error('Gateway timeout while reaching Configuration Service'))
      .mockResolvedValueOnce(mockEligibleData);

    render(
      <AssignModal
        ticket={mockTicket}
        employees={[]}
        departments={mockDepartments}
        priorityOptions={mockPriorityOptions}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to load employee eligibility data')).toBeInTheDocument();
    });

    expect(screen.getByText('Gateway timeout while reaching Configuration Service')).toBeInTheDocument();

    const retryBtn = screen.getByText('Retry Loading');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    });
  });

  it('recalculates eligibility when ticket category changes', async () => {
    const fetchSpy = vi.spyOn(ticketService, 'getEligibleEmployees').mockResolvedValue(mockEligibleData);

    render(
      <AssignModal
        ticket={mockTicket}
        employees={[]}
        departments={mockDepartments}
        priorityOptions={mockPriorityOptions}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const categorySelect = screen.getByDisplayValue('Biomedical Equipment');
    fireEvent.change(categorySelect, { target: { value: 'Hardware Breakdown' } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Hardware Breakdown',
        })
      );
    });
  });
});
