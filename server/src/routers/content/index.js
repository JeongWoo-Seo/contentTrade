import express from 'express';
import registerContent from './registerContent';
import list from './list';

const content = express.Router();

content.use('/registerContent',registerContent);
content.use('/list',list);

export default content;
