# XChai 配置教程


## 🌟 XChai 配置总介绍


### 📋 支持的模型


### 🛠️ 支持的工具

- 命令行工具：Claude Code, Aider
- VS Code 插件：Continue, Cline, Cody, Copilot, Tabnine, Supermaven
- 独立编辑器：Cursor, Windsurf
- AI 框架：OpenClaw


### 🔑 配置要点


### 📚 快速开始

- 获取 API Key（联系管理员）
- 选择你使用的工具（点击上方Tab）
- 按照教程配置 Base URL 和 API Key
- 开始使用！


### 💡 配置多个模型

大多数工具支持同时配置多个模型，方便切换使用：


#### 方法 1：配置文件中添加多个模型

```
{
  "models": [
    {
      "name": "Claude Opus 4.6",
      "provider": "anthropic",
      "model": "claude-opus-4-6",
      "apiKey": "你的API Key",
      "apiBase": "https://xchai.xyz"
    },
    {
      "name": "Claude Sonnet 4.6",
      "provider": "anthropic",
      "model": "claude-sonnet-4-6",
      "apiKey": "你的API Key",
      "apiBase": "https://xchai.xyz"
    },
    {
      "name": "GPT-5.4",
      "provider": "openai",
      "model": "gpt-5.4",
      "apiKey": "你的API Key",
      "apiBase": "https://xchai.xyz/v1"
    },
    {
      "name": "GPT-5.3 Codex",
      "provider": "openai",
      "model": "gpt-5.3-codex",
      "apiKey": "你的API Key",
      "apiBase": "https://xchai.xyz/v1"
    }
  ]
}
```


#### 方法 2：环境变量配置多个Key

```
# Claude 模型
export ANTHROPIC_API_KEY="你的API Key"
export ANTHROPIC_API_BASE="https://xchai.xyz"

# OpenAI 模型
export OPENAI_API_KEY="你的API Key"
export OPENAI_API_BASE="https://xchai.xyz/v1"
```


#### 方法 3：工具内切换

配置好多个模型后，在工具界面中可以快速切换：

- VS Code 插件：通常在状态栏或命令面板选择模型
- Cursor/Windsurf：设置中可以添加多个模型，使用时切换
- 命令行工具：使用 --model 参数指定


### 💰 价格参考

详见"模型列表"Tab，包含每个模型的输入/输出价格


### ❓ 遇到问题？

查看"FAQ"Tab，或联系技术支持


## 💻 VS Code 通用配置


### 推荐插件组合


### 统一配置方法

在 VS Code 的 settings.json 中配置（按 Ctrl+Shift+P 搜索 "settings.json"）：


#### 配置 Continue

```
{
  "continue.models": [
    {
      "title": "Claude Opus 4.6",
      "provider": "anthropic",
      "model": "claude-opus-4-6",
      "apiKey": "你的API Key",
      "apiBase": "https://xchai.xyz"
    },
    {
      "title": "GPT-5.4",
      "provider": "openai",
      "model": "gpt-5.4",
      "apiKey": "你的API Key",
      "apiBase": "https://xchai.xyz/v1"
    }
  ]
}
```


#### 配置 Cline

```
{
  "cline.anthropicApiKey": "你的API Key",
  "cline.anthropicBaseUrl": "https://xchai.xyz",
  "cline.anthropicModel": "claude-opus-4-6"
}
```


#### 配置 Cody

```
{
  "cody.customModels": [
    {
      "name": "Claude Opus",
      "provider": "anthropic",
      "model": "claude-opus-4-6",
      "apiKey": "你的API Key",
      "endpoint": "https://xchai.xyz"
    }
  ]
}
```


### 多插件同时使用

可以同时安装多个插件，各司其职：

- Continue：日常对话和代码生成
- Cline：复杂任务的自主编程
- Tabnine/Supermaven：实时代码补全


### 快捷键参考


### 性能优化建议

- 实时补全插件（Tabnine/Supermaven）使用轻量模型（gpt-5.3-codex）
- 对话式插件（Continue/Cline）使用强力模型（claude-opus-4-6）
- 避免同时开启多个实时补全插件，可能冲突


## 📦 Claude Code 配置


### 步骤 1：配置 npm 镜像（国内必做）

```
# 使用淘宝镜像
npm config set registry https://registry.npmmirror.com

# 验证配置
npm config get registry
```


### 步骤 2：安装 Claude Code

```
# 全局安装
npm install -g @anthropic-ai/claude-code

# 验证安装
claude-code --version
```


### 步骤 3：配置环境变量


#### Linux / macOS

```
# 编辑配置文件
nano ~/.bashrc  # 或 ~/.zshrc

# 添加以下内容
export ANTHROPIC_API_URL="https://xchai.xyz"
export ANTHROPIC_API_KEY="你的API Key"
export ANTHROPIC_MODEL="claude-opus-4-6"

# 重新加载
source ~/.bashrc
```


#### Windows PowerShell

```
# 永久设置
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_URL", "https://xchai.xyz", "User")
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "你的API Key", "User")
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_MODEL", "claude-opus-4-6", "User")
```


### 步骤 4：测试配置

```
# 基本测试
claude-code "你好"

# 交互模式
claude-code --interactive
```


## 🤖 OpenAI 兼容配置


### 环境变量配置

```
# 注意：OpenAI API 需要加 /v1
export OPENAI_API_BASE="https://xchai.xyz/v1"
export OPENAI_API_KEY="你的API Key"
```


### Python 示例

```
from openai import OpenAI

client = OpenAI(
    base_url="https://xchai.xyz/v1",
    api_key="你的API Key"
)

response = client.chat.completions.create(
    model="gpt-5.4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```


## 🦞 OpenClaw 配置

配置文件位置：

- Linux/macOS: ~/.openclaw/openclaw.json
- Windows: %USERPROFILE%\.openclaw\openclaw.json

```
{
  "models": {
    "mode": "merge",
    "providers": {
      "xchai": {
        "baseUrl": "https://xchai.xyz",
        "apiKey": "你的API Key",
        "api": "anthropic-messages",
        "models": [
          {"id": "claude-opus-4-6", "name": "Claude Opus 4.6"},
          {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6"},
          {"id": "gpt-5.4", "name": "GPT-5.4"}
        ]
      }
    }
  }
}
```


## 🔄 Continue 配置

配置文件： ~/.continue/config.json

```
{
  "models": [
    {
      "title": "XChai Claude Opus",
      "provider": "anthropic",
      "model": "claude-opus-4-6",
      "apiKey": "你的API Key",
      "apiBase": "https://xchai.xyz"
    },
    {
      "title": "XChai GPT-5.4",
      "provider": "openai",
      "model": "gpt-5.4",
      "apiKey": "你的API Key",
      "apiBase": "https://xchai.xyz/v1"
    }
  ]
}
```


## 🖱️ Cursor 配置

配置步骤：

- 打开 Settings → Models
- 点击 Add Custom Model
- 配置 Claude：
                    
                        Provider: Anthropic
                        Base URL: https://xchai.xyz
                        API Key: 你的 API Key
                        Model: claude-opus-4-6
                    
                
- Provider: Anthropic
- Base URL: https://xchai.xyz
- API Key: 你的 API Key
- Model: claude-opus-4-6
- 配置 OpenAI：
                    
                        Provider: OpenAI
                        Base URL: https://xchai.xyz/v1
                        API Key: 你的 API Key
                        Model: gpt-5.4
                    
                
- Provider: OpenAI
- Base URL: https://xchai.xyz/v1
- API Key: 你的 API Key
- Model: gpt-5.4


## 🤖 Cline (原 Claude Dev) 配置

VS Code 插件配置：

- 在 VS Code 中安装 Cline 插件
- 打开 Cline 设置
- 选择 API Provider: Anthropic
- 配置：
                    
                        API Key: 你的 API Key
                        Base URL: https://xchai.xyz
                        Model: claude-opus-4-6
                    
                
- API Key: 你的 API Key
- Base URL: https://xchai.xyz
- Model: claude-opus-4-6


## 🏄 Windsurf 配置

配置步骤：

- 打开 Windsurf 设置
- 进入 AI Models 配置
- 添加自定义模型：
                    
                        Provider: Anthropic
                        API Endpoint: https://xchai.xyz
                        API Key: 你的 API Key
                        Model: claude-opus-4-6
                    
                
- Provider: Anthropic
- API Endpoint: https://xchai.xyz
- API Key: 你的 API Key
- Model: claude-opus-4-6


## 🤖 Aider 配置

Aider 是命令行 AI 编程助手


### 安装 Aider

```
# 使用 pip 安装
pip install aider-chat

# 或使用 pipx
pipx install aider-chat
```


### 配置 Claude

```
# 设置环境变量
export ANTHROPIC_API_KEY="你的API Key"
export ANTHROPIC_API_BASE="https://xchai.xyz"

# 使用 Claude
aider --model claude-opus-4-6
```


### 配置 OpenAI

```
# 设置环境变量
export OPENAI_API_KEY="你的API Key"
export OPENAI_API_BASE="https://xchai.xyz/v1"

# 使用 GPT
aider --model gpt-5.4
```


## 🚀 GitHub Copilot 配置


### VS Code 配置

在 VS Code 的 settings.json 中添加：

```
{
  "github.copilot.advanced": {
    "debug.overrideEngine": "gpt-5.4",
    "debug.overrideProxyUrl": "https://xchai.xyz/v1"
  }
}
```


## 🔮 Tabnine 配置

Tabnine 支持自定义模型端点


### 配置步骤

- 打开 Tabnine 设置
- 选择 "Custom Model"
- 配置：
                    
                        API Endpoint: https://xchai.xyz/v1
                        API Key: 你的 API Key
                        Model: gpt-5.3-codex
                    
                
- API Endpoint: https://xchai.xyz/v1
- API Key: 你的 API Key
- Model: gpt-5.3-codex


## 🦝 Cody (Sourcegraph) 配置

VS Code / JetBrains 插件配置


### 配置 Claude

```
{
  "cody.customModels": [
    {
      "name": "XChai Claude Opus",
      "provider": "anthropic",
      "model": "claude-opus-4-6",
      "apiKey": "你的API Key",
      "endpoint": "https://xchai.xyz"
    }
  ]
}
```


### 配置 OpenAI

```
{
  "cody.customModels": [
    {
      "name": "XChai GPT-5.4",
      "provider": "openai",
      "model": "gpt-5.4",
      "apiKey": "你的API Key",
      "endpoint": "https://xchai.xyz/v1"
    }
  ]
}
```


## ⚡ Supermaven 配置

超快速 AI 代码补全


### 配置步骤

- 安装 Supermaven 插件（VS Code / JetBrains）
- 打开设置 → Custom Model
- 配置：
                    
                        Provider: OpenAI Compatible
                        Base URL: https://xchai.xyz/v1
                        API Key: 你的 API Key
                        Model: gpt-5.3-codex
                    
                
- Provider: OpenAI Compatible
- Base URL: https://xchai.xyz/v1
- API Key: 你的 API Key
- Model: gpt-5.3-codex


## 📋 支持的模型


### Claude 系列


### OpenAI 系列


## 🔌 插件兼容性


## ❓ 常见问题


### Q1: Base URL 要不要加 /v1？

A:

- Claude API: https://xchai.xyz（不需要 /v1）
- OpenAI API: https://xchai.xyz/v1（需要 /v1）


### Q2: 推荐哪个模型？

A:

- 日常编程：claude-sonnet-4-6
- 复杂任务：claude-opus-4-6
- 快速响应：claude-haiku-4-5
- 代码生成：gpt-5.3-codex


### Q3: 国内用户如何安装？

A: 使用淘宝 npm 镜像：

```
npm config set registry https://registry.npmmirror.com
```


### Q4: 哪些插件支持 GPT 模型？

A: 除了 Claude Code（仅支持 Claude），其他所有插件都支持 GPT 模型。

