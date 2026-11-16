# Life Of Pi — End-to-End Build Plan

A personal, single-user daily planner with the same feature set, flows and feel as Sunsama, minus integrations and AI drafting. Built as a web app first, then wrapped as a Windows app.

**Visual flow reference:** https://claude.ai/artifact/WoeYgxdcnkbEg14AzH5hQz (every flow drawn screen by screen)

---

## 0. Scope and ground rules

| | |
|---|---|
| **Goal** | Feature and flow parity with Sunsama's core product: Today view, day-column board, timeboxing calendar, guided daily planning, daily shutdown and highlights, weekly objectives, weekly planning and review, focus mode, backlog, archive, channels, onboarding. |
| **Source of truth** | Sunsama's user manual (help.sunsama.com). Steps, defaults, rules and shortcuts in this plan are taken from it. Look and motion are tuned by eye against videos and screenshots. |
| **Platform** | Web app first. Windows app second, as a thin shell around the same build (§3). |
| **Out of scope** | Calendar and task-tool integrations, the AI planning agent and assistant, AI summaries and suggestions, accounts, teammates, sharing to chat or email, billing, mobile apps. |
| **Replaced, not dropped** | Calendar sync → built-in calendar. Sign-up → local profile. Post to Slack/Teams → copy as text. AI-drafted highlights → highlights you pick. |
| **Branding** | Same behaviour and layout logic, same calm feel. Own name, logo, illustrations and long-form copy. |

---

## 1. Feature inventory

### 1.1 Views
| View | Key | What it is |
|---|---|---|
| **Today** | `T` | Default opening view. This week's objectives · today's task list · right panel. |
| **This week** | `N` | Weekly objectives with the tasks aligned to each, "What remains" and "Progress" cards. |
| **Board** | `H` | One column per day, scrolling both ways. Date header, Add task, workload counter, task cards. |
| **Calendar** | `J` | Calendar in the centre (one day, three days, weekdays, week, month), tasks in the right panel. |
| **Focus** | `F` | One task, its subtasks, notes and timer. |
| **Backlog** | `B` | Full-page backlog with time buckets and folders. |
| **Right panel** | `>` | Calendar, weekly objectives, compact backlog, archive, search, trash. |

### 1.2 Tasks
| Feature | Behaviour |
|---|---|
| **Add task** | `A` opens the add window. Typing shortcuts: `~` planned time, `#` channel, `!` priority, `@` start date (or `@backlog`), `$` objective, `>` make subtask of another, `<` backlog folder. |
| **Task card** | Check circle, title, channel, planned and actual time, subtask progress, rollover-count badge, priority flag, "This week" label when linked to an objective. |
| **Task page** | Title, rich-text notes, subtasks with their own times, channel, start date, planned/actual, timer, objective, priority, "…" menu (Repeat, Duplicate, Delete). |
| **Planned vs actual** | Planned is the estimate; actual comes from the timer or manual entries, editable per day. |
| **Subtasks** | Timed and completable; checking one counts as activity for the day. |
| **Recurring** | Daily, weekdays, weekly on chosen days (every 1–8 weeks), monthly (date or weekday pattern), yearly. Optional "at roughly" time. Series editing from any instance. |
| **Priority** | Daily: Urgent, Priority, Normal, Low (resets daily). Backlog: Urgent, High, Medium, Low, None (persistent). |
| **Trash** | Deleted tasks restorable for 7 days. |

### 1.3 Time
| Feature | Behaviour |
|---|---|
| **Timeboxing** | Drag a task onto the calendar, or `X` to auto-schedule. Move and resize with 5-minute snapping. Multiple sessions per task. |
| **Events** | Created on the built-in calendar; block time for auto-scheduling; can be dragged into the task list. |
| **Timer** | `Space` starts or stops. Starting a timer enters focus mode (setting). |
| **Breaks** | `K`. Optional reminders, 25 minutes on and 5 off by default. Task-timer or Pomodoro display. |
| **Focus bar** | Current task, timer, play/pause, complete, hide. Docked in the web app; floating on Windows. |
| **Workload counter** | Per day, against the workload threshold; yellow near it, red over it. |

### 1.4 Rituals
| Ritual | Default time | Steps |
|---|---|---|
| **Daily planning** `P` | Chosen in first run | Reflect on yesterday (conditional) → Add tasks → Check the workload → Finalize → Daily plan |
| **Daily shutdown** `O` | 17:00 | Review your day → Highlights and reflection → Close |
| **Weekly planning** | Monday 08:00 | Objectives → Weekly plan |
| **Weekly review** | Friday 15:00 | Objectives in review → What got done → Summary |
| **Highlights** | — | Feed of each day's highlights and reflection, by date |

### 1.5 Organisation and utility
Contexts and channels (with a personal context that never counts toward workload), channel filter `Shift F`, command palette `Ctrl K`, search `Ctrl F`, full keymap (§8), undo `Ctrl Z`, celebrations (confetti, sparkles, emoji; switchable), dark mode `Shift L`, data export/import.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| App | **React + TypeScript + Vite** (static SPA) | No server; the same build runs in a browser and inside the Windows shell. |
| Routing | **TanStack Router** | Typed routes; date, panel and open task live in the URL. |
| Data | **Dexie (IndexedDB)**, `useLiveQuery` for reads | Local, instant, offline. Works unchanged inside the Windows shell. |
| Write layer | **Command layer** with inverse operations | One home for business rules, undo and activity logging; a hosted sync backend can sit behind it later. |
| UI state | **Zustand** | Selection, panels, drag state, timer tick. |
| Styling | **Tailwind CSS** + CSS-variable tokens | Light/dark and by-eye calibration from one file. |
| Primitives | **Radix UI** | Accessible dialog, popover, menu, tooltip. |
| Drag and drop | **dnd-kit** | Board, lists and drag-to-calendar in one system. |
| Motion | **Motion** (Framer Motion) | Layout animation, springs, shared-element transitions. |
| Calendar | **Custom time grid** | Full control of drag feel and visuals. |
| Rich text | **Tiptap** | Notes with `/` menu and Markdown shortcuts. |
| Dates | **date-fns**, **rrule** | Date maths and recurrence. |
| Palette | **cmdk** | Command palette. |
| Tests | **Vitest**, **Playwright** | Rules engine unit tests; end-to-end flows with a mocked clock. |

```
src/
  app/        routes, shell, providers
  features/   today/ week/ board/ calendar/ task/ focus/ rituals/
              backlog/ archive/ onboarding/ settings/ palette/
  domain/     pure rules: rollover, archive, workload, scheduling, recurrence, ordering
  data/       Dexie schema, commands, queries, undo, export/import
  platform/   one interface, two implementations: web now, Windows later
  ui/         design-system components
  styles/     tokens.css, motion.ts
src-tauri/    Windows shell (added in Phase 8)
e2e/          Playwright specs
```

---

## 3. Web first, Windows after

The Windows app is the same web build inside **Tauri** (uses the WebView2 runtime already on Windows 10/11; small installer, low memory). To keep that step small, the web app is built with these constraints from day one:

| Decision now | Why it matters later |
|---|---|
| Static SPA, no server, no cookies | The shell just loads the built files. |
| Everything OS-related goes through `src/platform/` | Notifications, global shortcuts, tray, floating focus bar, launch at login, backup files: web gets a browser version or a no-op; Windows gets the native version. No feature code changes. |
| Data access only through the command layer | Storage can stay IndexedDB or move to a SQLite file without touching features. |
| Single-letter shortcuts, as Sunsama uses | Avoids browser-reserved combinations; the few `Ctrl` ones are intercepted. |
| Focus bar is its own component | Docked in the web app, moved into a small always-on-top window on Windows. |

**What the Windows app adds:** floating focus bar, tray icon with timer, global shortcuts (`Ctrl Shift A` add task, `Ctrl Shift Space` timer, `Ctrl Shift F` focus bar), native notifications, launch at login, automatic backup file in Documents.

**How it gets built:** this environment is Linux, so the installer is produced by a GitHub Actions workflow on a Windows runner and attached to a release.

**Two things to know:**
- Data in the browser and data in the Windows app are separate stores. Export from one, import into the other.
- The installer will be unsigned, so Windows shows a SmartScreen prompt on first install.

---

## 4. Data model

| Entity | Key fields |
|---|---|
| **Profile** | name, createdAt, onboardingCompletedAt, guidedPlansRemaining |
| **Settings** | timeFormat, weekStartsOn, defaultView, newTaskPosition, rolloverPosition, priorityRollover[], workloadThresholdMin (or per weekday), countPlannedAsActual, schedule{per weekday start/end or unavailable}, planningTime, autoPlanning, autoRolloverInEvening, shutdownAuto, endOfDayMessage, weeklyPlan{day,time,auto}, weeklyReview{day,time,auto}, combineWeekly, includeWeekends, journalingStep, defaultBlockMin, autoScheduleGapMin, rescheduleOnConflict, rescheduleOnEarlyFinish, focusOnTimerStart, breakReminders{on,workMin,breakMin}, focusTimerMode, sounds{…}, celebrations{…}, darkMode, archiveAfterDays (1–14 or off) |
| **Context** | id, name, color, isPersonal, order |
| **Channel** | id, contextId, name, color, isDefault, enabled, schedule? |
| **Task** | id, title, notes, channelId, **date** (null = backlog), order, plannedMin, dailyPriority, backlogPriority, backlogBucket, backlogFolderId, objectiveId, completedAt, rolloverDays, lastActivityDate, archivedAt, deletedAt, seriesId, seriesDate, edited, kind (`task`/`ritual`/`setup`) |
| **Subtask** | id, taskId, title, order, plannedMin, completedAt |
| **TimeEntry** | id, taskId, subtaskId?, start, end (null = running) |
| **Session** | id, taskId, date, startMin, endMin (a timebox) |
| **Event** | id, title, date, startMin, endMin, channelId?, repeat?, blocksTime |
| **Series** | id, rrule, atRoughlyMin?, rigid, template{title, notes, subtasks, channelId, plannedMin} |
| **BacklogFolder** | id, name, order |
| **Objective** | id, weekStart, title, notes, channelId, order, completedAt, extendedToWeek? |
| **DayRecord** | date, planStatus, planStep, planText, obstacles, shutdownTime, shutdownStatus, highlights[], mood, reflection, publishedAt |
| **WeekRecord** | weekStart, planStatus, planText, reviewStatus, reviewText |

Derived, never stored: actual minutes, workload, partial-credit copies on earlier days, objective progress.

---

## 5. Flows

The screens for each step are drawn in the flow reference linked at the top.

### 5.1 First run
Three setup screens, then guided planning that must be completed to reach the workspace.

| # | Screen | Sets | Sunsama equivalent |
|---|---|---|---|
| 1 | Profile: your name | Profile | Sign-up |
| 2 | Workday: hours, workload threshold, starter contexts and channels | Schedule, threshold, channels | Pick your task tools |
| 3 | Calendar: add fixed repeating commitments (skippable) | Events | Connect your calendars |
| 4 | Planning time | Morning mode (before 15:00) or evening mode | Choose your daily planning time |
| 5 | Today or tomorrow | Which day the first plan is for | same |
| 6 | Add tasks | First real tasks | same |
| 7 | Set time estimates | Planned times; warns over threshold | same |
| 8 | Fill in the rest: drag events and backlog items into the day | Honest workload | Fill in from other tools |
| 9 | Push back what can wait | Tomorrow / Next week / any day | same |
| 10 | Finalize: order, timebox, shutdown time → **Looks good** | Sessions, shutdown time | same |
| 11 | Review and start → **Get started** | Plan text, obstacles | Share and start |

Guided steps show a coach panel on the left and a progress bar on top. Afterwards: land on the workspace, a "Set up Life Of Pi" task appears in today's list, and the coached version runs again for the next two planning sessions.

### 5.2 Daily planning
Opens with `P`, the Plan item, Plan at the top of a board column, or automatically at the planning time. `←` `→` move between steps.

| Step | Screen | Logic |
|---|---|---|
| 0 | **Reflect on yesterday** | Only if yesterday's shutdown was not done. Check off finished work, fix times. |
| 1 | **Add tasks** — "What do you want to get done today?" | Rolled-over tasks pre-listed. Add, pull from backlog, or drag an objective in. Set channel and planned time. |
| 2 | **Check the workload** — "What can wait?" | Work-context planned total vs threshold, with projected finish vs shutdown time. `D` defer, `Z` backlog, or drag to another day. |
| 3 | **Finalize your plan** | Order tasks; optional timeboxing (drag or `X`); confirm shutdown time. |
| 4 | **Daily plan** | Editable plan text and obstacles; Copy; **Get started**. Can be disabled permanently. |

On finishing: celebration, check on the Plan item, a completed "Daily planning" card added to the day (click to reopen the plan), default view opens.

### 5.3 Working the day
Today view → `F` focus on a task (or start a timer) → subtasks and notes → nudges (break reminder; "starts soon, shift focus?" five minutes before the next session) → `C` complete → focus moves to the next task → "Done for the day" screen when the list is empty.

### 5.4 Daily shutdown
Opens with `O`, the Shutdown item, or the reminder at shutdown time (snooze 30 minutes / dismiss until tomorrow).

| Step | Screen | Logic |
|---|---|---|
| 1 | **Today in review** | Total time, worked on, didn't get to. |
| 2 | **Highlights and reflection** | Star, reorder, remove highlights; mood; "Today was…". Side panel: time by channel, objectives, timeline. **Done for the day**. |
| 3 | **Close** | Confirmation, end-of-day message, celebration; focus mode stops. Unfinished tasks are not moved. |

### 5.5 Weekly planning and review
| Ritual | Steps | Logic |
|---|---|---|
| **Planning** | 1 Objectives (add, attach tasks, carry over last week's, "What remains") → 2 Weekly plan text → **Done** | From Thursday on it plans next week. Adds a "Weekly planning" card. |
| **Review** | 1 Objectives with time and progress → 2 What got done (per-day tasks, total logged, daily chart, time by channel) → 3 Summary → **Wrap up** | Monday–Wednesday it reviews last week. Step 1 skipped with no objectives. Can be combined into planning. |

---

## 6. Rules engine

Pure functions in `src/domain/`, each unit-tested with an injectable clock.

| Rule | Behaviour | Default |
|---|---|---|
| **Rollover** | At midnight (or on next open), unfinished tasks move to the next day; `rolloverDays += 1`; placed at top or bottom. | Position is a setting |
| **Partial credit** | If a subtask was checked or time was tracked on a day, a faded copy without a checkbox stays on that day. | On |
| **Auto-archive** | Archived when rolled over more than N consecutive days with no activity; activity resets the count. Note at the foot of the list; badge on the archive icon. Restore by giving it a day. | N = 4; 1–14 or off |
| **Trash** | Soft delete, purged after 7 days. | 7 days |
| **Workload** | Sum of planned time for work-context tasks vs threshold; yellow when close, red when over. Counter cycles time remaining / work time remaining / actual vs planned. | Threshold from first run |
| **Sessions** | Length = remaining planned time, else default. Planned time = total of sessions; editing either updates the other. 5-minute snapping. | 30 min |
| **Auto-schedule** | Next free slot that day inside working hours, never in the past, avoiding events and sessions, honouring the gap. ≤ 1 h splits only if necessary; longer splits into at most 3 blocks; `Shift X` never splits. | 09:00–17:00, no gap |
| **No room** | Offer: Schedule anyway · Schedule another day (up to a month ahead) · Defer · Cancel. | — |
| **Reschedule on conflict** | Dropping a session on another moves displaced ones to the next free time (split if needed; unpinned if they don't fit). Undo offered. `Shift` while dropping skips it. | On |
| **Early finish** | Session ends at completion time; later back-to-back sessions move forward until the first gap ≥ 30 min. Completing before a session starts removes it. | On |
| **Moving tasks** | Later day: future sessions removed. Backlog: upcoming sessions removed, folder kept. Scheduling from backlog drops the folder. | — |
| **Timer** | One at a time. Running state derived from the entry's start, so it survives reload. No future entries. | Long-timer alert 4 h |
| **Recurring** | Unedited instance rolls over until it meets the next instance, then is removed. Editing title, notes, subtasks, time or channel makes it unique and it stays. | — |
| **Priority** | Daily priority resets to Normal each day unless the level is set to persist. | Reset |
| **Ritual timing** | Planning time before 15:00 plans today; 15:00 or later plans tomorrow. Same time as shutdown → shutdown first. Weekly planning plans next week from Thursday; review covers last week Mon–Wed. Prompts never interrupt a running timer. | — |

---

## 7. UI and motion

### 7.1 Shell
Left panel (Today, This week, Board, Calendar, Focus · Daily rituals: Plan, Shutdown, Highlights · Weekly rituals: Plan, Review · Backlog with folders) — main view with date controls, Back to today and Filter — right panel — icon rail. `<` and `>` hide the panels; the left one slides back when the cursor touches the edge. Rituals show "Start" when due and a check when done.

### 7.2 Design tokens (starting point; calibrated in Phase 7)
| Group | Light | Dark |
|---|---|---|
| Canvas / surface | soft off-white / white | near-black / raised charcoal |
| Border | 1px soft neutral | 1px low-contrast |
| Text | three levels | three levels |
| Accent | one restrained hue for primary actions and today | lifted |
| Status | green (done), yellow (near threshold), red (over) | lifted |
| Channels | 12 pastel tags | 12, tuned for dark |

Type: one humanist sans, 13–14px UI, 15px task titles. Shape: 8px cards, 6px controls, 12px modals; faint layered shadows. Columns 280px.

### 7.3 Motion
| Interaction | Behaviour | Timing |
|---|---|---|
| Complete task | Check draws, title mutes and strikes, card settles | 250ms ease-out |
| Add task | Card grows in, neighbours slide | 180ms spring |
| Drag | Lift (scale 1.02, deeper shadow), tinted placeholder, spring on drop | 120ms / ~300ms |
| Drag to calendar | Ghost session snaps in 5-minute steps with a live time label | immediate |
| Task page | Fade + scale from 0.98; backdrop dims | 160ms in, 120ms out |
| Panels | Width slide, content fade | 200ms |
| Ritual steps | Slide and crossfade; progress segment fills | 280ms |
| Workload counter | Width and colour tween | 300ms |
| Celebrations | Confetti, sparkles or emoji on planning done, shutdown done, all tasks done | ~1.2s, skippable |
| Toasts | Slide up, 5s, with Undo | 180ms |

`prefers-reduced-motion` reduces everything to fades.

### 7.4 Responsive
≥1200px full shell · 900–1200px right panel overlays · below 1024px the objectives column hides · phone width: single day list; rituals stay desktop-only, as in Sunsama.

---

## 8. Keyboard map

Sunsama's bindings, minus integration panels. `Ctrl` on Windows.

| Area | Keys |
|---|---|
| **Go to** | `T` Today · `N` This week · `H` Board · `J` Calendar · `B` Backlog · `P` Planning · `O` Shutdown · `Shift Space` today · `Shift ←/→` day · `Shift F` filter · `Ctrl K` palette · `Ctrl F` search · `Shift L` dark mode · `<` `>` panels · `?` all shortcuts |
| **Right panel** | `Shift C` calendar · `Shift T` tasks · `Shift R` objectives · `Shift B` backlog · `Shift A` archive |
| **Add** | `A` add · `~` time · `#` channel · `!` priority · `@` date · `$` objective · `>` subtask of · `<` folder · `Enter` create · `Ctrl Enter` create and open · `Ctrl Shift ↑/↓` create at top/bottom |
| **Select** | `↑/↓` task · `Shift ↑/↓` first/last · `←/→` previous/next day |
| **On a task** | `C` complete · `Space` timer · `F` focus · `K` break · `W` planned · `E` actual · `Q` channel · `!` priority · `R` objective · `@` date · `V` subtask · `Ctrl Enter` open · `Ctrl D` duplicate · `Ctrl ⌫` delete · `Ctrl Z` undo |
| **Schedule and move** | `X` auto-schedule · `Shift X` one block · `Ctrl X` remove from calendar · `S` today · `D` snooze a day · `Z` backlog · `Shift Z` top of backlog · `Ctrl ↑/↓` move · `Ctrl Shift ↑/↓` top/bottom · `Ctrl S` sort by start time |
| **Rituals** | `←/→` previous/next step |
| **Notes** | `/` format menu · `Ctrl B/I/U` · Markdown shortcuts |
| **Windows app** | `Ctrl Shift A` add from anywhere · `Ctrl Shift Space` timer · `Ctrl Shift F` focus bar |

---

## 9. Routes

| Route | Screen |
|---|---|
| `/welcome`, `/setup/:step` | First run |
| `/today?date=` | Today |
| `/week?start=` | This week |
| `/board?date=` | Board |
| `/calendar?view=&date=` | Calendar |
| `/focus/:taskId` | Focus |
| `/plan/:date/:step`, `/shutdown/:date/:step` | Daily rituals |
| `/weekly/plan/:step`, `/weekly/review/:step` | Weekly rituals |
| `/highlights`, `/backlog` | Lists |
| `/settings/:section` | Settings |
| `?task=:id` on any route | Task page overlay |

---

## 10. Build phases

| Phase | Delivers | Done when |
|---|---|---|
| **0. Foundation** | Scaffold, tokens, primitives, Dexie schema, command layer + undo, platform interface, shell, routing | Shell renders light/dark; a task round-trips through storage. |
| **1. Tasks and board** | Add-task window with typing shortcuts, cards, task page, subtasks, notes, channels/contexts, filter, board, Today view, drag reorder and move | A day can be planned by hand. |
| **2. Calendar and timeboxing** | Time grid, events, sessions, drag/resize, auto-schedule, reschedule rules, right panel, calendar view, workload counter | Tasks and sessions stay in sync through every move. |
| **3. Timer and focus** | Time entries and editor, focus mode, focus bar, breaks, sounds | Actual time survives reload and shows everywhere. |
| **4. Daily rituals** | Rollover, partial credit, auto-archive, trash, daily planning, daily shutdown, highlights, ritual prompts, celebrations | A full day cycle runs with a mocked clock. |
| **5. Weekly and backlog** | Objectives, This week, weekly planning and review with charts, backlog buckets and folders, priority, recurring series | A full week cycle runs. |
| **6. First run and settings** | Setup screens, guided planning, setup task, all settings, export/import | Fresh profile → planned first day, no dead ends. |
| **7. Polish** | Command palette, full keymap, motion pass, visual calibration, empty states, responsive, accessibility | Reads as the same kind of product next to the reference. |
| **8. Windows app** | Tauri shell, tray, floating focus bar, global shortcuts, native notifications, launch at login, backup file, CI installer build | Installer from a GitHub release runs the full cycle on Windows. |
| **Later** | Hosted sync, parallel tasks, merge tasks, auto-sort | — |

**Verification throughout:** unit tests for every rule in §6; Playwright runs for first run, a day cycle, rollover and archive across midnight, a week cycle, and export → wipe → import; screenshots per phase in light and dark.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Drag feel across lists and calendar | Built in Phases 1–2, before anything depends on it. |
| Visual fidelity without exact values | Token-driven styling; calibration pass against screenshots or recordings. |
| Date logic (midnight, DST, week boundaries, the 15:00 line) | Local `YYYY-MM-DD` dates, minutes-of-day for sessions, injectable clock in tests. |
| Data loss on one device | Export/import from Phase 6; automatic backup file on Windows. |
| Windows shell can't be run in this environment | Built and smoke-tested in CI on a Windows runner; first real run is on your machine. |

---

## 12. Open items

| # | Item | Status |
|---|---|---|
| 1 | Data storage | **Decided:** local now, hosted later. |
| 2 | Name | **Decided:** Life Of Pi. |
| 3 | Platform | **Decided:** web app first, Windows app in Phase 8. |
| 4 | Visual reference | Screenshots or a short recording of the Today view, board, task page, planning and shutdown would sharpen the calibration pass. Not needed to start. |
