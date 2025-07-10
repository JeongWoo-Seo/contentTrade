import express from 'express';
import key from './key';

const server = express.Router();

server.use('/key',key);

export default server;