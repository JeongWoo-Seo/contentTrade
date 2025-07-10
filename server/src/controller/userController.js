import mySqlHandler from "../db/mysql";
import jwt from 'jsonwebtoken';
import dotenv from "dotenv";
import { accountAddressList } from "../config/config"

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

export const nicknameDeduplicateCheckController = async (req, res) => {
    const nickname = req.params.nickname;
    await mySqlHandler.nicknameDuplicateCheckQuery(nickname, (err, flag) => {
        res.status(200).send(flag);
    });
}

export const joinController = async (req, res) => {
    try {
        const count = await mySqlHandler.getUserCount();
        req.body.eoa = accountAddressList[count + 1];

        mySqlHandler.userJoinQuery(req.body, async (ret) => {
            if (!ret) { return res.status(500).json({ message: "서버 오류가 발생했습니다." }); }

            console.log("user join");
            res.status(201).send({
                flag: true
            });
        })
    } catch (error) {
        console.log("joinController 오류", error);
        res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
}

export const loginController = async (req, res) => {
    try {
        mySqlHandler.userLoginQuery(req.body, (login) => {
            const response = {
                flag: false,
                token: undefined,
                loginTk: undefined,
                nickname: undefined,
                eoa: undefined
            };

            if (login.flag) {
                response.flag = true;
                response.loginTk = login.login_tk;
                response.token = jwt.sign({ sk_enc: login.sk_enc }, JWT_SECRET);
                response.nickname = login.nickname;
                response.eoa = login.eoa;
            }
            res.status(200).send(response);
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
}

export const getUserKeyInfoController = async (req, res) => {
    try {
        const jwtHeader = JSON.parse(req.headers['access-token'])
        const loginTk = jwtHeader.loginTk;
        if (!loginTk) {
            return res.status(401).json({ message: "User not logged in" });
        }

        const usrInfo = await mySqlHandler.getUserInfo(loginTk);

        if (!usrInfo) {
            return res.status(404).json({ message: "User not found" });
        }

        const { pk_own, pk_enc } = usrInfo;

        return res.status(200).send({ pk_own, pk_enc });
    } catch (error) {
        console.error("getUserKeyInfoController 오류:", error);
        return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
};