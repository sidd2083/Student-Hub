import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

router.get("/auth/user", (req: Request, res: Response) => {
  const userId = req.headers["x-replit-user-id"] as string | undefined;
  const userName = req.headers["x-replit-user-name"] as string | undefined;
  const userImage = req.headers["x-replit-user-profile-image"] as string | undefined;

  if (!userId || !userName) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  return res.json({
    id: userId,
    name: userName,
    profileImage: userImage || "",
  });
});

router.get("/auth/login", (_req: Request, res: Response) => {
  res.redirect("https://replit.com/auth_with_repl_site?domain=" + (_req.headers["host"] || ""));
});

router.get("/auth/logout", (_req: Request, res: Response) => {
  res.redirect("/");
});

export default router;
