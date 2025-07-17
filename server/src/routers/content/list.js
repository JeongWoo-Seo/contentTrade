import express from "express";
import {getAllContentListController,
        getContentDatafromHctController}  from '../../controller/contentController';
import { authenticateToken } from '../../middleware/authMiddleware';

const router = express.Router();

router.get("/getAll",authenticateToken,getAllContentListController);
router.get('/contentInfo/hct/:h_ct',authenticateToken,getContentDatafromHctController);

export default router;