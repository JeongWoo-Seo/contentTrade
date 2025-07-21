import express from "express";
import {getAllContentListController,
        getContentDatafromHctController,
        getPurchaseList,
        getDecContentDataController}  from '../../controller/contentController';
import { authenticateToken } from '../../middleware/authMiddleware';

const router = express.Router();

router.get("/getAll",authenticateToken,getAllContentListController);
router.get('/contentInfo/h_ct/:h_ct',authenticateToken,getContentDatafromHctController);
router.get('/purchaseList',authenticateToken,getPurchaseList);
router.get('/purchaseList/purchaseInfo/h_ct/:h_ct',authenticateToken,getDecContentDataController);

export default router;