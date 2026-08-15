import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { useDismissable } from '../../../src/renderer/hooks/useDismissable';

function Menu({ label, onDismissed }: { label: string; onDismissed?: () => void }) {
  const [open, setOpen] = useState(false);
  const { triggerRef, panelRef } = useDismissable<HTMLButtonElement, HTMLDivElement>(open, () => {
    setOpen(false);
    onDismissed?.();
  });

  return (
    <div>
      <button ref={triggerRef} onClick={() => setOpen((v) => !v)}>
        open {label}
      </button>
      {open && (
        <div ref={panelRef} data-testid={`panel-${label}`}>
          panel {label}
          <button>inside {label}</button>
        </div>
      )}
    </div>
  );
}

describe('useDismissable', () => {
  it('closes on an outside mousedown', () => {
    render(<Menu label="a" />);
    fireEvent.click(screen.getByText('open a'));
    expect(screen.getByTestId('panel-a')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('panel-a')).not.toBeInTheDocument();
  });

  it('stays open when the click is inside the panel', () => {
    render(<Menu label="a" />);
    fireEvent.click(screen.getByText('open a'));

    fireEvent.mouseDown(screen.getByText('inside a'));
    expect(screen.getByTestId('panel-a')).toBeInTheDocument();
  });

  it('closes on escape', () => {
    render(<Menu label="a" />);
    fireEvent.click(screen.getByText('open a'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('panel-a')).not.toBeInTheDocument();
  });

  it('does not listen while closed', () => {
    const onDismissed = jest.fn();
    render(<Menu label="a" onDismissed={onDismissed} />);

    fireEvent.mouseDown(document.body);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismissed).not.toHaveBeenCalled();
  });

  // the regression the hook was extracted to fix: shared refs across a list
  // meant only the last row tracked its own panel
  it('tracks each instance independently in a list', () => {
    render(
      <>
        <Menu label="a" />
        <Menu label="b" />
      </>
    );

    fireEvent.click(screen.getByText('open a'));
    expect(screen.getByTestId('panel-a')).toBeInTheDocument();

    // clicking inside a's own panel must not dismiss it, even though b exists
    fireEvent.mouseDown(screen.getByText('inside a'));
    expect(screen.getByTestId('panel-a')).toBeInTheDocument();
  });
});
