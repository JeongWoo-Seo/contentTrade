import express from 'express';
import key from './key';
import contract from './contract';

const server = express.Router();

server.use('/key',key);
server.use('/contract',contract);

export default server;