import express from 'express';
import {getPublicKeyController} from '../../controller/serverController';
import { authenticateToken } from '../../middleware/authMiddleware';

const router = express.Router();

router.get('/publicKey',authenticateToken,getPublicKeyController);

export default router;