import _ from 'lodash';

export const nicknameDeduplicateCheckController = async (req, res) => {
    console.log(req.params);
    res.status(200).send({flag: true}
    );
}

export const addressDeduplicateChcekController = async (req, res) => {
    console.log(req.params);
    res.send("test");
}



export const joinController = async (req, res) => {
    console.log(req.body);

   
}

export const loginController = async (req, res) => {

}
