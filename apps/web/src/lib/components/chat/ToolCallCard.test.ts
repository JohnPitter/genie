import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import ToolCallCard from './ToolCallCard.svelte';
import type { RenderedToolCall } from '$lib/stores/chat';

const runningCall: RenderedToolCall = {
  id: '1',
  name: 'b3_quote',
  args: { ticker: 'PETR4' },
  status: 'running',
};

const doneCall: RenderedToolCall = {
  id: '2',
  name: 'web_search',
  args: { query: 'PETR4 notícias' },
  result: [{ title: 'Petrobras', url: 'https://example.com' }],
  durationMs: 1234,
  status: 'done',
};

const errorCall: RenderedToolCall = {
  id: '3',
  name: 'web_fetch',
  args: { url: 'https://example.com' },
  result: null,
  status: 'error',
};

describe('ToolCallCard', () => {
  it('renders the tool name', () => {
    const { getByText } = render(ToolCallCard, { props: { call: runningCall } });
    expect(getByText('b3_quote')).toBeInTheDocument();
  });

  it('renders "executando" badge for running status', () => {
    const { getByText } = render(ToolCallCard, { props: { call: runningCall } });
    expect(getByText('executando')).toBeInTheDocument();
  });

  it('renders "concluído" badge for done status', () => {
    const { getByText } = render(ToolCallCard, { props: { call: doneCall } });
    expect(getByText('concluído')).toBeInTheDocument();
  });

  it('renders "erro" badge for error status', () => {
    const { getByText } = render(ToolCallCard, { props: { call: errorCall } });
    expect(getByText('erro')).toBeInTheDocument();
  });

  it('renders duration when provided', () => {
    const { getByText } = render(ToolCallCard, { props: { call: doneCall } });
    expect(getByText('1234ms')).toBeInTheDocument();
  });

  it('does not render duration when undefined', () => {
    const { queryByText } = render(ToolCallCard, { props: { call: runningCall } });
    expect(queryByText(/ms$/)).toBeNull();
  });

  it('renders args JSON in pre element', () => {
    const { container } = render(ToolCallCard, { props: { call: runningCall } });
    const pres = container.querySelectorAll('pre');
    expect(pres.length).toBeGreaterThan(0);
    expect(pres[0].textContent).toContain('PETR4');
  });

  it('renders result JSON when present', () => {
    const { container } = render(ToolCallCard, { props: { call: doneCall } });
    const pres = container.querySelectorAll('pre');
    // Should have args pre + result pre
    expect(pres.length).toBe(2);
    expect(pres[1].textContent).toContain('Petrobras');
  });

  it('adds running class when status is running', () => {
    const { container } = render(ToolCallCard, { props: { call: runningCall } });
    const details = container.querySelector('details');
    expect(details?.classList.contains('tool-card--running')).toBe(true);
  });

  it('does not add running class when done', () => {
    const { container } = render(ToolCallCard, { props: { call: doneCall } });
    const details = container.querySelector('details');
    expect(details?.classList.contains('tool-card--running')).toBe(false);
  });

  it('error state opens details by default', () => {
    const { container } = render(ToolCallCard, { props: { call: errorCall } });
    const details = container.querySelector('details');
    expect(details?.hasAttribute('open')).toBe(true);
  });

  it('renders details element for collapsibility', () => {
    const { container } = render(ToolCallCard, { props: { call: runningCall } });
    expect(container.querySelector('details')).toBeInTheDocument();
    expect(container.querySelector('summary')).toBeInTheDocument();
  });
});
