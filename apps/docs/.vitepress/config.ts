import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'RBAC Console Foundation',
  description: '面向真实业务演进的认证、授权与多端接入基础工程文档。',
  lang: 'zh-CN',
  cleanUrls: true,
  lastUpdated: true,
  metaChunk: true,
  appearance: false,
  head: [
    ['meta', { name: 'theme-color', content: '#1d5a48' }],
    ['meta', { name: 'keywords', content: 'RBAC, OAuth2, OIDC, VitePress, Vue, Express, uni-app' }],
  ],
  themeConfig: {
    siteTitle: 'RBAC Console',
    logo: '/mark.svg',
    search: {
      provider: 'local',
    },
    nav: [
      { text: '首页', link: '/' },
      { text: '介绍', link: '/guide/introduction' },
      { text: '快速开始', link: '/guide/quick-start' },
      { text: '技术选型', link: '/architecture/tech-stack' },
      { text: '开发指南', link: '/guide/development' },
      { text: '赞助', link: '/support/sponsor' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '开始使用',
          items: [
            { text: '介绍', link: '/guide/introduction' },
            { text: '快速开始', link: '/guide/quick-start' },
            { text: '开发指南', link: '/guide/development' },
          ],
        },
      ],
      '/architecture/': [
        {
          text: '架构',
          items: [
            { text: '技术选型', link: '/architecture/tech-stack' },
          ],
        },
      ],
      '/support/': [
        {
          text: '支持项目',
          items: [
            { text: '赞助', link: '/support/sponsor' },
          ],
        },
      ],
    },
    outline: {
      level: [2, 3],
      label: '本页导航',
    },
    docFooter: {
      prev: '上一页',
      next: '下一页',
    },
    footer: {
      message: 'Grounded in the real monorepo, not a marketing mockup.',
      copyright: 'RBAC Console Foundation',
    },
  },
});
