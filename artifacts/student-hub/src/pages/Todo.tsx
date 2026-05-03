import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import {
  useListTasks, useCreateTask, useUpdateTask, useDeleteTask,
  getListTasksQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Plus, Trash2, Check } from "lucide-react";

export default function Todo() {
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

  const handleToggle = (id: number, completed: boolean) => {
    updateTask.mutate({ id, data: { completed: !completed } }, { onSuccess: invalidate });
  };

  const handleDelete = (id: number) => {
    deleteTask.mutate({ id }, { onSuccess: invalidate });
  };

  const pending = (tasks || []).filter(t => !t.completed);
  const done = (tasks || []).filter(t => t.completed);

  return (
    <Layout>
      <div className="p-8 max-w-2xl mx-auto">
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
            disabled={createTask.isPending}
            className="px-4 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : (tasks || []).length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No tasks yet. Add one above!</p>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Pending ({pending.length})</h2>
                <div className="space-y-2">
                  {pending.map((task) => (
                    <div key={task.id} data-testid={`task-item-${task.id}`}
                      className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3 group hover:shadow-sm transition-all">
                      <button
                        data-testid={`btn-complete-${task.id}`}
                        onClick={() => handleToggle(task.id, task.completed)}
                        className="w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-400 transition-all flex items-center justify-center flex-shrink-0"
                      />
                      <span className="flex-1 text-gray-900">{task.text}</span>
                      <button
                        data-testid={`btn-delete-${task.id}`}
                        onClick={() => handleDelete(task.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {done.length > 0 && (
              <div>
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Completed ({done.length})</h2>
                <div className="space-y-2">
                  {done.map((task) => (
                    <div key={task.id} data-testid={`task-done-${task.id}`}
                      className="flex items-center gap-3 bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 group">
                      <button
                        onClick={() => handleToggle(task.id, task.completed)}
                        className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0"
                      >
                        <Check className="w-3 h-3 text-white" />
                      </button>
                      <span className="flex-1 text-gray-400 line-through">{task.text}</span>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
