import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const connection = mysql.createConnection(
    {
        host: process.env.DATABASE_HOST,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME
    }
);

export function nicknameDuplicateCheckQuery(nickname, callback) {
    const duplicateCheck = `select nickname from user where nickname=?`;
    connection.query(duplicateCheck, [`${nickname}`], (err, res) => {
        if(err) { callback(err, false); }
        callback(null, res.length==0);
    });
}

export function userJoinQuery(userInfoJson, callback){

    const loginTk  = userInfoJson['loginTk'];
    const nickname = userInfoJson['nickname'];
    const skEnc    = userInfoJson['skEnc'];
    const pkOwn    = userInfoJson['pkOwn'];
    const pkEnc    = userInfoJson['pkEnc'];
    const addr     = userInfoJson['addr'];
    const EOA      = userInfoJson['eoa'];
    const userInsertUserQuery = 
        `INSERT INTO user (login_tk, nickname, sk_enc, pk_own, pk_enc, addr, eoa) 
        VALUES('${loginTk}', '${nickname}','${skEnc}', '${pkOwn}', '${pkEnc}', '${addr}', '${EOA}');`
    connection.query(userInsertUserQuery, (err, result) => {
        if(err){console.log(err); callback(false); return;}
        console.log("userInsertUserQuery",result);
        callback(true);
    })
    
}

export function getUserInfoFromId(id, callback){
    const getUserInfo = `select * from user where id=?`;

    connection.query(getUserInfo, [`${id}`], (err, row) => {
        if(err) {console.log(err); callback(err, null); return;}
        else if(row.length == 0){
            console.log("id does not exist");
            callback("id does not exist", null);
            return;
        }
        callback(null, row[0]);
    });
}

export function userLoginQuery(userInfoJsonInput, callback){
    const userInfoJson = _.isString(userInfoJsonInput)? JSON.parse(userInfoJsonInput) : userInfoJsonInput;

    const loginTk = userInfoJson['loginTk']
    const loginQuery = `select login_tk, nickname, sk_enc, eoa_addr from user where login_tk=?`

    connection.query(loginQuery, [`${loginTk}`], (err, row) => {
        if(err) {console.log(err); callback(false); return;}
        if(row.length == 0){
            console.log("loginTk does not exist");
            callback({
                flag : false
            });
            return;
        }
        console.log(row);
        
        callback({
            flag : true,
            nickname : row[0].nickname,
            login_tk : row[0].login_tk,
            sk_enc   : row[0].sk_enc,
        });
    });
}

export async function registDataQuery(registDataJsonInput){
    const owner_nickname    = registDataJsonInput['nickname'];
    const title             = registDataJsonInput['title'];
    const descript          = registDataJsonInput['desc'];
    const h_k               = registDataJsonInput['h_k'];
    const h_ct              = registDataJsonInput['h_ct'];
    const h_data            = registDataJsonInput['h_data'];
    const enc_key           = registDataJsonInput['enc_key'];
    const data_path         = registDataJsonInput['data_path'];

    const query = 
    `INSERT INTO data (owner_nickname, title, descript, h_ct, h_data, enc_key, data_path, h_k)
    VALUES('${owner_nickname}', '${title}', '${descript}', '${h_ct}', '${h_data}', '${enc_key}', '${data_path}', '${h_k}')`

    try {
        const [ret] = await promiseConnection.execute(query);
        console.log(ret);
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
}

export async function getDataList(ind, callback) { 
    const getDataQuery = 
    `SELECT title, descript, owner_nickname from data LIMIT ${ind*10}, 10;`

    const [data] = await promiseConnection.execute(getDataQuery);
    console.log(data);
    return data;
}

export async function getAllDataList (callback){
    const getDataQuery = 
    `SELECT title, descript, owner_nickname, h_ct from data;`

    const [data] = await promiseConnection.execute(getDataQuery)
    console.log(data);
    return data;
}

export async function getMyData(nickname){
    const getMyDataQuery = 
    `SELECT title, descript, h_ct, enc_key FROM data WHERE owner_nickname='${nickname}';`
    
    const [rows, fields] = await promiseConnection.execute(getMyDataQuery);
    console.log(rows);
    return rows
}
// connection.query('SELECT * FROM user;', function (error, results, fields) {
//   if (error) throw error;
//   console.log('user: ', results);
// });

const mySqlHandler = {
    nicknameDuplicateCheckQuery,
    userJoinQuery
};

export default mySqlHandler;