import express from 'express';
import {getUserKeyInfoController} from '../../controller/userController';

const router = express.Router();

router.get('/keyInfo',getUserKeyInfoController);

export default router;