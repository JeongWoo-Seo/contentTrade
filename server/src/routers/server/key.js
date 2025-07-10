import express from 'express';
import {getPublicKeyController} from '../../controller/serverController';

const router = express.Router();

router.get('/publicKey',getPublicKeyController);

export default router;