import express from 'express';

const server = async () =>{
    const app = express();
    app.set('port',8001);
    app.get('/',(req,res) => {
        res.send("hello");
    });

    app.listen(app.get('port'));
}

export default server;