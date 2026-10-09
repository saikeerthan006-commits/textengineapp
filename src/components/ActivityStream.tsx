import type { ActivityEvent } from "../types/agent";

export default function ActivityStream({ activities, active }: { activities: ActivityEvent[]; active: boolean }) {
  if (!activities.length) return null;
  return <div className="activity-stream" aria-live="polite">{activities.map((item) => {
    const completed = item.status === "complete" || (!active && item.status !== "error");
    return <div key={item.id} className={`activity-item ${item.status === "running" && active ? "activity-active" : ""} ${item.status === "error" ? "activity-error" : ""} ${completed ? "activity-complete" : ""}`}><span className="activity-mark">{completed ? "✓" : ""}</span>{item.message}</div>;
  })}</div>;
}
