import express from "express";
import join from "./join";
import login from './login';

const user = express.Router();

user.use('/join',join);
user.use('/login',login);

export default user;
