import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'QC-RBAC',
  description: 'QC-RBAC 开发文档，聚焦后端、前端、共享抽象和扩展方式。',
  lang: 'zh-CN',
  cleanUrls: true,
  lastUpdated: true,
  metaChunk: true,
  appearance: false,
  head: [
    ['meta', { name: 'theme-color', content: '#0f766e' }],
    ['meta', { name: 'keywords', content: 'QC-RBAC, RBAC, OAuth2, OIDC, VitePress, Vue, Express, uni-app' }],
    ['link', { rel: 'icon', href: '/mark.svg' }],
  ],
  themeConfig: {
    siteTitle: 'QC-RBAC',
    logo: '/mark.svg',
    search: {
      provider: 'local',
    },
    nav: [
      { text: '首页', link: '/' },
      { text: '介绍', link: '/guide/introduction' },
      { text: '快速开始', link: '/guide/quick-start' },
      { text: '开发指南', link: '/guide/development' },
      { text: '测试', link: '/guide/testing' },
      { text: '技术选型', link: '/architecture/tech-stack' },
      { text: '赞助', link: '/support/sponsor' },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/pqcqaq/QC-RBAC' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '开始',
          items: [
            { text: '介绍', link: '/guide/introduction' },
            { text: '快速开始', link: '/guide/quick-start' },
            { text: '开发指南', link: '/guide/development' },
            { text: '测试用例', link: '/guide/testing' },
          ],
        },
        {
          text: '实现',
          items: [
            { text: '后端实现', link: '/guide/backend' },
            { text: 'Web 前端', link: '/guide/web-frontend' },
            { text: 'Uni 前端', link: '/guide/uni-frontend' },
            { text: '共享抽象', link: '/guide/shared' },
          ],
        },
        {
          text: '扩展',
          items: [
            { text: '扩展指南', link: '/guide/extension' },
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
          text: '支持',
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
  },
});
