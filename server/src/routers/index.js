import express from 'express';
import user from './user/index';
import content from './content/index';

const rootRouter = express.Router();

rootRouter.use('/user',user);

rootRouter.use('/content', content);

export default rootRouter
