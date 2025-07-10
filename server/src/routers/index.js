import express from 'express';
import user from './user/index';
import content from './content/index';
import server from './server/index';

const rootRouter = express.Router();

rootRouter.use('/user',user);

rootRouter.use('/content', content);

rootRouter.use('/server', server);

export default rootRouter;
