import express from 'express';
import user from './user/index';

const rootRouter = express.Router();

rootRouter.use('/user',user);

export default rootRouter
