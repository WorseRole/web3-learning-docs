import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Web3 Engineering Notes",
  description: "Web3 / Blockchain / DeFi 工程知识库",
  base: '/web3-learning-docs/',
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: 'Web3', link: '/web3/web3' },
      { text: 'DeFi', link: '/defi/' },
      { text: 'CEX', link: '/cex/' },
      { text: 'Projects', link: '/projects/' },
    ],

    sidebar: {
      '/web3/': [
        {
          text: 'Web3 基础',
          items: [
            { text: 'Web3 知识地图', link: '/web3/web3' },
          ]
        }
      ],
      '/defi/': [
        {
          text: 'DeFi',
          items: [
            { text: '概览', link: '/defi/' },
          ]
        }
      ],
      '/cex/': [
        {
          text: 'CEX',
          items: [
            { text: '概览', link: '/cex/' },
          ]
        }
      ],
      '/projects/': [
        {
          text: 'Projects',
          items: [
            { text: '概览', link: '/projects/' },
          ]
        }
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/WorseRole/web3-learning-docs' }
    ],

    search: {
      provider: 'local'
    }
  }
})
