import dotenv from 'dotenv';

dotenv.config();

export const getPublicKeyController = (req, res) => {
    const pk_own = process.env.PK_OWN;
    const pk_enc = process.env.PK_ENC;

    const publicKey = {
        pk_own,
        pk_enc
    }

    res.status(200).send({publicKey});
}