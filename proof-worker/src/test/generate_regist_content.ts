import { encryptContent } from "../crypto/encryption.js";
import fs from "node:fs";

const originalText = "안녕하세요. 테스트 소설입니다.";

const authorPkOwn =
  "8679292966549914781522984359010950067423950449345789524075911117536530257186";

const encrypted = encryptContent(
  originalText,
  authorPkOwn,
);

if (!encrypted.success) {
  throw new Error(encrypted.reason);
}

const { result } = encrypted;

fs.writeFileSync(
  "./src/test/input.json",
  JSON.stringify(
    {
      pk_own: authorPkOwn,
      h_k: result.hK,
      h_ct: result.hCt,
      h_data: result.hData,

      dataEncKey: result.witness.dataEncKey,
      data: result.witness.data,
      CT_data: result.witness.CT_data,
      CT_r: result.witness.CT_r,
    },
    null,
    2,
  ),
);