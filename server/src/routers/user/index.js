import express from "express";
import join from "./join";

const user = express.Router();

user.use('/join',join);

export default user;
