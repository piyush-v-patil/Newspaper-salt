# Life Of Pi

A personal daily planner: plan the day, timebox it, work it, shut it down. Runs entirely in the browser with data stored locally; a Windows app follows.

The full build plan, feature list and rules are in [PLAN.md](PLAN.md).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

## Use it on the web

Every push publishes the web app to GitHub Pages at **https://piyush-v-patil.github.io/Newspaper-salt/**. It needs a one-time switch in the repository: **Settings → Pages → Source: GitHub Actions**. The address is public, but there is no shared data: everything you add stays in your own browser, and each visitor starts with an empty app.

## The Windows app

The same app, wrapped as a desktop program with [Tauri](https://tauri.app). On top of the web version it adds:

- a tray icon whose tooltip shows the running timer; closing the window keeps the app in the tray
- shortcuts that work from any app: `Ctrl+Shift+A` add a task, `Ctrl+Shift+Space` start or stop the timer, `Ctrl+Shift+F` show or hide the floating focus bar
- a small focus bar that floats above other apps while a task is in progress
- system notifications for rituals, breaks and planned time, when the app is in the background
- an option to open at sign-in, quietly in the tray
- a native save dialog for backups

**Getting the installer.** Every push builds one on GitHub: open the repository's **Actions** tab, pick the latest **Windows app** run, and download **life-of-pi-windows-installer** under Artifacts. Pushing a tag such as `v0.1.0` also attaches it to a release. The installer is not code-signed, so Windows SmartScreen will warn on first run: choose **More info**, then **Run anyway**.

**Building it yourself on Windows.** Install [Node 22](https://nodejs.org), [Rust](https://rustup.rs) and the Visual Studio C++ Build Tools, then:

```bash
npm install
npm run desktop:dev     # run the desktop app with live reload
npm run desktop:build   # build the installer into src-tauri/target/release/bundle
```

**Your data.** The desktop app and the browser version keep separate data. To move between them, use **Settings → Your data → Export backup** in one and **Restore from a backup** in the other.

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
| `src/platform` | The one place OS-specific behaviour lives: `web.ts` for browsers, `desktop.ts` for the Windows app |
| `src-tauri` | The desktop shell: tray, window behaviour, plugins and installer settings |
| `.github/workflows` | Tests on every push, and the Windows installer build |
| `src/styles` | Design tokens |
| `e2e` | Browser tests |

## Status

Phases 0 to 6 of 8 are done.

- **Phase 0:** project foundation, local storage, undo, app shell, light and dark themes.
- **Phase 1:** tasks and the board. Add-task window with typing shortcuts (`~` time, `#` channel, `@` date, `!` priority), task cards, task page with subtasks and rich-text notes, channels and filter, the Today view, the day-column board with drag and drop, and the task keyboard shortcuts.
- **Phase 2:** calendar and timeboxing. A time grid in the right panel and as its own view (day, 3 days, week); drag a task onto it, move and resize sessions, draw events; `X` auto-schedules into the next free time and offers choices when the day is full; planned time and sessions stay in step; finishing early shortens the session and pulls the next ones forward; a workload counter on every day.
- **Phase 3:** timer and focus. `Space` starts or pauses a task's timer and `F` opens focus mode: one task with its timer, subtasks and notes. Actual time shows beside planned time on every card and can be typed in with `E`. A focus bar follows the running task, `K` takes a break, a prompt offers to switch when the next timeboxed task is about to start, and finishing the day's last task celebrates.

- **Phase 4:** the daily cycle. Unfinished tasks roll over at midnight with a count of consecutive days; a task that rolls over too long with no progress goes to the archive (threshold adjustable, restorable); deleted tasks wait a week in the trash; `Ctrl+F` searches. Daily planning (`P`) walks through a look back, adding tasks, checking the workload, finalizing and a written plan, and resumes where you left off. Daily shutdown (`O`) reviews the day, keeps its highlights and a reflection, and files them under Highlights. Both are offered at their set times once setup is complete, never interrupting a running timer.

- **Phase 5:** the weekly cycle and longer horizons. Backlog with time buckets, folders and its own priority; weekly objectives with linked tasks and progress on the This week view (`N`); weekly planning and weekly review; recurring tasks (daily, weekdays, weekly on chosen days, monthly, yearly, every N) that create a month ahead, never pile up when skipped, and can be updated or stopped as a series.

- **Phase 6:** first run and settings. Setup asks for a name, workday hours and days, a workload limit, starter channels and a planning time, then leads into a coached first plan; nothing else opens until that plan is done. Settings covers general preferences, task placement and archiving, working hours per day, every ritual's time and reminder, timeboxing rules, focus and breaks, channels and contexts, a shortcut list, and your data (export a backup, restore one, or erase everything). Weekly planning and review are now offered at their set times too.

Since then: a month range on the calendar, turning an event into a task, repeating events, faded copies of work done on earlier days for tasks that moved on, colour themes for light and dark, and:

- **Due dates** separate from the planned day, with a notice on Today for tasks due but planned elsewhere; date pickers accept typed dates ("dec 3").
- **Tracked time:** time individual subtasks, edit an entry's start and end or log one by hand, show what you actually worked as solid blocks on the calendar, and time a second task alongside the main one.
- **Repeating tasks** "at roughly" a time (timeboxed automatically) and a way to change how often an existing series repeats; **repeating events** every other week, monthly or yearly, with "Apply to all upcoming" and "Delete this and following".
- **Setup** asks for fixed weekly commitments (lunch, stand-up…) and turns them into repeating events; a **workload limit per weekday**; **channel hours** for auto-scheduling.
- **Add-task shortcuts** `$` objective, `>` subtask of another task, `<` backlog folder.
- **Highlights** can be starred and reordered, with a "Starred only" view.
- **Merge** a task into another, and **sort** a day by time then priority.
- **Counters** on tasks (applications sent, problems solved), with a target, `+`/`-` keys, and a fresh count on each day of a repeating task.

- **Automatic backups.** The Windows app saves a backup file every day (when something changed) to `Documents\Life Of Pi Backups` or a folder you choose, such as a OneDrive folder; the web app keeps daily snapshots in the browser and reminds you weekly to download a copy. A backup is also taken before any restore, import or erase. The last two weeks are kept, then one a week for two months. Settings → Your data lists them, with Back up now and Restore.

- **Sign-in and sync.** Settings → Account & sync: create an account or sign in with email and password, and every device signed in to it stays in step, in the background (on start, every half minute, on focus, back online, and a moment after any change). Everything still works offline. The newest change to a record wins. The first sign-in on a device uploads its data, downloads the account's, or (when both have data) asks whether to use the account's or combine them. A new device can sign in from the welcome screen and skip setup. Data lives in Supabase (`supabase/schema.sql`); row-level security means each account sees only its own rows.

