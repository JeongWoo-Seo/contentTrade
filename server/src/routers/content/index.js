import express from 'express';
import registerContent from './registerContent';
import list from './list';
import buy from './buy';

const content = express.Router();

content.use('/registerContent',registerContent);
content.use('/list',list);
content.use('/buy',buy);

export default content;
