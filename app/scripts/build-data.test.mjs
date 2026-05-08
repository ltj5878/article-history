import test from 'node:test';
import assert from 'node:assert/strict';

import { buildStaticBookData } from './build-data.mjs';
import { eraEvents as shijiEvents } from '../../server/data/books/shiji.js';

test('builds article-based books without legacy chapter files', () => {
  const result = buildStaticBookData([
    {
      mod: {
        book: { id: 'zuozhuan', title: '左传', dynasty: '春秋' },
        eraEvents: [{ year: -684, label: '长勺之战', chapter: 'changshao' }],
        chapters: [
          { id: 'changshao', title: '长勺之战', subtitle: '曹刿论战', year: -684, paragraphs: [] },
        ],
      },
    },
    {
      mod: {
        book: { id: 'shiji', title: '史记', dynasty: '西汉' },
        eraEvents: [{ year: -207, label: '巨鹿之战', article: 'xiangyu-benji', section: 'julu' }],
        articles: [
          {
            id: 'xiangyu-benji',
            title: '项羽本纪',
            subtitle: '卷七',
            sections: [
              {
                id: 'julu',
                title: '巨鹿之战',
                subtitle: '破釜沉舟',
                year: -207,
                paragraphs: [{ id: 'julu-p1', original: '项羽已杀卿子冠军。' }],
              },
            ],
          },
        ],
      },
    },
  ]);

  assert.deepEqual(result.listing.map(b => b.id), ['zuozhuan', 'shiji']);
  assert.equal(result.bookMetas.get('shiji').articles[0].id, 'xiangyu-benji');
  assert.equal(result.bookMetas.get('shiji').articleCount, 1);
  assert.equal(result.articleDocs.get('shiji/xiangyu-benji').sections[0].id, 'julu');
  assert.equal(result.chapterDocs.has('shiji/julu'), false);
  assert.equal(result.bookMetas.get('zuozhuan').chapters[0].id, 'changshao');
});

test('shiji timeline merges duplicate event labels for the same year', () => {
  const seen = new Set();
  for (const event of shijiEvents) {
    const key = `${event.year}:${event.label}`;
    assert.equal(seen.has(key), false, `duplicate event: ${key}`);
    seen.add(key);
  }

  const pengcheng = shijiEvents.find(event => event.year === -205 && event.label === '彭城之败');
  assert.ok(pengcheng);
  assert.equal(pengcheng.targets.length, 2);
});
