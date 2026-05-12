import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import notesRouter from "./notes";
import mcqsRouter from "./mcqs";
import pyqsRouter from "./pyqs";
import tasksRouter from "./tasks";
import scoresRouter from "./scores";
import aiRouter from "./ai";
import studyRouter from "./study";
import announcementsRouter from "./announcements";
import savedRouter from "./saved";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(notesRouter);
router.use(mcqsRouter);
router.use(pyqsRouter);
router.use(tasksRouter);
router.use(scoresRouter);
router.use(aiRouter);
router.use(studyRouter);
router.use(announcementsRouter);
router.use(savedRouter);
router.use(uploadRouter);

export default router;
