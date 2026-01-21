# 🐢 Turtle Soup (海龟汤)

**Turtle Soup** 是一个基于 AI (Gemini/OpenAI) 驱动的多人在线海龟汤（情境猜谜）游戏平台。玩家需要通过提问 "是/否" 的问题来以此揭开悬疑故事背后的真相。

| Dark Mode | Light Mode |
| :---: | :---: |
| ![Dark Mode](./assets/drak.png) | ![Light Mode](./assets/light.png) |

![Conclusion](./assets/conclude.png)

## ✨ 特性 (Features)

*   **AI Game Master**: 由大语言模型 (LLM) 扮演主持人，实时回答玩家的提问。
*   **多人实时协作**: 支持多名玩家在一个房间内共同解谜，聊天和线索实时同步 (基于 Firebase)。
*   **动态谜题生成**: 内置谜题生成器，可根据关键词（如：恐怖、悬疑、搞笑）无限生成新的谜题。
*   **智能裁判系统**:
    *   **自动判定**: AI 自动判断玩家问题是 "是"、"否"、"无关" 或 "部分正确"。
    *   **防剧透机制**: 严格的 Prompt Engineering 防止 AI 直接泄露真相。
    *   **完整度追踪**: 实时计算玩家对真相的完整度 (0-100%)。
*   **沉浸式 UI**:
    *   **黑客/赛博风格**: Terminal 风格的界面设计。
    *   **日夜间模式**: 支持明/暗主题切换。
    *   **Mesugaki Persona**: 可选的 "雌小鬼" 性格模式（彩蛋）。
*   **并发保护**: 完善的锁机制，防止多人同时生成谜题或重置游戏。

## 🛠️ 技术栈 (Tech Stack)

*   **前端**: [React](https://react.dev/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/)
*   **后端/服务**: [Firebase](https://firebase.google.com/) (Firestore, Auth)
*   **AI**: OpenAI Compatible API (e.g., Google Gemini, DeepSeek)

## 🚀 快速开始 (Getting Started)

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/turtle-soup.git
cd turtle-soup
```

### 2. 安装依赖

```bash
npm install
# or
yarn install
```

### 3. 配置环境

复制示例环境文件：

```bash
cp .env.example .env
```

**你需要填入以下配置：**

*   `VITE_GEMINI_API_KEY`: 你的 LLM API Key。
*   `VITE_GEMINI_API_URL`: API 端点 (例如 `https://api.openai.com/v1/chat/completions` 或任何兼容服务)。
*   `VITE_ACCESS_PASSWORD`: (可选) 房间访问密码。
*   `VITE_FIREBASE_*`: 你的 Firebase 项目配置 (Key, Domain, ProjectID 等)。

> **注意**: 这是一个纯前端项目 (Serverless)，你需要自行创建一个 Firebase 项目并启用 **Firestore Database** 和 **Anonymous Auth**。

### 4. 运行开发服务器

```bash
npm run dev
```

打开浏览器访问 `http://localhost:5173`。

## 📦 部署 (Deployment)

本项目可以轻松部署到 Vercel, Netlify 或 Firebase Hosting。

```bash
npm run build
```

构建产物位于 `dist/` 目录。

## 📄 许可证 (License)

[MIT](./LICENSE)

---

**Have fun solving mysteries! 🕵️‍♂️**
