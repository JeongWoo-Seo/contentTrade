import dotenv from 'dotenv';
import { tradeContract } from '../contract/deploy';

dotenv.config();

/**
 * 공개키 정보 반환 컨트롤러
 */
export const getPublicKeyController = (req, res) => {
  const { PK_OWN: pk_own, PK_ENC: pk_enc } = process.env;

  if (!pk_own || !pk_enc) {
    return res.status(400).send({ message: '공개키 정보가 설정되어 있지 않습니다.' });
  }

  return res.status(200).send({ pk_own, pk_enc });
};

/**
 * 스마트 컨트랙트 주소 및 ABI 반환 컨트롤러
 */
export const getContractInfoController = (req, res) => {
  try {
    const address = tradeContract.options?.address;
    const jsonABI = tradeContract.options?.jsonInterface;

    if (!address || !jsonABI) {
      return res.status(400).send({ message: '컨트랙트 정보가 유효하지 않습니다.' });
    }

    return res.status(200).send({ address, jsonABI });
  } catch (error) {
    console.error('getContractAddressController 오류:', error);
    return res.status(500).send({ message: '서버 내부 오류가 발생했습니다.' });
  }
};
