import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import notesRouter from "./notes";
import mcqsRouter from "./mcqs";
import pyqsRouter from "./pyqs";
import tasksRouter from "./tasks";
import scoresRouter from "./scores";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(notesRouter);
router.use(mcqsRouter);
router.use(pyqsRouter);
router.use(tasksRouter);
router.use(scoresRouter);
router.use(aiRouter);

export default router;
