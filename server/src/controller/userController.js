import mySqlHandler from "../db/mysql";

export const nicknameDeduplicateCheckController = async (req, res) => {
    const nickname = req.params.nickname;
    await mySqlHandler.nicknameDuplicateCheckQuery(nickname,(err,flag) => {
        res.status(200).send(flag);
    });
}

export const joinController = async (req, res) => {

    // if(!JoinHelper.idLengthCheck(req.body["nickname"])){
    //     return res.status(400).send("id is too long");
    // }
    
    // const account = await getGanacheAccounts(usrcnt);

    try {
        // const tradeContract = getTradeContract();
        // const pk_own = hexToDec(req.body['pkOwn'])
        // const pk_enc = hexToDec(req.body['pkEnc'])
        // const receipt = await tradeContract.registUser(
        //     pk_own,
        //     pk_enc,
        //     account.address
        // )
        
        // _.set(req.body, 'eoa', _.get(account, 'address'))
        // _.set(req.body, 'receipt', receipt)
        //임시코드
        req.body.eoa = "6";
        //임시코드
        
        mySqlHandler.userJoinQuery(req.body, async (ret) => {
            if(!ret){return res.status(200).send({flag:false});}
            
            //usrcnt += 1;
            res.status(200).send({
                flag: true
                // account : account,
                // receipt : receipt
            });
        })
    } catch (error) {
        console.log(error);
        res.status(200).send({flag: false});
    }    
}

export const loginController = async (req, res) => {

}
