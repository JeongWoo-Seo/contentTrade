import mySqlHandler from "../db/mysql";

export const nicknameDeduplicateCheckController = async (req, res) => {
    const nickname = req.params.nickname;
    await mySqlHandler.nicknameDuplicateCheckQuery(nickname,(err,flag) => {
        res.status(200).send(flag);
    });
}

export const addressDeduplicateChcekController = async (req, res) => {
    console.log(req.params);
    //res.send("test");
}



export const joinController = async (req, res) => {
    console.log(req.body);
}

export const loginController = async (req, res) => {

}
