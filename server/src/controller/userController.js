import mySqlHandler from "../db/mysql";
import jwt from 'jsonwebtoken';
import dotenv from "dotenv";
import {accountAddressList} from "../config/config"

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

export const nicknameDeduplicateCheckController = async (req, res) => {
    const nickname = req.params.nickname;
    await mySqlHandler.nicknameDuplicateCheckQuery(nickname,(err,flag) => {
        res.status(200).send(flag);
    });
}

export const joinController = async (req, res) => {
    
    try {
        const count = await mySqlHandler.getUserCount();
        req.body.eoa = accountAddressList[count+1];
        console.log("user join");
        mySqlHandler.userJoinQuery(req.body, async (ret) => {
            if(!ret){return res.status(200).send({flag:false});}

            res.status(200).send({
                flag: true
            });
        })
    } catch (error) {
        console.log(error);
        res.status(200).send({flag: false});
    }    
}

export const loginController = async (req, res) => {
    mySqlHandler.userLoginQuery(req.body, (login) => {
        const response = {
          flag      : false,
          token     : undefined,
          loginTk   : undefined,
          nickname  : undefined,
          eoa       : undefined
        };
        try {
            if(login.flag){
                response.flag     = true; 
                response.loginTk  = login.login_tk;
                response.token    = jwt.sign({sk_enc:login.sk_enc},JWT_SECRET);
                response.nickname = login.nickname;
                response.eoa      = login.eoa;
              }
              res.status(200).send(response); 
        } catch (error) {
            console.log(error);
            res.send(response);
        }
    })
}
