import express from "express";
import join from "./join";
import login from './login';
import key from './key';

const user = express.Router();

user.use('/join',join);
user.use('/login',login);
user.use('/key',key);

export default user;
