# Momentum — Keyboard Shortcuts Reference

Give this file to Claude Code as supplementary context so it implements every shortcut correctly.

---

## Global Shortcuts (work from anywhere)

| Key            | Action                                     |
| -------------- | ------------------------------------------ |
| `/`            | Focus the task input bar                   |
| `Escape`       | Blur input / close any modal               |
| `Cmd/Ctrl + K` | Open command palette                       |
| `Cmd/Ctrl + P` | Open "Plan My Day"                         |
| `Cmd/Ctrl + R` | Open "End of Day Review"                   |
| `Cmd/Ctrl + W` | Open Weekly Stats                          |
| `Cmd/Ctrl + E` | Export all data as JSON                    |
| `Cmd/Ctrl + I` | Import data from JSON file                 |
| `Tab`          | Toggle between Today view and Backlog view |
| `1-9`          | Filter by role (number = role position)    |
| `0`            | Show all roles (clear filter)              |

## Task Navigation (Today View)

| Key        | Action                     |
| ---------- | -------------------------- |
| `j` or `↓` | Select next task           |
| `k` or `↑` | Select previous task       |
| `h` or `←` | Move focus to left column  |
| `l` or `→` | Move focus to right column |

## Task Actions (with a task selected)

| Key                     | Action                               |
| ----------------------- | ------------------------------------ |
| `Enter`                 | Start task (move to In Progress)     |
| `Space`                 | Complete task (move to Done)         |
| `e`                     | Edit task inline                     |
| `d`                     | Defer task to tomorrow               |
| `Delete` or `Backspace` | Delete task (with 5s undo)           |
| `t`                     | Move to today (when in Backlog view) |

## Quick-Add Syntax

| Modifier         | Example             | Meaning                    |
| ---------------- | ------------------- | -------------------------- |
| `~Xm` or `~Xh`   | `~30m`, `~2h`       | Time estimate              |
| `#role`          | `#product`          | Assign to role             |
| `!h`, `!m`, `!l` | `!h`                | Priority (high/medium/low) |
| `+date`          | `+tomorrow`, `+mon` | Schedule date              |

## Important UX Rules for Implementation

1. **Keyboard shortcuts must NOT fire when the input bar or any text input is focused.** Only fire shortcuts in "navigation mode" — when no input element has focus.
2. **The input bar captures `/` keypresses globally** — pressing `/` from anywhere should focus the input bar, even if another element is focused (except during modal dialogs).
3. **Modal shortcuts (Plan My Day, Review, Stats, Command Palette) should trap focus** — `Tab` cycles within the modal, `Escape` closes it.
4. **The command palette should support fuzzy matching** — typing "pla" should match "Plan My Day", typing "dark" should match "Toggle Dark Mode".
5. **In Progress lane enforces max 2 tasks.** If user tries to start a 3rd task, show a confirmation dialog: "You already have 2 tasks in progress. Pause one first?" with the option to select which to pause (move back to Up Next).
