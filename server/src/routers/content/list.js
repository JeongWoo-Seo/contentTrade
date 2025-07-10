import express from "express";
import {getAllContentListController,
        getContentDatafromHctController}  from '../../controller/contentController';

const router = express.Router();

router.get("/getAll",getAllContentListController);
router.get('/contentInfo/hct/:h_ct',getContentDatafromHctController);

export default router;