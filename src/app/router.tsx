import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import { isDay, type Day } from '@/domain/dates';
import { BoardPage } from '@/features/board/BoardPage';
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
  component: () => <ComingSoon title="This week" phase={5} summary="Weekly objectives and the tasks aligned with each." />,
});
const boardRoute = createRoute({ getParentRoute: parent, path: '/board', component: BoardPage });
const calendarRoute = createRoute({
  getParentRoute: parent,
  path: '/calendar',
  component: () => <ComingSoon title="Calendar" phase={2} summary="Your events and timeboxed tasks on a time grid." />,
});
const focusRoute = createRoute({
  getParentRoute: parent,
  path: '/focus',
  component: () => <ComingSoon title="Focus" phase={3} summary="One task, its subtasks and notes, and a running timer." />,
});
const planRoute = createRoute({
  getParentRoute: parent,
  path: '/plan',
  component: () => <ComingSoon title="Daily planning" phase={4} summary="A guided walk from a blank day to a realistic plan." />,
});
const shutdownRoute = createRoute({
  getParentRoute: parent,
  path: '/shutdown',
  component: () => <ComingSoon title="Daily shutdown" phase={4} summary="Review the day, pick your highlights, and close it out." />,
});
const highlightsRoute = createRoute({
  getParentRoute: parent,
  path: '/highlights',
  component: () => <ComingSoon title="Highlights" phase={4} summary="Each day's highlights and reflection, by date." />,
});
const weeklyPlanRoute = createRoute({
  getParentRoute: parent,
  path: '/weekly/plan',
  component: () => <ComingSoon title="Weekly planning" phase={5} summary="Set this week's objectives and line up the work behind them." />,
});
const weeklyReviewRoute = createRoute({
  getParentRoute: parent,
  path: '/weekly/review',
  component: () => <ComingSoon title="Weekly review" phase={5} summary="What got done, where the time went, and how the objectives fared." />,
});
const backlogRoute = createRoute({
  getParentRoute: parent,
  path: '/backlog',
  component: () => <ComingSoon title="Backlog" phase={5} summary="Tasks without a day, sorted into time buckets and folders." />,
});
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
