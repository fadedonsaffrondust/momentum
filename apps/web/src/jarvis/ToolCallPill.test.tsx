import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolCallPill, humanizeToolName } from './ToolCallPill';

describe('humanizeToolName', () => {
  it('splits camelCase into lowercase words', () => {
    expect(humanizeToolName('getMyTasks')).toBe('get my tasks');
    expect(humanizeToolName('getBrandsRequiringAttention')).toBe('get brands requiring attention');
  });

  it('leaves all-lowercase names alone', () => {
    expect(humanizeToolName('noop')).toBe('noop');
  });
});

describe('ToolCallPill', () => {
  it('renders the pending state with "Looking up" copy', () => {
    render(<ToolCallPill toolName="getMyTasks" status="pending" arguments={{ limit: 5 }} />);
    expect(screen.getByText(/Looking up/i)).toBeInTheDocument();
    expect(screen.getByText('get my tasks')).toBeInTheDocument();
  });

  it('does not render latency while pending', () => {
    render(<ToolCallPill toolName="getBrand" status="pending" arguments={{}} latencyMs={10} />);
    expect(screen.queryByText(/ms$/)).not.toBeInTheDocument();
  });

  it('shows a success glyph and latency when resolved', () => {
    render(
      <ToolCallPill
        toolName="getBrand"
        status="success"
        arguments={{}}
        result={[{ id: '1' }]}
        latencyMs={42}
      />,
    );
    expect(screen.getByText('42ms')).toBeInTheDocument();
    // The trigger button's aria-label switches from "Looking up" to "Looked up"
    expect(screen.getByRole('button', { name: /Looked up/i })).toBeInTheDocument();
  });

  it('shows the error variant with destructive styling', () => {
    const { container } = render(
      <ToolCallPill
        toolName="failingTool"
        status="error"
        arguments={{ x: 1 }}
        error="invalid arguments"
      />,
    );
    expect(container.querySelector('[data-tool-call-pill="true"]')).toHaveClass(/destructive/);
  });

  it('expands on click to reveal arguments and result', () => {
    render(
      <ToolCallPill
        toolName="getBrand"
        status="success"
        arguments={{ brandId: 'b-123' }}
        result={{ id: 'b-123', name: 'Boudin' }}
        latencyMs={7}
      />,
    );
    // Collapsed by default
    expect(screen.queryByText(/brandId/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Looked up/i }));

    expect(screen.getByText(/brandId/)).toBeInTheDocument();
    expect(screen.getByText(/Boudin/)).toBeInTheDocument();
    expect(screen.getByText('arguments')).toBeInTheDocument();
    expect(screen.getByText('result')).toBeInTheDocument();
  });

  it('expands to show error message instead of result when status is error', () => {
    render(
      <ToolCallPill toolName="failingTool" status="error" arguments={{ x: 1 }} error="timed out" />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('timed out')).toBeInTheDocument();
    expect(screen.queryByText('result')).not.toBeInTheDocument();
  });
});
