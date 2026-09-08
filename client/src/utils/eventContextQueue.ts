export type EventContextState = 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface EventContext {
  id: string;
  type: string;
  source: string;
  timestamp: number;
  summary: string;
  taskId?: string;
  state?: EventContextState;
  sideEffects?: boolean;
  guidance?: string;
}

export function createEventContextQueue(maxSize = 20) {
  let events: EventContext[] = [];

  return {
    enqueue(event: EventContext) {
      events = [...events, event]
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-maxSize);
    },

    snapshot(): EventContext[] {
      return events.map(event => ({ ...event }));
    },

    consume(ids: readonly string[]) {
      const consumed = new Set(ids);
      events = events.filter(event => !consumed.has(event.id));
    },

    clear() {
      events = [];
    },
  };
}

export function formatEventContext(events: readonly EventContext[]): string {
  if (events.length === 0) return '';

  const entries = events.map(event => {
    const details = [
      `Type: ${event.type}`,
      `Source: ${event.source}`,
      event.taskId && `Task: ${event.taskId}`,
      event.state && `State: ${event.state}`,
      `Summary: ${event.summary}`,
      event.sideEffects !== undefined && `Unfinished side effects: ${event.sideEffects ? 'yes' : 'no'}`,
      event.guidance && `Guidance: ${event.guidance}`,
    ].filter(Boolean);
    return details.join('\n');
  });

  return `<EventContext>\n${entries.join('\n\n')}\n</EventContext>`;
}
