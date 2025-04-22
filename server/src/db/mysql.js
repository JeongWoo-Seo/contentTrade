import mysql  from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const connection = mysql.createConnection(
    {
        host     : process.env.DATABASE_HOST,
        user     : process.env.DATABASE_USER,
        password : process.env.DATABASE_PASSWORD,
        database : process.env.DATABASE_NAME
    }
);

export function nicknameDuplicateCheckQuery(nickname, callback) {
    const duplicateCheck = `SELECT nickname FROM user where nickname=?`;
    connection.query(duplicateCheck, [`${nickname}`], (err, res) => {
        console.log(res);
        if(err) { callback(err, false); }
        callback(null, res.length==0);
    });
}
 
// connection.query('SELECT * FROM user;', function (error, results, fields) {
//   if (error) throw error;
//   console.log('user: ', results);
// });
 
// connection.end();

const mySqlHandler = {
    nicknameDuplicateCheckQuery
};

export default mySqlHandler;