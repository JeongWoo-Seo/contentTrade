import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyRegistrations } from '../services/novelService.js';
import { Pagination } from './Pagination.jsx';
import '../styles/NovelList.css';
import '../styles/MyRegistrations.css';

const PAGE_SIZE = 20;

// 등록 처리 상태(ContentRegistration.status) → 사용자 친화 라벨 + 배지 클래스.
// 판매 상태(ContentList.status)와 별개다.
const STATUS_META = {
  PENDING: { label: '처리 대기', className: 'pending' },
  PROCESSING: { label: '처리 중', className: 'processing' },
  APPROVED: { label: '승인', className: 'approved' },
  REJECTED: { label: '반려', className: 'rejected' },
};

function formatDate(iso) {
  return iso ? iso.slice(0, 10) : '';
}

export function MyRegistrations() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | loaded | error

  const load = useCallback(async (p) => {
    setStatus('loading');
    try {
      const data = await getMyRegistrations({ page: p, size: PAGE_SIZE });
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

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="myreg-list">
      <header className="novel-list-header">
        <h2>내가 등록한 소설</h2>
      </header>

      {status === 'loading' && <p className="status-msg">불러오는 중...</p>}

      {status === 'error' && (
        <div className="status-msg error">
          <p>소설 목록을 불러오지 못했습니다. 다시 시도해주세요.</p>
          <button type="button" onClick={() => load(page)}>
            다시 시도
          </button>
        </div>
      )}

      {status === 'loaded' && items.length === 0 && (
        <div className="status-msg empty">
          <p>등록한 소설이 없습니다.</p>
          <p>첫 번째 소설을 등록해보세요.</p>
          <Link to="/novels/new" className="new-button">
            소설 등록하기
          </Link>
        </div>
      )}

      {status === 'loaded' && items.length > 0 && (
        <ul className="myreg-items">
          {items.map((item) => {
            const meta = STATUS_META[item.status] ?? { label: item.status, className: '' };
            return (
              <li key={item.id} className="myreg-item">
                <div className="myreg-header">
                  <h3 className="myreg-title">{item.title}</h3>
                  <span className={`status-badge ${meta.className}`}>{meta.label}</span>
                </div>
                <div className="myreg-meta">
                  <span className="myreg-price">{Number(item.price).toLocaleString()}원</span>
                  <span className="myreg-date">{formatDate(item.createdAt)}</span>
                </div>
                {item.status === 'REJECTED' && item.rejectionReason && (
                  <p className="myreg-rejection">반려 사유: {item.rejectionReason}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {status === 'loaded' && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
