import { Router } from "express";
import { contractController } from "../controllers/contract.controller.js";

const router = Router();

router.get("/address", contractController.getAddresses);

export default router;
