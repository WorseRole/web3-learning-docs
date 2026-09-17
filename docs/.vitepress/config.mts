import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Web3 Engineering Notes",
  description: "Web3 / Blockchain / DeFi 工程知识库",
  base: '/web3-learning-docs/',
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: 'Web3', link: '/web3/恢复基础，建立知识地图' },
      { text: 'DeFi', link: '/defi/' },
      { text: 'CEX', link: '/cex/' },
      { text: 'Projects', link: '/projects/' },
      { text: 'Foundry', link: '/foundry/' },
    ],

    sidebar: {
      '/web3/': [
        {
          text: 'Web3 基础',
          items: [
            { text: '恢复基础，建立知识地图', link: '/web3/恢复基础，建立知识地图' },
            { text: '恢复基础，建立知识地图 02', link: '/web3/恢复基础，建立知识地图02' },
            { text: '恢复基础，建立知识地图 03', link: '/web3/恢复基础，建立知识地图03' },
            { text: '恢复基础，建立知识地图 04', link: '/web3/恢复基础，建立知识地图04' },
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
            { text: 'MetaNode 永续合约', link: '/projects/metanode-perpetual' },
            { text: 'KinzaFinance 借贷', link: '/projects/kinza-lending' },
          ]
        }
      ],
      '/foundry/': [
        {
          text: 'Foundry 实操',
          items: [
            { text: '概览', link: '/foundry/' },
            { text: '阶段 0 串讲', link: '/foundry/阶段0-串讲' },
            { text: '阶段 1 · Sepolia', link: '/foundry/阶段1-Sepolia' },
            { text: '阶段 1 串讲', link: '/foundry/阶段1-串讲' },
            { text: 'Sepolia 部署流程', link: '/foundry/Sepolia-部署流程' },
            { text: 'Forge/Cast 链上命令', link: '/foundry/forge-cast-链上命令' },
            { text: '阶段 2 · Day 11 Proxy', link: '/foundry/阶段2-Day11-Proxy原理' },
            { text: '阶段 2 · Day 12 V1/V2', link: '/foundry/阶段2-Day12-CounterV1V2' },
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
