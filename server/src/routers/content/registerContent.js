import express from 'express';
import registDataController  from '../../controller/registerContentController';

const router = express.Router();

router.post('/',registDataController);

export default router;