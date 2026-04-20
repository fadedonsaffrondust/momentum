import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadOmnirevContext, _clearOmnirevContextCache } from './loader.ts';

describe('loadOmnirevContext', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-knowledge-'));
    _clearOmnirevContextCache();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    _clearOmnirevContextCache();
  });

  it('reads the file from disk', () => {
    const p = path.join(tmpDir, 'omnirev.md');
    fs.writeFileSync(p, '# Omnirev\n\nStatic context.');
    expect(loadOmnirevContext(p)).toBe('# Omnirev\n\nStatic context.');
  });

  it('caches subsequent reads for the same path', () => {
    const p = path.join(tmpDir, 'omnirev.md');
    fs.writeFileSync(p, 'first');
    expect(loadOmnirevContext(p)).toBe('first');

    // Mutate the file; the cached copy should still win.
    fs.writeFileSync(p, 'second');
    expect(loadOmnirevContext(p)).toBe('first');
  });

  it('_clearOmnirevContextCache forces the next call to re-read', () => {
    const p = path.join(tmpDir, 'omnirev.md');
    fs.writeFileSync(p, 'first');
    loadOmnirevContext(p);
    fs.writeFileSync(p, 'second');
    _clearOmnirevContextCache();
    expect(loadOmnirevContext(p)).toBe('second');
  });

  it('switches cache when called with a different path', () => {
    const a = path.join(tmpDir, 'a.md');
    const b = path.join(tmpDir, 'b.md');
    fs.writeFileSync(a, 'alpha');
    fs.writeFileSync(b, 'beta');
    expect(loadOmnirevContext(a)).toBe('alpha');
    expect(loadOmnirevContext(b)).toBe('beta');
  });

  it('loads the installed default (apps/api/src/jarvis/knowledge/omnirev-context.md)', () => {
    // Task 1 installed this file; ensure it is readable and non-empty.
    const content = loadOmnirevContext();
    expect(content.length).toBeGreaterThan(0);
    expect(content).toMatch(/Omnirev/i);
  });
});
