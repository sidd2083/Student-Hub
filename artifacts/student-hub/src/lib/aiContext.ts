const KEY = "nepai_pending_context";
const ID_KEY = "nepai_pending_id";

export function setAiContext(ctx: string) {
  sessionStorage.setItem(KEY, ctx);
  sessionStorage.setItem(ID_KEY, Date.now().toString());
}

export function consumeAiContext(): { context: string; id: string } | null {
  const ctx = sessionStorage.getItem(KEY);
  const id = sessionStorage.getItem(ID_KEY);
  if (ctx && id) {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(ID_KEY);
    return { context: ctx, id };
  }
  return null;
}
