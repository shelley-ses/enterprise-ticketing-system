import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SuperAdminTicketConfig from './SuperAdminTicketConfig';
import * as configurationService from '@/services/configurationService';
import * as ticketService from '@/services/ticketService';

// Mock AuthContext
vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: {
      emp_id: 1,
      name: 'Super Admin',
      role: 'superadmin',
      department: 'IT',
    },
  })),
}));

// Mock BranchContext
vi.mock('@/context/BranchContext', () => ({
  useBranch: vi.fn(() => ({
    selectedBranchId: 1,
    selectedBranch: { id: 1, name: 'Main Branch' },
    branches: [{ id: 1, name: 'Main Branch' }],
    loading: false,
    setSelectedBranchId: vi.fn(),
  })),
}));

// Mock react-router-dom with active 'messaging' tab
vi.mock('@/services/echo', () => ({
  default: {
    channel: vi.fn(() => ({
      listen: vi.fn(),
      stopListening: vi.fn(),
    })),
    private: vi.fn(() => ({
      listen: vi.fn(),
      stopListening: vi.fn(),
    })),
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: vi.fn(() => ({ subtab: 'messaging' })),
  useNavigate: vi.fn(() => vi.fn()),
  useLocation: vi.fn(() => ({ pathname: '/ticketing/superadmin/config/messaging' })),
}));

// Mock ticketService
vi.mock('@/services/ticketService', () => ({
  getSuperAdminConfig: vi.fn(() => Promise.resolve({ equipment: [], categories: [], priorities: [] })),
  getDepartments: vi.fn(() => Promise.resolve([])),
  getSLARules: vi.fn(() => Promise.resolve([])),
  getWorkflowStatuses: vi.fn(() => Promise.resolve([])),
  getEscalationRules: vi.fn(() => Promise.resolve([])),
  getTicketFormOptions: vi.fn(() => Promise.resolve({ problem_categories: [], ticket_priorities: [] })),
  getTicketLimitConfig: vi.fn(() => Promise.resolve({})),
  getTicketNumberFormatConfig: vi.fn(() => Promise.resolve({})),
  getTicketDefaultsConfig: vi.fn(() => Promise.resolve({})),
  getBranchPriorities: vi.fn(() => Promise.resolve([])),
  getBranchCategoriesAndSla: vi.fn(() => Promise.resolve([])),
}));

// Mock configurationService
vi.mock('@/services/configurationService', () => ({
  getMessagingConfiguration: vi.fn(),
  updateMessagingConfiguration: vi.fn(),
  resetMessagingConfiguration: vi.fn(),
  getEmailConfiguration: vi.fn(() => Promise.resolve({})),
  getEmailTemplates: vi.fn(() => Promise.resolve([])),
  getNotificationChannels: vi.fn(() => Promise.resolve({})),
  getFeedbackQuestions: vi.fn(() => Promise.resolve([])),
  getFeedbackFormStatus: vi.fn(() => Promise.resolve({})),
  getCategoryFeedbackToggles: vi.fn(() => Promise.resolve({})),
  getCachedWindowConfiguration: vi.fn(() => ({})),
  getWindowConfiguration: vi.fn(() => Promise.resolve({})),
  getNotificationRouting: vi.fn(() => Promise.resolve({})),
  getTransitionRulesConfig: vi.fn(() => Promise.resolve({})),
  getFileLimitsConfig: vi.fn(() => Promise.resolve({})),
}));

describe('SuperAdminTicketConfig Messaging Subtabs & Internal Configuration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockMessagingConfig = {
    allow_customer_support: true,
    allow_delegated_employee: true,
    allow_full_thread_history: true,
    allow_employee_file_attachments: true,
    allow_customer_file_attachments: true,
    internal: {
      mode: 'requestor_cs_delegated',
      allow_direct_assigned: true,
      allow_full_history: true,
      notify_on_activity: true,
    },
  };

  it('renders messaging tab with External Tickets and Internal Tickets segmented control', async () => {
    configurationService.getMessagingConfiguration.mockResolvedValueOnce(mockMessagingConfig);

    render(<SuperAdminTicketConfig />);

    expect(await screen.findByText('Ticket Messaging Configuration')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /External Tickets/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Internal Tickets/i })).toBeInTheDocument();
  });

  it('switches between External and Internal ticket configurations', async () => {
    configurationService.getMessagingConfiguration.mockResolvedValueOnce(mockMessagingConfig);

    render(<SuperAdminTicketConfig />);

    await screen.findByText('Ticket Messaging Configuration');

    // Default is external
    expect(screen.getByText('Baseline Participants')).toBeInTheDocument();

    // Click Internal Tickets segmented sub-tab
    const internalTabButton = screen.getByRole('button', { name: /Internal Tickets/i });
    fireEvent.click(internalTabButton);

    // Should now display internal configuration cards
    expect(await screen.findByText('Internal Communication Mode')).toBeInTheDocument();
    expect(screen.getByText('Direct Collaboration Rules')).toBeInTheDocument();
    expect(screen.getByText(/Security.*AI Isolation/i)).toBeInTheDocument();
    expect(screen.getByText(/Requestor.*CS Only/i)).toBeInTheDocument();
  });

  it('allows SuperAdmin to switch internal mode and save the updated configuration', async () => {
    configurationService.getMessagingConfiguration.mockResolvedValueOnce(mockMessagingConfig);
    configurationService.updateMessagingConfiguration.mockResolvedValueOnce({
      success: true,
      data: {
        ...mockMessagingConfig,
        internal: {
          ...mockMessagingConfig.internal,
          mode: 'requestor_cs_only',
        },
      },
    });

    render(<SuperAdminTicketConfig />);

    await screen.findByText('Ticket Messaging Configuration');

    // Switch to Internal Tickets
    fireEvent.click(screen.getByRole('button', { name: /Internal Tickets/i }));

    // Select Requestor -> CS Only mode radio
    const csOnlyRadio = screen.getByDisplayValue('requestor_cs_only');
    fireEvent.click(csOnlyRadio);

    // Click Save Settings button
    const saveButton = screen.getByRole('button', { name: /Save Settings/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(configurationService.updateMessagingConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          internal: expect.objectContaining({
            mode: 'requestor_cs_only',
          }),
        })
      );
    });
  });

  it('resets messaging settings back to system defaults including internal configuration', async () => {
    configurationService.getMessagingConfiguration.mockResolvedValueOnce(mockMessagingConfig);
    configurationService.resetMessagingConfiguration.mockResolvedValueOnce({
      success: true,
      data: mockMessagingConfig,
    });

    render(<SuperAdminTicketConfig />);

    await screen.findByText('Ticket Messaging Configuration');

    const resetButton = screen.getByRole('button', { name: /Reset to Defaults/i });
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(configurationService.resetMessagingConfiguration).toHaveBeenCalled();
    });
  });
});
