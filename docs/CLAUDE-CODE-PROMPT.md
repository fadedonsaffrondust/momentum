# Prompt: Build "Momentum" — A Keyboard-First Daily Task Operating System

## What to Build

Build a single-page web app called **Momentum** — a daily task operating system designed for startup founders and operators who wear multiple hats and need to move fast. This is NOT a traditional todo list. It's an opinionated daily execution engine.

**Tech stack:** HTML + CSS + vanilla JavaScript in a single `index.html` file. No frameworks, no build tools, no dependencies. All data persists in localStorage. The entire app must load instantly and work offline.

---

## Core Philosophy

Most todo apps are task graveyards — infinite lists that grow faster than they shrink. Momentum is different:

1. **Today-only by default.** The primary view shows ONLY what you're doing today. Everything else is hidden until you need it.
2. **Keyboard-first.** Every action is achievable without touching the mouse. Speed of capture matters more than visual polish.
3. **Context-aware.** Tasks belong to "roles" (hats you wear). You can focus on one role at a time or see everything.
4. **Time-boxed.** Every task has an estimated duration. The app tells you if your day is overloaded before you start.
5. **Opinionated daily ritual.** The app has a "Plan My Day" mode and an "End of Day Review" — it doesn't just store tasks, it drives a workflow.

---

## Detailed Feature Spec

### 1. Task Capture (The Input Bar)

A persistent input bar at the top of the screen — always focused, always ready. Think Spotlight/Alfred, not a form.

**Quick-add syntax (parse inline):**

- `Buy domain for landing page` → creates a basic task
- `Buy domain for landing page ~30m` → adds 30-minute time estimate
- `Buy domain for landing page ~30m #product` → assigns to "product" role
- `Buy domain for landing page ~30m #product !h` → sets high priority (!h = high, !m = medium, !l = low)
- `Buy domain for landing page ~30m #product !h +tomorrow` → schedules for tomorrow (+today is default, also support +mon, +tue, etc.)

The parser should be forgiving — order of modifiers shouldn't matter.

**Keyboard shortcut:** `/` focuses the input bar from anywhere in the app. `Escape` blurs it.

### 2. Role System (Context Switching)

Users define roles during first use (stored in localStorage). Examples: "Product", "Operations", "Strategy", "Personal".

- Each role gets a color (auto-assigned from a curated palette, user can override)
- Role pills appear as a horizontal filter bar below the input
- Clicking a role (or pressing `1`, `2`, `3`, etc.) filters the view to that role only
- Pressing `0` or clicking "All" shows everything
- The active role filter also pre-fills the `#role` tag on new tasks

### 3. Today View (The Main Event)

The default and primary view. Shows only tasks scheduled for today.

**Layout:**

- Three swim lanes displayed as columns on desktop, stacked on mobile:
  - **Up Next** — unstarted tasks, ordered by priority then manual drag order
  - **In Progress** — tasks you've actively started (max 2 enforced — if you try to start a 3rd, the app asks which to pause)
  - **Done** — completed tasks with completion timestamps

**Each task card shows:**

- Task title
- Role badge (colored pill)
- Time estimate (e.g., "30m")
- Priority indicator (subtle: a colored left border — red/amber/gray for H/M/L)
- Created timestamp (subtle, small)

**Task interactions:**

- `Enter` on a selected task → starts it (moves to In Progress), starts a subtle timer
- `Space` on a selected task → completes it (moves to Done), records actual time
- `e` on a selected task → inline edit mode
- `d` on a selected task → defer to tomorrow
- `Backspace/Delete` on a selected task → delete with undo toast (5 second undo window)
- `j/k` → navigate up/down through tasks (vim-style)
- `h/l` → navigate between columns
- Arrow keys should also work as alternatives to vim bindings

**The Time Budget Bar:**
At the top of the Today view, show a horizontal progress bar:

- Total estimated time for today's tasks vs. available hours (default 8h, user-configurable)
- Color-coded: green if under capacity, amber if 80-100%, red if over
- When overloaded, show the overage: "You're 2h 15m over capacity. Consider deferring tasks."

### 4. Backlog View

Accessed via `Tab` key or a subtle tab at the top.

- Shows all tasks NOT scheduled for today
- Grouped by scheduled date (Tomorrow, This Week, Later, Someday)
- "Someday" is the catch-all for tasks with no date
- Drag tasks (or press `t` for "today") to pull them into today's queue

### 5. Plan My Day Mode

Triggered on first visit each day (before 12pm) or manually via `Cmd/Ctrl + P`.

A focused modal workflow:

1. **Review Yesterday's Leftovers:** Shows incomplete tasks from yesterday. For each: "Move to today", "Defer", or "Delete". Keyboard: `Enter` = move to today, `d` = defer to tomorrow, `Delete` = remove.

2. **Review Backlog Suggestions:** Shows top 5 tasks from backlog sorted by priority and age. Same interaction.

3. **Today's Plan Summary:** Shows the resulting today list with total time estimate vs. capacity. Shows a motivational-but-honest message:
   - Under capacity: "Solid plan. You have room to breathe."
   - At capacity: "Full day. Protect your focus."
   - Over capacity: "This is more than a day's work. What can move?"

4. Press `Enter` to confirm and start the day.

### 6. End of Day Review

Triggered manually via `Cmd/Ctrl + R` or via a subtle prompt after 5pm.

Shows:

- **Completed tasks** with actual time vs. estimated time
- **Completion rate** (tasks done / tasks planned, as a percentage)
- **Incomplete tasks** with defer/delete options
- **Estimation accuracy** (how close were your time estimates to reality?)
- **One-line journal:** A text input that asks "What's one thing you learned today?" — stored with the day's data

### 7. Weekly Stats (Minimal)

Accessed via `Cmd/Ctrl + W`.

A simple dashboard showing the last 7 days:

- Tasks completed per day (bar chart, keep it minimal — use pure CSS or simple canvas)
- Average completion rate
- Most active role
- Estimation accuracy trend
- Streak counter: consecutive days with >80% completion rate

### 8. Quick Actions Command Palette

`Cmd/Ctrl + K` opens a command palette (like VS Code).

Available commands:

- "Plan My Day"
- "End of Day Review"
- "Weekly Stats"
- "Add Role..."
- "Set Daily Capacity..."
- "Export Data (JSON)"
- "Import Data (JSON)"
- "Toggle Dark Mode"
- "Clear Completed Tasks"
- "Keyboard Shortcuts"

Fuzzy-match filtering as you type.

### 9. Data Portability — Export / Import System

This is critical. Since all data lives in localStorage (browser-local), the user needs a robust way to move their data between browsers, machines, or iterations of the app. This should feel like a first-class feature, not an afterthought.

**Full Export (`Cmd/Ctrl + E`):**

- Exports ALL app data as a single `.json` file: settings (roles, capacity, theme, username), all tasks (every status — todo, in progress, done), and all daily logs/journal entries
- The file is timestamped automatically: `momentum-backup-2026-04-13.json`
- Triggers a browser download immediately — no extra clicks
- Show a toast confirmation: "Exported 47 tasks and 12 daily logs"

**Full Import (`Cmd/Ctrl + I`):**

- Opens a file picker for `.json` files
- Before applying, show a confirmation dialog with a summary of what's about to be imported: "This file contains 47 tasks, 3 roles, and 12 daily logs. Import will REPLACE all current data. Continue?"
- On confirm, wipe current localStorage and load the imported data
- Also offer a "Merge" option alongside "Replace" — merge keeps existing tasks and adds only new ones (match by task ID to avoid duplicates). This is important for users who want to combine data from two browsers rather than overwrite.
- Show a toast on success: "Imported successfully — 47 tasks, 3 roles, 12 daily logs"
- If the file is malformed or missing required fields, show a clear error: "Invalid file. Expected a Momentum export file." Do not partially import.

**Auto-Backup Reminder:**

- If the user hasn't exported in 7+ days, show a subtle, dismissible banner at the bottom of the Today view: "It's been a while since your last backup. Export your data?" with an "Export Now" button and an "X" to dismiss.
- Track `lastExportDate` in localStorage.

**Export Format (document this in a comment in the code so future iterations can parse it):**

```javascript
{
  version: "1.0", // schema version for forward compatibility
  exportedAt: "2026-04-13T17:30:00Z",
  settings: { /* full settings object */ },
  tasks: [ /* full array of all tasks */ ],
  dailyLogs: [ /* full array of all daily logs */ ]
}
```

The `version` field is important — if the data model evolves in a future iteration, the import function can detect an older format and migrate it automatically rather than failing.

---

## Design Direction

### Visual Style

- **Dark mode default** with a clean light mode toggle
- Monospace font for task titles (gives it a "command center" feel — use `JetBrains Mono` from Google Fonts, fallback to system monospace)
- Minimal chrome. No borders for the sake of borders. Use spacing and subtle background shifts to create hierarchy.
- Accent color: a muted electric blue (`#4F8EF7`) for interactive elements
- The overall feel should be: Notion's cleanliness meets a terminal's efficiency

### Responsive

- Desktop: three-column kanban layout for today view
- Tablet: two-column (Up Next + In Progress combined, Done separate)
- Mobile: single column with tab switching between lanes

### Animations

- Tasteful but fast. Tasks should animate when moving between lanes (150ms ease-out).
- No loading spinners needed (everything is local).
- Subtle fade on task completion — a brief green flash on the left border before moving to Done.

---

## Data Model

```javascript
// Stored in localStorage as JSON

// Settings
{
  roles: [
    { id: "product", name: "Product", color: "#4F8EF7" },
    { id: "ops", name: "Operations", color: "#F7B24F" },
    // ...
  ],
  dailyCapacityMinutes: 480, // 8 hours
  theme: "dark", // "dark" | "light"
  userName: "Nader" // used in greetings
}

// Tasks
{
  id: "uuid",
  title: "Buy domain for landing page",
  role: "product", // role id
  priority: "high", // "high" | "medium" | "low"
  estimateMinutes: 30,
  actualMinutes: null, // filled on completion
  status: "todo", // "todo" | "in_progress" | "done"
  scheduledDate: "2026-04-14", // ISO date string
  createdAt: "2026-04-13T09:00:00Z",
  startedAt: null,
  completedAt: null,
  column: "up_next" // "up_next" | "in_progress" | "done"
}

// Daily Logs
{
  date: "2026-04-13",
  tasksPlanned: 8,
  tasksCompleted: 6,
  totalEstimatedMinutes: 360,
  totalActualMinutes: 410,
  journalEntry: "Learned that our onboarding flow needs a complete rethink.",
  completionRate: 0.75
}
```

---

## Implementation Notes

- **Single file.** Everything in one `index.html` — HTML structure, `<style>` block, `<script>` block. This keeps it dead simple to host anywhere (even just open the file locally).
- **No frameworks.** Vanilla JS only. Use modern browser APIs (template literals for HTML, CSS custom properties for theming, etc.).
- **localStorage for everything.** Wrap it in a thin data layer with `save()` and `load()` helpers. Include export/import as JSON for backup.
- **UUID generation:** Use `crypto.randomUUID()` for task IDs.
- **Date handling:** Use native `Date` and `Intl.DateTimeFormat`. No moment.js or date-fns needed.
- **Keyboard handling:** Use a centralized keyboard event handler that checks context (is a modal open? is the input focused?) before dispatching to handlers. This prevents shortcut conflicts.
- **Accessibility:** Proper focus management, ARIA labels on interactive elements, visible focus indicators.

---

## First-Run Experience

On first load (no data in localStorage):

1. Show a minimal welcome screen: "Welcome to Momentum. What should I call you?" (text input)
2. "What hats do you wear?" — let user add 2-5 roles with names. Auto-assign colors.
3. "How many focused hours do you have each day?" — slider, default 8.
4. Drop into the empty Today view with the input bar focused and a ghost-text hint: "Type a task... (use ~30m for time, #role for context, !h for priority)"

---

## What "Done" Looks Like

When you're finished, I should be able to:

1. Open `index.html` in a browser
2. Go through the first-run setup
3. Add tasks using the quick-add syntax
4. See them appear in the Today view kanban
5. Start, complete, and defer tasks using keyboard shortcuts
6. Run "Plan My Day" and "End of Day Review" flows
7. See weekly stats
8. Use the command palette
9. Toggle dark/light mode
10. Have all data persist across page refreshes

Build the complete, working application. Do not leave placeholder functions or TODOs. Every feature described above should be fully implemented and functional.
