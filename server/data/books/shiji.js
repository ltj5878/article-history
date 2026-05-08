// 《史记》文章聚合数据。
// Source modules still hold the existing annotated episode data; this file
// groups those episodes into article-length reading units.

import { chapters as xiangyuChapters } from './xiangyu-benji.js';
import { chapters as gaozuChapters } from './gaozu-benji.js';
import { chapters as qinChapters } from './qin-shihuang-benji.js';
import { chapters as liezhuanChapters } from './shiji-liezhuan.js';

export const book = {
  id: 'shiji',
  title: '史记',
  bookSeries: '纪传体通史',
  dynasty: '西汉',
  author: '司马迁',
  description: '《史记》选读：本纪、世家、列传文章式阅读，保留小节与地图联动。',
};

function sectionFromChapter(chapter) {
  return {
    id: chapter.id,
    title: chapter.title,
    subtitle: chapter.subtitle,
    year: chapter.year,
    period: chapter.period,
    paragraphs: (chapter.paragraphs || []).map(p => ({
      ...p,
      id: `${chapter.id}-${p.id}`,
    })),
  };
}

function articleFromChapters({ id, title, subtitle, description, chapters }) {
  return {
    id,
    title,
    subtitle,
    description,
    sections: chapters.map(sectionFromChapter),
  };
}

const goujianChapters = liezhuanChapters.filter(c => c.id === 'goujian1' || c.id === 'goujian2');
const lianpoChapter = liezhuanChapters.find(c => c.id === 'lianpo');
const jingkeChapter = liezhuanChapters.find(c => c.id === 'jingke');

export const articles = [
  articleFromChapters({
    id: 'xiangyu-benji',
    title: '项羽本纪',
    subtitle: '卷七',
    description: '记项羽起于会稽、破秦入关、楚汉相争，至垓下乌江。',
    chapters: xiangyuChapters,
  }),
  articleFromChapters({
    id: 'gaozu-benji',
    title: '高祖本纪',
    subtitle: '卷八',
    description: '记刘邦从沛县起兵、入关灭秦、楚汉相争，至即皇帝位。',
    chapters: gaozuChapters,
  }),
  articleFromChapters({
    id: 'qin-shihuang-benji',
    title: '秦始皇本纪',
    subtitle: '卷六',
    description: '记秦王政兼并六国、称皇帝、巡狩天下，至沙丘崩逝。',
    chapters: qinChapters,
  }),
  articleFromChapters({
    id: 'goujian-shijia',
    title: '越王勾践世家',
    subtitle: '世家',
    description: '记越王勾践会稽受困、卧薪尝胆，终灭吴称霸。',
    chapters: goujianChapters,
  }),
  articleFromChapters({
    id: 'lianpo-linxiangru-liezhuan',
    title: '廉颇蔺相如列传',
    subtitle: '列传',
    description: '记完璧归赵、渑池之会与将相和。',
    chapters: [lianpoChapter],
  }),
  articleFromChapters({
    id: 'jingke',
    title: '刺客列传·荆轲',
    subtitle: '列传',
    description: '记燕太子丹使荆轲入秦刺秦王。',
    chapters: [jingkeChapter],
  }),
];

function buildEraEvents(items) {
  const byTimeAndLabel = new Map();

  for (const article of items) {
    for (const section of article.sections) {
      const target = {
        article: article.id,
        section: section.id,
        articleTitle: article.title,
      };
      const key = `${section.year}:${section.title}`;
      const existing = byTimeAndLabel.get(key);
      if (existing) {
        existing.targets.push(target);
        continue;
      }
      byTimeAndLabel.set(key, {
        year: section.year,
        label: section.title,
        article: article.id,
        section: section.id,
        targets: [target],
      });
    }
  }

  return [...byTimeAndLabel.values()];
}

export const eraEvents = buildEraEvents(articles);

export const sectionEvents = articles.flatMap(article =>
  article.sections.map(section => ({
    year: section.year,
    label: section.title,
    article: article.id,
    section: section.id,
  }))
);
