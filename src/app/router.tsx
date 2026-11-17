import { createRootRoute, createRoute, createRouter, Navigate } from '@tanstack/react-router';
import { useSettings } from '@/data/ReferenceData';
import { isDay, type Day } from '@/domain/dates';
import { BoardPage } from '@/features/board/BoardPage';
import { CalendarPage } from '@/features/calendar/CalendarPage';
import { FloatingFocusBar } from '@/features/focus/FloatingFocusBar';
import { FocusPage } from '@/features/focus/FocusPage';
import { HighlightsPage } from '@/features/rituals/HighlightsPage';
import { PlanPage } from '@/features/rituals/PlanPage';
import { ShutdownPage } from '@/features/rituals/ShutdownPage';
import { BacklogPage } from '@/features/lists/BacklogPage';
import { WeekPage } from '@/features/week/WeekPage';
import { WeeklyPlanPage, WeeklyReviewPage } from '@/features/rituals/WeeklyPages';
import { SetupPage } from '@/features/setup/SetupPage';
import { SETTINGS_SECTIONS, SettingsPage, type SettingsSection } from '@/features/settings/SettingsPage';
import { TodayPage } from '@/features/today/TodayPage';
import { Shell } from './Shell';

const rootRoute = createRootRoute({
  component: Shell,
  // The open task is part of the URL on every view.
  validateSearch: (search: Record<string, unknown>): { task?: string } =>
    typeof search.task === 'string' && search.task ? { task: search.task } : {},
});
const parent = () => rootRoute;

const indexRoute = createRoute({
  getParentRoute: parent,
  path: '/',
  // Opens on the view chosen in Settings.
  component: function Home() {
    const { defaultView } = useSettings();
    return <Navigate to={defaultView === 'board' ? '/board' : defaultView === 'calendar' ? '/calendar' : '/today'} replace />;
  },
});
const welcomeRoute = createRoute({ getParentRoute: parent, path: '/welcome', component: SetupPage });
const focusBarRoute = createRoute({ getParentRoute: parent, path: '/focusbar', component: FloatingFocusBar });

const todayRoute = createRoute({
  getParentRoute: parent,
  path: '/today',
  validateSearch: (search: Record<string, unknown>): { date?: Day } => (isDay(search.date) ? { date: search.date } : {}),
  component: function Today() {
    const { date } = todayRoute.useSearch();
    return <TodayPage date={date} />;
  },
});

const weekRoute = createRoute({
  getParentRoute: parent,
  path: '/week',
  validateSearch: (search: Record<string, unknown>): { start?: Day } => (isDay(search.start) ? { start: search.start } : {}),
  component: function Week() {
    const { start } = weekRoute.useSearch();
    return <WeekPage start={start} />;
  },
});
const boardRoute = createRoute({ getParentRoute: parent, path: '/board', component: BoardPage });
const calendarRoute = createRoute({
  getParentRoute: parent,
  path: '/calendar',
  validateSearch: (search: Record<string, unknown>): { date?: Day } => (isDay(search.date) ? { date: search.date } : {}),
  component: function Calendar() {
    const { date } = calendarRoute.useSearch();
    return <CalendarPage date={date} />;
  },
});
const focusRoute = createRoute({ getParentRoute: parent, path: '/focus', component: () => <FocusPage /> });
const focusTaskRoute = createRoute({
  getParentRoute: parent,
  path: '/focus/$taskId',
  component: function FocusTask() {
    const { taskId } = focusTaskRoute.useParams();
    return <FocusPage taskId={taskId} />;
  },
});
const planRoute = createRoute({
  getParentRoute: parent,
  path: '/plan',
  validateSearch: (search: Record<string, unknown>): { date?: Day } => (isDay(search.date) ? { date: search.date } : {}),
  component: function Plan() {
    const { date } = planRoute.useSearch();
    // Keyed by day so planning a different day starts from that day's saved step.
    return <PlanPage key={date ?? 'default'} date={date} />;
  },
});
const shutdownRoute = createRoute({ getParentRoute: parent, path: '/shutdown', component: ShutdownPage });
const highlightsRoute = createRoute({ getParentRoute: parent, path: '/highlights', component: HighlightsPage });
const weeklyPlanRoute = createRoute({ getParentRoute: parent, path: '/weekly/plan', component: WeeklyPlanPage });
const weeklyReviewRoute = createRoute({ getParentRoute: parent, path: '/weekly/review', component: WeeklyReviewPage });
const backlogRoute = createRoute({ getParentRoute: parent, path: '/backlog', component: BacklogPage });
const settingsRoute = createRoute({
  getParentRoute: parent,
  path: '/settings',
  validateSearch: (search: Record<string, unknown>): { section?: SettingsSection } =>
    SETTINGS_SECTIONS.some((s) => s.id === search.section) ? { section: search.section as SettingsSection } : {},
  component: function Settings() {
    const { section } = settingsRoute.useSearch();
    return <SettingsPage section={section} />;
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  welcomeRoute,
  focusBarRoute,
  todayRoute,
  weekRoute,
  boardRoute,
  calendarRoute,
  focusRoute,
  focusTaskRoute,
  planRoute,
  shutdownRoute,
  highlightsRoute,
  weeklyPlanRoute,
  weeklyReviewRoute,
  backlogRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
