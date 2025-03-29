import express from 'express';
import rootRouter from "./routers";
import bodyParser from "body-parser";
import cors from 'cors';

const server = async () =>{
    const app = express();
    
    app.get('/',(req,res) => {
        res.send("hello");
    });

    app.use(cors({
        origin: '*', // 모든 출처 허용 옵션. true 를 써도 된다.
    }));

    app.use(bodyParser.json());
    app.use('/', rootRouter);   // 서버가 실행되기 전에 set 라우터 지정
    
    app.set('port',8005);
    app.listen(app.get('port'));
}

export default server;