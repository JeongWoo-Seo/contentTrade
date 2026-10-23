import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listNovels, getTradeInfo } from '../services/novelService';
import { Pagination } from './Pagination';
import type { NovelListItem } from '../types';
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
      // [구매 절차 1/8] 거래 정보 조회 (구현됨)
      // 서버가 거래 상태(ACTIVE)를 검증하고, 거래 불가면 오류를 반환한다.
      const tradeInfo = await getTradeInfo(item.id);

      // ---- 이후 단계는 ZK/블록체인 연동이 준비되면 이곳에서 구현한다 ----

      // [구매 절차 2/8] 블록체인에서 구매자 계좌 정보 조회
      // TODO: 구매자(현재 로그인 사용자)의 on-chain 계좌(commitment)를 조회한다.

      // [구매 절차 3/8] 계좌 정보 복호화
      // TODO: 계좌 정보를 sk_enc 등으로 복호화해 원문 데이터를 얻는다.

      // [구매 절차 4/8] ENA_ 암호화
      // TODO: 구매자의 계좌 commitment(ENA_)를 암호화한다.

      // [구매 절차 5/8] Cm 및 주문 정보 암호화
      // TODO: CoinCommitment(Cm)와 주문 정보를 작가/서버 공개키로 암호화한다.

      // [구매 절차 6/8] Proof + public input 생성
      // TODO: generate_trade / accept_trade 회로의 witness를 생성하고 Groth16 proof를 만든다.

      // [구매 절차 7/8] 블록체인에서 ZK proof 검증
      // TODO: 블록체인 컨트랙트에 proof를 제출해 검증받고 tx_hash를 얻는다.

      // [구매 절차 8/8] h_ct와 tx_hash를 서버에 전달
      // TODO: 검증된 h_ct와 tx_hash를 구매 완료 API로 전달해 구매를 확정한다.

      console.log('[purchase] 거래 정보 조회 성공:', tradeInfo);
      setPurchaseMessage(`"${item.title}" 구매 절차를 시작합니다.`);
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
