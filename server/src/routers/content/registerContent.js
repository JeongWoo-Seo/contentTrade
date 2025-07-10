import express from 'express';
import {registDataController}  from '../../controller/contentController';

const router = express.Router();

router.post('/',registDataController);

export default router;