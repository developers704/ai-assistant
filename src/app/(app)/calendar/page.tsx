"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store/app-context";
import { PageHeader } from "@/components/layout/Sidebar";
import {
  PageShell,
  PageShellHeader,
  LushTabBar,
  LushEmpty,
} from "@/components/layout/PageShell";
import { syncUiSelection } from "@/components/layout/UiContextSync";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn, getPriorityColor } from "@/lib/utils";
import { isTodayInTimezone, userTimezone } from "@/lib/calendar-dates";
import {
  filterCalendarEvents,
  displayAttendee,
  formatEventLocation,
  formatTimeInTimezone,
  formatDateInTimezone,
} from "@/lib/calendar-utils";
import {
  Calendar,
  MapPin,
  Users,
  Plus,
  CheckSquare,
  Square,
  CheckSquareIcon,
  Trash2,
  Link2,
  Video,
} from "lucide-react";

type Tab = "calendar" | "tasks";

export default function CalendarTasksPage() {
  const { state, addEvent, addReminder, toggleReminder, deleteReminder } = useApp();
  const [tab, setTab] = useState<Tab>("calendar");
  const [showEventForm, setShowEventForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [eventForm, setEventForm] = useState({ title: "", start: "", end: "", location: "", attendees: "" });
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueDate: new Date().toISOString().split("T")[0],
    dueTime: "",
    priority: "medium" as "low" | "medium" | "high",
  });
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  useEffect(() => {
    void syncUiSelection({
      selectedMeetingId: selectedMeetingId ?? undefined,
    });
  }, [selectedMeetingId]);

  if (!state) return null;

  const googleConnected = state.integrations?.google?.connected ?? false;
  const tz = userTimezone(state);
  const events = filterCalendarEvents(state.events);

  const todayEvents = events
    .filter((e) => isTodayInTimezone(e.start, tz))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const upcomingEvents = events
    .filter((e) => !isTodayInTimezone(e.start, tz) && new Date(e.start) > new Date())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 8);

  const pending = state.reminders.filter((r) => !r.completed);
  const completed = state.reminders.filter((r) => r.completed);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    await addEvent({
      title: eventForm.title,
      start: new Date(eventForm.start).toISOString(),
      end: new Date(eventForm.end).toISOString(),
      location: eventForm.location,
      attendees: eventForm.attendees.split(",").map((a) => a.trim()).filter(Boolean),
      status: "confirmed",
    });
    setShowEventForm(false);
    setEventForm({ title: "", start: "", end: "", location: "", attendees: "" });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await addReminder(taskForm);
    setShowTaskForm(false);
    setTaskForm({
      title: "",
      description: "",
      dueDate: new Date().toISOString().split("T")[0],
      dueTime: "",
      priority: "medium",
    });
  };

  const EventCard = ({ event, showDate = false }: { event: (typeof events)[0]; showDate?: boolean }) => {
    const loc = event.location ? formatEventLocation(event.location) : null;
    const selected = selectedMeetingId === event.id;
    return (
      <Card
        className={cn(
          "p-4 ring-1 cursor-pointer transition-all duration-200",
          selected
            ? "ring-rose-400/40 bg-rose-500/10"
            : "ring-white/[0.06] hover:ring-white/12 hover:bg-white/[0.04]"
        )}
        onClick={() => setSelectedMeetingId(event.id)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-ink leading-snug">{event.title}</p>
            <p className="text-sm text-rose-300 mt-1">
              {showDate && `${formatDateInTimezone(event.start, tz)} · `}
              {formatTimeInTimezone(event.start, tz)} – {formatTimeInTimezone(event.end, tz)}
            </p>
          </div>
          <Badge variant={event.status === "confirmed" ? "success" : "warning"}>{event.status}</Badge>
        </div>
        {loc && (
          <p className="text-sm text-ink-muted mt-2 flex items-start gap-1.5">
            {loc.href ? <Video size={14} className="shrink-0 mt-0.5 text-sky-300" /> : <MapPin size={14} className="shrink-0 mt-0.5" />}
            {loc.href ? (
              <a href={loc.href} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-200 break-all">
                {loc.label}
              </a>
            ) : (
              <span>{loc.label}</span>
            )}
          </p>
        )}
        {event.attendees.length > 0 && (
          <div className="text-sm text-ink-muted mt-2 flex items-start gap-1.5">
            <Users size={14} className="shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              {event.attendees.map((a) => displayAttendee(a, state.contacts)).join(" · ")}
            </span>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] lg:h-[calc(100dvh-4rem)]">
      <PageShell accent="rose" className="flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-h-0">
        <PageShellHeader className="shrink-0">
          <PageHeader
            gradient
            eyebrow="Schedule"
            title="Calendar & Tasks"
            subtitle={
              googleConnected
                ? `${todayEvents.length} events today · ${pending.length} tasks · Google synced`
                : `${todayEvents.length} events today · ${pending.length} tasks`
            }
            action={
              <div className="flex items-center gap-2">
                {googleConnected && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80 bg-emerald-500/10 px-2.5 py-1 rounded-full ring-1 ring-emerald-400/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                )}
                <Button
                  size="sm"
                  onClick={() => (tab === "calendar" ? setShowEventForm(!showEventForm) : setShowTaskForm(!showTaskForm))}
                >
                  <Plus size={16} /> {tab === "calendar" ? "New Event" : "Add Task"}
                </Button>
              </div>
            }
          />

          <div className="mt-4">
            <LushTabBar
              tabs={[
                { id: "calendar" as const, label: "Calendar", icon: Calendar, color: "text-rose-300" },
                { id: "tasks" as const, label: "Tasks", icon: CheckSquare, color: "text-amber-300" },
              ]}
              active={tab}
              onChange={setTab}
            />
          </div>
        </PageShellHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 min-h-0">
          {!googleConnected && (
            <Card className="mb-5 p-4 flex flex-wrap items-center justify-between gap-3 ring-1 ring-amber-400/20 bg-amber-500/10">
              <p className="text-sm text-ink-secondary">Connect Google Calendar in Settings to sync your real schedule.</p>
              <Link href="/settings">
                <Button size="sm" variant="outline">
                  <Link2 size={14} /> Connect Calendar
                </Button>
              </Link>
            </Card>
          )}

          {tab === "calendar" && (
            <>
              {showEventForm && (
                <Card className="mb-5">
                  <form onSubmit={handleCreateEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Title" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} required />
                    <Input label="Location" value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} />
                    <Input label="Start" type="datetime-local" value={eventForm.start} onChange={(e) => setEventForm({ ...eventForm, start: e.target.value })} required />
                    <Input label="End" type="datetime-local" value={eventForm.end} onChange={(e) => setEventForm({ ...eventForm, end: e.target.value })} required />
                    <Input label="Attendees (comma-separated)" value={eventForm.attendees} onChange={(e) => setEventForm({ ...eventForm, attendees: e.target.value })} className="md:col-span-2" />
                    <div className="md:col-span-2 flex gap-2">
                      <Button type="submit">Create Event</Button>
                      <Button type="button" variant="outline" onClick={() => setShowEventForm(false)}>Cancel</Button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20">
                      <Calendar size={14} className="text-rose-300" />
                    </span>
                    Today
                  </h3>
                  <div className="space-y-3">
                    {todayEvents.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                    {todayEvents.length === 0 && (
                      <LushEmpty message="No events scheduled for today" icon={Calendar} />
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20">
                      <Calendar size={14} className="text-violet-300" />
                    </span>
                    Upcoming
                  </h3>
                  <div className="space-y-3">
                    {upcomingEvents.map((event) => (
                      <EventCard key={event.id} event={event} showDate />
                    ))}
                    {upcomingEvents.length === 0 && (
                      <LushEmpty message="No upcoming events this week" icon={Calendar} />
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "tasks" && (
            <>
              {showTaskForm && (
                <Card className="mb-5">
                  <form onSubmit={handleCreateTask} className="space-y-4">
                    <Input label="Title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required />
                    <Input label="Description" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} />
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Due Date" type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
                      <Input label="Due Time" type="time" value={taskForm.dueTime} onChange={(e) => setTaskForm({ ...taskForm, dueTime: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-secondary mb-1.5">Priority</label>
                      <select
                        value={taskForm.priority}
                        onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as "low" | "medium" | "high" })}
                        className="w-full px-4 py-2.5 rounded-2xl border border-white/25 bg-white/10 text-ink text-sm backdrop-blur-md"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit">Create Task</Button>
                      <Button type="button" variant="outline" onClick={() => setShowTaskForm(false)}>Cancel</Button>
                    </div>
                  </form>
                </Card>
              )}

              <div className="space-y-2">
                {pending.map((task) => (
                  <Card key={task.id} className="p-4 flex items-center gap-4">
                    <button onClick={() => toggleReminder(task.id)} className="text-ink-muted hover:text-amber-300 transition-colors">
                      <Square size={20} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink">{task.title}</p>
                      {task.description && <p className="text-sm text-ink-muted truncate">{task.description}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-ink-muted">
                          {task.dueDate}
                          {task.dueTime ? ` ${task.dueTime}` : ""}
                        </span>
                        {task.recurring && <span className="text-xs text-amber-300">Recurring</span>}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    <button onClick={() => deleteReminder(task.id)} className="text-ink-muted hover:text-rose-300 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </Card>
                ))}
                {pending.length === 0 && (
                  <Card className="p-10 text-center">
                    <CheckSquare size={36} className="text-ink-muted mx-auto mb-3 opacity-60" />
                    <p className="text-ink-secondary">No tasks yet</p>
                    <p className="text-sm text-ink-muted mt-1">Tap Add Task above, or ask Alexa in chat.</p>
                  </Card>
                )}
              </div>

              {completed.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-ink-secondary mb-3 flex items-center gap-2">
                    <CheckSquare size={16} /> Completed
                  </h3>
                  <div className="space-y-2 opacity-70">
                    {completed.map((task) => (
                      <Card key={task.id} className="p-4 flex items-center gap-4">
                        <button onClick={() => toggleReminder(task.id)} className="text-emerald-400">
                          <CheckSquareIcon size={20} />
                        </button>
                        <p className="flex-1 line-through text-ink-secondary">{task.title}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </PageShell>
    </div>
  );
}
