import type { Day } from '@/domain/dates';

export type Id = string;

/** Where a task lives: a calendar day, or the backlog. */
export const BACKLOG = 'backlog';
export type TaskDay = Day | typeof BACKLOG;

export type TaskState = 'active' | 'archived' | 'deleted';
export type DailyPriority = 'urgent' | 'priority' | 'normal' | 'low';
export type BacklogPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
export type BacklogBucket = 'soon' | 'month' | 'quarter' | 'year' | 'someday' | 'never';
export type TaskKind = 'task' | 'ritual' | 'setup';

export interface Task {
  id: Id;
  title: string;
  notes: string;
  channelId: Id | null;
  day: TaskDay;
  order: string;
  plannedMin: number | null;
  dailyPriority: DailyPriority;
  backlogPriority: BacklogPriority;
  backlogBucket: BacklogBucket;
  backlogFolderId: Id | null;
  objectiveId: Id | null;
  /** When it has to be done by. Separate from the day it is planned for. */
  dueDay?: Day | null;
  completedAt: number | null;
  completedDay: Day | null;
  /** Consecutive days this task has rolled over without activity. */
  rolloverDays: number;
  lastActivityDay: Day | null;
  state: TaskState;
  stateChangedAt: number | null;
  seriesId: Id | null;
  seriesDay: Day | null;
  /** True once a recurring instance has been changed by hand. */
  edited: boolean;
  kind: TaskKind;
  createdAt: number;
  updatedAt: number;
}

export interface Subtask {
  id: Id;
  taskId: Id;
  title: string;
  order: string;
  plannedMin: number | null;
  completedAt: number | null;
}

export interface TimeEntry {
  id: Id;
  taskId: Id;
  subtaskId: Id | null;
  start: number;
  /** null while the timer is running. */
  end: number | null;
}

/** A timebox: a block of calendar time reserved for a task. */
export interface Session {
  id: Id;
  taskId: Id;
  day: Day;
  startMin: number;
  endMin: number;
}

export interface CalendarEvent {
  id: Id;
  title: string;
  day: Day;
  startMin: number;
  endMin: number;
  channelId: Id | null;
  blocksTime: boolean;
  /** Set when the event is one occurrence of a repeating event. */
  seriesId?: Id | null;
}

/** A repeating event, such as a daily standup. Its occurrences are ordinary events that point back here. */
export interface EventSeries {
  id: Id;
  repeat: Repeat;
  startDay: Day;
  /** Set when the series is stopped; no occurrence is created after this day. */
  endDay: Day | null;
  /** Occurrences exist up to and including this day. */
  generatedThrough: Day;
  template: Pick<CalendarEvent, 'title' | 'startMin' | 'endMin' | 'channelId' | 'blocksTime'>;
}

export type RepeatKind = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

/** How often a recurring task comes round. */
export interface Repeat {
  kind: RepeatKind;
  /** Every N days, weeks, months or years. Ignored for weekdays. */
  interval: number;
  /** For weekly: which days of the week, 0 for Sunday to 6 for Saturday. */
  weekdays: number[];
}

/** A recurring task. Its instances are ordinary tasks that point back here. */
export interface Series {
  id: Id;
  repeat: Repeat;
  startDay: Day;
  /** Set when the series is stopped; no instance is created after this day. */
  endDay: Day | null;
  /** Instances exist for every occurrence up to and including this day. */
  generatedThrough: Day;
  template: Pick<Task, 'title' | 'notes' | 'channelId' | 'plannedMin'> & { subtasks: string[] };
  /** "At roughly": each instance is timeboxed at this minute of the day. */
  atMin?: number | null;
}

export interface Context {
  id: Id;
  name: string;
  color: string;
  /** Tasks in a personal context never count toward workload. */
  isPersonal: boolean;
  order: string;
}

export interface Channel {
  id: Id;
  contextId: Id | null;
  name: string;
  color: string;
  isDefault: boolean;
  enabled: boolean;
  order: string;
  /** Tasks in this channel are auto-scheduled only within these hours, every day. */
  hours?: { startMin: number; endMin: number } | null;
}

export interface BacklogFolder {
  id: Id;
  name: string;
  order: string;
}

export interface Objective {
  id: Id;
  weekStart: Day;
  title: string;
  notes: string;
  channelId: Id | null;
  order: string;
  completedAt: number | null;
}

export type RitualStatus = 'none' | 'in_progress' | 'done';

export interface DayRecord {
  day: Day;
  planStatus: RitualStatus;
  planStep: number;
  planText: string;
  obstacles: string;
  shutdownMin: number | null;
  shutdownStatus: RitualStatus;
  highlights: Id[];
  mood: string | null;
  reflection: string;
}

export interface WeekRecord {
  weekStart: Day;
  planStatus: RitualStatus;
  planText: string;
  reviewStatus: RitualStatus;
  reviewText: string;
}

export interface Profile {
  name: string;
  createdAt: number;
  onboardingCompletedAt: number | null;
  /** Coached planning runs for the first sessions, then stops. */
  guidedPlansRemaining: number;
  /** How far through the first-run setup screens the person has got. */
  setupStep: number;
}

export type DarkMode = 'on' | 'off' | 'system';
export type DefaultView = 'today' | 'board' | 'calendar';
export type ListEdge = 'top' | 'bottom';

export interface DaySchedule {
  available: boolean;
  startMin: number;
  endMin: number;
}

export interface Settings {
  darkMode: DarkMode;
  /** Colour theme used in light mode (see app/themes.ts). */
  lightTheme: string;
  /** Colour theme used in dark mode. */
  darkTheme: string;
  timeFormat: '12h' | '24h';
  weekStartsOn: 0 | 1;
  defaultView: DefaultView;
  newTaskPosition: ListEdge;
  rolloverPosition: ListEdge;
  workloadThresholdMin: number;
  /** A different limit on some weekdays (index 0 is Sunday); null or missing means the daily limit. */
  workloadByWeekday?: (number | null)[];
  countPlannedAsActual: boolean;
  /** Index 0 is Sunday. */
  schedule: DaySchedule[];
  planningMin: number;
  autoPlanning: boolean;
  autoShutdown: boolean;
  weeklyPlan: { weekday: number; min: number; auto: boolean };
  weeklyReview: { weekday: number; min: number; auto: boolean };
  defaultSessionMin: 15 | 30 | 45 | 60;
  autoScheduleGapMin: 0 | 5 | 10 | 15;
  rescheduleOnConflict: boolean;
  rescheduleOnEarlyFinish: boolean;
  focusOnTimerStart: boolean;
  /** Include the written summary step at the end of planning. */
  planSummaryStep: boolean;
  /** What the shutdown's closing screen says. */
  endOfDayMessage: { kind: 'encouragement' | 'none' | 'custom'; text: string };
  /** Suggest a break after each stretch of work. */
  breakReminders: { on: boolean; workMin: number; breakMin: number };
  /** Play a chime when a timer reaches the task's planned time. */
  timerSounds: boolean;
  /** Desktop app: keep a small focus bar floating above other apps while a task is in progress. */
  floatingFocusBar: boolean;
  /** Consecutive rollover days before a task is archived; null turns it off. */
  archiveAfterDays: number | null;
  celebrations: boolean;
}

/** The one timer that can run at a time. Kept on its own so it survives a reload. */
export interface RunningTimer {
  entryId: Id;
  taskId: Id;
  subtaskId: Id | null;
  start: number;
}
