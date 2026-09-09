import { Router } from "express";
import { novelController } from "../controllers/novel.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authMiddleware, novelController.create);
router.get("/", authMiddleware, novelController.list);
router.get("/mine", authMiddleware, novelController.listMine);

export default router;
