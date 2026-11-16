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

Phases 0 and 1 of 8 are done.

- **Phase 0:** project foundation, local storage, undo, app shell, light and dark themes.
- **Phase 1:** tasks and the board. Add-task window with typing shortcuts (`~` time, `#` channel, `@` date, `!` priority), task cards, task page with subtasks and rich-text notes, channels and filter, the Today view, the day-column board with drag and drop, and the task keyboard shortcuts.

Calendar, Focus, the rituals, Backlog and Settings are placeholders until their phase.
