# Life Of Pi

A personal daily planner: plan the day, timebox it, work it, shut it down. Runs entirely in the browser with data stored locally; a Windows app follows.

The full build plan, feature list and rules are in [PLAN.md](PLAN.md).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

## Check it

```bash
npm run typecheck  # types
npm test           # unit tests for the data layer and rules
npm run e2e        # browser tests against a production build
```

## Layout

| Folder | Holds |
|---|---|
| `src/app` | Shell, navigation, routing, global shortcuts, theme |
| `src/features` | One folder per view |
| `src/domain` | Pure rules (dates, ordering, and later rollover, workload, scheduling) |
| `src/data` | Database schema, commands with undo, live queries |
| `src/platform` | The one place OS-specific behaviour lives |
| `src/styles` | Design tokens |
| `e2e` | Browser tests |

## Status

Phases 0 to 4 of 8 are done.

- **Phase 0:** project foundation, local storage, undo, app shell, light and dark themes.
- **Phase 1:** tasks and the board. Add-task window with typing shortcuts (`~` time, `#` channel, `@` date, `!` priority), task cards, task page with subtasks and rich-text notes, channels and filter, the Today view, the day-column board with drag and drop, and the task keyboard shortcuts.
- **Phase 2:** calendar and timeboxing. A time grid in the right panel and as its own view (day, 3 days, week); drag a task onto it, move and resize sessions, draw events; `X` auto-schedules into the next free time and offers choices when the day is full; planned time and sessions stay in step; finishing early shortens the session and pulls the next ones forward; a workload counter on every day.
- **Phase 3:** timer and focus. `Space` starts or pauses a task's timer and `F` opens focus mode: one task with its timer, subtasks and notes. Actual time shows beside planned time on every card and can be typed in with `E`. A focus bar follows the running task, `K` takes a break, a prompt offers to switch when the next timeboxed task is about to start, and finishing the day's last task celebrates.

- **Phase 4:** the daily cycle. Unfinished tasks roll over at midnight with a count of consecutive days; a task that rolls over too long with no progress goes to the archive (threshold adjustable, restorable); deleted tasks wait a week in the trash; `Ctrl+F` searches. Daily planning (`P`) walks through a look back, adding tasks, checking the workload, finalizing and a written plan, and resumes where you left off. Daily shutdown (`O`) reviews the day, keeps its highlights and a reflection, and files them under Highlights. Both are offered at their set times once setup is complete, never interrupting a running timer.

Not built yet within these phases: the month calendar range, turning an event into a task, repeating events, editing a time entry's start and end, showing tracked time on the calendar, and the faded "worked on this" copy a task leaves on earlier days.

Weekly rituals, objectives, Backlog and Settings are placeholders until their phase.
