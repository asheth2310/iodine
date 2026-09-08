export function hasConflictMarkers(content: string): boolean {
  return content.includes('<<<<<<<') && content.includes('=======') && content.includes('>>>>>>>');
}

export function extractBranchNames(content: string): { ours: string; theirs: string } {
  return {
    ours:   content.match(/^<<<<<<< (.+)$/m)?.[1] ?? 'Ours',
    theirs: content.match(/^>>>>>>> (.+)$/m)?.[1] ?? 'Theirs',
  };
}

/**
 * States for the conflict-marker state machine. 'base' is the diff3 merge-base
 * section between `<<<<<<<` and `=======` (introduced by `merge.conflictStyle=diff3`).
 * Lines in this section belong to neither side and must be skipped for both
 * the "ours" and "theirs" resolved versions.
 */
type ConflictState = 'normal' | 'ours' | 'theirs' | 'base';

/** Full file with every conflict resolved by taking the ours side. */
export function buildOursVersion(content: string): string {
  const out: string[] = [];
  let state: ConflictState = 'normal';
  for (const line of content.split('\n')) {
    if (line.startsWith('<<<<<<<')) { state = 'ours';   continue; }
    if (line.startsWith('|||||||')) { state = 'base';   continue; }
    if (line.startsWith('=======')) { state = 'theirs'; continue; }
    if (line.startsWith('>>>>>>>')) { state = 'normal'; continue; }
    if (state === 'base' || state === 'theirs') continue;
    out.push(line);
  }
  return out.join('\n');
}

/** Full file with every conflict resolved by taking the theirs side. */
export function buildTheirsVersion(content: string): string {
  const out: string[] = [];
  let state: ConflictState = 'normal';
  for (const line of content.split('\n')) {
    if (line.startsWith('<<<<<<<')) { state = 'ours';   continue; }
    if (line.startsWith('|||||||')) { state = 'base';   continue; }
    if (line.startsWith('=======')) { state = 'theirs'; continue; }
    if (line.startsWith('>>>>>>>')) { state = 'normal'; continue; }
    if (state === 'base' || state === 'ours') continue;
    out.push(line);
  }
  return out.join('\n');
}

/** localStorage key for the in-progress result for a given file path. */
export function conflictResultKey(filePath: string): string {
  return `iodine:conflict-result:${filePath}`;
}
