import express from "express";
import {getAllContentListController}  from '../../controller/contentListController';

const router = express.Router();

router.get("/getAll",getAllContentListController);

export default router;