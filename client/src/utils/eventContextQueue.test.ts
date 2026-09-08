import { describe, expect, it } from 'vitest';
import { createEventContextQueue, formatEventContext, type EventContext } from './eventContextQueue';

function event(id: string, timestamp: number): EventContext {
  return {
    id,
    type: 'user_interrupted',
    source: 'microphone',
    timestamp,
    summary: `Interruption ${id}`,
  };
}

describe('event context queue', () => {
  it('snapshots events chronologically and consumes only acknowledged events', () => {
    const queue = createEventContextQueue();
    queue.enqueue(event('later', 2));
    queue.enqueue(event('earlier', 1));

    const snapshot = queue.snapshot();
    expect(snapshot.map(item => item.id)).toEqual(['earlier', 'later']);

    queue.consume(['earlier']);
    expect(queue.snapshot().map(item => item.id)).toEqual(['later']);
  });

  it('keeps events added after a request snapshot', () => {
    const queue = createEventContextQueue();
    queue.enqueue(event('included', 1));
    const snapshot = queue.snapshot();
    queue.enqueue(event('arrived-during-request', 2));

    queue.consume(snapshot.map(item => item.id));
    expect(queue.snapshot().map(item => item.id)).toEqual(['arrived-during-request']);
  });

  it('caps old events and formats optional context fields', () => {
    const queue = createEventContextQueue(2);
    queue.enqueue(event('old', 1));
    queue.enqueue(event('middle', 2));
    queue.enqueue({
      ...event('latest', 3),
      taskId: 'explain-hook',
      state: 'paused',
      sideEffects: false,
      guidance: 'Address the new message directly.',
    });

    expect(queue.snapshot().map(item => item.id)).toEqual(['middle', 'latest']);
    expect(formatEventContext(queue.snapshot())).toContain('Task: explain-hook');
    expect(formatEventContext(queue.snapshot())).toContain('Unfinished side effects: no');
  });
});
