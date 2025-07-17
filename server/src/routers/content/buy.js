import express from 'express';
import {acceptTradeController} from '../../controller/tradeController';
import { authenticateToken } from '../../middleware/authMiddleware';

const router = express.Router();

router.post('/requestTrade',authenticateToken,acceptTradeController)

export default router;