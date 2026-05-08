import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { SoftGate } from "@/components/SoftGate";
import {
  useListTasks, useCreateTask, useUpdateTask, useDeleteTask,
  getListTasksQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Plus, Trash2, Check } from "lucide-react";

function TodoContent() {
  const { user } = useAuth();
  const [newTask, setNewTask] = useState("");
  const qc = useQueryClient();
  const uid = user?.uid || "";

  const { data: tasks, isLoading } = useListTasks(
    { uid },
    { query: { enabled: !!uid, queryKey: getListTasksQueryKey({ uid }) } }
  );
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListTasksQueryKey({ uid }) });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    createTask.mutate({ data: { uid, text: newTask.trim() } }, {
      onSuccess: () => { setNewTask(""); invalidate(); }
    });
  };

  // One-way: only allow completing (not un-completing)
  const handleComplete = (id: number) => {
    updateTask.mutate({ id, data: { completed: true } }, {
      onSuccess: () => {
        invalidate();
        if (uid) {
          fetch("/api/study/log-task", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid }),
          }).catch(console.error);
        }
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteTask.mutate({ id }, { onSuccess: invalidate });
  };

  const taskList = Array.isArray(tasks) ? tasks : [];
  const pending = taskList.filter(t => !t.completed);
  const done = taskList.filter(t => t.completed);

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">To-Do</h1>
        <p className="text-gray-500">Keep track of your study tasks</p>
      </div>
      <form onSubmit={handleAdd} className="flex gap-3 mb-8">
        <input
          data-testid="input-new-task"
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        />
        <button
          data-testid="btn-add-task"
          type="submit"
          disabled={!newTask.trim() || createTask.isPending}
          className="w-12 h-12 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center justify-center flex-shrink-0"
        >
          <Plus className="w-5 h-5" />
        </button>
      </form>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : (
        <>
          {pending.length === 0 && done.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No tasks yet</p>
              <p className="text-sm mt-1">Add a task above to get started</p>
            </div>
          )}

          {pending.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Pending · {pending.length}</p>
              <div className="space-y-2">
                {pending.map(task => (
                  <div key={task.id} data-testid={`task-item-${task.id}`}
                    className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 hover:shadow-sm transition-all group">
                    <button
                      onClick={() => handleComplete(task.id)}
                      title="Mark as done"
                      className="w-5 h-5 rounded-full border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all flex items-center justify-center flex-shrink-0"
                    />
                    <p className="flex-1 text-sm text-gray-800">{task.text}</p>
                    <button onClick={() => handleDelete(task.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {done.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Completed · {done.length}</p>
              <div className="space-y-2">
                {done.map(task => (
                  <div key={task.id} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 group">
                    {/* Completed tasks: non-interactive green check (no toggle back) */}
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <p className="flex-1 text-sm text-gray-400 line-through">{task.text}</p>
                    <button onClick={() => handleDelete(task.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Todo() {
  return (
    <>
      <Helmet>
        <title>To-Do — Student Hub</title>
        <meta name="description" content="Track your study tasks with Student Hub's built-in to-do list." />
      </Helmet>
      <SoftGate feature="the To-Do list">
        <TodoContent />
      </SoftGate>
    </>
  );
}
