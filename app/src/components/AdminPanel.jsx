import { useEffect, useState } from 'react';

const emptyBook = { id: '', title: '', bookSeries: '', dynasty: '', author: '', description: '' };
const emptyChapter = { id: '', title: '', subtitle: '', year: '', period: '', original: '', translation: '' };
const importTemplate = JSON.stringify({
  books: [
    {
      id: 'guoyu',
      title: '国语',
      bookSeries: '国别体',
      dynasty: '春秋',
      author: '左丘明',
      description: '春秋国别史料汇编',
      eraEvents: [],
      chapters: [
        {
          id: 'guoyu-zhouyu',
          title: '周语',
          subtitle: '敬王问治',
          year: -520,
          period: 'spring_autumn_late',
          paragraphs: [
            {
              id: 'p1',
              original: '敬王问于史伯。',
              translation: '周敬王向史伯询问政事。',
              entities: [],
              routes: [],
            },
          ],
        },
      ],
    },
  ],
}, null, 2);

export default function AdminPanel({ adminClient, onClose, onChanged }) {
  const [books, setBooks] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [bookForm, setBookForm] = useState(emptyBook);
  const [chapterForm, setChapterForm] = useState(emptyChapter);
  const [importText, setImportText] = useState(importTemplate);
  const [importStatus, setImportStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedBook = books.find(book => book.id === selectedId) || null;

  async function loadBooks(nextSelectedId = selectedId) {
    setError('');
    try {
      const list = await adminClient.listBooks();
      setBooks(list);
      const nextSelected = list.find(book => book.id === nextSelectedId) || list[0] || null;
      setSelectedId(nextSelected?.id || '');
      setBookForm(nextSelected ? fromBook(nextSelected) : emptyBook);
    } catch (err) {
      setError(err?.message || '无法加载后台数据');
    }
  }

  function pickBook(bookId) {
    const book = books.find(item => item.id === bookId);
    setSelectedId(bookId);
    setBookForm(book ? fromBook(book) : emptyBook);
  }

  async function submitBook(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setImportStatus('');
    try {
      const payload = cleanBookPayload(bookForm);
      if (selectedBook?.id === bookForm.id) {
        await adminClient.updateBook(selectedBook.id, payload);
      } else {
        await adminClient.createBook(payload);
      }
      await loadBooks(payload.id);
      onChanged?.();
    } catch (err) {
      setError(err?.message || '保存古籍失败');
    } finally {
      setBusy(false);
    }
  }

  async function deleteBook() {
    if (!selectedBook) return;
    setBusy(true);
    setError('');
    setImportStatus('');
    try {
      await adminClient.deleteBook(selectedBook.id);
      await loadBooks('');
      onChanged?.();
    } catch (err) {
      setError(err?.message || '删除古籍失败');
    } finally {
      setBusy(false);
    }
  }

  async function submitChapter(event) {
    event.preventDefault();
    if (!selectedBook) return;
    setBusy(true);
    setError('');
    setImportStatus('');
    try {
      await adminClient.addChapter(selectedBook.id, cleanChapterPayload(chapterForm));
      setChapterForm(emptyChapter);
      await loadBooks(selectedBook.id);
      onChanged?.();
    } catch (err) {
      setError(err?.message || '新增章节失败');
    } finally {
      setBusy(false);
    }
  }

  async function submitImport(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setImportStatus('');
    try {
      const payload = JSON.parse(importText);
      const result = await adminClient.importPackage(payload);
      await loadBooks(payload.books?.[0]?.id || selectedId);
      onChanged?.();
      setImportStatus(`已导入 ${result.booksImported} 本古籍，${result.readingUnitsImported} 篇内容`);
    } catch (err) {
      setError(err instanceof SyntaxError ? '内容包 JSON 格式错误' : (err?.message || '导入内容包失败'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-panel" role="dialog" aria-modal="true">
      <div className="admin-panel__head">
        <div>
          <div className="admin-panel__eyebrow">管理员</div>
          <h2>内容维护</h2>
        </div>
        <button type="button" className="admin-panel__close" onClick={onClose}>关闭</button>
      </div>

      {error && <div className="admin-panel__error">{error}</div>}

      <div className="admin-panel__body">
        <div className="admin-panel__list">
          <button type="button" className={!selectedId ? 'is-active' : ''} onClick={() => { setSelectedId(''); setBookForm(emptyBook); }}>
            新增古籍
          </button>
          {books.map(book => (
            <button
              type="button"
              key={book.id}
              className={book.id === selectedId ? 'is-active' : ''}
              onClick={() => pickBook(book.id)}
            >
              <span>{book.title}</span>
              <small>{book.chapterCount || book.articleCount || 0} 篇</small>
            </button>
          ))}
        </div>

        <div className="admin-panel__forms">
          <form className="admin-form" onSubmit={submitBook}>
            <h3>{selectedBook ? '古籍信息' : '新增古籍'}</h3>
            <div className="admin-form__grid">
              <Field label="ID" value={bookForm.id} disabled={Boolean(selectedBook)} onChange={value => setBookForm({ ...bookForm, id: value })} required />
              <Field label="书名" value={bookForm.title} onChange={value => setBookForm({ ...bookForm, title: value })} required />
              <Field label="类别" value={bookForm.bookSeries} onChange={value => setBookForm({ ...bookForm, bookSeries: value })} />
              <Field label="朝代" value={bookForm.dynasty} onChange={value => setBookForm({ ...bookForm, dynasty: value })} />
              <Field label="作者" value={bookForm.author} onChange={value => setBookForm({ ...bookForm, author: value })} />
            </div>
            <TextField label="简介" value={bookForm.description} onChange={value => setBookForm({ ...bookForm, description: value })} />
            <div className="admin-form__actions">
              <button type="submit" disabled={busy}>{selectedBook ? '保存古籍' : '创建古籍'}</button>
              {selectedBook && <button type="button" className="is-danger" disabled={busy} onClick={deleteBook}>删除</button>}
            </div>
          </form>

          {selectedBook && (
            <form className="admin-form" onSubmit={submitChapter}>
              <h3>新增基础章节</h3>
              <div className="admin-form__grid">
                <Field label="章节 ID" value={chapterForm.id} onChange={value => setChapterForm({ ...chapterForm, id: value })} required />
                <Field label="标题" value={chapterForm.title} onChange={value => setChapterForm({ ...chapterForm, title: value })} required />
                <Field label="副标题" value={chapterForm.subtitle} onChange={value => setChapterForm({ ...chapterForm, subtitle: value })} />
                <Field label="年份" type="number" value={chapterForm.year} onChange={value => setChapterForm({ ...chapterForm, year: value })} />
                <Field label="时期 ID" value={chapterForm.period} onChange={value => setChapterForm({ ...chapterForm, period: value })} />
              </div>
              <TextField label="原文" value={chapterForm.original} onChange={value => setChapterForm({ ...chapterForm, original: value })} required />
              <TextField label="译文" value={chapterForm.translation} onChange={value => setChapterForm({ ...chapterForm, translation: value })} />
              <div className="admin-form__actions">
                <button type="submit" disabled={busy}>添加章节</button>
              </div>
            </form>
          )}

          <form className="admin-form admin-form--import" onSubmit={submitImport}>
            <h3>导入内容包</h3>
            {importStatus && <div className="admin-panel__success">{importStatus}</div>}
            <TextField label="内容包 JSON" value={importText} onChange={setImportText} required />
            <div className="admin-form__actions">
              <button type="submit" disabled={busy}>导入内容包</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false, disabled = false }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <input type={type} value={value} disabled={disabled} required={required} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextField({ label, value, onChange, required = false }) {
  return (
    <label className="admin-field admin-field--wide">
      <span>{label}</span>
      <textarea value={value} required={required} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function fromBook(book) {
  return {
    id: book.id || '',
    title: book.title || '',
    bookSeries: book.bookSeries || '',
    dynasty: book.dynasty || '',
    author: book.author || '',
    description: book.description || '',
  };
}

function cleanBookPayload(form) {
  return {
    id: form.id.trim(),
    title: form.title.trim(),
    bookSeries: form.bookSeries.trim() || null,
    dynasty: form.dynasty.trim() || null,
    author: form.author.trim() || null,
    description: form.description.trim() || null,
  };
}

function cleanChapterPayload(form) {
  return {
    id: form.id.trim(),
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    year: form.year === '' ? null : Number(form.year),
    period: form.period.trim() || null,
    original: form.original.trim(),
    translation: form.translation.trim() || null,
  };
}
