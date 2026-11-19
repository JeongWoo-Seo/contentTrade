import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listNovels, getTradeInfo, requestPurchase } from '../services/novelService';
import { Pagination } from './Pagination';
import type { NovelListItem } from '../types';
import { useAuth } from '../../auth/hooks/useAuth';
import { getContractAddress } from '../../auth/services/contractService';
import { submitPurchaseContent, getEna } from '../services/contractService';
import { computeAccountBalanceUpdate } from '../../../utils/crypto/balance';
import { createPurchaseOrder, buildGenerateTradeInput } from '../services/purchaseOrder';
import { generateTradeProof } from '../services/proofService';
import { splitPointHex } from '../../../utils/crypto/util';
import '../styles/NovelList.css';

const PAGE_SIZE = 20;

type LoadStatus = 'loading' | 'loaded' | 'error';

export function NovelList() {
  const [items, setItems] = useState<NovelListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<LoadStatus>('loading');

  // 구매 진행 상태
  const [purchasingId, setPurchasingId] = useState<number | null>(null); // 구매 중인 소설 id
  const [purchaseMessage, setPurchaseMessage] = useState('');
  const [purchaseError, setPurchaseError] = useState(false);
  const { getSecrets, getWallet } = useAuth();

  const load = useCallback(async (p: number) => {
    setStatus('loading');
    try {
      const data = await listNovels({ page: p, size: PAGE_SIZE });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setStatus('loaded');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const handlePurchase = async (item: NovelListItem) => {
    // 중복 클릭 방지: 이미 구매 절차가 진행 중이면 무시.
    if (purchasingId !== null) return;

    setPurchasingId(item.id);
    setPurchaseError(false);
    setPurchaseMessage('');

    try {
      // [구매 절차 1/8] 거래 정보 조회
      // 서버가 거래 상태(ACTIVE)를 검증하고, 거래 불가면 오류를 반환한다.
      console.log('[purchase] 구매 요청 진행');
      const tradeInfo = await getTradeInfo(item.id);

      // 이미 구매를 요청했거나 완료한 경우: 재구매하지 않고 안내한다.
      if (tradeInfo.alreadyPurchased) {
        setPurchaseMessage(`"${item.title}"은(는) 이미 구매한 소설입니다.`);
        return;
      }

      // [구매 절차 2/8] 로그인 사용자의 addr로 계좌 암호화 잔액(ENA) 조회
      const secrets = getSecrets();
      const addr = secrets.addr;
      const kENA = secrets.kENA;
      if (!addr || !kENA) {
        throw new Error('로그인 정보가 없습니다.');
      }
      const deployment = await getContractAddress();
      const ena = await getEna(addr, deployment.contentTrade); // 계좌 미등록 시 오류

      // [구매 절차 3/8] ENA 복호화 후 price 차감
      // [구매 절차 4/8] 차감된 잔액을 기존 ENA 방식으로 재암호화
      const balanceUpdate = await computeAccountBalanceUpdate(kENA, ena, BigInt(tradeInfo.price));
      console.log('[purchase] 계좌 잔액 처리 완료:', balanceUpdate);

      // [구매 절차 5/8] Cm 및 주문 정보 암호화
      if (!secrets.pkEnc) {
        throw new Error("User encryption keys are missing");
      }

      const purchaseOrder = await createPurchaseOrder({
        pk_enc_cons: splitPointHex(secrets.pkEnc),
        pk_enc_svr: splitPointHex(tradeInfo.serverPkEnc),
        pk_enc_auth: splitPointHex(tradeInfo.authorPkEnc),
        pk_own_svr: tradeInfo.serverPkOwn,
        pk_own_auth: tradeInfo.authorPkOwn,
        h_k: tradeInfo.hK,
        price: BigInt(tradeInfo.price),
      });

      const input = buildGenerateTradeInput({
        purchaseOrder,
        balanceUpdate,
        hK: tradeInfo.hK,
        serverPkOwn: tradeInfo.serverPkOwn,
        authorPkOwn: tradeInfo.authorPkOwn,
        pkEnc: secrets.pkEnc,
        serverPkEnc: tradeInfo.serverPkEnc,
        authorPkEnc: tradeInfo.authorPkEnc,
        kENA,
      });

      // [구매 절차 6/8] Proof + public input 생성
      const { proof, publicSignals } = await generateTradeProof(input);

      // [구매 절차 7/8] 블록체인에서 ZK proof 검증
      const wallet = getWallet();
      if (!wallet) {
        throw new Error('지갑 정보가 없습니다.');
      }

      const txHash = await submitPurchaseContent({
        privateKey: wallet.privateKey,
        contractAddress: deployment.contentTrade,
        proof,
        publicSignals,
      });

      // [구매 절차 8/8] 거래 승인 요청을 tx_hash와 함께 서버에 전달
      await requestPurchase(item.id, txHash);

      console.log('[purchase] 구매 요청 완료:', { contentId: item.id, txHash });
      setPurchaseMessage(`"${item.title}" 구매 요청이 완료되었습니다.`);
    } catch (err) {
      // 거래 불가 / 존재하지 않음 / 네트워크·API 오류 → 절차 중단 + 안내.
      setPurchaseError(true);
      setPurchaseMessage(err instanceof Error ? err.message : '구매 중 오류가 발생했습니다.');
    } finally {
      setPurchasingId(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="novel-list">
      <header className="novel-list-header">
        <h2>소설 목록</h2>
        <Link to="/novels/new" className="new-button">
          소설 등록
        </Link>
      </header>

      {purchaseMessage && (
        <div className={purchaseError ? 'purchase-msg error' : 'purchase-msg'}>
          {purchaseMessage}
        </div>
      )}

      {status === 'loading' && <p className="status-msg">소설을 불러오는 중...</p>}

      {status === 'error' && (
        <div className="status-msg error">
          <p>소설 목록을 불러오지 못했습니다. 다시 시도해주세요.</p>
          <button type="button" onClick={() => load(page)}>
            다시 시도
          </button>
        </div>
      )}

      {status === 'loaded' && items.length === 0 && (
        <p className="status-msg">등록된 소설이 없습니다.</p>
      )}

      {status === 'loaded' && items.length > 0 && (
        <ul className="novel-items">
          {items.map((item) => (
            <li key={item.id} className="novel-item">
              <h3 className="novel-title">{item.title}</h3>
              <p className="novel-desc">{item.description}</p>
              <div className="novel-meta">
                <span className="novel-author">{item.author}</span>
                <span className="novel-price">{Number(item.price).toLocaleString()}원</span>
              </div>
              <div className="novel-actions">
                <button
                  type="button"
                  className="purchase-button"
                  onClick={() => handlePurchase(item)}
                  disabled={purchasingId !== null}
                >
                  {purchasingId === item.id ? '구매 중…' : '구매'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {status === 'loaded' && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
