import express from 'express';
import {registDataController}  from '../../controller/contentController';
import { authenticateToken } from '../../middleware/authMiddleware';

const router = express.Router();

router.post('/',authenticateToken,registDataController);

export default router;