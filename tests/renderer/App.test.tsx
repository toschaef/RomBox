import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../../src/renderer/App';

// Mock child components that rely on heavy Electron IPCs or page logic
jest.mock('../../src/renderer/components/layout', () => {
  return function MockLayout() {
    return <div data-testid="layout">Mocked Layout</div>;
  };
});

jest.mock('../../src/renderer/components/NotificationContainer', () => {
  return function MockNotificationContainer() {
    return <div data-testid="notification-container">Mocked Notification Container</div>;
  };
});

describe('App Component', () => {
  it('should render App component without crashing', () => {
    render(<App />);
    
    // App should render layout and notification container
    expect(screen.getByTestId('layout')).toBeInTheDocument();
    expect(screen.getByTestId('notification-container')).toBeInTheDocument();
  });
});
