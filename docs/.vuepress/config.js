const { resolve } = require('path')

module.exports = {
  title: 'Vue 设计之道',
  description: 'Vue Design',
  base: '/vue-design/',
  locales: {
    '/': {
      lang: 'zh-CN',
      title: 'Vue 设计之道',
      description: 'Vue Design'
    },
  },
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      {
        text: 'Languages',
        ariaLabel: 'Language Menu',
        items: [
          { text: 'Chinese', link: '/' }
        ]
      }
    ],
    locales: {
      '/': {
        label: '简体中文',
        editLinkText: '在 GitHub 上编辑此页',
        sidebar: [
          ['/zh/1-reactivity', '响应性'],
          ['/zh/2-render-function', '渲染函数'],
          ['/zh/3-mini-vue', '迷你 Vue 实现'],
          ['/zh/4-template-compile', '模板编译'],
          ['/zh/5-mini-vue', '迷你 Vue 改进'],
          ['/zh/6-component', '组件'],
          ['/zh/7-optimize', '优化']
        ]
      }
    },
    sidebar: 'auto',
    sidebarDepth: 2,
    displayAllHeaders: true,
    repo: 'yangzheli/vue-design',
    repoLabel: 'Github',
    editLinks: true,
    nextLinks: true,
    prevLinks: true
  },
  configureWebpack: {
    resolve: {
      alias: {
        '@alias': resolve(__dirname, './public'),
      }
    }
  }
}