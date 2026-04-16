const PATTERNS = [
  /^→\s*(.+)/,
  /^\/todo\s+(.+)/i,
  /^-\s*\[\s*\]\s*(.+)/,
  /^action\s*items?:\s*(.+)/i,
  /^next\s*steps?:\s*(.+)/i,
  /^to\s*do:\s*(.+)/i,
];

export function extractActionItems(notes: string): string[] {
  const items: string[] = [];
  for (const line of notes.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const pattern of PATTERNS) {
      const match = trimmed.match(pattern);
      if (match?.[1]) {
        items.push(match[1].trim());
        break;
      }
    }
  }
  return items;
}
