import mySqlHandler from "../db/mysql";
import jwt from 'jsonwebtoken';
import dotenv from "dotenv";
import bcrypt from 'bcrypt';
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
        const { loginTk,nickname,skEnc,pkOwn,pkEnc,addr} = req.body;
        if (!loginTk || !nickname || !skEnc || !pkOwn || !pkEnc || !addr) {
            return res.status(400).json({
                success: false,
                message: "가입 정보가 부족합니다."
            });
        }
        const saltRounds = 10; // 솔트 생성에 사용될 라운드 수 (보통 10~12)
        const login_tk = await bcrypt.hash(loginTk, saltRounds);

        const count = await mySqlHandler.getUserCount();
        const eoa = accountAddressList[count + 1];

        const userData = {
            login_tk,
            nickname, 
            skEnc,pkOwn,pkEnc,addr,
            eoa 
        };

        mySqlHandler.userJoinQuery(userData, async (ret) => {
            if (!ret) { return res.status(500).json({success: false,message: "서버 오류가 발생했습니다." }); }

            console.log("user join");
            res.status(201).send({
                success: true
            });
        })
    } catch (error) {
        console.log("joinController 오류", error);
        res.status(500).json({success: false, message: "서버 오류가 발생했습니다." });
    }
}

export const loginController = async (req, res) => {
    const { nickname, login_tk } = req.body;
    if (!nickname || !login_tk) {
        return res.status(400).json({
            success: false,
            message: "사용자 이름과 비밀번호를 모두 입력해주세요."
        });
    }

    try {
        const loginInfo = await mySqlHandler.userLoginQuery(req.body);

        if (loginInfo && loginInfo.flag) {
            const isPasswordValid = bcrypt.compareSync(login_tk, loginInfo.login_tk);

            if (!isPasswordValid) {
                return res.status(401).json({success: false,message: "로그인 실패: 비밀번호가 올바르지 않습니다." });
            }
            const token = jwt.sign({ user_id: loginInfo.user_id, nickname : loginInfo.nickname }, JWT_SECRET, { expiresIn: '1h' });

            return res.status(200).json({
                success: true, 
                user_id : loginInfo.user_id,
                nickname: loginInfo.nickname,
                eoa: loginInfo.eoa,
                token: token
            });
        } else {
            return res.status(401).json({
                success: false,
                message: "로그인 실패: 사용자 이름 또는 비밀번호가 올바르지 않습니다."
            });
        }
    } catch (error) {
        console.error("로그인 처리 중 서버 오류 발생:", error);
        return res.status(500).json({
            success: false,
            message: "서버 오류가 발생했습니다."
        });
    }
};

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

        const { sk_enc,pk_own, pk_enc } = usrInfo;

        return res.status(200).send({ sk_enc,pk_own, pk_enc });
    } catch (error) {
        console.error("getUserKeyInfoController 오류:", error);
        return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
};