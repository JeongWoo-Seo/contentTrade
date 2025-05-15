import express from 'express';
import { loginController } from '../../controller/userController';

const router = express.Router();

router.get('/',loginController);

export default router;