import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Message from './Message.svelte';
import type { ChatMessage } from '$lib/stores/chat';

const userMsg: ChatMessage = {
  id: 'u1',
  role: 'user',
  content: 'Olá, como está a Petrobras?',
  status: 'complete',
};

const assistantMsg: ChatMessage = {
  id: 'a1',
  role: 'assistant',
  content: 'A PETR4 está em alta hoje.',
  status: 'complete',
};

const streamingMsg: ChatMessage = {
  id: 'a2',
  role: 'assistant',
  content: '',
  status: 'streaming',
};

const errorMsg: ChatMessage = {
  id: 'a3',
  role: 'assistant',
  content: '',
  status: 'error',
};

const msgWithToolCalls: ChatMessage = {
  id: 'a4',
  role: 'assistant',
  content: 'Busquei os dados.',
  status: 'complete',
  toolCalls: [
    {
      id: 'tc1',
      name: 'b3_quote',
      args: { ticker: 'PETR4' },
      result: { price: 38.12 },
      durationMs: 500,
      status: 'done',
    },
  ],
};

describe('Message', () => {
  it('renders user message with correct class', () => {
    const { container } = render(Message, { props: { message: userMsg } });
    const div = container.querySelector('.message--user');
    expect(div).toBeInTheDocument();
  });

  it('renders assistant message with correct class', () => {
    const { container } = render(Message, { props: { message: assistantMsg } });
    const div = container.querySelector('.message--assistant');
    expect(div).toBeInTheDocument();
  });

  it('renders user message content', () => {
    const { getByText } = render(Message, { props: { message: userMsg } });
    expect(getByText(/Olá, como está a Petrobras/)).toBeInTheDocument();
  });

  it('renders assistant message content', () => {
    const { container } = render(Message, { props: { message: assistantMsg } });
    expect(container.querySelector('.message__content')).toBeInTheDocument();
    expect(container.querySelector('.message__content')?.textContent).toContain('PETR4');
  });

  it('shows thinking pill when streaming with empty content', () => {
    const { container } = render(Message, { props: { message: streamingMsg } });
    // Typing is now shown via .message__tool-activity pill ("Analisando sua pergunta")
    expect(container.querySelector('.message__tool-activity')).toBeInTheDocument();
  });

  it('shows error badge on error status', () => {
    const { getByText } = render(Message, { props: { message: errorMsg } });
    expect(getByText('Erro ao gerar resposta')).toBeInTheDocument();
  });

  it('adds error class on error status', () => {
    const { container } = render(Message, { props: { message: errorMsg } });
    expect(container.querySelector('.message--error')).toBeInTheDocument();
  });

  it('renders tool call activity pill when streaming with running tool', () => {
    const streamingWithTool: ChatMessage = {
      ...msgWithToolCalls,
      status: 'streaming',
      content: '',
      toolCalls: [{ id: 'tc1', name: 'b3_quote', args: {}, result: null, durationMs: 0, status: 'running' }],
    };
    const { container } = render(Message, { props: { message: streamingWithTool } });
    expect(container.querySelector('.message__tool-activity')).toBeInTheDocument();
  });

  it('renders content as markdown - bold text', () => {
    const boldMsg: ChatMessage = {
      ...assistantMsg,
      content: 'Preço: **R$ 38,12**.',
    };
    const { container } = render(Message, { props: { message: boldMsg } });
    const strong = container.querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong?.textContent).toBe('R$ 38,12');
  });

  it('renders links as anchors with target=_blank', () => {
    const linkMsg: ChatMessage = {
      ...assistantMsg,
      content: 'Veja [mais aqui](https://example.com).',
    };
    const { container } = render(Message, { props: { message: linkMsg } });
    const anchor = container.querySelector('a[target="_blank"]');
    expect(anchor).toBeInTheDocument();
    expect(anchor?.getAttribute('rel')).toContain('noopener');
  });

  it('escapes HTML in message content (XSS prevention)', () => {
    const xssMsg: ChatMessage = {
      ...userMsg,
      content: '<script>alert("xss")</script>',
    };
    const { container } = render(Message, { props: { message: xssMsg } });
    // Should not contain actual <script> element
    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).toContain('&lt;script&gt;');
  });

  it('user message shows user avatar (U)', () => {
    const { getByText } = render(Message, { props: { message: userMsg } });
    expect(getByText('U')).toBeInTheDocument();
  });

  it('assistant message does not show user avatar', () => {
    const { queryByText } = render(Message, { props: { message: assistantMsg } });
    expect(queryByText('U')).toBeNull();
  });
});
