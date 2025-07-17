import express from 'express';
import {getContractInfoController} from '../../controller/serverController';
import { authenticateToken } from '../../middleware/authMiddleware';

const router = express.Router();

router.get("/contractInfo",authenticateToken,getContractInfoController);

export default router;