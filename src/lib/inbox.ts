import type { Task } from "../types.ts";
import { addDays, taskDay } from "./agenda.ts";
import { inInbox } from "./workspaces.ts";

type InboxItem = {
  task: Task;
  scheduled: string | null;
  nextDate: string | null;
};

export function inboxSections(tasks: Task[], today: string) {
  const limit = addDays(today, 7);
  const sections = {
    overdue: [] as InboxItem[],
    today: [] as InboxItem[],
    upcoming: [] as InboxItem[],
    priority: [] as InboxItem[],
    waiting: [] as InboxItem[],
    capture: [] as InboxItem[],
    later: [] as InboxItem[],
  };

  for (const task of tasks) {
    if (task.status !== "open" && task.status !== "waiting") continue;
    const scheduled = taskDay(task, today);
    const deadline = task.deadline;
    const nextDate = scheduled && deadline ? (scheduled < deadline ? scheduled : deadline) : scheduled ?? deadline;
    const item = { task, scheduled, nextDate };
    if ((deadline && deadline < today) || (scheduled && scheduled < today)) sections.overdue.push(item);
    else if (scheduled === today || deadline === today) sections.today.push(item);
    else if ((scheduled && scheduled > today && scheduled <= limit) || (deadline && deadline > today && deadline <= limit)) {
      sections.upcoming.push(item);
    } else if (task.isFocus || task.priority >= 2) sections.priority.push(item);
    else if (task.status === "waiting") sections.waiting.push(item);
    else if (inInbox(task) && !nextDate) sections.capture.push(item);
    else sections.later.push(item);
  }

  for (const items of Object.values(sections)) {
    items.sort((a, b) => (a.nextDate ?? "9999").localeCompare(b.nextDate ?? "9999")
      || (a.scheduled === a.nextDate ? a.task.startTime ?? "99" : "99").localeCompare(b.scheduled === b.nextDate ? b.task.startTime ?? "99" : "99")
      || Number(b.task.isFocus) - Number(a.task.isFocus) || b.task.priority - a.task.priority || a.task.sortOrder - b.task.sortOrder);
  }
  return sections;
}
