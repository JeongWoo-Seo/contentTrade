import express from 'express';
import registerContent from './registerContent';

const content = express.Router();

content.use('/content',registerContent);

export default content;
