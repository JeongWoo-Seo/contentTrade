import express from 'express';
import { 
    nicknameDeduplicateCheckController,
    joinController,
} from '../../controller/userController.js';

const router = express.Router();

router.get('/check/nickname/:nickname', nicknameDeduplicateCheckController);

router.post('/join', joinController);
  
export default router;