# Momentum — Brands Feature Spec (V1)

## Context for Claude Code

Extend the existing Momentum app with a new **Brands** section. This is a client/account management layer that lives alongside Today, Backlog, and Parkings. It is designed for operators managing relationships with multiple enterprise customers.

Architecture and UX quality are paramount — many metrics and data types will be added in future iterations. Build with extensibility in mind. Do NOT over-engineer, but do ensure the data model and component boundaries are clean enough to grow.

---

## Core Product Philosophy for Brands

A Brand has **three distinct information layers** that must be kept visually and structurally separate:

1. **North Star** — persistent context that rarely changes (goals, stakeholders, success definition). Always accessible. Never buried.
2. **Pulse** — the living current state (open action items, last contact recency, health signal). The focal point.
3. **Archive** — everything that's been captured over time (meeting history). One click away, never in the way.

Most CRMs fail by flattening all three into one infinite scroll. Do not do that. Treat these as separate UX layers with clear hierarchy.

---

## Navigation

Add "Brands" as a top-level section in the app shell, alongside Tasks, and Parkings.

- Keyboard shortcut: `Cmd/Ctrl + B` opens the Brands section
- From Brands list, `Enter` on a selected brand opens its detail view
- `Escape` from a brand detail view returns to the list

---

## Brand List View

A clean two-column layout:

**Left rail (fixed, ~280px):**

- Search/filter input at the top
- Brand list — each item shows: brand name, health pill, last activity recency (e.g., "2d ago")
- "+ New Brand" button at the bottom
- "Import from file" button below that

**Main content:**

- When no brand is selected: show a minimal empty state with a single line of copy — "Select a brand or create a new one" — and a subtle illustration or geometric accent.
- When a brand is selected: show its detail view (specified below).

**Health pill logic (computed, not stored):**

- **On track** (green dot) — Last meeting within 7 days AND ≤3 open action items AND no overdue items
- **Quiet** (amber dot) — No meeting in 14+ days OR no activity at all
- **Needs attention** (red dot) — Overdue action items OR >5 open action items OR meeting >30 days ago

Health is computed on render from underlying data — it is never stored as a field.

---

## Brand Detail View

Single scrollable page with a strict visual hierarchy. Use collapsible sections with clear state indicators.

### Header (always visible, sticky on scroll)

- Brand name (large, editable on double-click)
- Health pill
- Two primary action buttons on the right: **"+ New Meeting Note"** and **"⋯"** (menu: Edit, Delete, Export)

### Section 1: Pulse (above the fold, default expanded, NOT collapsible)

This is the focal point. A compact, high-density summary of current state.

Three subcomponents laid out horizontally on desktop, stacked on mobile:

**1A — Activity Snapshot:**

- Last meeting: date + title (e.g., "2d ago — One-on-one with Danna")
- Meeting cadence: "Avg 5.2 days between meetings"
- Total meetings logged: "17 meetings"

**1B — Open Action Items (top 3):**

- Show the 3 most recent open action items
- Each item has a title, age ("3d old"), and two inline actions: **"Send to Today"** (pushes to Momentum's Today view with the brand tagged) and **"Mark Done"**
- A "View all X open items" link at the bottom that scrolls to the Action Items section

**1C — Stakeholder Activity:**

- Show up to 4 stakeholders as circular initials with colored backgrounds
- Tooltip on hover: name, role, last mentioned in meeting date
- Click a stakeholder to filter the Meetings archive to only meetings they appeared in

### Section 2: North Star (default expanded, collapsible)

Three editable fields, clearly labeled:

- **Goals** — multiline text, inline-editable (click to edit, save on blur)
- **Key Stakeholders** — structured list with inline add/edit:
  - Each stakeholder: Name (required), Role (optional), Notes (optional)
  - Add new with a single "+" button at the bottom of the list
- **Success Definition** — multiline text

Use minimal affordances — no save button. Auto-save on blur/change with a subtle confirmation (a 1-second muted checkmark).

### Section 3: Action Items (default collapsed, shows count in header)

Section header: "Action Items (X open, Y done)"

When expanded:

- Two tabs: "Open" (default) and "Done"
- Each action item shows: checkbox, text, owner (if set), due date (if set), source meeting link, age
- Inline create at the top: "+ Add action item" with optional owner and due date fields
- Hover actions per item: "Send to Today", "Edit", "Delete"
- Items sent to Today show a subtle icon + link back to the Momentum task

### Section 4: Meeting Notes Archive (default collapsed)

Section header: "Meetings (X)"

When expanded:

- Reverse chronological list
- Each entry shows: date, title, attendees (as initials), 1-line summary
- Click expands inline to show full notes
- Each meeting has: Edit, Delete, and "Extract action items" (re-run LLM extraction) options

**Critical UX rule:** Meetings are NEVER the focal point. Keep this section collapsed by default. Do not auto-expand it on page load.

### Section 5: Raw Context (advanced, default collapsed)

For power users and future extensibility:

- Shows raw imported text (if brand was imported)
- Custom fields slot for future metrics (empty in V1 — but render the section with a "Coming soon" state so the architecture is clear)

---

## Meeting Note Creation Flow

Triggered via "+ New Meeting Note" button or `n` keyboard shortcut from a brand page.

A focused modal (full-width overlay, not a dialog box):

**Fields:**

- Date (defaults to today, date picker)
- Title (text input, with auto-suggestions from past meeting titles, e.g., "Weekly", "One on One with [stakeholder]")
- Attendees (chip input, autocomplete from this brand's stakeholders, allow creating new)
- Notes (large textarea, support basic markdown: `-` for bullets, `→` for action items)
- Decisions (optional, separate textarea)

**On Save:**

1. Save the meeting note
2. Auto-extract action items from notes using a simple regex first (look for lines starting with `→`, `- [ ]`, "Action item:", etc.)
3. If the user has an OpenAI API key configured, offer a button "Enhance with AI" that:
   - Generates a 1-2 sentence summary
   - More robustly extracts action items, decisions, and attendees
   - Suggests new stakeholders found in notes

Keyboard: `Cmd/Ctrl + Enter` saves. `Escape` cancels with a confirmation if content was entered.

---

## Import Feature (The Revolutionary Part)

This is where the product differentiates itself. Users can import existing notes from other systems (ClickUp, Notion, Google Docs exports, raw markdown, etc.) and have them **intelligently transformed** into Momentum's opinionated structure.

### Flow

1. User clicks "Import from file" in the Brands left rail
2. Modal opens with:
   - File picker (accept `.md`, `.txt`, `.docx` — start with `.md` only for V1, add others in comments for future)
   - OpenAI API key input (if not already configured in settings — store in localStorage, obfuscate display)
   - Model selector (default `gpt-4o-mini` for cost, option for `gpt-4o` for quality) — can default and hide for V1 simplicity
   - "Analyze" button

3. On Analyze:
   - Read file contents
   - Show a loading state: "Analyzing your notes... (this usually takes 10-30 seconds)"
   - Make an OpenAI API call with structured output (JSON mode) — see schema below
   - If OpenAI returns an error (invalid key, rate limit, etc.), surface it clearly

4. Preview screen:
   - Show the parsed Brand with ALL fields populated and editable
   - Layout mirrors the final Brand Detail view so user can see exactly what they're about to create
   - Show counts: "Extracted: 7 meetings, 12 action items, 4 stakeholders"
   - Two buttons: "Create Brand" (saves to localStorage) and "Cancel" (discards)

5. On Create:
   - Save the full brand with all meetings, action items, stakeholders
   - Navigate to the new brand's detail view
   - Show a toast: "Imported 'Boudin Bakery' — 7 meetings, 12 action items"

### LLM Prompt (embed in the code)

Use this EXACT system prompt for the OpenAI API call:

```
You are a structured data extractor for a product called Momentum. You will receive messy, human-written client notes (often exported from ClickUp, Notion, or similar tools) and must transform them into Momentum's clean opinionated schema.

Momentum separates client information into three layers:
1. North Star — goals, key stakeholders, success definition
2. Pulse — current open action items and activity
3. Archive — individual meeting notes with summaries, decisions, and action items

DO NOT preserve the source tool's structure. DO NOT include sections like "Agenda", "Features", "Notes", "Next steps" as separate fields — fold them appropriately into `rawNotes` or `decisions` or `actionItems`.

Extract and return JSON matching this exact schema. Only these fields. Nothing else.

Rules:
- If a field is not present in the source, return an empty string or empty array. Do not invent content.
- Deduplicate stakeholders by name (case-insensitive). Infer roles only if clearly stated.
- For each meeting, generate a 1-2 sentence `summary` from the notes. Be factual — no embellishment.
- Extract `actionItems` aggressively — look for: lines starting with →, dashes, "Action items:", "Next steps:", "To do:", or imperative phrasing ("Set up X", "Follow up with Y").
- `decisions` are only things explicitly framed as decisions or conclusions. Do not over-extract.
- Preserve original phrasing for action items and decisions — do not rephrase.
- Meeting dates: parse flexible formats (YYYY-MM-DD, "March 16", "3/16/2026") and normalize to YYYY-MM-DD.
- If a meeting date is ambiguous, use your best inference based on context/order in the document.

Return ONLY valid JSON. No markdown code blocks, no explanations.
```

### JSON Schema for OpenAI Response

```json
{
  "name": "string — brand name, extracted from H1 or first line",
  "goals": "string — may be empty",
  "successDefinition": "string — may be empty",
  "stakeholders": [
    { "name": "string", "role": "string (may be empty)", "notes": "string (may be empty)" }
  ],
  "meetings": [
    {
      "date": "YYYY-MM-DD",
      "title": "string",
      "attendees": ["string"],
      "summary": "1-2 sentence LLM-generated summary",
      "rawNotes": "string — cleaned but mostly preserved original notes",
      "decisions": ["string"],
      "actionItems": ["string"]
    }
  ]
}
```

After receiving the response, the app converts this JSON into its internal data model (Brand + Meeting Notes + Action Items all linked), generates IDs, sets timestamps, and shows the preview.

---

## Data Model

```javascript
// Brand
{
  id: "uuid",
  name: "Boudin Bakery",
  goals: "...",
  successDefinition: "...",
  stakeholders: [
    {
      id: "uuid",
      name: "Danna",
      role: "CSM",
      notes: ""
    }
  ],
  customFields: {}, // extensible for future metrics
  createdAt: "iso",
  updatedAt: "iso",
  importedFrom: "clickup" | null,
  rawImportContent: "string" | null // preserved for reference
}

// Meeting Note
{
  id: "uuid",
  brandId: "brand uuid",
  date: "YYYY-MM-DD",
  title: "string",
  attendees: ["name", "name"], // match to stakeholder names
  summary: "string",
  rawNotes: "string",
  decisions: ["string"],
  createdAt: "iso"
}

// Action Item
{
  id: "uuid",
  brandId: "brand uuid",
  meetingId: "meeting uuid" | null, // null if created ad-hoc
  text: "string",
  status: "open" | "done",
  owner: "string (stakeholder name or 'me')",
  dueDate: "YYYY-MM-DD" | null,
  linkedMomentumTaskId: "uuid" | null, // set when "Send to Today" is clicked
  createdAt: "iso",
  completedAt: "iso" | null
}
```

**Important:** Store brands, meetings, and action items as separate top-level arrays in localStorage — do not nest them inside brands. This makes querying, filtering, and cross-linking with the Today view trivial, and supports future scaling (indexing, syncing, etc.).

---

## "Send to Today" — The Cross-Linking Feature

This is the feature that turns Momentum from a CRM-adjacent tool into an execution system.

When a user clicks "Send to Today" on an action item:

1. Create a new task in Momentum's main task list with:
   - `title`: the action item text
   - `role`: null or a special "client" role (you may add a built-in "Client Work" role on first use)
   - `scheduledDate`: today
   - `status`: "todo"
   - `linkedActionItemId`: the action item's id
   - A visual indicator: small brand badge on the task card showing the brand name

2. Update the action item:
   - Set `linkedMomentumTaskId` to the new task's id
   - Show a small "In Today" badge on the action item

3. When the user completes the task in the Today view:
   - Also mark the linked action item as `done`
   - Fire a subtle notification: "Action item closed for [Brand]"

4. Conversely, if the action item is marked done in the Brand view:
   - Complete the linked Today task as well

This bidirectional sync is critical. Do not cut corners here.

---

## Import Feature — Edge Cases to Handle

- **Empty snapshot fields** (like the Boudin example has) — set goals/successDefinition/stakeholders to empty, do not fail
- **Meetings with missing action item sections** — return empty arrays
- **Duplicate meeting dates** — preserve both, they are distinct meetings
- **Stakeholder name variations** ("Danna" vs "danna") — normalize to most common casing
- **Malformed file** — show clear error: "Could not parse file. Make sure it's a .md, .txt, or .docx file."
- **API key missing** — inline prompt to enter one, store in localStorage
- **API rate limit or error** — show the actual error message from OpenAI, don't mask it
- **File too large** — if file is >50k characters, truncate to most recent 50k and warn the user (older meetings will not be imported)

---

## Visual Design Notes

- Maintain consistency with the existing Momentum design system (dark mode default, monospace for task titles, serif or clean sans for brand names and long-form text)
- Brand names in the list use the serif font (larger, more presence)
- Meeting dates and metadata use monospace (precise, data-like)
- Health pills: use small colored dots (6px) with subtle glow, not solid pills — keeps it elegant
- Section headers in the detail view use a subtle underline, not boxes — minimal chrome
- All transitions: 150ms ease-out, match the existing app

---

## What "Done" Looks Like for This Iteration

1. Users can navigate to the Brands section via `Cmd/Ctrl + B`
2. Users can manually create a new brand with goals, stakeholders, and success definition
3. Users can import a `.md` file and have it transformed into a structured brand via OpenAI
4. Users can view a brand's detail page with clear separation between Pulse, North Star, and Archive
5. Users can create, edit, and complete meeting notes
6. Users can create action items and send them to their Today view with bidirectional sync
7. Health pills compute correctly and update when data changes
8. All data persists in localStorage and is included in the global export/import JSON

---

## Out of Scope for This Iteration (Document for Future)

Do not build these yet, but reserve schema space so they can slot in cleanly later:

- Brand-level metrics (revenue, deal stage, contract dates) — goes in `customFields`
- Stakeholder sentiment tracking
- Email integration / thread capture
- Meeting transcription from audio files
- LLM-generated brand summary across all meetings ("What's happened with Boudin this quarter?")
- Search across all brands/meetings
- Multi-user collaboration / sharing

---

## Final Note on Architecture

The data model above is deliberately normalized (brands, meetings, action items as separate collections linked by IDs). This is the right call for extensibility — resist any suggestion to nest meetings or action items inside the brand object. The cross-linking with Momentum's Today view alone justifies this architecture.

Component structure should mirror the data: a `BrandListView`, `BrandDetailView`, `PulseSection`, `NorthStarSection`, `ActionItemsSection`, `MeetingsArchiveSection`, and `ImportModal`. Keep them as small, focused modules.
