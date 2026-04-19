/**
 * Release notes — the source of truth for the "What's new" modal.
 *
 * Whenever a user-visible change ships, prepend a new entry to RELEASE_NOTES
 * (see CLAUDE.md → "Keep release notes in sync" for the full rules).
 * Entries must be in reverse-chronological order: newest first.
 */

export interface ReleaseItem {
  title: string;
  description: string;
  /** Keyboard shortcut tokens, e.g. ["Cmd", "K"] or ["Tab"]. Rendered as stacked keycaps. */
  shortcuts?: string[];
  /** Optional one-liner of how to try the feature right now. */
  howTo?: string;
}

export interface ReleaseNote {
  version: string;
  date: string; // YYYY-MM-DD
  headline: string;
  summary: string;
  items: ReleaseItem[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '0.14.1',
    date: '2026-04-19',
    headline: 'Backend safety: atomic imports, rate limits, security headers',
    summary:
      'Defensive backend hardening with no behavior change in the happy path. Multi-step writes (data import, AI brand import, account registration) now run inside a single database transaction, so a mid-stream failure can no longer leave the database half-changed. Auth and export endpoints are rate-limited to make CPU-expensive paths un-floodable. Standard security response headers ship on every API response. The Drizzle column types and the Zod API validators are now driven from a single canonical tuple, so they cannot drift apart.',
    items: [
      {
        title: 'Atomic data imports',
        description:
          'The /import endpoint now wraps the entire import flow in a single database transaction. If a mid-stream insert fails (bad file, schema mismatch, unique-constraint violation), the database is left exactly as it was before the request — no half-replaced team data, no orphaned brands missing their stakeholders. Same protection added to the AI brand import worker and to account registration.',
      },
      {
        title: 'Rate limits on expensive endpoints',
        description:
          'Default 300 requests / minute per IP. /auth/register and /auth/login are tightened to 5 / 15 minutes per IP (bcrypt is intentionally CPU-expensive — easy to weaponize without a limit). /export is tightened to 5 / 5 minutes per JWT user id (it iterates the entire team-shared dataset). Requests over budget receive a 429 with the standard Retry-After header.',
      },
      {
        title: 'Security response headers',
        description:
          'The API now ships standard security headers on every response (X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Cross-Origin-Resource-Policy, etc.) via @fastify/helmet. Content-Security-Policy is intentionally left to the SPA layer.',
      },
      {
        title: 'Single source of truth for enums',
        description:
          'Postgres column types (Drizzle pgEnum) and the API contract (Zod z.enum) used to be defined separately — a typo in either could have silently diverged. Both sides now import the same canonical tuple from @momentum/shared/enums, with a parity test in the API suite that fails if anything drifts.',
      },
      {
        title: 'Plugin error codes are respected',
        description:
          'The error handler now respects the statusCode property on errors thrown by Fastify plugins (rate-limit, JWT, etc.) instead of converting them to a generic 500. A 429 stays a 429 — clients can distinguish "back off" from "we crashed".',
      },
    ],
  },
  {
    version: '0.14.0',
    date: '2026-04-19',
    headline: 'Continuous integration, linting, and pre-commit checks land',
    summary:
      'Under-the-hood reliability work. Every change now ships against an automatic typecheck + lint + test + format gate on every pull request, ESLint is wired up across all four workspaces, and a lefthook pre-commit hook auto-fixes formatting and lint issues before they reach a commit. No user-facing behavior change — this is the foundation that makes the rest of the technical-debt cleanup safe to land.',
    items: [
      {
        title: 'Automatic checks on every pull request',
        description:
          'A new GitHub Actions workflow runs `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm format:check` on every PR and on pushes to main, then runs `pnpm build` if the verify step passes. Concurrency-cancelled per branch so a fresh push supersedes an in-flight run.',
      },
      {
        title: 'ESLint flat config across the monorepo',
        description:
          'Each workspace now has a `lint` script (`eslint . --max-warnings=0`) backed by a single root `eslint.config.mjs`. Phase one is intentionally lean — the only enforced rule today bans the all-property Tailwind transition utility per the frontend design rules. Rules for explicit-any, ban-ts-comment, exhaustive-deps, and import/order will tighten in a follow-up release after the codebase-wide sweep.',
      },
      {
        title: 'Lefthook pre-commit hook',
        description:
          'Staged TypeScript files are auto-fixed by ESLint and Prettier before the commit lands, so formatting and trivial lint issues never reach review. Installed automatically on `pnpm install` via the new root `prepare` script.',
      },
      {
        title: 'Faster Turbo cache + unified Vitest config',
        description:
          'turbo.json now declares per-task `inputs` and `outputs` for typecheck / lint / test, so warm-cache runs are near-instant. Each package`s `vitest.config.ts` extends a shared `vitest.shared.ts` so configuration drift across packages is gone.',
      },
    ],
  },
  {
    version: '0.13.3',
    date: '2026-04-18',
    headline: 'Today board reshapes smoothly when the drawer opens',
    summary:
      'Opening a task used to pop the Today board: the Done column disappeared instantly, the grid snapped from 3 to 2 columns, and the remaining cards visibly flashed wider before the drawer finished sliding in. The reshape now animates as a single 150ms motion — Done fades and collapses, the other two columns glide to their new widths, and the cards inside resize in lockstep with the drawer.',
    items: [
      {
        title: 'One smooth motion for the drawer + board reshape',
        description:
          "The Done column, the remaining two columns' widths, the cards inside, and the drawer all animate in 150ms ease-out so opening / closing the drawer feels like one gesture instead of three competing ones.",
      },
    ],
  },
  {
    version: '0.13.2',
    date: '2026-04-18',
    headline: 'Snappier kanban drag-and-drop',
    summary:
      'The Today kanban drag felt off — cards bounced on drop, the dragged card looked ghost-like, and the drop target was easy to miss. All fixed: a crisp 150ms fade on drop (no bouncy spring), a subtle lift (scale + tilt + shadow) on the card under the cursor, a bolder drop-zone highlight, and smooth reflow when a card leaves a column.',
    items: [
      {
        title: 'Crisper drop animation',
        description:
          'The default spring overshoot is gone. When you drop a card, the floating clone fades out in 150ms while the card lands in its new column — no bounce, no lag.',
      },
      {
        title: 'Lifted card while dragging',
        description:
          'The card following the cursor now scales slightly, tilts 1.5°, and gets a heavier shadow with a subtle primary-color ring. Clear "I\'ve picked this up" affordance.',
      },
      {
        title: 'Stronger drop-zone highlight and smooth reflow',
        description:
          'Hovering a column while dragging shows a full-color primary border with a tinted background and inset ring. When a card leaves a column, the remaining cards slide into place with a short 150ms ease-out layout animation instead of popping.',
      },
    ],
  },
  {
    version: '0.13.1',
    date: '2026-04-18',
    headline: 'Task detail drawer autosaves',
    summary:
      "The Save button is gone. Every field in the task detail drawer — title, description, priority, role, estimate, scheduled date, assignee — now saves itself about half a second after you stop editing. Navigate to another task with j/k and the previous task's pending changes flush immediately, so nothing gets lost when you switch focus mid-edit.",
    items: [
      {
        title: 'Autosave on every edit',
        description:
          'Edits are debounced by 500ms and written back to the task. The footer shows a subtle "Saving…" while a save is in flight and "Saved" otherwise — no more hunting for a Save button.',
      },
      {
        title: 'Flush on navigate and close',
        description:
          'Pressing j/k to move to another task, clicking Close, hitting Escape, or pressing the X in the drawer header all flush any in-progress save immediately. Switching tasks mid-sentence no longer loses the half-typed text.',
      },
    ],
  },
  {
    version: '0.13.0',
    date: '2026-04-18',
    headline: 'Notion-style slash commands in task descriptions',
    summary:
      'The task Description is now a rich-text editor. Type `/` anywhere and an inline menu appears with Heading 1, Heading 2, and Todo. Pick one and the current line becomes a real heading (visibly larger) or a real checkbox you can click to complete — not just a markdown prefix. Existing plain-text descriptions load as regular paragraphs, no migration needed.',
    items: [
      {
        title: 'Slash menu: /h1, /h2, /todo',
        description:
          'Type `/` to open the menu, then type to filter (`h` narrows to headings, `t` jumps to Todo), arrow keys to navigate, Enter to apply. Esc closes the menu without closing the drawer.',
        shortcuts: ['/'],
      },
      {
        title: 'Real headings and checkboxes',
        description:
          'Heading 1 and Heading 2 render at their actual sizes. Todo items are native checkboxes — click to check; checked items go muted and strike-through. Save persists the full formatted content back to the task.',
      },
    ],
  },
  {
    version: '0.12.0',
    date: '2026-04-18',
    headline: 'Team view is now a column-per-teammate board',
    summary:
      "The Team page used to stack teammates vertically, each with their own 3-column mini-kanban. That layout collapsed the moment anyone accumulated tasks — Done tasks on one row would push the next teammate off-screen. It's now a horizontal board: one column per teammate, with each task card carrying its own status tag (Up Next / In Progress / Done). Scroll horizontally to browse teammates; scroll vertically within a column. Current user's column is always first.",
    items: [
      {
        title: 'One column per teammate',
        description:
          'Horizontal board layout. Every teammate is a 320px column with a sticky header showing their stats. Cards are sorted In Progress → Up Next → Done so the most actionable work is at the top of each column.',
      },
      {
        title: 'Status on the card, not in the grid',
        description:
          "Each task card shows its stage as a small tag next to the role pill — green for In Progress, neutral for Up Next, muted for Done. No more guessing what column a task lives in; it's right there on the card.",
      },
      {
        title: 'Updated keyboard model',
        description:
          "j / k move between tasks in the focused teammate's column. h / l (and [ / ] as aliases) jump to the previous or next teammate. e opens the detail drawer, A reassigns. Progression keys (Enter / Space) stayed on Today — Team is an overview surface, not a remote-control for other people's tasks.",
        shortcuts: ['j', 'k', 'h', 'l'],
      },
    ],
  },
  {
    version: '0.11.0',
    date: '2026-04-18',
    headline: 'Tasks now have a description field',
    summary:
      "Every task gets a multi-line description you can fill in from the detail drawer. Use it for a definition of done, links, context, or anything that doesn't fit in the title. The textarea ships with smart helpers: type `/todo ` for a checkbox, `-` or `1.` for bullet / numbered lists (auto-continues on Enter), and Tab to indent. Quick-add stays title-only — descriptions are edit-only and optional.",
    items: [
      {
        title: 'Definition of done lives with the task',
        description:
          "Open any task with `e` and you'll see a Description textarea under the title. Type a checklist, paste a link, drop the acceptance criteria — whatever the title alone can't capture. Save to persist; leave it blank to clear.",
        shortcuts: ['e'],
      },
      {
        title: 'Smart list helpers out of the box',
        description:
          'The description textarea uses the same smart helpers as meeting notes: `/todo ` converts to `- [ ]`, `- ` and `1. ` auto-continue on Enter, Tab indents a list item, Shift+Tab outdents. Hit Enter on an empty bullet to exit the list.',
        shortcuts: ['Tab', '↵'],
      },
    ],
  },
  {
    version: '0.10.0',
    date: '2026-04-18',
    headline: 'Task detail is now a side drawer',
    summary:
      'Pressing `e` on a task no longer pops a blocking modal — a non-modal drawer slides in from the right edge. The page behind stays fully interactive: j / k keep navigating and the drawer follows along, showing whichever task is currently selected. Today and Team grids reflow from 3 columns to 2 while the drawer is open so nothing hides beneath it. Escape or the close button dismisses the drawer; it also persists across page navigation until you explicitly close it.',
    items: [
      {
        title: 'Drawer follows selection',
        description:
          "Open the drawer with `e` on any task, then keep using j / k to move between cards — the drawer updates live to show the task you're on. No more open-edit-close-nav-open-edit cycles.",
        shortcuts: ['e', 'j', 'k'],
      },
      {
        title: 'Grids reflow instead of hiding content',
        description:
          'On Today and Team, the kanban grid drops from 3 → 2 columns while the drawer is open (widens back to 3 at very wide viewports). The Done column stays reachable by scroll or h / l nav.',
      },
      {
        title: 'Escape to close · persists across navigation',
        description:
          "The drawer stays open when you navigate between views (g t / g l / g u) — useful for bouncing through pages while keeping a task pinned for edit. Press Escape or the close button when you're done.",
        shortcuts: ['Esc'],
      },
    ],
  },
  {
    version: '0.9.5',
    date: '2026-04-18',
    headline: 'Plan My Day now scrolls when leftovers run long',
    summary:
      "The Plan My Day modal used to grow past the viewport when yesterday's leftovers or the backlog had many items — the Next / Back buttons ended up below the fold. The modal now caps its height and scrolls the list inside, keeping the step chips and footer buttons pinned.",
    items: [
      {
        title: 'Scrollable leftovers and backlog list',
        description:
          'When the Leftovers or Backlog step contains more tasks than fit on screen, the list now scrolls inside the modal. The step navigation at the top and the Back / Next buttons at the bottom stay visible as you work through a long list.',
      },
    ],
  },
  {
    version: '0.9.4',
    date: '2026-04-18',
    headline: 'Time tracking is correct across pauses and reopens',
    summary:
      "Paused intervals no longer count as work. Before, pausing a task and resuming later would count the gap between pause and resume as time spent on the task. Completing a reopened task would also overwrite — not add to — previously logged minutes. Both are fixed: each start/pause/complete cycle now rolls its elapsed minutes into the task's running total, and multi-session totals are preserved across reopens.",
    items: [
      {
        title: 'Accurate time across pause → resume cycles',
        description:
          "When you pause a task, the minutes you actually spent in that session are added to the task's total and the timer clears. Starting again begins a fresh session, so gaps between pause and resume (lunch, meetings, distractions) are no longer counted as work on the task.",
      },
      {
        title: 'Reopen preserves history, next complete accumulates',
        description:
          "Dragging a Done task back to Up Next keeps its prior actual minutes as a record. If you restart and complete it again, the new session's time is added to the prior total instead of replacing it.",
      },
    ],
  },
  {
    version: '0.9.3',
    date: '2026-04-18',
    headline: 'Drag tasks between columns on Today',
    summary:
      'The Today kanban now supports mouse drag-and-drop between Up Next, In Progress, and Done. The keyboard model is unchanged — Enter / Space / e still work — drag is just an alternative path for mouse users. Dragging a task from Done back to Up Next or In Progress reopens it (clears the completion timestamp and start timer) so accidental completes are easy to undo.',
    items: [
      {
        title: 'Drag between columns',
        description:
          'Grab any task on Today and drop it on another column. Dropping on In Progress starts the task (same as Enter), dropping on Done completes it (same as Space), dropping back on Up Next pauses the timer. A small 6px activation distance means a plain click still selects without triggering drag.',
      },
      {
        title: 'Reopen a completed task by dragging it out of Done',
        description:
          'Drop a Done task on Up Next (or In Progress) to reopen it — completion timestamp is cleared, the timer resets, and prior time logged on the task is preserved as history. Useful when you hit Space by accident or marked the wrong task.',
      },
    ],
  },
  {
    version: '0.9.2',
    date: '2026-04-18',
    headline: 'Enter now advances tasks through the kanban',
    summary:
      'Pressing Enter on a selected task on Today now moves it to the next stage: Up Next → In Progress on the first press, In Progress → Done on the second. Space still completes a task from any state in one shot, so nothing you already learned goes away — Enter just fills in the missing step-through.',
    items: [
      {
        title: 'Enter advances one stage at a time',
        description:
          'Select a task and press Enter. If it\'s in Up Next, it moves to In Progress. If it\'s already In Progress, Enter now completes it. Space continues to work as a one-shot "mark done" from any state — use it when you finished something without formally starting it.',
        shortcuts: ['Enter', 'Space'],
      },
    ],
  },
  {
    version: '0.9.1',
    date: '2026-04-18',
    headline: 'One key to edit any task — from Today, Backlog, or Team',
    summary:
      'Pressing `e` on a selected task now opens the full task detail modal so you can edit the title, priority, role, estimate, scheduled date, and assignee in one place. Works the same way on Today, Team, and now Backlog — which just got keyboard navigation too. The old inline title-only edit is gone; the detail modal covers everything it did and more.',
    items: [
      {
        title: '`e` edits the whole task, everywhere',
        description:
          'Select a task with j/k and press e — the task detail modal opens with every field editable: title, priority, role, estimate, scheduled date, and assignee. Previously e only let you rename the task inline, and estimate had no keyboard path at all. Now one key covers the full edit.',
        shortcuts: ['e'],
      },
      {
        title: 'Backlog is keyboard-navigable',
        description:
          'The Backlog view now supports j/k to move through tasks across all date groups (Overdue → Tomorrow → This Week → Later → Someday) and e to open the detail modal for the selected task. Double-click a row to open the detail modal with the mouse.',
        shortcuts: ['j', 'k', 'e'],
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-04-17',
    headline: 'Every surface now runs on the new design tokens',
    summary:
      'The rest of the app has caught up to the new tokens: Today, Backlog, Brands, Feature Requests, Meeting notes, Team, Inbox, Parkings, Settings, and every modal now render through the shadcn-based color system. Dark and light modes are contrast-checked across the board. Empty states on the Today columns got a small upgrade telling you exactly which key to press.',
    items: [
      {
        title: 'Consistent tokens across the whole app',
        description:
          "Every surface now reads from the same shadcn-compatible semantic tokens (background / foreground / primary / secondary / muted / border / ring). Light and dark themes switch as a single operation. If you noticed subtle visual drift between surfaces before, that's gone.",
      },
      {
        title: 'Today columns tell you what to press',
        description:
          'Empty columns now show a purposeful empty state: "No tasks up next. Press / or n to add one." Same treatment on In Progress and Done. The shortcut hint is rendered as actual keycaps so it\'s easy to spot.',
        shortcuts: ['/', 'n'],
      },
      {
        title: 'Context-aware commands on Today',
        description:
          'Opening the command palette on Today or Backlog now surfaces "New task" and "Show everyone\'s tasks / Show only my tasks" in a new Today section. More surfaces will register their own commands as they get deeper rebuilds.',
        shortcuts: ['Cmd', 'K'],
      },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-04-17',
    headline: 'New shell, new command palette, better keyboard discovery',
    summary:
      'The first visible phase of the frontend overhaul lands: Momentum now runs on Geist Sans for UI chrome, the sidebar shows hover tooltips with keyboard hints, the command palette got a big upgrade with icons, descriptions, shortcut hints, context awareness, and a "Recent" section, and a global `n` shortcut creates a new thing wherever you are.',
    items: [
      {
        title: 'New typography and shell',
        description:
          "The app shell and navigation rail now use Geist Sans for UI text; mono is reserved for keycaps, counters, and IDs. Dark and light themes both shipped with refreshed tokens. Existing surfaces keep their current style until they're rebuilt one by one in later phases.",
      },
      {
        title: 'Command palette — now worth opening',
        description:
          'Every command has a lucide icon, a short description, and its keyboard shortcut rendered as keycaps. Commands are grouped by section (Daily, Navigate, Data, Preferences, Help). A "Recent" row at the top remembers your last few picks across sessions. Surfaces can register their own commands as they get rebuilt, and context-specific ones will start showing up on the relevant routes.',
        shortcuts: ['Cmd', 'K'],
        howTo: 'Press Cmd+K from anywhere, type what you want, and hit Enter.',
      },
      {
        title: 'Sidebar tooltips show the shortcut',
        description:
          'Hovering any nav item reveals a tooltip with the item label and its keyboard chord — e.g. Inbox → "g i", Shortcuts → "?". No more hunting through the Shortcuts modal to learn bindings.',
      },
      {
        title: '`n` creates a new thing, everywhere',
        description:
          'Press `n` from any surface to create a new thing in context. On views with an input bar (Today, Backlog, Parkings), `n` focuses the input — same as `/`. On views without an input, `n` triggers the surface\'s "new" action (feature requests, for example). Typing `n` inside an input still works normally.',
        shortcuts: ['n'],
      },
      {
        title: 'Vendor-neutral copy across the app',
        description:
          'Toast messages, modal titles, hints, and release notes now use generic terms — "spreadsheet", "recording", "AI extraction" — instead of naming third-party services. The integration layer stays invisible.',
      },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-04-17',
    headline: 'Momentum is now a team space',
    summary:
      "Momentum is now a shared operating system for the Omnirev team. Brands, meetings, and action items are team-visible. Tasks and parkings support assignment and involvement. A new Team Task View shows everyone's current work, a new Inbox surfaces things assigned to or involving you, and End of Day + Weekly Stats pick up a team pulse.",
    items: [
      {
        title: 'Sign up with your @omnirev.ai email',
        description:
          'Signup is now gated to the @omnirev.ai domain — anyone on the team can create an account and see the same brands, meetings, and action items. A new second step in the first-run wizard asks for your display name so teammates can recognise you on avatars and in task cards.',
        howTo:
          'Sign out and register a second account with another @omnirev.ai address to see the team view take shape.',
      },
      {
        title: 'Tasks have creators and assignees',
        description:
          'Every task now tracks who created it and who it is assigned to. Both appear as avatars on task cards. You can reassign a task from the picker with a single keystroke, or inline while typing a new task by prefixing a teammate\'s first name with @ — "@alice ship the docs" assigns as you type.',
        shortcuts: ['A'],
        howTo:
          'Select any task with j/k, press A to open the assignee picker, and pick a teammate with 1–9 or by typing their name.',
      },
      {
        title: 'Mine / Everyone / Unassigned filters',
        description:
          'The Today and Backlog views grew a small chip above the list to switch between "Mine", "Everyone", and (on Backlog) "Unassigned". Your personal view is still "Mine" by default. Press @ anywhere on a filterable view to jump straight to the chip group.',
        shortcuts: ['@'],
      },
      {
        title: 'Parkings are shared by default — mark private with v',
        description:
          'Parkings default to team-visible so stand-up notes surface for everyone. Toggle a row to private with v and a lock icon appears; only the creator sees private parkings. Tag teammates into a team parking with I to put it in their Inbox and on their Mine filter.',
        shortcuts: ['v', 'I'],
        howTo:
          'Select a parking with j/k, press v to flip visibility, or press I to pick who else is involved.',
      },
      {
        title: 'Brand recent activity + team-visible meetings',
        description:
          "Every brand's Overview tab now shows a Recent Activity panel with stakeholder edits, meetings logged, action items created and completed, recordings synced, and feature-request changes — with the teammate who did each action. Meetings show attendee avatars for anyone matched to a teammate. Work (action items) cards show creator and assignee so handoffs are visible at a glance.",
      },
      {
        title: "Team Task View — everyone's today in one place",
        description:
          'A new /team page groups tasks by person. Each teammate gets their own mini-kanban (Up next · In progress · Done). Navigate with j/k within a column, h/l between columns, ]/[ between teammate sections, press Enter on a task to open its detail modal, or A to reassign it without leaving the page.',
        shortcuts: ['g', 'u'],
      },
      {
        title: 'Inbox — things that need your attention',
        description:
          'A new /inbox page lists the five events that involve you: tasks assigned to you, your tasks edited by someone else, parkings that tag you, action items assigned to you, and meetings where you were added as an attendee. Walk the list with j/k, open an item with Enter (which also marks it read), mark one read with Space, or clear the tray with m then a.',
        shortcuts: ['g', 'i'],
      },
      {
        title: 'End of Day team pulse + Weekly Stats Team tab',
        description:
          "Your End of Day Review still belongs to you — your journal entry, your completed/incomplete lists, your stats. Below the Save button, a quiet strip now shows the team's completion rate for today and how many teammates are still working. The Weekly Stats modal gained a Mine | Team tab bar; switch with [ and ] to see per-person completion rate, estimation accuracy, streak, and top role across the team.",
        shortcuts: ['[', ']'],
      },
      {
        title: 'Six-view navigation cycle',
        description:
          '] and [ now cycle through six views: Today → Backlog → Parkings → Team → Brands → Inbox. The g-prefix shortcuts grew g u (Team) and g i (Inbox) to match; the existing g t / g l / g p / g b still work as before.',
        shortcuts: [']', '['],
      },
    ],
  },
  {
    version: '0.6.3',
    date: '2026-04-17',
    headline: 'New brand color — Momentum is green now',
    summary:
      'The accent color across the app has moved from blue to a vivid green (#0FB848). Buttons, focus rings, tab indicators, modal glows, role-pill defaults, and stakeholder avatars all pick up the new brand color automatically.',
    items: [
      {
        title: 'Accent color refreshed',
        description:
          'Every surface that previously rendered in the old blue accent (CTAs, active tab underlines, the "keyboard-first" pill in the Shortcuts modal, focus rings, the What\'s new dot) now uses the new Momentum green. Both dark and light themes pick it up — dark uses the vivid #0FB848 for visibility against the near-black background, light uses a deeper #02862F for legible contrast against the near-white surface.',
      },
      {
        title: 'Default role color is green',
        description:
          'New roles created without an explicit color now default to the brand green. Existing roles keep whatever color you chose — nothing is migrated. The role color palette still offers 8 swatches; the old blue is still available, just no longer first.',
      },
      {
        title: 'Stakeholder avatars refreshed',
        description:
          'The 8-color palette used for stakeholder initials has the new green at position 0. Stakeholders that previously hashed to blue will now render green; the palette has 8 distinct hues as before.',
      },
    ],
  },
  {
    version: '0.6.2',
    date: '2026-04-17',
    headline: 'Keyboard navigation for meeting form suggestions',
    summary:
      'The attendee and title suggestion dropdowns on the meeting form now support arrow-key navigation and Enter to add or pick the highlighted result.',
    items: [
      {
        title: 'Arrow keys + Enter on attendee suggestions',
        description:
          'After typing a partial name, use ↑ / ↓ to move through the suggestion list and Enter to add the highlighted stakeholder. Enter with no matching suggestion still adds the typed text as a free-form attendee.',
        shortcuts: ['↑', '↓', 'Enter'],
        howTo:
          'Open a brand, start a new meeting, type a letter in the Attendees field, then use the arrow keys to pick a suggestion and press Enter.',
      },
      {
        title: 'Arrow keys + Enter on title suggestions',
        description:
          'The meeting title input now suggests past titles as you type. Use ↑ / ↓ to navigate them and Enter to fill the field; Esc dismisses the list.',
        shortcuts: ['↑', '↓', 'Enter', 'Esc'],
        howTo:
          'Start a new meeting on a brand that has past meetings, type two letters in the Title field, then press ↓ and Enter.',
      },
    ],
  },
  {
    version: '0.6.1',
    date: '2026-04-17',
    headline: 'Parkings priority stripes restored',
    summary:
      'Parking cards now show the colored left-edge stripe for priority — red for high, amber for medium, dim grey for low — matching task cards.',
    items: [
      {
        title: 'Priority stripe on parking cards',
        description:
          'The left-border priority color was being overridden by the card’s base border and rendered invisible. Parking cards now reliably show the correct priority color on the edge.',
      },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-04-16',
    headline: 'Feature Requests — spreadsheet two-way sync',
    summary:
      'Each brand now has a Feature Requests tab that syncs bidirectionally with an external spreadsheet. View, edit, and manage client feature requests directly from Momentum.',
    items: [
      {
        title: 'Feature Requests Tab',
        description:
          'A new third tab on each brand detail page displays feature requests in a clean, filterable table. Filter by All, Open, or Resolved status, search by keyword, and sort by date or status.',
        shortcuts: ['3', 'f'],
        howTo: 'Open any brand and click the Feature Requests tab, or press 3 or f.',
      },
      {
        title: 'Spreadsheet connection',
        description:
          'Connect a spreadsheet URL per brand. Momentum analyzes the column structure, optionally standardizes headers, and imports all existing rows. Changes sync both ways — edits in Momentum push to the sheet, and edits in the sheet pull into Momentum.',
        howTo:
          'Go to the Feature Requests tab and click "Connect spreadsheet", then paste the URL.',
      },
      {
        title: 'Inline Editing',
        description:
          'Double-click any cell (Date, Request, Response) to edit it inline. The Resolved checkbox toggles with a single click. Changes auto-save on blur or Enter.',
      },
      {
        title: 'Convert to Action Item',
        description:
          'Hover any unresolved feature request and click the arrow icon to create an action item from it. The feature request is automatically marked as resolved.',
      },
      {
        title: 'Keyboard Navigation',
        description:
          'Full keyboard support on the Feature Requests tab: n for new request, j/k to navigate rows, Space to toggle resolved, r to sync, Escape to deselect.',
        shortcuts: ['n', 'j', 'k', 'Space', 'r'],
      },
      {
        title: 'Pulse Stats',
        description:
          'The brand Overview tab now shows a Feature Requests summary card with open and resolved counts, and a link to jump to the tab.',
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-04-16',
    headline: 'Brand detail view redesigned with tabbed layout',
    summary:
      'The brand detail page now uses a clean tabbed interface — Overview for the health snapshot, stakeholders, and goals; Action Items & Meetings for the working area. Better typography, spacing, and contrast throughout.',
    items: [
      {
        title: 'Tabbed Brand View',
        description:
          'The brand detail page is now split into an Overview tab and an Action Items & Meetings tab, eliminating the need to scroll through collapsed sections. Switch between them with a click or keyboard shortcuts.',
        shortcuts: ['1', '2'],
        howTo:
          'Open any brand and use the tab bar below the header, or press 1 for Overview and 2 for Action Items & Meetings.',
      },
      {
        title: 'Stakeholder Cards',
        description:
          'Stakeholders are now displayed as a visual grid of cards showing name, role, and email — much easier to scan than the previous inline list.',
      },
      {
        title: 'Improved Readability',
        description:
          'All section labels, body text, and metadata have been bumped up in size and contrast for a more comfortable reading experience. No more squinting at 10px labels.',
      },
    ],
  },
  {
    version: '0.4.1',
    date: '2026-04-16',
    headline: 'Smarter recording sync — no more duplicate action items',
    summary:
      'When syncing meeting recordings, extracted action items are now compared against your existing action items using AI. Duplicates are automatically skipped, and similar items are merged with updated details.',
    items: [
      {
        title: 'Action Item Deduplication',
        description:
          'During recording sync, Momentum uses an LLM to compare each extracted action item against your existing open items. Items that are essentially the same are skipped, items with new details are merged into the existing entry, and genuinely new items are created as before.',
        howTo:
          "Just sync recordings as usual — deduplication happens automatically. You'll see fewer duplicate action items after importing multiple recordings.",
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-04-15',
    headline: 'Meeting Recording Sync — pull transcripts into your brand notes',
    summary:
      'Sync meeting recordings into Momentum. Transcripts are automatically processed to extract summaries, action items, and decisions — all linked to the right brand.',
    items: [
      {
        title: 'Sync Recordings',
        description:
          'Click "Sync Recordings" on any brand to search your meeting recordings. Momentum scores each recording against your matching rules and shows likely and possible matches for you to review before importing.',
        shortcuts: ['s'],
        howTo:
          'Open a brand, click "Sync Recordings" or press s. Review the candidates, check the ones you want, and hit "Sync Selected".',
      },
      {
        title: 'Matching Rules',
        description:
          'Configure per-brand matching rules to control which recordings are surfaced. Match by stakeholder email, title keywords, meeting type, and sync window. Click the gear icon on a brand to configure.',
      },
      {
        title: 'AI-Powered Extraction',
        description:
          'Synced recordings are processed to extract a concise summary, action items with owners, and key decisions. Action items are automatically added to the brand.',
      },
      {
        title: 'Recording Links',
        description:
          'Meeting notes synced from recordings show a "Recording" link that opens the playback in a new tab.',
      },
      {
        title: 'Same-Day Merge',
        description:
          'If you already have manual notes for a day and sync a recording from that same day, the content is merged into one unified note — no duplicates.',
      },
      {
        title: 'Stakeholder Emails',
        description:
          'Stakeholders now support an email field. Adding emails to stakeholders improves recording matching accuracy.',
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-04-15',
    headline: 'Brands — client management meets daily execution',
    summary:
      'A full Brands section for managing enterprise client relationships: meetings, stakeholders, action items, health tracking, AI-powered import, and bidirectional sync with your Today view.',
    items: [
      {
        title: 'Brand management',
        description:
          'Create and manage brands with three layers: North Star (goals, stakeholders, success definition), Pulse (activity snapshot, open action items, stakeholder badges), and Archive (meeting notes with decisions and extracted action items). Everything auto-saves on blur.',
        shortcuts: ['⌘', 'B'],
        howTo:
          'Press Cmd+B or g b to open Brands. Click "+ New Brand" to create one, then fill in goals and add stakeholders. Double-click the brand name to rename.',
      },
      {
        title: 'Meeting notes with action item extraction',
        description:
          'Log meetings with date, title, attendees (chip input with stakeholder autocomplete), notes, and decisions. Lines starting with → are automatically extracted as action items on save. Past titles autocomplete as you type.',
        shortcuts: ['n'],
        howTo:
          'Open a brand and press n (or click "+ New Meeting Note"). Write notes with → prefixed lines for action items. Press Cmd+Enter to save.',
      },
      {
        title: 'Send to Today — bidirectional sync',
        description:
          'Push any brand action item to your Today task list. Completing the task in Today auto-marks the action item done, and vice versa. The task card shows a linked badge.',
        howTo:
          'Hover an action item and click →Today, or use the "Send to Today" link in the Pulse section.',
      },
      {
        title: 'AI-powered brand import',
        description:
          'Upload a .md or .txt file of client notes and the server uses AI extraction to pull out meetings, stakeholders, action items, goals, and success definition. Processing is async — you can keep working while it runs.',
        howTo:
          'Click "Import from file" in the Brands sidebar, select a file, click Analyze. The brand appears in the list with an importing spinner and auto-navigates to the detail view when done.',
      },
      {
        title: 'Health pills',
        description:
          'Each brand shows a computed health dot: green (on track), amber (quiet), red (needs attention). Based on meeting recency, open action item count, and overdue items.',
      },
      {
        title: 'Keyboard shortcuts updated',
        description:
          'g b now goes to Brands (Backlog moved to g l). Cmd+B is a modifier shortcut for Brands. Brands detail view supports n (new meeting) and a (new action item). View cycle updated to include Brands.',
        shortcuts: ['g', 'b'],
      },
    ],
  },
  {
    version: '0.2.5',
    date: '2026-04-15',
    headline: 'Global shortcuts work from every view',
    summary:
      'Backlog (and any future view) now responds to g/[/] and every other global shortcut. Previously those only worked on pages that happened to call the keyboard-controller hook.',
    items: [
      {
        title: 'Global shortcuts moved out of individual pages',
        description:
          'View navigation, the command palette, role filtering, and every other global keyboard shortcut are now registered at the app shell level, which means they fire identically from Today, Backlog, and Parkings. Pages continue to own their own navigation keys (j/k/h/l) and task actions (Enter/Space/e/r/p/d/Delete).',
        shortcuts: ['g', 'b'],
        howTo:
          'Navigate to Backlog and press g t or [ / ] — it now works, same as from Today and Parkings.',
      },
    ],
  },
  {
    version: '0.2.4',
    date: '2026-04-15',
    headline: 'View navigation actually works from every page',
    summary:
      'The g / [ / ] view-navigation shortcuts were silently broken on pages where the input bar auto-focused on mount — which was every task and parking page. Fixed.',
    items: [
      {
        title: 'No more auto-focused input bars',
        description:
          'Tasks and Parkings no longer grab focus on the input bar when you land on them. That used to swallow g-prefix and bracket shortcuts, so pressing g t from Parkings did nothing. Press / to focus the input when you want to capture something — the same way you already focus it from anywhere else in the app.',
        shortcuts: ['/'],
        howTo:
          'Land on any view, press g t / g b / g p to jump, or [ and ] to cycle. When you want to type a new task or parking, tap / first to focus the input bar.',
      },
    ],
  },
  {
    version: '0.2.3',
    date: '2026-04-15',
    headline: 'Tab key restored to the browser, new view-switching bindings',
    summary:
      'Tab no longer cycles views — it hands control back to the browser for focus-ring and screen-reader navigation, the way it should. View switching moved to vim-style “go to” bindings and bracket cycling.',
    items: [
      {
        title: 'Tab is free again',
        description:
          'Tab used to hijack focus to cycle Today → Backlog → Parkings. That broke accessibility and normal browser focus flow. It now does exactly what every web app expects: move focus to the next focusable element.',
      },
      {
        title: '“Go to” bindings for direct view jumps',
        description:
          'Press g then a letter to jump directly to any view. This is vim-style navigation — hold nothing, tap g, then tap the destination within 1.5 seconds. Pressing g twice cancels the pending state.',
        shortcuts: ['g', 't'],
        howTo:
          'g t for Today (Tasks), g b for Backlog, g p for Parkings. Works anywhere as long as you’re not typing into an input.',
      },
      {
        title: 'Bracket keys for previous / next view',
        description:
          'If you prefer cycling over direct jumps, press ] to move to the next view and [ to move to the previous one. Order: Today → Backlog → Parkings → Today.',
        shortcuts: [']'],
      },
    ],
  },
  {
    version: '0.2.2',
    date: '2026-04-15',
    headline: 'Shortcuts help is actually accurate now',
    summary:
      'The Shortcuts modal was drifting from reality — Parkings were missing, the Tab binding was wrong, and a dead row was still listed. All fixed, with a new rule to keep them in sync going forward.',
    items: [
      {
        title: 'Parkings shortcuts documented',
        description:
          'The Shortcuts help (press ? anywhere or open the command palette → Keyboard Shortcuts) now has a dedicated Parkings section listing every binding: navigation, expand/collapse, mark discussed, change role, cycle priority, defer, delete.',
        shortcuts: ['?'],
      },
      {
        title: 'Corrected the Tab binding label',
        description:
          'Tab has cycled Today → Backlog → Parkings → Today since v0.2.0, but the help still said “Toggle Today ↔ Backlog.” Fixed. Also removed a ghost row for a “t – Move to today” shortcut that was never actually wired up.',
      },
    ],
  },
  {
    version: '0.2.1',
    date: '2026-04-15',
    headline: 'Slimmer sidebar, Today/Backlog tabs on Tasks',
    summary:
      'The sidebar is now a thin icon rail reserved for top-level destinations. Today and Backlog moved to a sub-tab bar inside Tasks.',
    items: [
      {
        title: 'Icon-only sidebar',
        description:
          'The sidebar shrank from a text rail to a 56-pixel icon rail. Only top-level destinations live there now — Tasks and Parkings — plus What’s new, Shortcuts, theme, and sign out at the bottom. Hover any icon to see its label. The Momentum mark at the top links back to the current app version.',
      },
      {
        title: 'Today / Backlog tabs moved to the Tasks view',
        description:
          'Today and Backlog are no longer sidebar items — they are now tabs at the top of the Tasks area. The active tab gets an accent underline. Tab key cycles Today → Backlog → Parkings → Today, same as before.',
        shortcuts: ['Tab'],
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-04-15',
    headline: 'Sidebar, Parkings, and this “What’s new” page',
    summary:
      'A persistent left sidebar, a new Parkings view for daily standup prep, and release notes that land the moment you update.',
    items: [
      {
        title: 'New sidebar navigation',
        description:
          'The old top-nav tabs are gone. A persistent left sidebar groups Tasks (Today, Backlog) and Parkings, with your profile, theme toggle, and sign-out tucked at the bottom. Tab still cycles — now it rotates through all three views.',
        shortcuts: ['Tab'],
      },
      {
        title: 'Parkings for your daily standups',
        description:
          'Capture topics you want to bring up at the next daily standup. Each parking has a title, prep notes, and an outcome you fill in after the conversation. Items are grouped by daily date — Today, Tomorrow, future days, and Unscheduled.',
        shortcuts: ['Enter', 'Space', 'e', 'r', 'p', 'd'],
        howTo:
          'Open Parkings from the sidebar (or Tab to it), type a topic the same way you type tasks. Use +tomorrow / +mon to target a specific daily. Expand a card with Enter to write prep notes. Press Space after the discussion to mark it done.',
      },
      {
        title: '“What’s new” experience',
        description:
          'Release notes auto-open the first time you visit after an update. You can reopen them anytime from the sidebar or the command palette under Help. A subtle accent dot on the sidebar link tells you when an unseen release is waiting.',
        shortcuts: ['Cmd', 'K'],
      },
    ],
  },
];

export const LATEST_VERSION: string = RELEASE_NOTES[0]!.version;

/** Compare two version strings as dotted integers ("0.2.0" < "0.10.0"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number(n) || 0);
  const pb = b.split('.').map((n) => Number(n) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}
