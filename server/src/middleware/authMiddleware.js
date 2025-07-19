import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

export const authenticateToken = (req,res,next) =>{
    const token = req.headers['access-token'];
    
    if(!token){
        return res.status(401).json({message : "인증 토큰이 없습니다"});
    }

    jwt.verify(token,JWT_SECRET,(err,user) =>{
        if(err){
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({message: "인증 토큰이 만료되었습니다. 다시 로그인해주세요." });
            }
            console.error("JWT 검증 오류:", err);
            return res.status(403).json({message: "유효하지 않은 인증 토큰입니다." });
        }
        req.user = user;
        next();
    })
}