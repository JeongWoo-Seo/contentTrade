import express from 'express';
import { loginController } from '../../controller/userController';

const router = express.Router();

router.post('/',loginController);

export default router;