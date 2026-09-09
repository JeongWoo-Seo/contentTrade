import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listNovels } from '../services/novelService.js';
import { Pagination } from './Pagination.jsx';
import '../styles/NovelList.css';

const PAGE_SIZE = 20;

export function NovelList() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | loaded | error

  const load = useCallback(async (p) => {
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

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="novel-list">
      <header className="novel-list-header">
        <h2>소설 목록</h2>
        <Link to="/novels/new" className="new-button">
          소설 등록
        </Link>
      </header>

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
