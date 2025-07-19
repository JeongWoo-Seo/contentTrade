import express from 'express';
import {getUserKeyInfoController} from '../../controller/userController';
import { authenticateToken } from '../../middleware/authMiddleware';

const router = express.Router();

router.get('/keyInfo',authenticateToken,getUserKeyInfoController);

export default router;