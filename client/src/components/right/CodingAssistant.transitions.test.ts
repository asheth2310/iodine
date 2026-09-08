import { describe, expect, it } from 'vitest';
import { RESPONSE_TRANSITIONS } from './CodingAssistant';

describe('response narration transitions', () => {
  it('includes the context transition for ordinary narrated turns', () => {
    expect(RESPONSE_TRANSITIONS.default).toContain('That gives us the context.');
  });

  it('uses short transitions for larger unskippable batches', () => {
    expect(RESPONSE_TRANSITIONS.unskippable).toEqual(['Alright.', 'Okay.']);
  });
});
