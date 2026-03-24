import {
  isSchedulerRunning,
  getScheduleInfo,
  startScheduler,
  stopScheduler,
  persistSchedulerState,
} from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    enabled: isSchedulerRunning(),
    schedules: getScheduleInfo(),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const enabled = Boolean(body.enabled);

  if (enabled) {
    startScheduler();
  } else {
    stopScheduler();
  }

  await persistSchedulerState(enabled);

  return Response.json({
    enabled: isSchedulerRunning(),
    schedules: getScheduleInfo(),
  });
}
