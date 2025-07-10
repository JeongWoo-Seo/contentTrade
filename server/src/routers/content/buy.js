import express from 'express';
import {acceptTradeController} from '../../controller/tradeController';

const router = express.Router();

router.post('/requestTrade',acceptTradeController)

export default router;