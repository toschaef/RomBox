import { render, screen } from '@testing-library/react';
import Button, { buttonVariants } from '../../../src/renderer/ui/Button';
import IconButton, { iconButtonVariants } from '../../../src/renderer/ui/IconButton';
import Pill, { pillVariants } from '../../../src/renderer/ui/Pill';
import Card, { cardVariants } from '../../../src/renderer/ui/Card';
import Divider from '../../../src/renderer/ui/Divider';
import Toggle from '../../../src/renderer/ui/Toggle';
import Select from '../../../src/renderer/ui/Select';
import TextInput from '../../../src/renderer/ui/TextInput';
import SegmentedControl from '../../../src/renderer/ui/SegmentedControl';
import { ToastSlot, toastVariants } from '../../../src/renderer/ui/Toast';
import { cn } from '../../../src/renderer/ui/cn';

describe('cn', () => {
  it('lets a later class win a conflict instead of emitting both', () => {
    expect(cn('px-3 py-1.5', 'px-6')).toBe('py-1.5 px-6');
  });

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', null, undefined, 'c')).toBe('a c');
  });
});

describe('variant class strings', () => {
  const intents = ['primary', 'secondary', 'ghost', 'danger'] as const;
  const sizes = ['xs', 'sm', 'md'] as const;

  it.each(intents)('button intent %s is stable', (intent) => {
    expect(buttonVariants({ intent })).toMatchSnapshot();
  });

  it.each(sizes)('button size %s is stable', (size) => {
    expect(buttonVariants({ size })).toMatchSnapshot();
  });

  it.each(['neutral', 'ok', 'info', 'warn', 'bad', 'danger'] as const)('pill tone %s is stable', (tone) => {
    expect(pillVariants({ tone })).toMatchSnapshot();
  });

  it.each(['default', 'listening', 'active'] as const)('card state %s is stable', (state) => {
    expect(cardVariants({ state })).toMatchSnapshot();
  });

  it.each(['default', 'ghost', 'danger'] as const)('icon button intent %s is stable', (intent) => {
    expect(iconButtonVariants({ intent })).toMatchSnapshot();
  });

  it('every size rung uses the shared padding scale', () => {
    expect(buttonVariants({ size: 'xs' })).toContain('px-2 py-1');
    expect(buttonVariants({ size: 'sm' })).toContain('px-3 py-1.5');
    expect(buttonVariants({ size: 'md' })).toContain('px-4 py-2');
  });
});

describe('Toast', () => {
  it.each(['success', 'error', 'loading'] as const)('tone %s is stable', (tone) => {
    expect(toastVariants({ tone })).toMatchSnapshot();
  });

  it('animates in and out with utilities rather than bespoke css', () => {
    expect(toastVariants({ motion: 'enter' })).toContain('animate-in');
    expect(toastVariants({ motion: 'exit' })).toContain('animate-out');
    // the old .notification-enter / .notification-exit classes are gone
    expect(toastVariants({ motion: 'enter' })).not.toContain('notification-');
    expect(toastVariants({ motion: 'exit' })).not.toContain('notification-');
  });

  it('drives timing from duration tokens, not hardcoded ms', () => {
    expect(toastVariants({ motion: 'enter' })).toContain('duration-slow');
    expect(toastVariants({ motion: 'exit' })).toContain('duration-fast');
  });

  it('only collapses height while exiting', () => {
    const { container, rerender } = render(
      <ToastSlot exiting={false}>
        <span>hi</span>
      </ToastSlot>
    );
    expect(container.firstElementChild).not.toHaveClass('animate-toast-collapse');

    rerender(
      <ToastSlot exiting>
        <span>hi</span>
      </ToastSlot>
    );
    expect(container.firstElementChild).toHaveClass('animate-toast-collapse');
  });
});

describe('Button', () => {
  it('defaults to type=button so it never submits a form by accident', () => {
    render(<Button>go</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('accepts a className override that beats the variant', () => {
    render(<Button size="sm" className="px-6" />);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('px-6');
    expect(cls).not.toContain('px-3');
  });
});

describe('Toggle', () => {
  it('exposes switch semantics and reports state', () => {
    render(<Toggle checked onChange={() => undefined} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles to the opposite value', () => {
    const onChange = jest.fn();
    render(<Toggle checked={false} onChange={onChange} />);
    screen.getByRole('switch').click();
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Select', () => {
  it('renders each option and reports the raw value', () => {
    const onChange = jest.fn();
    render(
      <Select
        value="b"
        onChange={onChange}
        options={[
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ]}
      />
    );
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('combobox')).toHaveValue('b');
  });

  it('forwards id so label/htmlFor and e2e selectors keep working', () => {
    render(<Select id="launchResolution" value="a" onChange={() => undefined} options={[{ label: 'A', value: 'a' }]} />);
    expect(screen.getByRole('combobox')).toHaveAttribute('id', 'launchResolution');
  });
});

describe('SegmentedControl', () => {
  it('marks only the selected segment', () => {
    render(
      <SegmentedControl
        value="one"
        onChange={() => undefined}
        options={[
          { value: 'one', label: 'One' },
          { value: 'two', label: 'Two' },
        ]}
      />
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });
});

describe('structural primitives', () => {
  it('Divider is a separator', () => {
    render(<Divider />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('Card forwards arbitrary props like data-testid', () => {
    render(<Card data-testid="row" />);
    expect(screen.getByTestId('row')).toBeInTheDocument();
  });

  it('TextInput defaults to type=text', () => {
    render(<TextInput />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');
  });

  it('IconButton renders its glyph', () => {
    render(<IconButton>{'⋮'}</IconButton>);
    expect(screen.getByRole('button')).toHaveTextContent('⋮');
  });

  it('Pill renders its label', () => {
    render(<Pill tone="ok">Installed</Pill>);
    expect(screen.getByText('Installed')).toBeInTheDocument();
  });
});
