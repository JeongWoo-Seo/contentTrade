import mysql from 'mysql2';
import mysqlPromise from 'mysql2/promise';
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
const promiseConnection = await mysqlPromise.createConnection(
    {
        host: process.env.DATABASE_HOST,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME
    }
);

export function nicknameDuplicateCheckQuery(nickname, callback) {
    const query = `SELECT nickname FROM user WHERE nickname = ?`;

    connection.query(query, [nickname], (err, results) => {
        if (err) {
            return callback(err, false);
        }
        // 중복이 없으면 true, 있으면 false
        callback(null, results.length === 0);
    });
}

export function userJoinQuery(userInfoJson, callback) {
    const {
        loginTk,
        nickname,
        skEnc,
        pkOwn,
        pkEnc,
        addr,
        eoa
    } = userInfoJson;

    const query = `
        INSERT INTO user (login_tk, nickname, sk_enc, pk_own, pk_enc, addr, eoa) 
        VALUES (?, ?, ?, ?, ?, ?, ?);
    `;

    const values = [loginTk, nickname, skEnc, pkOwn, pkEnc, addr, eoa];

    connection.query(query, values, (err, result) => {
        if (err) {
            console.error('User insert failed:', err);
            return callback(false);
        }

        console.log("insert user successfully:");
        callback(true);
    });
}

export async function  getUserCount(){
    try {
        const query = 'SELECT COUNT(*) FROM user';
        const [rows] = await promiseConnection.execute(query);

        return rows[0]['COUNT(*)'];
    } catch (error) {
        console.error('getUserCount error:', error);
        throw error;
    }
}

export function getUserInfoFromId(id, callback) {
    const query = `SELECT * FROM user WHERE id = ?`;

    connection.query(query, [id], (err, rows) => {
        if (err) {
            console.error('DB Error:', err);
            return callback(err, null);
        }

        if (rows.length === 0) {
            const msg = 'ID does not exist';
            console.log(msg);
            return callback(msg, null);
        }

        callback(null, rows[0]);
    });
}

export async function getUserInfo(lgTk) {
    try {
        const query = 'SELECT * FROM user WHERE login_tk = ?';
        const [rows] = await promiseConnection.execute(query, [lgTk]);

        if (rows.length === 0) {
            return null;
        }
        return rows[0];
    } catch (error) {
        console.error('getUserInfo error:', error);
        throw error;
    }
}

export function userLoginQuery(userInfoJsonInput, callback) {
    const { nickname, login_tk } = userInfoJsonInput;

    const query = `
        SELECT login_tk, nickname, sk_enc, eoa 
        FROM user 
        WHERE nickname = ?
    `;

    connection.query(query, [nickname], (err, rows) => {
        if (err) {
            console.error('DB Error:', err);
            return callback({flag:false});
        }

        if (rows.length === 0) {
            console.log('User does not exist');
            return callback({ flag: false });
        }

        const user = rows[0];

        if (user.login_tk !== login_tk) {
            console.log('login_tk is incorrect');
            return callback({ flag: false });
        }

        callback({
            flag: true,
            nickname: user.nickname,
            login_tk: user.login_tk,
            sk_enc  : user.sk_enc,
            eoa     : user.eoa
        });
    });
}

export async function getUserKeysFromId(id) {
    const query = `
        SELECT sk_enc, pk_enc, pk_own 
        FROM user 
        WHERE id = ?
    `;

    try {
        const [rows] = await promiseConnection.execute(query, [id]);

        if (!rows.length) {
            return null; 
        }

        return rows[0];
    } catch (error) {
        console.error("getUserKeysFromId 오류:", error);
        throw error; 
    }
}

export async function registDataQuery(registDataJsonInput) {
    const {
        id: user_id,
        title,
        desc: descript,
        h_k,
        h_ct,
        h_data,
        enc_key,
        data_path
    } = registDataJsonInput;

    const query = `
        INSERT INTO content_list 
        (user_id, title, descript, h_ct, h_data, enc_key, data_path, h_k)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [user_id, title, descript, h_ct, h_data, enc_key, data_path, h_k];

    try {
        connection.query(query, values);
        return true;
    } catch (error) {
        console.error('mysql registDataQuery error:', error);
        throw error;
    }
}

export async function getDataList(pageIndex) {
    const offset = pageIndex * 10;
    const query = `
        SELECT title, descript, user_id 
        FROM content_list 
        LIMIT ?, 10;
    `;

    try {
        const [data] = await promiseConnection.execute(query, [offset]);
        return data;
    } catch (error) {
        console.error('getDataList:', error);
        return [];
    }
}

export async function getAllDataList() {
    const query = `
        SELECT title, descript, user_id, h_ct 
        FROM content_list;
    `;

    try {
        const [rows] = await promiseConnection.execute(query);

        if (rows.length === 0) {
            return null;
        }

        return rows;
    } catch (error) {
        console.error('Error fetching all data:', error);
        throw error;
    }
}

export async function getMyData(user_id) {
    const query = `
        SELECT title, descript, h_ct, enc_key 
        FROM content_list 
        WHERE user_id = ?;
    `;

    try {
        const [rows] = await promiseConnection.execute(query, [user_id]);
        return rows;
    } catch (error) {
        console.error('Error fetching user data:', error);
        return [];
    }
}

export async function getDataInfoFromHct(h_ct) {
    const query = `
        SELECT h_k, h_ct, h_data, user_id, title
        FROM content_list
        WHERE h_ct = ?
    `;

    try {
        const [rows] = await promiseConnection.execute(query, [h_ct]);

        if (!rows.length) {
            return null;
        }

        return rows[0];
    } catch (error) {
        console.error("getDataInfoFromHct 오류:", error);
        throw error;
    }
}

export async function getDataEncKeyFromHct(h_ct) {
    const query = `
        SELECT enc_key, data_path 
        FROM content_list 
        WHERE h_ct = ?
    `;

    try {
        const [rows] = await promiseConnection.execute(query, [h_ct]);

        if (rows.length === 0) {
            return null;
        }

        return rows[0];
    } catch (error) {
        console.error("getDataEncKeyFromHct 오류:", error);
        throw error;
    }
}


const mySqlHandler = {
    nicknameDuplicateCheckQuery,
    userJoinQuery,
    userLoginQuery,
    registDataQuery,
    getUserInfo,
    getAllDataList,
    getUserCount
};

export default mySqlHandler;