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

Phase 0 of 8 is done: project foundation, storage, undo, app shell, light and dark themes. Views other than Today are placeholders until their phase.
