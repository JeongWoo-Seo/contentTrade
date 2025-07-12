import express from 'express';
import {getContractInfoController} from '../../controller/serverController';

const router = express.Router();

router.get("/contractInfo",getContractInfoController);

export default router;