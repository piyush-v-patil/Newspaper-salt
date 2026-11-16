# Daily Planner — End-to-End Build Plan

A personal, single-user daily planner with the same feature set, flows, and feel as Sunsama — minus third-party integrations.

**Working name:** Meridian (placeholder — rename any time)

---

## 0. Scope and ground rules

| | |
|---|---|
| **Goal** | Feature and flow parity with Sunsama's core product: day-column board, timeboxing calendar, guided daily planning, daily shutdown, weekly planning/review, focus mode, backlog, channels, objectives, onboarding. |
| **In scope** | Everything a single user does inside the app, end to end: first launch → onboarding → first plan → working the day → shutdown → weekly cycle. |
| **Out of scope** | Integrations (Google/Outlook calendar, Slack, Gmail, Asana, Jira, Notion, etc.), team/workspace features, billing, email-to-task, native mobile apps. |
| **Replaced, not dropped** | Calendar sync → a built-in local calendar. "Post plan to Slack" → copy as Markdown. Sign-up → local profile. |
| **Branding** | Same behaviour, layout logic, and calm visual feel. Own name, logo, illustrations, and written copy — nothing lifted from Sunsama's assets or text. |
| **Fidelity limit** | I can't read Sunsama's source, exact hex values, or easing curves. Tokens and motion are tuned by eye against reference screenshots (see §12, decision 3). |

---

## 1. Feature inventory

### 1.1 Planning surfaces
| Feature | What it does |
|---|---|
| **Board (home)** | Horizontally scrolling columns, one per day. Today is anchored and highlighted. Each column: date header, add-task row, workload bar, task cards. Infinite scroll both directions. |
| **My Day** | Single-day view: today's task list on the left, today's timeline on the right. |
| **Calendar view** | Full day / 3-day / week time grid with a task list rail to drag from. |
| **Right panel** | Collapsible rail next to the board, switchable between Calendar (today's timeline), Backlog, Objectives, Archive. |
| **Backlog** | Unscheduled tasks, grouped into folders (e.g. Soon, Someday, custom). Drag onto any day. |
| **Archive** | Searchable list of archived tasks with restore. |

### 1.2 Tasks
| Feature | What it does |
|---|---|
| **Task card** | Completion circle, title, channel tag, planned time, actual time, subtask progress, due date, rollover badge, recurring icon. Hover reveals quick actions. |
| **Task detail modal** | Title, rich-text notes, subtasks (each with own planned/actual time), channel, start date, due date, planned time, actual time + timer, objective link, recurrence, activity log, duplicate / move to backlog / archive / delete. |
| **Inline add** | Type a title, Enter to create, keep typing for the next. Inline tokens: `#channel`, `30m` / `1h30` for planned time. |
| **Subtasks** | Checklist with reorder, per-subtask time, convert subtask ↔ task. |
| **Planned vs actual** | Planned is an estimate; actual accrues from the timer or manual entry. Both shown on card and totals. |
| **Recurring tasks** | Daily / weekdays / weekly on days / monthly / custom interval. Edit "this", "this and following", or "all". |
| **Due dates** | Independent of the scheduled day; overdue and due-soon states surface on the card. |

### 1.3 Time
| Feature | What it does |
|---|---|
| **Timeboxing** | Drag a task onto the timeline to create a block. Move and resize with 5-minute snapping. One task can have several blocks. |
| **Auto-schedule** | One keystroke places the task in the next free slot inside working hours. |
| **Local events** | Click-drag on the grid to create an event (meeting, appointment). Events count as busy time; can be converted to a task. |
| **Timer** | Start/stop on any task or subtask. One running timer at a time. Visible in a persistent focus bar. |
| **Focus mode** | Full-screen single task: title, notes, subtasks, large timer, optional pomodoro intervals, "complete and next". |
| **Workload bar** | Per-day planned total vs daily capacity; turns amber near the limit, red over it. |

### 1.4 Rituals
| Feature | What it does |
|---|---|
| **Daily planning** | Guided multi-step flow that produces the day's plan (§4.2). |
| **Daily shutdown** | Guided review of the day with reflection (§4.4). |
| **Weekly planning** | Review last week, set 3–5 objectives, pre-place tasks across the week. |
| **Weekly review** | Time by channel, planned vs actual, objective outcomes, written reflection. |
| **Daily highlights** | Journal feed: each day's plan summary and shutdown reflection. |

### 1.5 Organisation and utility
| Feature | What it does |
|---|---|
| **Contexts and channels** | Contexts (Work, Personal) contain channels (`#deep-work`, `#admin`). Each channel has a colour. Filter the board by context or channel. |
| **Objectives** | Weekly goals; tasks link to an objective; progress = linked tasks done. |
| **Command palette** | `Cmd/Ctrl+K`: jump to date, search tasks, run any action. |
| **Keyboard shortcuts** | Full keymap for add, complete, schedule, focus, move, set time/channel/due, navigate days (§7). |
| **Undo** | `Cmd/Ctrl+Z` plus an undo toast for every destructive or bulk action. |
| **Reminders** | Browser notifications: time to plan, time to shut down, timebox starting, timer still running. |
| **Settings** | Profile, working hours, capacity, ritual times and steps, rollover and auto-archive rules, week start, time format, theme, channels, shortcuts, data export/import. |
| **Themes** | Light and dark. |

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| App | **React + TypeScript + Vite** (SPA) | Fast dev loop, no server needed for a personal tool. |
| Routing | **TanStack Router** | Typed routes and search params (date, panel, modal state in the URL). |
| Data | **Dexie (IndexedDB)** as source of truth, `useLiveQuery` for reads | Instant, offline, zero hosting cost. Every interaction is local, which is what makes the UI feel immediate. |
| Write layer | Thin **command layer** (`createTask`, `moveTask`, …) with inverse ops | One place for business rules, undo, and activity logging. A sync backend can be added behind it later. |
| UI state | **Zustand** | Ephemeral state only: selection, open panels, drag state, running timer tick. |
| Styling | **Tailwind CSS** + CSS-variable design tokens | Tokens drive light/dark and make by-eye tuning a one-file change. |
| Primitives | **Radix UI** | Accessible dialog, popover, dropdown, tooltip, without imposed styling. |
| Drag and drop | **dnd-kit** | Board reorder, cross-column moves, and drag-to-timeline in one system. |
| Motion | **Motion** (Framer Motion) | Layout animations, shared-element transitions, springs. |
| Calendar grid | **Custom-built** | Off-the-shelf calendars fight you on drag feel and visual fidelity. |
| Rich text | **Tiptap** | Notes with checklists, links, Markdown shortcuts. |
| Dates | **date-fns** + **rrule** | Date maths and recurrence expansion. |
| Palette | **cmdk** | Command palette. |
| Virtualisation | **TanStack Virtual** | Infinite day columns without DOM bloat. |
| PWA | **vite-plugin-pwa** | Installable, offline, notification support. |
| Tests | **Vitest** (rules engine), **Playwright** (end-to-end flows + screenshots) | The logic in §5 is where bugs hide; the flows in §4 are what must not break. |

**Project layout**
```
src/
  app/            routes, shell, providers
  features/       board/ calendar/ task/ rituals/ focus/ backlog/
                  objectives/ onboarding/ settings/ palette/
  domain/         pure rules: rollover, workload, recurrence, scheduling, ordering
  data/           Dexie schema, commands, queries, undo, export/import
  ui/             design-system components (Button, Card, Popover, TimeInput…)
  styles/         tokens.css, motion.ts
e2e/              Playwright specs
```

---

## 3. Data model

| Entity | Key fields |
|---|---|
| **Profile** | name, createdAt, onboardingCompletedAt |
| **Settings** | workingHours{start,end}, dailyCapacityMin, weekStartsOn, timeFormat, theme, planningTime, planningFor(`today`/`tomorrow`), shutdownTime, enabledRitualSteps, rolloverPosition(`top`/`bottom`), autoArchiveAfterRollovers, defaultChannelId, defaultBlockMin, notifications{…} |
| **Context** | id, name, order |
| **Channel** | id, contextId, name, color, order, archived |
| **Task** | id, title, notes(JSON), channelId, **scheduledDate**(null = backlog), backlogFolderId, order(fractional index), plannedMin, dueDate, startDate, completedAt, archivedAt, archiveReason, rolloverCount, objectiveId, recurrenceId, recurrenceInstanceDate, createdAt, updatedAt |
| **Subtask** | id, taskId, title, order, plannedMin, completedAt |
| **TimeEntry** | id, taskId, subtaskId?, start, end(null = running), source(`timer`/`manual`) |
| **TimeBlock** | id, kind(`timebox`/`event`), taskId?, title, date, startMin, endMin, color |
| **Recurrence** | id, rrule, templateTask{…}, startDate, endDate?, exceptions[] |
| **BacklogFolder** | id, name, order |
| **Objective** | id, weekStart, title, notes, status(`open`/`done`/`dropped`), order |
| **DayRecord** | date, planStatus, planStep, plannedAt, planSummary, shutdownStatus, shutdownAt, reflection |
| **WeekRecord** | weekStart, planStatus, reviewStatus, reflection |
| **Activity** | id, taskId, type, payload, at |

Derived, never stored: actual minutes (sum of TimeEntries), day workload, objective progress, subtask progress.

---

## 4. Flows

### 4.1 First launch and onboarding
The onboarding answers directly seed settings — nothing is asked that isn't used.

| # | Screen | Collects | Drives |
|---|---|---|---|
| 1 | Welcome | — | Sets the calm tone; single "Get started" action. |
| 2 | Your name | name | Greetings in rituals ("Good morning, …"). |
| 3 | What are you planning? | Work / Personal / Both | Seeds contexts and a starter channel set for each. |
| 4 | Your channels | edit the seeded list, pick colours | Channel list and default channel. |
| 5 | Your workday | start, end, focused hours per day | Working hours, daily capacity, calendar's visible range. |
| 6 | When do you plan? | morning of / evening before + time | Planning trigger rule (§5.5). |
| 7 | When do you stop? | shutdown time | Shutdown reminder and trigger. |
| 8 | Reminders | notification permission (skippable) | Browser notifications. |
| 9 | **Guided first plan** | the real daily-planning flow with coach marks | First real tasks and timeboxes — no demo data. |
| 10 | Board | — | Lands on today with a dismissible 5-item getting-started checklist. |

Progress is persisted per step, so a refresh resumes where you left off. Every step has Back; steps 4 and 8 have Skip.

### 4.2 Daily planning ritual
Full-screen, one decision per step, progress dots at top, `Enter` advances.

| Step | Prompt | Layout | Logic |
|---|---|---|---|
| 1. **Gather** | What do you want to get done today? | Centre: today's list with inline add. Left: yesterday's unfinished. Right: backlog. | Rolled-over tasks are pre-listed with a badge. Drag or click to pull in from either side. |
| 2. **Estimate** | How long will each take? | Today's list, time picker focused on first unestimated task. | `Tab` walks the tasks. Channel can be set here too. Running total shown. |
| 3. **Right-size** | Shown only if total > capacity | Today's list next to drop zones: Tomorrow, Later this week, Backlog. | Live "over by 1h 20m" counter; Continue enables at any time but the warning stays visible until under capacity. |
| 4. **Order and schedule** | What comes first? | Today's list next to today's timeline. | Drag to reorder; drag to timeline to timebox; "Schedule all" auto-places in order around events. |
| 5. **Commit** | Your plan for today | Read-only summary: tasks by channel, total, first block. | "Copy as Markdown", then **Start my day** → marks `planStatus = done`, lands on My Day. |

Steps 3 and 4 can be disabled in settings. Exiting mid-flow saves the step and shows a "Resume planning" banner.

### 4.3 Working the day
1. Open app → My Day or Board, today in focus.
2. Start a task: press `F` (focus mode) or click the timer. Focus bar appears app-wide.
3. Check off subtasks; notes autosave.
4. Complete: timer stops, entry saved, card animates to done, next task offered.
5. Things change: drag to another day, to backlog, or re-timebox. Workload bars update live.
6. New input: `A` anywhere to add; inline tokens set channel and time.

### 4.4 Daily shutdown ritual
| Step | Prompt | Content |
|---|---|---|
| 1. **Review** | What did you get done? | Completed tasks with planned vs actual; total time; split by channel. Missed time can be added. |
| 2. **Loose ends** | What's left? | Each unfinished task: Tomorrow / pick date / Backlog / Archive. |
| 3. **Reflect** | How did today go? | Free-text reflection (optional prompts). |
| 4. **Close** | Done for today | Summary, copy as Markdown, closing moment. Marks `shutdownStatus = done`; saved to Daily highlights. |

### 4.5 Weekly cycle
- **Weekly planning** (first planning session of the week): last week's objectives → carry/drop → set this week's objectives → week board to spread tasks and link them → commit.
- **Weekly review** (last shutdown of the week): completed count, time by channel (bar chart), planned vs actual accuracy, objective outcomes, reflection.

---

## 5. Business logic (the rules engine)

All of this lives in `src/domain/` as pure functions with unit tests.

### 5.1 Rollover
- Runs on app open and at local midnight if the app is open.
- Every incomplete, non-archived task with `scheduledDate < today` moves to today; `rolloverCount += 1`.
- Placement follows `rolloverPosition` (top or bottom), preserving relative order.
- Completed tasks stay on the day they were completed.
- Timeboxes for rolled tasks on past days are kept as history, not moved.
- Recurring instances that were missed do **not** roll over (they would pile up); they are marked skipped.

### 5.2 Auto-archive
- When `rolloverCount > autoArchiveAfterRollovers` (default 4, configurable, can be off), the task is archived with reason `stale`.
- A once-a-day notice lists what was archived, with one-click restore.

### 5.3 Workload
- Task planned time = sum of subtask estimates if any subtask has one, else the task's own estimate.
- Day planned = sum over tasks scheduled that day (done and not done).
- Bar states: under 85% neutral · 85–100% amber · over 100% red with "over by X".
- Unestimated tasks show a count ("3 unestimated") rather than silently counting as zero.

### 5.4 Timebox ↔ task sync
- Scheduling creates a block of `plannedMin` (or `defaultBlockMin` if unestimated).
- Resizing the only block of a task updates `plannedMin`; with multiple blocks, planned time is left alone.
- Moving a task to another day removes its future blocks on the old day.
- Completing a task marks its blocks done; deleting a task deletes its blocks.
- Auto-schedule: earliest gap ≥ needed duration, after "now" (rounded up to 5 min), within working hours, avoiding events and other blocks; falls back to splitting only if asked.

### 5.5 Ritual triggers
```
planning due   = planStatus(target day) != done
                 AND now >= planningTime
                 AND (planningFor == today ? target = today : target = tomorrow)
shutdown due   = shutdownStatus(today) != done AND now >= shutdownTime
weekly plan    = first daily planning of the week AND week.planStatus != done
weekly review  = last working day's shutdown AND week.reviewStatus != done
```
- Due rituals show a full-screen prompt on open with **Start**, **Later** (snooze 1h), **Skip today**.
- Never interrupts an active timer or focus session — the prompt waits.

### 5.6 Timer
- One running entry globally; starting another stops the first.
- Running state survives reload (computed from `start`, not ticked).
- Entries over a sanity limit (e.g. 4h with no activity) prompt "Still working?" and offer to trim.

### 5.7 Recurrence
- Instances are materialised on a rolling 30-day window on app open.
- Instance edits fork from the template; "this and following" splits the rule.
- Completing an instance never affects others.

### 5.8 Ordering and undo
- Fractional index strings per list (day, backlog folder, subtasks) — reorders write one row.
- Every command returns its inverse; undo stack of 50, cleared on reload.

---

## 6. UI and UX specification

### 6.1 App shell
```
┌──────────┬──────────────────────────────────────────────┬──────────────┬───┐
│ Sidebar  │ Top bar: ‹ Today ›  date · view switch · filter │              │ R │
│          ├──────────────────────────────────────────────┤  Right panel  │ a │
│ Home     │                                              │  (Calendar /  │ i │
│ My Day   │   Mon 16      Tue 17      Wed 18     Thu 19  │   Backlog /   │ l │
│ Calendar │   ▓▓▓░ 5h/6h  ▓░░░ 2h     ░░░░       ░░░░    │   Objectives /│   │
│ ──────── │   + Add task  + Add task  + Add task         │   Archive)    │   │
│ Rituals  │   ┌───────┐   ┌───────┐                      │               │   │
│ Backlog  │   │ card  │   │ card  │                      │               │   │
│ Archive  │   └───────┘   └───────┘                      │               │   │
│ ──────── │                                              │               │   │
│ Channels │                                              │               │   │
├──────────┴──────────────────────────────────────────────┴──────────────┴───┤
│ Focus bar (only while a timer runs): task · elapsed · pause · complete      │
└────────────────────────────────────────────────────────────────────────────┘
```
- Sidebar collapses to icons; right panel collapses to the rail.
- Modal state, selected date, and open panel live in the URL, so back/forward and reload behave.

### 6.2 Design tokens (starting point, tuned in Phase 7)
| Token group | Light | Dark |
|---|---|---|
| Canvas | warm off-white | near-black, slightly warm |
| Surface (cards, panels) | white | raised charcoal |
| Border | 1px soft neutral | 1px low-contrast neutral |
| Text | near-black / mid-grey / light-grey (3 levels) | off-white / grey / dim |
| Accent | one restrained hue for primary actions and today | same hue, lifted |
| Success | soft green (completion) | same, lifted |
| Warning / over | amber / muted red (workload) | same, lifted |
| Channel colours | 12-step pastel set, tag = tinted background + darker text | 12-step, tuned for dark |

- **Type:** one humanist sans (Inter or similar), 13–14px base UI, 15px task titles, generous line height; rituals use larger, lighter headings.
- **Shape:** 8px card radius, 6px controls, 12px modals. Shadows are faint and layered; depth comes mostly from borders and background steps.
- **Density:** 280px columns, 8px card gap, 12px card padding.

### 6.3 Motion spec
| Interaction | Behaviour | Timing |
|---|---|---|
| Complete task | Circle fills with check draw; title fades to muted with strikethrough; card settles to the done group via layout animation | 250ms, ease-out |
| Add task | Card grows in from the input, neighbours slide | 180ms spring |
| Drag lift | Scale 1.02, shadow deepens, slight tilt; source slot leaves a tinted placeholder | 120ms |
| Drop | Card springs into slot; neighbours reflow | spring, ~300ms settle |
| Drag onto timeline | Ghost block snaps in 5-min steps, time label follows | immediate |
| Task modal | Fade + scale 0.98→1 from the card; backdrop dims | 160ms in / 120ms out |
| Right panel / sidebar | Width slide, content fades | 200ms |
| Ritual steps | Outgoing slides left and fades; incoming slides in; progress dot fills | 280ms |
| Workload bar | Width and colour tween on change | 300ms |
| Day navigation | Columns scroll with momentum; "Today" button springs back | 400ms |
| Shutdown close | Quiet celebratory moment (original illustration + soft fade) | ~1.2s, skippable |
| Toasts | Slide up from bottom-left, auto-dismiss 5s | 180ms |

All motion respects `prefers-reduced-motion` (fades only).

### 6.4 States every surface must handle
Empty (first-time and cleared), loading (skeleton, rare since data is local), over-capacity, overdue, running timer, drag-in-progress, offline (no change — it's local), narrow viewport.

### 6.5 Responsive
- ≥1200px: full shell. 900–1200px: right panel overlays. <900px: single day column + bottom tab bar; calendar and backlog become sheets. Installable as a PWA on phone.

---

## 7. Keyboard map

| Area | Keys |
|---|---|
| Global | `Cmd/Ctrl+K` palette · `A` add task · `Cmd/Ctrl+Z` undo · `?` shortcut sheet · `/` search |
| Navigate | `←/→` previous/next day · `T` today · `1/2/3` Board / My Day / Calendar · `]` toggle right panel · `[` toggle sidebar |
| Selected task | `Enter` open · `C` complete · `F` focus · `Space` start/stop timer · `E` planned time · `#` channel · `D` due date · `X` auto-schedule · `M` move to date · `B` to backlog · `Shift+A` archive · `Cmd/Ctrl+D` duplicate · `Backspace` delete |
| Reorder | `Alt+↑/↓` within day · `Alt+←/→` to adjacent day |
| Rituals | `Enter` next · `Shift+Enter` back · `Esc` save and exit |

Remappable in settings. Where I can confirm Sunsama's actual binding for an action, I'll default to it.

---

## 8. Routes

| Route | Screen |
|---|---|
| `/welcome`, `/onboarding/:step` | First launch |
| `/board?date=` | Board (home) |
| `/day/:date` | My Day |
| `/calendar?view=day\|3day\|week&date=` | Calendar |
| `/focus/:taskId` | Focus mode |
| `/plan/:date/:step` | Daily planning |
| `/shutdown/:date/:step` | Daily shutdown |
| `/week/:weekStart/plan`, `/week/:weekStart/review` | Weekly rituals |
| `/backlog`, `/archive`, `/objectives`, `/highlights` | Lists |
| `/settings/:section` | Settings |
| `?task=:id` (any route) | Task modal overlay |

---

## 9. Build phases

Each phase ends in something usable and is committed separately.

| Phase | Delivers | Done when |
|---|---|---|
| **0. Foundation** | Vite scaffold, tokens, UI primitives, Dexie schema, command layer + undo, app shell, routing | Shell renders in light/dark; a task can be written and read back. |
| **1. Board and tasks** | Day columns, infinite scroll, inline add with tokens, cards, drag reorder/move, task modal, subtasks, notes, channels + filter | A full day can be planned by hand on the board. |
| **2. Calendar and timeboxing** | Timeline grid, local events, drag-to-schedule, move/resize, auto-schedule, right panel, calendar view, workload bars | Tasks and blocks stay in sync through every move. |
| **3. Timer and focus** | Time entries, focus bar, focus mode, planned vs actual, manual time edit | Actual time survives reload and shows everywhere. |
| **4. Daily rituals** | Rollover + auto-archive engine, daily planning flow, daily shutdown flow, triggers, daily highlights | A full day cycle runs: prompt → plan → work → shutdown. |
| **5. Backlog, recurrence, weekly** | Backlog folders, archive view, recurring tasks, objectives, weekly planning, weekly review with charts | A full week cycle runs. |
| **6. Onboarding and settings** | Onboarding flow wired to settings, guided first plan, getting-started checklist, all settings, notifications, export/import | Fresh profile → onboarding → planned first day with no dead ends. |
| **7. Polish** | Command palette, full keymap, motion pass, by-eye visual calibration, empty states, responsive + PWA, reduced-motion, accessibility pass | Side-by-side with reference screenshots reads as the same kind of product. |

### Verification throughout
- **Unit:** every rule in §5 (rollover edge cases across midnight/DST, workload, recurrence splits, auto-schedule gaps).
- **End-to-end (Playwright):** onboarding → first plan; add/estimate/schedule/complete; rollover with a mocked clock; shutdown; weekly cycle; export → wipe → import.
- **Visual:** screenshot set per phase in light and dark at desktop and phone widths.

---

## 10. Data safety
- Everything lives in the browser's IndexedDB on one device.
- One-click JSON export/import in settings; automatic rolling local snapshot (last 7 days).
- Clearing site data deletes everything — the app says so in settings and nudges a backup weekly.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Drag feel across board + timeline is the hardest part to get right | Build it in Phases 1–2 before anything depends on it; tune with real use. |
| Visual fidelity without access to exact values | Token-driven styling + a dedicated calibration pass against screenshots. |
| Date logic bugs (midnight, DST, week boundaries) | Dates stored as local `YYYY-MM-DD` strings, minutes-of-day for blocks; clock is injectable for tests. |
| Single-device data loss | Export/import and snapshots from Phase 6; optional sync later. |
| Scope size | Phases are independently shippable; the day cycle (0–4) is the core, the rest layers on. |

---

## 12. Decisions for you

| # | Decision | Recommendation |
|---|---|---|
| 1 | **Where data lives:** local-only in the browser, or a hosted backend with login and multi-device sync | **Local-only now.** Fastest, free, offline. The command layer keeps a sync backend (e.g. Supabase) addable later without a rewrite. |
| 2 | **Name** | Keep "Meridian" as a placeholder; it's one constant. |
| 3 | **Reference material** | If you have a Sunsama account or trial, screenshots or a short screen recording of the board, task modal, planning and shutdown flows will make the calibration pass far more accurate than working from memory. |
