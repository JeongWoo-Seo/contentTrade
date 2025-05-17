import express from 'express';
import registerContent from './registerContent';

const content = express.Router();

content.use('/registerContent',registerContent);

export default content;
