import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationContainer from '../../src/renderer/components/NotificationContainer';
import { useNotifications } from '../../src/renderer/hooks/useNotifications';

// Mock the hook that supplies notifications state
jest.mock('../../src/renderer/hooks/useNotifications');
const mockUseNotifications = useNotifications as jest.Mock;

describe('NotificationContainer Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render null when there are no notifications and no loading message', () => {
    mockUseNotifications.mockReturnValue({
      notifications: [],
      dismiss: jest.fn(),
      loadingMessage: null
    });

    const { container } = render(<NotificationContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('should render multiple notifications of varying types (success, error)', () => {
    const dismissMock = jest.fn();
    mockUseNotifications.mockReturnValue({
      notifications: [
        { id: 'notif-1', type: 'success', message: 'Game downloaded successfully', duration: 3000, ts: Date.now() },
        { id: 'notif-2', type: 'error', message: 'Failed to extract zip file', duration: 5000, ts: Date.now() }
      ],
      dismiss: dismissMock,
      loadingMessage: null
    });

    render(<NotificationContainer />);

    // Check that both messages exist
    expect(screen.getByText('Game downloaded successfully')).toBeInTheDocument();
    expect(screen.getByText('Failed to extract zip file')).toBeInTheDocument();

    // Check that dismiss buttons work
    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss notification' });
    expect(dismissButtons).toHaveLength(2);

    // Click the first dismiss button
    fireEvent.click(dismissButtons[0]);
    expect(dismissMock).toHaveBeenCalledTimes(1);
    expect(dismissMock).toHaveBeenCalledWith('notif-1');
  });

  it('should render the loading spinner and message when loadingMessage is provided', () => {
    mockUseNotifications.mockReturnValue({
      notifications: [],
      dismiss: jest.fn(),
      loadingMessage: 'Downloading NES core...'
    });

    render(<NotificationContainer />);

    expect(screen.getByText('Downloading NES core...')).toBeInTheDocument();
    
    // Spinner SVG is present in LoadingToast
    const spinner = screen.getByText('Downloading NES core...').previousSibling;
    expect(spinner).toBeDefined();
    expect(spinner?.nodeName).toBe('svg');
  });

  it('should render both loading toast and standard toasts together', () => {
    mockUseNotifications.mockReturnValue({
      notifications: [
        { id: 'notif-1', type: 'success', message: 'Setup completed', duration: 3000, ts: Date.now() }
      ],
      dismiss: jest.fn(),
      loadingMessage: 'Scanning ROMs folder...'
    });

    render(<NotificationContainer />);

    expect(screen.getByText('Setup completed')).toBeInTheDocument();
    expect(screen.getByText('Scanning ROMs folder...')).toBeInTheDocument();
  });
});
