# Momentum — Feature Requests Tab (Google Sheets Two-Way Sync)

## Context for Claude Code

Add a **"Feature Requests"** subtab to each brand's detail page. This tab displays feature requests that clients submit, synced bidirectionally with a Google Spreadsheet per brand. Both the brand's stakeholders and Omnirev users can make edits from either side — Google Sheets or Momentum — and changes reflect in both places.

**Important architectural constraint:** The Google Drive MCP connector is available for reading/writing Google Sheets. Use it for all Google Sheets operations. Do NOT use the Google Sheets REST API directly or require OAuth setup — the MCP connector handles auth.

---

## The Standardization Decision

Each brand currently has its own Google Sheet with slightly different column names and orders. Rather than building dynamic schema detection, Momentum enforces a **canonical schema**. On first connection, the sheet is analyzed and migrated to the standard format.

### Momentum's Canonical Schema

Four columns, fixed order, fixed names:

| Column | Header Name | Type | Description |
|--------|-------------|------|-------------|
| A | Date | Date string (YYYY/MM/DD) | When the request was submitted |
| B | Request | Text | The feature request description |
| C | Response | Text | Omnirev's response/comment |
| D | Resolved | Boolean (TRUE/FALSE) | Whether the request has been addressed |

These column names are deliberately client-friendly — this sheet is shared with the brand's stakeholders.

---

## Tab Placement & Navigation

Looking at the current brand page (which has "Overview" and "Action Items & Meetings" tabs), add **"Feature Requests"** as a third tab.

```
Overview | Action Items & Meetings (12) | Feature Requests (8)
```

The count in the tab label shows the number of **open (unresolved)** feature requests. Update this count whenever data changes.

**Keyboard shortcut:** `f` when on a brand detail page switches to the Feature Requests tab.

---

## Feature Requests Tab — Layout

### Header Bar

- **Left side:** "Feature Requests" title + count badge showing "X open, Y resolved"
- **Right side:** Three elements:
  - **"+ New Request"** button — adds a new row inline
  - **"Sync"** button with a subtle refresh icon — triggers a manual sync with Google Sheets
  - **"Open in Sheets" link** — small external link icon, opens the connected Google Sheet in a new tab
  - **Last synced timestamp** — subtle text: "Synced 2m ago"

### Filter Bar

A simple horizontal filter below the header:

- **Status filter:** "All" | "Open" (default) | "Resolved" — radio-style toggle
- **Search:** text input that filters requests by keyword (searches Request and Response fields)
- **Sort:** by Date (newest first, default) or by Status (open first, then resolved)

### Request Table

Display feature requests as a clean table (not cards — tabular data should look tabular).

| Date | Request | Response | Resolved | Actions |
|------|---------|----------|----------|---------|

**Column behavior:**

- **Date:** Displayed as human-friendly format (e.g., "Apr 14, 2026"). Sorted newest-first by default.
- **Request:** The main content column. Wraps text. Takes ~40% of table width.
- **Response:** Omnirev's response. Wraps text. Takes ~35% of table width. If empty, shows a subtle placeholder: "No response yet" in muted text.
- **Resolved:** A checkbox. Toggling it immediately updates the status AND syncs the change to Google Sheets.
- **Actions:** Hover-only column. Shows edit (pencil) and delete (trash) icons.

**Inline editing:** Double-clicking any cell (Date, Request, Response) enters edit mode for that cell. Changes auto-save on blur and sync to the sheet. The Resolved checkbox is always interactive (no double-click needed).

**Empty state:** If no feature requests exist yet, show: "No feature requests for this brand. Connect a Google Sheet or add one manually."

### New Request Flow

Clicking "+ New Request" or pressing `n` while on the Feature Requests tab:

1. Adds a new row at the top of the table, in edit mode
2. Date is pre-filled with today's date
3. Cursor focuses on the Request field
4. User types the request, optionally tabs to Response
5. On blur or `Enter`, the row saves and syncs to Google Sheets
6. `Escape` cancels and removes the row if empty

---

## Google Sheets Connection — Setup Flow

### Per-Brand Configuration

Each brand has a **Google Sheet connection** configured in the brand's settings (accessible via the "⋯" menu → "Connect Feature Requests Sheet" or through the Feature Requests tab empty state).

**Setup modal:**

1. **Sheet URL input:** User pastes the full Google Sheets URL (e.g., `https://docs.google.com/spreadsheets/d/1J4Ggq.../edit`)
2. **Parse the URL** to extract the spreadsheet ID and optionally the gid (sheet/tab number)
3. **"Analyze Sheet" button:** Reads the sheet via the Google Drive MCP, detects the current column structure
4. **Column mapping preview:** Shows what Momentum detected:
   - "We found these columns: [Request, Date Requested, Response, Resolved?]"
   - "We'll remap them to Momentum's standard format: [Date, Request, Response, Resolved]"
   - Shows a before/after preview of the header row
5. **"Connect & Standardize" button:** Rewrites the header row to the canonical format, reorders columns if needed, and saves the connection
6. Alternatively: **"Connect Without Changes"** — for sheets that are already in the right format or where the user doesn't want headers changed (Momentum will map internally using detected positions, but this is the less reliable path — show a warning)

### First-Time Migration Logic

When analyzing an existing sheet, use these heuristics to map columns:

| If header contains... | Maps to |
|----------------------|---------|
| "date", "requested", "date requested" | Date |
| "request", "question", "feature", "ask" | Request |
| "response", "comment", "reply", "answer", "omnirev" | Response |
| "resolved", "done", "complete", "status" | Resolved |

Case-insensitive matching. If a column can't be matched, show it in the preview as "Unknown — will be ignored" and let the user manually assign it.

After mapping, rewrite the header row and reorder columns to match the canonical order (Date, Request, Response, Resolved). Preserve all existing data rows — only the header and column order change.

**If the sheet has extra columns beyond the four:** Preserve them. Move them to columns E+ after the canonical four. Don't delete data.

---

## Two-Way Sync Architecture

### Sync Model: Pull-on-Open + Push-on-Change

This is NOT real-time sync. It's event-driven:

**Pull (Sheet → Momentum):**
- When the user opens the Feature Requests tab, Momentum reads the full sheet via Google Drive MCP
- Parse the sheet data, compare with Momentum's localStorage copy
- Update Momentum's local data with any changes from the sheet
- Show a brief "Syncing..." indicator during this fetch
- Also triggered by clicking the "Sync" button manually

**Push (Momentum → Sheet):**
- When the user edits a cell, adds a row, deletes a row, or toggles Resolved in Momentum, immediately write the change back to Google Sheets via the MCP
- Changes are written row-by-row — not by rewriting the entire sheet

### Conflict Resolution

Since this is not real-time, conflicts can occur (someone edits the sheet while someone else edits Momentum). Handle this simply:

**Last-write-wins.** On pull, if a row exists in both places and the content differs, the Google Sheet version wins (because the sheet is the shared artifact the client also uses). On push, Momentum's version overwrites the sheet cell.

This is deliberately simple. For V1, true conflict resolution (merge, diff, user-choice) is overengineered. The practical scenario is: either the brand edits the sheet, or you edit Momentum, rarely both at the exact same time on the same row.

**Row matching:** Match rows between Momentum and Google Sheets by **row position** (row number in the sheet). Momentum stores the row index for each feature request. When a new row is added in Momentum, it's appended to the sheet. When a new row appears in the sheet (detected on pull by having more data rows than Momentum's last known count), it's added to Momentum.

**Deleted rows:** If a row is deleted in Momentum, remove it from the sheet. If a row disappears from the sheet (detected by row count decreasing or content shifting), mark it as deleted in Momentum and remove it from the local view. Show a subtle toast: "1 request was removed from the sheet."

### Sync Indicators

- **Tab-level:** The Feature Requests tab shows a small dot indicator if the local data is stale (last synced > 5 minutes ago)
- **Row-level:** While a push is in progress, the affected row shows a subtle saving indicator (a small spinner replacing the action icons)
- **Error state:** If a write fails (MCP error, permission issue), show a toast: "Failed to sync to Google Sheets. Your changes are saved locally." Add a subtle warning icon to the row.

---

## Data Model

### Brand — New Fields
```javascript
{
  // ...existing brand fields...
  featureRequests: {
    sheetId: "1J4GgqnxLJ_I8UkgCmN_mHYgdhIYWAcIXEIObolj7ciQ",  // extracted from URL
    sheetGid: "0",                     // tab/gid, default "0"
    sheetUrl: "https://docs.google.com/spreadsheets/d/.../edit",  // full URL for "Open in Sheets" link
    connected: true,
    lastSyncedAt: "iso",
    columnMapping: {                   // stored after initial analysis, used if user chose "Connect Without Changes"
      date: 0,                         // column index (0-based)
      request: 1,
      response: 2,
      resolved: 3
    }
  }
}
```

### Feature Request Item
```javascript
{
  id: "uuid",                          // Momentum's internal ID
  brandId: "brand uuid",
  sheetRowIndex: 4,                    // 0-based row index in the Google Sheet (row 0 = header)
  date: "2026/04/14",
  request: "Can we add an industry for Car Dealerships?",
  response: "We need some examples of Car Dealership accounts to review.",
  resolved: false,
  lastModifiedAt: "iso",               // used for conflict detection
  syncStatus: "synced" | "pending" | "error"  // current sync state
}
```

Store feature requests as a top-level array in localStorage (alongside brands, meetings, action items) — linked to brands by `brandId`. This maintains the normalized architecture established in earlier specs.

---

## Google Drive MCP Integration

Use the connected Google Drive MCP tools for all sheet operations. The available tools are:

- `read_file_content` — reads the full sheet content (returns as table/text)
- `create_file` — creates new files (not needed for existing sheets)

**Important limitation:** The Google Drive MCP `read_file_content` returns sheet data as formatted text (markdown table or CSV-like). Parsing this into structured rows is necessary. Write a robust parser that handles:
- Empty cells (represented as empty strings between delimiters)
- Cells with commas in content (quoted strings)
- Mixed date formats (normalize to YYYY/MM/DD on import)
- TRUE/FALSE as strings → convert to boolean

**For writing back to sheets:** Use the MCP's file update capabilities. If the MCP doesn't support cell-level writes, the fallback approach is:
1. Read the full sheet
2. Modify the in-memory representation
3. Write the full sheet back

Document this limitation in the code — if cell-level writes become available in the MCP later, switch to that approach for better performance.

---

## Feature Requests Tab — Interaction Details

### Keyboard Shortcuts (within Feature Requests tab)

| Key | Action |
|-----|--------|
| `n` | Add new feature request |
| `j/k` or `↓/↑` | Navigate between rows |
| `Enter` | Edit selected row |
| `Space` | Toggle Resolved on selected row |
| `r` | Trigger manual sync |
| `Escape` | Exit edit mode / deselect |

### Visual Design

- Match the existing Momentum dark theme
- Table rows alternate with subtle background variation for readability
- Resolved requests: show with muted/dimmed text and a strikethrough on the Request column — visually de-emphasized but not hidden (unless filtered out)
- The Resolved checkbox uses the existing accent color (blue) when checked
- Response column: if empty, show "No response yet" in muted italic text as placeholder
- Dates displayed in a monospace font (consistent with Momentum's style for data fields)

### Resolved Requests — Visual Treatment

When a request is marked Resolved:
- The row text becomes muted (opacity ~0.5)
- Request text gets a subtle strikethrough
- The row drops to the bottom of the list (below open requests) when sorted by status
- The "Open" filter hides resolved rows entirely

---

## Cross-Feature Integration

### Feature Requests → Action Items

When viewing a feature request, a user should be able to convert it to an action item with one click. Add a small "→ Create Action Item" option in the row's action menu (hover).

On click:
1. Creates an Action Item on the brand with the request text as the item text
2. Links back to the feature request (store `featureRequestId` on the action item)
3. When the action item is completed, prompt: "Also mark the feature request as Resolved?"

This bridges the gap between "client asked for X" and "we need to do X."

### Summary Stats in Pulse

Add to the brand's Pulse section (Activity Snapshot area):
- "Feature Requests: X open, Y resolved" — one line, links to the Feature Requests tab

---

## Edge Cases

**Sheet is empty (no data rows):** Show the empty state. Allow adding requests from Momentum — they'll be pushed to the sheet.

**Sheet has data but unrecognizable columns:** During setup, show: "We couldn't automatically detect the column structure. Please map each column manually." Show dropdowns for each detected column → canonical field mapping.

**Sheet is deleted or access revoked:** On sync attempt, if the MCP returns an error, show: "Unable to access the Google Sheet. The file may have been deleted or your access revoked. Reconnect in settings." Feature requests remain visible locally from the last successful sync, with a warning banner.

**Brand has no sheet connected:** The Feature Requests tab shows: "Connect a Google Sheet to track feature requests for this brand." with a "Connect Sheet" button that opens the setup modal. The user can also add requests manually (stored locally only, no sync) and connect a sheet later — on connection, local requests are pushed to the sheet.

**Very large sheets (500+ rows):** Read the full sheet on pull (Google Sheets can handle this). In Momentum's UI, paginate at 50 rows per page with a "Load more" at the bottom. Keep full data in localStorage — only the rendering is paginated.

**Multiple tabs in one spreadsheet:** The `gid` parameter identifies which tab to use. During setup, if the spreadsheet has multiple tabs, show a tab selector: "This spreadsheet has 3 tabs. Which one contains feature requests?" List tab names for selection.

**Date format inconsistencies:** The sheets currently have mixed formats ("2026/04/06", "April 14", "4/9", "30-Mar"). On first sync, normalize all dates to YYYY/MM/DD format. On write-back, always use YYYY/MM/DD. Document this normalization in the setup preview so the user isn't surprised.

**Empty rows in the middle of the sheet:** Skip them during import. Don't create empty feature request records. If the sheet has trailing empty rows (very common — all three current sheets have hundreds), ignore them.

---

## What "Done" Looks Like

1. Each brand page has a "Feature Requests" tab with an open-request count
2. Users can connect a Google Sheet URL per brand
3. On first connection, the sheet is analyzed and optionally standardized to Momentum's column format
4. Feature requests display in a clean, editable table within Momentum
5. Edits in Momentum (add, edit, toggle resolved, delete) push to Google Sheets
6. Edits in Google Sheets are pulled into Momentum when the tab is opened or manually synced
7. Users can add new requests from Momentum and have them appear in the shared sheet
8. Feature requests can be converted to action items with one click
9. The Pulse section shows a feature request summary

---

## Out of Scope for V1

- **Real-time sync / webhooks.** Google Sheets doesn't have a simple webhook for cell changes. Real-time would require Google Apps Script triggers — too much infrastructure for V1.
- **Multi-sheet per brand.** One sheet per brand. If a brand needs multiple sheets (e.g., separate sheets for features vs. bugs), that's a V2 enhancement.
- **Inline comments or threads.** No discussion thread per request. The Response column serves this purpose for now.
- **Priority or categorization columns.** V1 is the four canonical columns only. Future iterations can add Priority, Category, Assignee — the standardized schema approach makes this easy to extend.
- **Automatic migration of all existing sheets.** V1 migrates on connection. A bulk "standardize all sheets" tool can come later.
- **Google Sheets API (direct).** We use the Google Drive MCP exclusively. If MCP limitations block writes, document the gap and implement a read-only mode with manual sheet editing as the write path.
