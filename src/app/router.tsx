import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { isDay, type Day } from '@/domain/dates';
import { BoardPage } from '@/features/board/BoardPage';
import { CalendarPage } from '@/features/calendar/CalendarPage';
import { FocusPage } from '@/features/focus/FocusPage';
import { HighlightsPage } from '@/features/rituals/HighlightsPage';
import { PlanPage } from '@/features/rituals/PlanPage';
import { ShutdownPage } from '@/features/rituals/ShutdownPage';
import { BacklogPage } from '@/features/lists/BacklogPage';
import { WeekPage } from '@/features/week/WeekPage';
import { WeeklyPlanPage, WeeklyReviewPage } from '@/features/rituals/WeeklyPages';
import { ComingSoon } from '@/features/placeholder/ComingSoon';
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
  beforeLoad: () => {
    throw redirect({ to: '/today' });
  },
});

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
  component: () => <ComingSoon title="Settings" phase={6} summary="Working hours, ritual times, rollover rules, channels and your data." />,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
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
