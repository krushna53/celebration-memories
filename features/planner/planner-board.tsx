"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, StickyNote, ListChecks } from "lucide-react";

import type { PlannerTask, PlannerTaskStatus, PlannerNote } from "@/types/planner";

type ActionResult<T = undefined> = { success: true; data: T } | { success: false; error: string };

const inputClasses =
  "w-full rounded-lg border border-navy-950/15 bg-white px-3 py-2 text-sm text-navy-950 placeholder:text-navy-700/40 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30";

const STATUS_LABEL: Record<PlannerTaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

interface PlannerBoardProps {
  tasks: PlannerTask[];
  notes: PlannerNote[];
  /** Prefills the "Added by" / "Your name" fields — the admin's own name, or whatever the public name-gate captured. */
  currentName?: string;
  onCreateTask: (values: {
    title: string;
    notes?: string;
    assignedTo?: string;
    dueDate?: string;
    createdBy?: string;
  }) => Promise<ActionResult<PlannerTask>>;
  onUpdateTask: (
    taskId: string,
    values: { status?: PlannerTaskStatus; assignedTo?: string | null },
  ) => Promise<ActionResult<undefined>>;
  onDeleteTask: (taskId: string) => Promise<ActionResult<undefined>>;
  onCreateNote: (values: { authorName?: string; content: string }) => Promise<ActionResult<PlannerNote>>;
  onDeleteNote: (noteId: string) => Promise<ActionResult<undefined>>;
}

/**
 * Shared to-do + notes board UI — rendered both from /admin/planner
 * (session-authenticated) and /plan/[token] (link-authenticated, no
 * login). The two callers pass different action bindings but the same
 * component, so family members editing via the shared link see
 * identical behavior to the client editing from the dashboard.
 */
export function PlannerBoard({
  tasks: initialTasks,
  notes: initialNotes,
  currentName,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onCreateNote,
  onDeleteNote,
}: PlannerBoardProps) {
  const [tab, setTab] = useState<"tasks" | "notes">("tasks");
  const [tasks, setTasks] = useState(initialTasks);
  const [notes, setNotes] = useState(initialNotes);

  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [noteContent, setNoteContent] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAddingTask(true);
    setTaskError(null);
    const result = await onCreateTask({
      title,
      notes: taskNotes || undefined,
      assignedTo: assignedTo || undefined,
      dueDate: dueDate || undefined,
      createdBy: currentName || undefined,
    });
    setAddingTask(false);
    if (result.success) {
      setTasks((prev) => [...prev, result.data]);
      setTitle("");
      setAssignedTo("");
      setDueDate("");
      setTaskNotes("");
    } else {
      setTaskError(result.error);
    }
  }

  async function changeStatus(taskId: string, status: PlannerTaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    const result = await onUpdateTask(taskId, { status });
    if (!result.success) setTaskError(result.error);
  }

  async function removeTask(taskId: string) {
    const prev = tasks;
    setTasks((cur) => cur.filter((t) => t.id !== taskId));
    const result = await onDeleteTask(taskId);
    if (!result.success) {
      setTasks(prev);
      setTaskError(result.error);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setAddingNote(true);
    setNoteError(null);
    const result = await onCreateNote({ authorName: currentName || undefined, content: noteContent });
    setAddingNote(false);
    if (result.success) {
      setNotes((prev) => [result.data, ...prev]);
      setNoteContent("");
    } else {
      setNoteError(result.error);
    }
  }

  async function removeNote(noteId: string) {
    const prev = notes;
    setNotes((cur) => cur.filter((n) => n.id !== noteId));
    const result = await onDeleteNote(noteId);
    if (!result.success) {
      setNotes(prev);
      setNoteError(result.error);
    }
  }

  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div>
      <div className="flex gap-2 border-b border-navy-950/10">
        <button
          type="button"
          onClick={() => setTab("tasks")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-luxury duration-200 ${
            tab === "tasks" ? "border-gold-500 text-navy-950" : "border-transparent text-navy-700/50 hover:text-navy-700"
          }`}
        >
          <ListChecks size={15} /> To-Do {tasks.length > 0 ? `(${doneCount}/${tasks.length})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setTab("notes")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-luxury duration-200 ${
            tab === "notes" ? "border-gold-500 text-navy-950" : "border-transparent text-navy-700/50 hover:text-navy-700"
          }`}
        >
          <StickyNote size={15} /> Notes {notes.length > 0 ? `(${notes.length})` : ""}
        </button>
      </div>

      {tab === "tasks" ? (
        <div className="mt-5">
          <form onSubmit={addTask} className="grid gap-2.5 rounded-xl border border-navy-950/10 bg-white p-4 sm:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task — e.g. Book caterer"
              className={`${inputClasses} sm:col-span-2`}
            />
            <input
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Assign to (optional)"
              className={inputClasses}
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClasses}
            />
            <textarea
              value={taskNotes}
              onChange={(e) => setTaskNotes(e.target.value)}
              placeholder="Details / notes for this task (optional)"
              rows={2}
              className={`${inputClasses} resize-none sm:col-span-2`}
            />
            {taskError ? <p className="text-xs text-red-600 sm:col-span-2">{taskError}</p> : null}
            <button
              type="submit"
              disabled={addingTask || !title.trim()}
              className="flex items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
            >
              {addingTask ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Task
            </button>
          </form>

          <div className="mt-4 grid gap-2.5">
            {tasks.length === 0 ? (
              <p className="text-sm text-navy-700/50">No tasks yet — add the first one above.</p>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-navy-950/10 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`font-medium text-navy-950 ${task.status === "done" ? "line-through opacity-50" : ""}`}>
                        {task.title}
                      </p>
                      {task.notes ? <p className="mt-1 text-sm text-navy-700/60">{task.notes}</p> : null}
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-navy-700/50">
                        {task.assignedTo ? <span>Assigned to {task.assignedTo}</span> : null}
                        {task.dueDate ? <span>Due {task.dueDate}</span> : null}
                        {task.createdBy ? <span>Added by {task.createdBy}</span> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <select
                        value={task.status}
                        onChange={(e) => changeStatus(task.id, e.target.value as PlannerTaskStatus)}
                        className="rounded-full border border-navy-950/15 bg-white px-2.5 py-1 text-xs text-navy-700 focus:border-gold-500 focus:outline-none"
                      >
                        {(Object.keys(STATUS_LABEL) as PlannerTaskStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeTask(task.id)}
                        aria-label="Delete task"
                        className="text-navy-700/30 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <form onSubmit={addNote} className="grid gap-2.5 rounded-xl border border-navy-950/10 bg-white p-4">
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Jot down an idea, reminder, or decision made while planning..."
              rows={3}
              className={`${inputClasses} resize-none`}
            />
            {noteError ? <p className="text-xs text-red-600">{noteError}</p> : null}
            <button
              type="submit"
              disabled={addingNote || !noteContent.trim()}
              className="flex items-center justify-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 hover:brightness-110 disabled:opacity-60 sm:justify-self-start"
            >
              {addingNote ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Note
            </button>
          </form>

          <div className="mt-4 grid gap-2.5">
            {notes.length === 0 ? (
              <p className="text-sm text-navy-700/50">No notes yet.</p>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="rounded-xl border border-navy-950/10 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="whitespace-pre-wrap text-sm text-navy-700/80">{note.content}</p>
                    <button
                      type="button"
                      onClick={() => removeNote(note.id)}
                      aria-label="Delete note"
                      className="shrink-0 text-navy-700/30 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-navy-700/40">
                    {note.authorName || "Someone"} &middot; {new Date(note.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
