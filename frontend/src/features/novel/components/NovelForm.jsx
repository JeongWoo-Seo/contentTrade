import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createNovel } from '../services/novelService.js';
import '../styles/NovelForm.css';

const MAX_TITLE = 50;
const MAX_DESCRIPTION = 200;
const MAX_CONTENT = 5000;
const MAX_PRICE = 1_000_000_000;

export function NovelForm() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const priceNum = Number(price);

    if (!trimmedTitle) {
      setError('제목을 입력해주세요.');
      return;
    }
    if (trimmedTitle.length > MAX_TITLE) {
      setError(`제목은 ${MAX_TITLE}자 이하여야 합니다.`);
      return;
    }
    if (!trimmedDescription) {
      setError('소개를 입력해주세요.');
      return;
    }
    if (trimmedDescription.length > MAX_DESCRIPTION) {
      setError(`소개는 ${MAX_DESCRIPTION}자 이하여야 합니다.`);
      return;
    }
    if (!content.trim()) {
      setError('내용을 입력해주세요.');
      return;
    }
    if (content.length > MAX_CONTENT) {
      setError(`내용은 ${MAX_CONTENT}자 이하여야 합니다.`);
      return;
    }
    if (price === '' || Number.isNaN(priceNum)) {
      setError('가격을 숫자로 입력해주세요.');
      return;
    }
    if (priceNum < 0) {
      setError('가격은 0 이상이어야 합니다.');
      return;
    }
    if (priceNum > MAX_PRICE) {
      setError(`가격은 ${MAX_PRICE.toLocaleString()} 이하여야 합니다.`);
      return;
    }

    setLoading(true);
    try {
      await createNovel({
        title: trimmedTitle,
        description: trimmedDescription,
        content,
        price: priceNum,
      });
      navigate('/novels', { state: { registered: true } });
    } catch (err) {
      setError(err?.message ?? '소설 등록에 실패했습니다.');
      setLoading(false);
    }
  };

  const contentOver = content.length > MAX_CONTENT;

  return (
    <form className="novel-form" onSubmit={onSubmit}>
      <h2>소설 등록</h2>

      <label className="novel-field">
        <span>제목</span>
        <input
          type="text"
          value={title}
          maxLength={MAX_TITLE}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
        />
      </label>

      <label className="novel-field">
        <span>간략 소개</span>
        <textarea
          value={description}
          maxLength={MAX_DESCRIPTION}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="간략 소개"
        />
      </label>

      <label className="novel-field">
        <span>내용</span>
        <textarea
          className="content-input"
          value={content}
          rows={10}
          onChange={(e) => setContent(e.target.value)}
          placeholder="소설 본문"
        />
        <span className={`char-count${contentOver ? ' over' : ''}`}>
          {content.length} / {MAX_CONTENT}
        </span>
      </label>

      <label className="novel-field">
        <span>가격</span>
        <input
          type="number"
          value={price}
          min="0"
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0"
        />
      </label>

      {error && <p className="novel-form-error">{error}</p>}

      <button type="submit" className="novel-submit" disabled={loading}>
        {loading ? '등록 중…' : '등록하기'}
      </button>
    </form>
  );
}
