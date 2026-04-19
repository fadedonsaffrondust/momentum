# Momentum — Frontend Revision Brief

## How to Use This Document

You (Claude Code) are revising Momentum's entire frontend to reach best-in-class B2B product UI quality — the tier set by Linear, Attio, Raycast, and Vercel's dashboard. This document defines the tech stack, design tokens, interaction patterns, and UX principles the revision must conform to.

Treat this as a spec, not a suggestion list. Deviations must be called out explicitly in your plan with justification. If something here conflicts with existing code you encounter, flag it — do not silently override.

**Before writing any code, read this entire document, then produce a migration plan for my approval.** Do not start refactoring until I approve the plan.

---

## About Momentum

Momentum is an internal operating system for the leadership team at Omnirev, a US-based AI sales-automation startup for enterprise restaurant catering. There is currently one primary operator (the founder/COO) using it daily to:

- Manage personal tasks across Product, Ops, and Strategy roles
- Track relationships and health of 8–12 active enterprise brand accounts
- Capture and review meeting notes and action items per brand
- Sync meeting recordings for transcript extraction
- Track feature requests from brands
- Run daily planning and review rituals

Momentum is opinionated and keyboard-first. It is not a generic SaaS dashboard, and the UI should not feel like one.

---

## Non-Negotiable UX Principles

These apply to every screen, every component, every interaction. They outrank stylistic preferences.

**Keyboard-first, always.** Every action must be achievable without a mouse. Shortcuts are the primary interface; click support is the fallback. `j/k` navigates lists everywhere. `Enter` opens/confirms everywhere. `Space` toggles. `Escape` closes. `n` creates a new thing in whatever context you're in. `cmd+k` opens the command palette from anywhere. Breaking any of these cross-surface consistencies is a bug.

**Information hierarchy is everything.** The most important thing on any screen is obvious within 1 second, the second-most within 3. Use collapsible sections, progressive disclosure, and visual weight (opacity, size, position) to enforce this. Multiple levels of competing visual weight on the same screen is a failure.

**Never show everything by default.** Default views are filtered, focused, and scoped. Today view shows today's tasks only. Feature requests default to Open, not All. "Show all" is an escape hatch, not a landing state.

**Workflows over screens.** Momentum is a workflow engine, not a dashboard. Every surface should drive an action — Plan My Day, End of Day Review, Sync Recordings — not just display data.

**Speed is a feature.** Animations ≤ 150ms. No spinners on local operations. Instant capture (input bars always focusable). Progress shown if > 2s. Explanation shown if > 10s.

**No vendor branding in the UI.** Momentum integrates with external services (tl;dv, Google Sheets, OpenAI). None of their names appear in the UI. Use generic terms: "recording," "sync," "AI extraction." The integration layer is invisible.

---

## Tech Stack — These Are Decisions

### 1. shadcn/ui (copy-paste, owned in-repo)

Use shadcn/ui as the component foundation. Components are copied into the repo, not installed as a dependency — we own and modify them.

- Install via the shadcn CLI: `npx shadcn@latest init` then `npx shadcn@latest add <component>` as needed.
- Place components in `src/components/ui/`.
- Treat every added component as a starting point. Modify it to match Momentum's design tokens (below). Do not ship default shadcn styling.
- Prefer shadcn's primitives over writing from scratch; prefer writing from scratch over installing a third competing component library.

### 2. Tailwind CSS (styling layer)

All styling is Tailwind utility classes driven by our design tokens. No CSS-in-JS. No CSS modules. No inline style objects except for dynamic values that cannot be expressed in classes.

- Configure the Tailwind theme to use the design tokens defined below (do not rely on defaults).
- Enable `@tailwindcss/forms` and `@tailwindcss/typography` only if needed — both reset a lot of defaults we may want to keep under our control.
- Use `clsx` + `tailwind-merge` (via the `cn()` helper shadcn ships with) for conditional classes.

### 3. Radix UI primitives (complex behavior, accessibility)

Use Radix for all dialogs, popovers, dropdowns, tooltips, tabs, selects, checkboxes, radio groups, context menus, hover cards, and any component requiring focus management, keyboard navigation, or ARIA correctness. shadcn already wraps these — lean into them rather than around them.

- Never roll your own modal, popover, or dropdown. Radix handles edge cases (focus trap, escape handling, portal rendering, scroll lock) that are expensive to replicate correctly.

### 4. cmdk (command palette)

Install `cmdk` and build a global command palette bound to `cmd+k` / `ctrl+k`.

- The palette is the primary entry point for any action a power user would want: jump to brand, create task, start Plan My Day, open feature requests, etc.
- Structure commands by context: global commands always visible; context-specific commands (e.g., brand actions when a brand is focused) surface based on current route.
- Support fuzzy search. Support recent commands. Support keyboard-only flow end to end — no click should ever be required once the palette is open.
- Reference implementations to study: Linear's cmd+k, Raycast, Vercel dashboard, Attio's quick switcher.

### 5. Framer Motion (micro-interactions only)

Use Framer Motion for purposeful micro-animations — list item insertion/removal, panel slide, status transitions, drawer open/close.

- All animations ≤ 150ms. Use `ease-out` for entrances, `ease-in` for exits.
- Do not animate on every interaction. If an animation doesn't communicate state change, remove it.
- Respect `prefers-reduced-motion` — wrap animated components to skip or shorten when set.

### 6. Typography — Geist (primary) with Inter fallback

Use **Geist Sans** for UI and **Geist Mono** for code, timestamps, IDs, and numeric columns in tables. Fallback to Inter if Geist is unavailable for any reason.

- Load via `next/font` if Momentum is on Next.js, or via `@fontsource/geist-sans` and `@fontsource/geist-mono` otherwise.
- Set `font-feature-settings: "cv11", "ss01", "ss03"` on Geist Sans for slightly tighter letterforms.
- Never use system font stacks for UI in Momentum. Acceptable tier is Geist or Inter — nothing else.

---

## Design Tokens

These override Tailwind defaults. Define them in `tailwind.config.ts` under `theme.extend`.

### Spacing

Use a 4px base grid: `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`. No arbitrary values in components. If you need 14px, either round to 12 or 16 — or update the scale with justification.

### Typography scale

Do not use more than three type sizes on any single screen. The full scale:

- `text-2xs` — 11px / 16px line-height — metadata, keyboard hints
- `text-xs` — 12px / 18px — secondary labels, table column headers
- `text-sm` — 13px / 20px — body default for UI
- `text-base` — 14px / 22px — primary content
- `text-lg` — 16px / 24px — section headers
- `text-xl` — 20px / 28px — page titles
- `text-2xl` — 24px / 32px — rare, hero moments only

Font weights: `400` (default), `500` (emphasis), `600` (headers). Never `700+` in UI.

### Color

Build on Tailwind's neutral palette with custom semantic tokens. Use CSS variables so dark mode is a single switch.

Semantic tokens (define as CSS variables, consume via Tailwind):

- `--background` / `--foreground` — page canvas and primary text
- `--surface` — elevated cards, panels
- `--surface-hover` — hover state for rows/cards
- `--border` — default border
- `--border-subtle` — dividers inside panels
- `--muted` / `--muted-foreground` — secondary text, metadata
- `--accent` — Momentum brand accent (pick one hue, use sparingly)
- `--success` / `--warning` / `--danger` — status only, never decoration

Rules:

- No more than one accent color used per screen region.
- Status colors (green/yellow/red) appear only on status indicators, never as general-purpose styling.
- Health pills, priority indicators, and similar use opacity and desaturation over bright colors.

### Border radius

- `rounded-sm` (3px) — inputs, small buttons
- `rounded` (6px) — cards, default buttons
- `rounded-md` (8px) — dialogs, panels
- No radius over 8px anywhere in the UI.

### Shadows

Minimal. Most surfaces should use a 1px border instead of a shadow.

- `shadow-xs` — subtle lift for hovered cards
- `shadow-sm` — popovers, dropdowns
- `shadow-md` — dialogs (paired with backdrop)
- No shadows on buttons, inputs, or inline elements.

### Motion

- Duration: `100ms` (instant), `150ms` (standard), `200ms` (only for larger panel transitions)
- Easing: `ease-out` for entrances, `ease-in` for exits, `cubic-bezier(0.4, 0, 0.2, 1)` for bidirectional transitions
- Never use bounce, elastic, or spring with overshoot in UI chrome — reserved for playful moments if any exist (there probably aren't any in Momentum)

### Density

Momentum is an information-dense operator tool, not a marketing site. Err toward compact:

- Table row height: 32–36px
- List item height: 36–40px
- Button height: 28px (sm), 32px (default), 36px (lg)
- Input height: 32px default
- Padding inside cards: 16px default, 12px for compact variants

---

## Interaction Patterns

### Keyboard shortcuts

Implement a global shortcut handler (suggest `react-hotkeys-hook` or a small custom hook). Shortcuts must:

- Be discoverable — every interactive element exposes its shortcut via tooltip on hover, visible on focus
- Be consistent across surfaces — do not reassign `j/k`, `Enter`, `Space`, `Escape`, `n`, `cmd+k` to anything else
- Not conflict with browser defaults (`cmd+t`, `cmd+w`, `cmd+l`, etc.)
- Work when the relevant context is focused, not just when a specific element is focused

### Command palette structure

- Global commands always available (new task, jump to brand, start Plan My Day, sync, etc.)
- Context commands surface based on current route (e.g., on a brand page, "Mark action item done", "Log meeting note")
- Recent commands section at top when palette opens with empty query
- Every command has an icon, a label, optional keyboard shortcut display, and an optional description

### Focus states

Visible focus ring on every interactive element (Radix/shadcn handle this by default — don't strip it). Use a 2px ring in `--accent` with 2px offset.

### Empty states

Every list, table, and panel has a purposeful empty state:

- What this surface is for (one line)
- What action the user can take (a button or shortcut hint)
- No illustrations. No empty-state clipart.

### Loading states

- < 200ms perceived work: show nothing
- 200ms–2s: skeleton shimmer matching the expected layout
- 2s–10s: progress indicator with "Loading X" label
- > 10s: progress indicator + explanation of what's happening

### Error states

- Inline, next to the thing that failed
- Actionable — include a "Retry" or "Fix" action
- Never a toast alone for a persistent error
- Toasts are for transient confirmations only ("Task created"), not for errors that require action

---

## Migration Sequencing

Do not refactor the entire frontend in one PR. Break the work into the following phases. Each phase must ship independently and not break the app.

**Phase 1 — Foundation (no visible change expected)**

- Install and configure Tailwind with our design tokens
- Set up shadcn CLI, install initial primitives (Button, Input, Dialog, Popover, Dropdown, Tooltip)
- Load Geist fonts
- Establish `cn()` helper, global CSS variables, dark mode switch
- Add Framer Motion and cmdk as dependencies

**Phase 2 — Global chrome**

- Rebuild app shell: top nav, side nav, main content area
- Implement global command palette (cmd+k) with a seed set of commands
- Implement global keyboard shortcut handler

**Phase 3 — Primary surfaces (one at a time, in this order)**

1. Today view (highest-traffic surface)
2. Brand list + brand detail
3. Feature requests table
4. Meeting notes / action items
5. Settings and secondary surfaces

For each surface, match the design tokens, keyboard shortcuts, and interaction patterns defined above. Do not mix old and new styles in the same surface.

**Phase 4 — Polish pass**

- Animation audit — every transition ≤ 150ms, `prefers-reduced-motion` respected
- Keyboard shortcut audit — every action reachable without a mouse
- Empty/loading/error state audit — every list/table/panel handled
- Focus state audit — visible ring everywhere

---

## Guardrails — What Not To Do

- Do not install Material UI, Chakra, Ant Design, Mantine, or any other component library alongside shadcn. Pick one foundation and stick with it.
- Do not use emojis as icons. Use Lucide icons (ships with shadcn) consistently.
- Do not introduce new fonts. Geist and Geist Mono only.
- Do not add more than three type sizes or two font weights on any single screen.
- Do not use drop shadows as decoration. Shadows are functional (elevation cues) only.
- Do not animate hover states beyond color/opacity transitions.
- Do not use full-width content containers. Use a max width (~1400px) with graceful behavior below it.
- Do not introduce bright, saturated colors outside of status indicators.
- Do not name vendors (tl;dv, Google, OpenAI, Slack, etc.) anywhere in the UI. Use generic terms.
- Do not add loading spinners for local operations — they should be instant.
- Do not refactor and add features in the same PR.

---

## Verification Checklist

Before declaring the revision complete, every item below must be true. Verify by walking through the app, not by reading code.

- [ ] Every screen's most important element is obvious within 1 second
- [ ] `cmd+k` works from every surface
- [ ] `j/k`, `Enter`, `Space`, `Escape`, `n` behave consistently across every list/table
- [ ] Every action reachable from the mouse is reachable from the keyboard
- [ ] No animation exceeds 150ms
- [ ] `prefers-reduced-motion` is respected
- [ ] Geist Sans loads on every page; no fallback to system fonts visible on first paint
- [ ] No more than three type sizes visible on any single screen
- [ ] Every list/table has a purposeful empty state
- [ ] Every async operation has appropriate loading treatment
- [ ] Every error state is inline and actionable
- [ ] No vendor branding appears anywhere in the UI
- [ ] Dark mode works on every surface (if dark mode is shipped)
- [ ] Focus rings are visible on every interactive element
- [ ] No full-page layout shift when navigating between primary surfaces

---

## What I Expect From You Before Coding

Produce a migration plan that includes:

1. A summary of the current frontend — framework, existing component library (if any), styling approach, current state of keyboard handling and command palette
2. The specific changes required in each phase above, scoped to this repo
3. Any conflicts between this document and the existing codebase, with proposed resolution
4. An estimate of PR count and rough sequencing
5. The first phase's concrete task list

Wait for my approval on the plan before making changes.
