import { useCallback } from 'react';

interface UseSmartTextareaOptions {
  value: string;
  onChange: (newValue: string) => void;
}

export function useSmartTextarea({ value, onChange }: UseSmartTextareaOptions) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.metaKey || e.ctrlKey) return;

      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd } = textarea;

      if (e.key === 'Tab') {
        e.preventDefault();
        const result = handleTabKey(value, selectionStart, selectionEnd, e.shiftKey);
        onChange(result.newText);
        requestAnimationFrame(() => {
          textarea.setSelectionRange(result.newCursor, result.newSelectionEnd);
        });
        return;
      }

      if (e.key === ' ') {
        const result = handleSpaceKey(value, selectionStart);
        if (result) {
          e.preventDefault();
          onChange(result.newText);
          requestAnimationFrame(() => {
            textarea.setSelectionRange(result.newCursor, result.newCursor);
          });
          return;
        }
      }

      if (e.key === 'Enter') {
        const result = handleEnterKey(value, selectionStart);
        if (result) {
          e.preventDefault();
          onChange(result.newText);
          requestAnimationFrame(() => {
            textarea.setSelectionRange(result.newCursor, result.newCursor);
          });
          return;
        }
      }
    },
    [value, onChange],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  return { onKeyDown, onChange: handleChange };
}

function getLineContext(text: string, cursorPos: number) {
  const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
  const lineEnd = text.indexOf('\n', cursorPos);
  const lineEndActual = lineEnd === -1 ? text.length : lineEnd;
  const currentLine = text.slice(lineStart, lineEndActual);
  const cursorCol = cursorPos - lineStart;
  return { lineStart, lineEnd: lineEndActual, currentLine, cursorCol };
}

const BULLET_RE = /^(\s*)(- )(.*)$/;
const NUMBERED_RE = /^(\s*)(\d+)\.\s(.*)$/;
const TODO_RE = /(?:^|\s)\/todo$/;

export function handleEnterKey(
  text: string,
  cursorPos: number,
): { newText: string; newCursor: number } | null {
  const { lineStart, lineEnd, currentLine, cursorCol } = getLineContext(text, cursorPos);

  // Check /todo expansion first
  const beforeCursor = text.slice(0, cursorPos);
  if (TODO_RE.test(beforeCursor)) {
    const todoStart = cursorPos - 5;
    const newText = text.slice(0, todoStart) + '→ ' + text.slice(cursorPos);
    return { newText, newCursor: todoStart + 2 };
  }

  // Only auto-continue if cursor is at end of line (ignoring trailing whitespace)
  const contentAfterCursor = currentLine.slice(cursorCol).trim();
  if (contentAfterCursor.length > 0) return null;

  // Bullet list
  const bulletMatch = currentLine.match(BULLET_RE);
  if (bulletMatch) {
    const [, indent, marker, content] = bulletMatch;
    if (content!.trim().length === 0) {
      // Empty bullet — exit list mode
      const newText = text.slice(0, lineStart) + text.slice(lineEnd);
      return { newText, newCursor: lineStart };
    }
    // Continue bullet
    const insertion = '\n' + indent + marker;
    const newText = text.slice(0, cursorPos) + insertion + text.slice(cursorPos);
    return { newText, newCursor: cursorPos + insertion.length };
  }

  // Numbered list
  const numMatch = currentLine.match(NUMBERED_RE);
  if (numMatch) {
    const [, indent, numStr, content] = numMatch;
    if (content!.trim().length === 0) {
      // Empty number — exit list mode
      const newText = text.slice(0, lineStart) + text.slice(lineEnd);
      return { newText, newCursor: lineStart };
    }
    const nextNum = parseInt(numStr!, 10) + 1;
    const insertion = '\n' + indent + nextNum + '. ';
    const newText = text.slice(0, cursorPos) + insertion + text.slice(cursorPos);
    return { newText, newCursor: cursorPos + insertion.length };
  }

  return null;
}

export function handleTabKey(
  text: string,
  cursorPos: number,
  selectionEnd: number,
  shift: boolean,
): { newText: string; newCursor: number; newSelectionEnd: number } {
  const firstLineStart = text.lastIndexOf('\n', cursorPos - 1) + 1;
  const lastLineEnd = text.indexOf('\n', selectionEnd);
  const lastLineEndActual = lastLineEnd === -1 ? text.length : lastLineEnd;

  const before = text.slice(0, firstLineStart);
  const block = text.slice(firstLineStart, lastLineEndActual);
  const after = text.slice(lastLineEndActual);

  const lines = block.split('\n');
  let cursorDelta = 0;
  let endDelta = 0;
  let firstLineDelta = 0;

  const newLines = lines.map((line, i) => {
    if (shift) {
      if (line.startsWith('  ')) {
        if (i === 0) firstLineDelta = -2;
        endDelta -= 2;
        return line.slice(2);
      }
      return line;
    } else {
      if (i === 0) firstLineDelta = 2;
      endDelta += 2;
      return '  ' + line;
    }
  });

  cursorDelta = firstLineDelta;
  const newText = before + newLines.join('\n') + after;
  const newCursor = Math.max(firstLineStart, cursorPos + cursorDelta);
  const newSelEnd = Math.max(newCursor, selectionEnd + endDelta);

  return { newText, newCursor, newSelectionEnd: newSelEnd };
}

export function handleSpaceKey(
  text: string,
  cursorPos: number,
): { newText: string; newCursor: number } | null {
  if (cursorPos < 5) return null;
  const beforeCursor = text.slice(0, cursorPos);
  if (!TODO_RE.test(beforeCursor)) return null;

  const todoStart = cursorPos - 5;
  const charBefore = todoStart > 0 ? text[todoStart - 1] : undefined;
  if (charBefore !== undefined && charBefore !== '\n' && charBefore !== ' ' && charBefore !== '\t') {
    return null;
  }

  const newText = text.slice(0, todoStart) + '→ ' + text.slice(cursorPos);
  return { newText, newCursor: todoStart + 2 };
}
