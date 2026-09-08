// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from '../src/providers';
import { useCodingAssistant } from '../src/hooks/useCodingAssistant';

function chatResponse() {
  const body = 'event: done\ndata: {}\n\n';
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function interruption() {
  return {
    id: 'interrupt-1',
    type: 'user_interrupted',
    source: 'stop_button',
    timestamp: 1,
    summary: 'The user interrupted the previous response.',
    state: 'paused' as const,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useCodingAssistant event context', () => {
  it('sends event context invisibly and consumes it after a successful request', async () => {
    const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      return chatResponse();
    }));
    const { result } = renderHook(() => useCodingAssistant(DEFAULT_PROVIDER, DEFAULT_MODEL, null));

    act(() => result.current.enqueueEventContext(interruption()));
    await act(async () => { await result.current.sendMessage('What happened?'); });

    expect(requests[0].messages.at(-1)?.content).toContain('<EventContext>');
    expect(result.current.uiMessages.find(message => message.role === 'user'))
      .toMatchObject({ content: 'What happened?' });

    await act(async () => { await result.current.sendMessage('Continue'); });
    expect(requests[1].messages.at(-1)?.content).toBe('Continue');
  });

  it('carries a stopped response into the next user turn', async () => {
    let resolveFirstRequest!: (response: Response) => void;
    const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      if (requests.length === 1) {
        return new Promise<Response>(resolve => { resolveFirstRequest = resolve; });
      }
      return chatResponse();
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useCodingAssistant(DEFAULT_PROVIDER, DEFAULT_MODEL, null));

    let firstSend!: Promise<void>;
    act(() => { firstSend = result.current.sendMessage('Explain this code'); });
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    act(() => result.current.stopExecution());
    resolveFirstRequest(chatResponse());
    await act(async () => { await firstSend; });

    await act(async () => { await result.current.sendMessage('What does that variable mean?'); });
    const nextMessage = requests[1].messages.at(-1)?.content ?? '';
    expect(nextMessage).toContain('Type: user_interrupted');
    expect(nextMessage).toContain('Source: stop_button');
  });

  it('uses microphone as the sole source for a microphone interruption', async () => {
    let resolveFirstRequest!: (response: Response) => void;
    const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      if (requests.length === 1) {
        return new Promise<Response>(resolve => { resolveFirstRequest = resolve; });
      }
      return chatResponse();
    }));
    const { result } = renderHook(() => useCodingAssistant(DEFAULT_PROVIDER, DEFAULT_MODEL, null));

    let firstSend!: Promise<void>;
    act(() => { firstSend = result.current.sendMessage('Explain this code'); });
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    act(() => result.current.stopExecution('microphone'));
    resolveFirstRequest(chatResponse());
    await act(async () => { await firstSend; });

    await act(async () => { await result.current.sendMessage('Let me clarify'); });
    const nextMessage = requests[1].messages.at(-1)?.content ?? '';
    expect(nextMessage).toContain('Source: microphone');
    expect(nextMessage).not.toContain('Source: stop_button');
  });

  it('retains event context when a request fails', async () => {
    const requests: Array<{ messages: Array<{ role: string; content: string }> }> = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      if (requests.length === 1) throw new Error('offline');
      return chatResponse();
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useCodingAssistant(DEFAULT_PROVIDER, DEFAULT_MODEL, null));

    act(() => result.current.enqueueEventContext(interruption()));
    await act(async () => { await result.current.sendMessage('First attempt'); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.sendMessage('Retry'); });

    expect(requests).toHaveLength(2);
    expect(requests[0].messages.at(-1)?.content).toContain('<EventContext>');
    expect(requests[1].messages.at(-1)?.content).toContain('<EventContext>');
  });
});
