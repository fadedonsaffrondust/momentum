import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';

/* ─────────────── types ��────────────── */

export interface ColumnMapping {
  date: number;
  request: number;
  response: number;
  resolved: number;
}

export interface SheetRow {
  rowIndex: number;
  date: string;
  request: string;
  response: string;
  resolved: boolean;
}

export interface ParsedSheetUrl {
  spreadsheetId: string;
  gid: string;
}

/* ─────────────── column analysis heuristics ─────────────── */

const COLUMN_PATTERNS: Record<keyof ColumnMapping, RegExp> = {
  date: /\b(date|requested|date\s*requested|submitted|when)\b/i,
  request: /\b(requests?|questions?|features?|asks?|descriptions?|items?)\b/i,
  response: /\b(responses?|comments?|reply|replies|answers?|omni\s*rev|notes?)\b/i,
  resolved: /\b(resolved|done|complete[d]?|status|closed)\b/i,
};

export function analyzeColumns(headerRow: string[]): ColumnMapping | null {
  const mapping: Partial<ColumnMapping> = {};
  const used = new Set<number>();

  for (const [field, pattern] of Object.entries(COLUMN_PATTERNS) as [
    keyof ColumnMapping,
    RegExp,
  ][]) {
    for (let i = 0; i < headerRow.length; i++) {
      if (used.has(i)) continue;
      if (pattern.test(headerRow[i]!.trim())) {
        mapping[field] = i;
        used.add(i);
        break;
      }
    }
  }

  if (
    mapping.date !== undefined &&
    mapping.request !== undefined &&
    mapping.response !== undefined &&
    mapping.resolved !== undefined
  ) {
    return mapping as ColumnMapping;
  }

  return null;
}

/* ─────────────── URL parsing ──��──────────── */

export function parseSheetUrl(url: string): ParsedSheetUrl | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;

  const spreadsheetId = match[1]!;
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1]! : '0';

  return { spreadsheetId, gid };
}

/* ─────────────── date normalization ─────────────── */

export function normalizeDate(raw: string, defaultYear?: number): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  if (/^\d{4}[/-]\d{2}[/-]\d{2}$/.test(trimmed)) {
    return trimmed.replace(/-/g, '/');
  }

  // Handle M/D or M/D/YYYY (e.g. "4/1", "3/27/2026")
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (slashMatch) {
    const year = slashMatch[3]
      ? parseInt(slashMatch[3])
      : (defaultYear ?? new Date().getFullYear());
    const m = String(parseInt(slashMatch[1]!)).padStart(2, '0');
    const day = String(parseInt(slashMatch[2]!)).padStart(2, '0');
    return `${year}/${m}/${day}`;
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  }

  return trimmed;
}

const SHEETS_EPOCH = new Date(1899, 11, 30).getTime();

export function dateToSerial(dateStr: string): number {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return 0;
  const d = new Date(parseInt(parts[0]!), parseInt(parts[1]!) - 1, parseInt(parts[2]!));
  if (isNaN(d.getTime())) return 0;
  return Math.round((d.getTime() - SHEETS_EPOCH) / 86_400_000);
}

function parseResolved(value: string): boolean {
  const v = value.trim().toUpperCase();
  return v === 'TRUE' || v === 'YES' || v === '1' || v === 'DONE' || v === 'RESOLVED';
}

/* ─────────────── client ─────────────── */

export class GoogleSheetsClient {
  private sheets: sheets_v4.Sheets;

  constructor(serviceAccountKey: string) {
    const fixed = serviceAccountKey.replace(/\n/g, '\\n').replace(/\\\\n/g, '\\n');
    const credentials = JSON.parse(fixed);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async getSheetName(spreadsheetId: string, gid: string): Promise<string> {
    const res = await this.sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });
    const gidNum = parseInt(gid, 10);
    const sheet = res.data.sheets?.find((s) => s.properties?.sheetId === gidNum);
    return sheet?.properties?.title ?? 'Sheet1';
  }

  async getSheetNames(spreadsheetId: string): Promise<{ gid: number; title: string }[]> {
    const res = await this.sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });
    return (
      res.data.sheets?.map((s) => ({
        gid: s.properties?.sheetId ?? 0,
        title: s.properties?.title ?? 'Sheet1',
      })) ?? []
    );
  }

  async readSheet(spreadsheetId: string, gid: string): Promise<string[][]> {
    const sheetName = await this.getSheetName(spreadsheetId, gid);
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetName,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    return (res.data.values as string[][] | undefined) ?? [];
  }

  async writeRow(
    spreadsheetId: string,
    gid: string,
    rowIndex: number,
    values: string[],
  ): Promise<void> {
    const gidNum = parseInt(gid, 10);
    const cells = values.map((v) => {
      if (v === 'TRUE' || v === 'FALSE') {
        return { userEnteredValue: { boolValue: v === 'TRUE' } };
      }
      const serial = dateToSerial(v);
      if (serial > 0) {
        return {
          userEnteredValue: { numberValue: serial },
          userEnteredFormat: { numberFormat: { type: 'DATE' as const, pattern: 'yyyy/mm/dd' } },
        };
      }
      return { userEnteredValue: { stringValue: v } };
    });
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: {
                sheetId: gidNum,
                startRowIndex: rowIndex,
                endRowIndex: rowIndex + 1,
                startColumnIndex: 0,
                endColumnIndex: values.length,
              },
              rows: [{ values: cells }],
              fields: 'userEnteredValue,userEnteredFormat.numberFormat',
            },
          },
        ],
      },
    });
  }

  async writeAllRows(
    spreadsheetId: string,
    gid: string,
    rows: { rowIndex: number; values: string[] }[],
  ): Promise<void> {
    if (rows.length === 0) return;
    const gidNum = parseInt(gid, 10);
    const cellRows = rows.map((row) => ({
      values: row.values.map((v) => {
        if (v === 'TRUE' || v === 'FALSE') {
          return { userEnteredValue: { boolValue: v === 'TRUE' } };
        }
        const serial = dateToSerial(v);
        if (serial > 0) {
          return {
            userEnteredValue: { numberValue: serial },
            userEnteredFormat: { numberFormat: { type: 'DATE' as const, pattern: 'yyyy/mm/dd' } },
          };
        }
        return { userEnteredValue: { stringValue: v } };
      }),
    }));

    const minRow = Math.min(...rows.map((r) => r.rowIndex));
    const maxRow = Math.max(...rows.map((r) => r.rowIndex));
    const maxCols = Math.max(...rows.map((r) => r.values.length));

    const grid: typeof cellRows = new Array(maxRow - minRow + 1).fill(null).map(() => ({
      values: new Array(maxCols).fill(null).map(() => ({ userEnteredValue: { stringValue: '' } })),
    }));

    for (let i = 0; i < rows.length; i++) {
      grid[rows[i]!.rowIndex - minRow] = cellRows[i]!;
    }

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: {
                sheetId: gidNum,
                startRowIndex: minRow,
                endRowIndex: maxRow + 1,
                startColumnIndex: 0,
                endColumnIndex: maxCols,
              },
              rows: grid,
              fields: 'userEnteredValue,userEnteredFormat.numberFormat',
            },
          },
        ],
      },
    });
  }

  async appendRow(spreadsheetId: string, gid: string, values: string[]): Promise<number> {
    const rawRows = await this.readSheet(spreadsheetId, gid);
    let lastDataRow = 0;
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      // Check columns 0 and 1 (Date and Request) — ignore Resolved column
      // which may have "FALSE" from table formatting on empty rows
      if (row && ((row[0] ?? '').trim() || (row[1] ?? '').trim())) lastDataRow = i;
    }
    const targetRow = lastDataRow + 1;
    await this.writeRow(spreadsheetId, gid, targetRow, values);
    return targetRow;
  }

  async clearRow(spreadsheetId: string, gid: string, rowIndex: number): Promise<void> {
    const sheetName = await this.getSheetName(spreadsheetId, gid);
    await this.sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A${rowIndex + 1}:Z${rowIndex + 1}`,
    });
  }

  async deleteRow(spreadsheetId: string, gid: string, rowIndex: number): Promise<void> {
    const gidNum = parseInt(gid, 10);
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: gidNum,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });
  }

  async rewriteHeaders(spreadsheetId: string, gid: string, headers: string[]): Promise<void> {
    const sheetName = await this.getSheetName(spreadsheetId, gid);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }

  async standardizeSheetFormatting(
    spreadsheetId: string,
    gid: string,
    dataRowCount: number,
  ): Promise<void> {
    const gidNum = parseInt(gid, 10);
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateDimensionProperties: {
              range: { sheetId: gidNum, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 100 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: gidNum, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
              properties: { pixelSize: 400 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: gidNum, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
              properties: { pixelSize: 400 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: gidNum, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
              properties: { pixelSize: 80 },
              fields: 'pixelSize',
            },
          },
          {
            repeatCell: {
              range: { sheetId: gidNum, startColumnIndex: 1, endColumnIndex: 3 },
              cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } },
              fields: 'userEnteredFormat.wrapStrategy',
            },
          },
        ],
      },
    });
    // Checkbox validation may fail on sheets with typed table columns — skip gracefully
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              setDataValidation: {
                range: {
                  sheetId: gidNum,
                  startRowIndex: 1,
                  endRowIndex: dataRowCount + 1,
                  startColumnIndex: 3,
                  endColumnIndex: 4,
                },
                rule: { condition: { type: 'BOOLEAN' }, strict: false, showCustomUi: true },
              },
            },
          ],
        },
      });
    } catch {
      // Table-formatted sheets already have typed columns
    }
  }

  parseRows(rawRows: string[][], mapping: ColumnMapping): SheetRow[] {
    const rows: SheetRow[] = [];
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i]!;
      const request = (row[mapping.request] ?? '').trim();
      if (!request) continue;

      rows.push({
        rowIndex: i,
        date: normalizeDate(row[mapping.date] ?? ''),
        request,
        response: (row[mapping.response] ?? '').trim(),
        resolved: parseResolved(row[mapping.resolved] ?? ''),
      });
    }
    return rows;
  }

  formatRow(
    item: { date: string; request: string; response: string | null; resolved: boolean },
    mapping: ColumnMapping,
  ): string[] {
    const values: string[] = [];
    const maxCol = Math.max(mapping.date, mapping.request, mapping.response, mapping.resolved);
    for (let i = 0; i <= maxCol; i++) values.push('');
    values[mapping.date] = item.date;
    values[mapping.request] = item.request;
    values[mapping.response] = item.response ?? '';
    values[mapping.resolved] = item.resolved ? 'TRUE' : 'FALSE';
    return values;
  }
}
