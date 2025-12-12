# 🦁 Omni-Agent Arena | 全链 AI 竞技场

> **Web3 x AI**: Where Autonomous Agents Battle On-Chain.
> Powered by **ZetaChain** & **Alibaba Cloud Qwen**.

## 📖 项目简介 (Introduction)

**Omni-Agent Arena** 是一个去中心化的 AI 对战游戏 Demo。在这个游戏中，玩家不再亲自操作每一个动作，而是授权给一个 **AI Agent**。该 Agent 会读取战场数据，利用 **LLM (通义千问)** 进行策略推理，并通过 **ZetaChain** 的跨链能力在 Base 和 Ethereum 测试网之间发送交易指令，完成攻击、防御或释放技能的操作。

本项目旨在展示 **"通用 AI 应用 (Universal AI Applications)"** 的潜力：即 AI 不仅能生成文本，还能作为链上实体，持有资产并执行跨链交互。

## 🌟 核心特性 (Features)

- **🤖 LLM 驱动决策**: 后端集成 `qwen-plus` 模型，AI 根据 HP 和对手状态智能选择行动。
- **⛓️ 真实链上交互**: 战斗指令通过底层脚本 (`messaging`) 直接与 ZetaChain/Base Sepolia 合约交互。
- **🎮 街机风格 UI**: 
  - 动态 Sprite 动画（冲刺、震动、闪白）。
  - RPG 式伤害飘字与暴击特效。
  - 实时血条与状态气泡。
- **⚡️ 稳健的同步系统**:
  - **动画队列 (Animation Queue)**: 防止网络波动导致的动画重叠。
  - **断线重连**: 刷新页面自动恢复房间状态。
  - **观战模式**: 允许第三方玩家进入房间实时观看战斗。
- **🛡️ 钱包集成**: 支持 Metamask/OKX Wallet，实现了 EIP-2255 标准的账号切换与断开逻辑。

## 🛠️ 技术栈 (Tech Stack)

- **Frontend**: HTML5, CSS3 (Cyberpunk Style), Vanilla JavaScript (No frameworks, pure performance).
- **Backend**: Node.js, Express.
- **AI Model**: Alibaba Cloud DashScope (Qwen-plus).
- **Blockchain**: ZetaChain Athens-3, Base Sepolia, Ethereum Sepolia.
- **Tools**: Ethers.js v5, Hardhat (for contract interactions).

## 🚀 快速开始 (Quick Start)

### 1. 本地运行 (Local Development)

确保安装了 [Node.js](https://nodejs.org/) (v18+) 和 [Git](https://git-scm.com/)。

Bash

```
# 1. 克隆项目
git clone https://github.com/your-username/omni-agent-arena.git
cd omni-agent-arena

# 2. 安装根目录依赖
npm install

# 3. 安装链上脚本依赖 (重要！)
cd messaging
npm install
cd ..
```

### 2. 配置环境变量

在根目录创建 `.env` 文件：

代码段

```
# 阿里云通义千问 API Key
DASHSCOPE_API_KEY=sk-your_aliyun_key

# AI Agent 钱包私钥 (用于自动发交易，请务必使用测试网小号！)
# 注意：不需要带 0x 前缀
PRIVATE_KEY=your_testnet_private_key
```

### 3. 启动

Bash

```
node server.js
```

访问 `http://localhost:3000` 即可体验。