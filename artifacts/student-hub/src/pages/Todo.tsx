import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/context/AuthContext";
import { SoftGate } from "@/components/SoftGate";
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CheckSquare, Plus, Trash2, Check } from "lucide-react";

interface Task {
  id: string;
  uid: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

function TodoContent() {
  const { user } = useAuth();
  const [newTask, setNewTask] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "tasks"),
        where("uid", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list: Task[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setTasks(list);
    } catch (e) {
      console.error("[Todo] Load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim() || !user?.uid) return;
    setAdding(true);
    try {
      const data = {
        uid: user.uid,
        text: newTask.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, "tasks"), data);
      setTasks(prev => [{ id: ref.id, ...data }, ...prev]);
      setNewTask("");
    } catch (e) {
      console.error("[Todo] Add failed:", e);
    } finally {
      setAdding(false);
    }
  };

  const handleComplete = async (id: string) => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, "tasks", id), { completed: true });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true } : t));

      // Log task completion to study_logs
      const today = new Date().toISOString().slice(0, 10);
      const logId = `${user.uid}_${today}`;
      const logRef = doc(db, "study_logs", logId);
      const logSnap = await getDoc(logRef);
      if (logSnap.exists()) {
        await updateDoc(logRef, { tasksCompleted: (logSnap.data().tasksCompleted ?? 0) + 1 });
      } else {
        await setDoc(logRef, { uid: user.uid, date: today, studyMinutes: 0, tasksCompleted: 1, notesViewed: 0 });
      }
    } catch (e) {
      console.error("[Todo] Complete failed:", e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "tasks", id));
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error("[Todo] Delete failed:", e);
    }
  };

  const pending = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);

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
          disabled={!newTask.trim() || adding}
          className="w-12 h-12 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center justify-center flex-shrink-0"
        >
          <Plus className="w-5 h-5" />
        </button>
      </form>

      {loading ? (
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
