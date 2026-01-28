# Yuxi-Know OpenAI 兼容 API 集成设计

**日期**: 2026-01-28
**状态**: 待实施

---

## 1. 概述

### 1.1 目标

在客服平台和 Yuxi-Know 之间建立 OpenAI 兼容的 API 通道，实现：

1. **客服平台**：支持切换 AI 后端（FastGPT / Yuxi-Know）
2. **Yuxi-Know**：提供 OpenAI 兼容的公开 API 端点 + API Key 管理

### 1.2 设计原则

- **渐进式开发**：先实现核心功能，权限管理后续迭代
- **最小改动**：FastGPT 现有逻辑保持不变
- **标准兼容**：遵循 OpenAI API 格式规范

---

## 2. 客服平台改造

### 2.1 配置数据结构

扩展 `config/ai-settings.json`：

```jsonc
{
  "enabled": true,
  "provider": "yuxi-know",  // "fastgpt" | "yuxi-know"

  // FastGPT 配置（现有）
  "fastgptUrl": "https://fastgpt.example.com",
  "fastgptAppId": "app-xxx",
  "fastgptApiKey": "fastgpt-xxx",

  // Yuxi-Know 配置（新增）
  "yuxiUrl": "https://yuxi.example.com",
  "yuxiApiKey": "sk-yuxi-xxx",
  "yuxiAgentId": "chatbot",

  // 通用配置
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "systemPrompt": "You are a helpful assistant."
}
```

### 2.2 TypeScript 类型定义

```typescript
// src/lib/utils/ai-config.ts

export type AIProvider = 'fastgpt' | 'yuxi-know'

export interface AISettings {
  enabled: boolean
  provider: AIProvider

  // FastGPT
  fastgptUrl: string
  fastgptAppId: string
  fastgptApiKey: string

  // Yuxi-Know
  yuxiUrl: string
  yuxiApiKey: string
  yuxiAgentId: string

  // Common
  model: string
  temperature: number
  systemPrompt: string
}
```

### 2.3 前端设置页面

**文件**: `src/app/admin/settings/page.tsx`

**UI 结构**:

```
┌─────────────────────────────────────────────────────────────┐
│  AI 智能回复设置                                             │
├─────────────────────────────────────────────────────────────┤
│  [✓] 启用 AI 智能回复                                        │
│                                                             │
│  AI 后端:  (•) FastGPT    ( ) Yuxi-Know                     │
│                                                             │
│  ┌─ FastGPT 配置 ──────────────────────────────────────┐   │
│  │  URL:      [https://fastgpt.example.com          ]  │   │
│  │  App ID:   [app-xxx                              ]  │   │
│  │  API Key:  [••••••••••••                         ]  │   │
│  │  [测试连接]                                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  -- 或切换到 Yuxi-Know 后显示 --                             │
│                                                             │
│  ┌─ Yuxi-Know 配置 ────────────────────────────────────┐   │
│  │  Base URL: [https://yuxi.example.com             ]  │   │
│  │  API Key:  [sk-yuxi-xxx                          ]  │   │
│  │  智能体:   [▼ chatbot - 智能聊天助手             ]  │   │
│  │            [刷新列表]                               │   │
│  │  [测试连接]                                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  [保存设置]                                                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 后端 API 改造

#### 2.4.1 设置 API

**文件**: `src/app/api/admin/settings/ai/route.ts`

扩展 Schema：

```typescript
const AISettingsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['fastgpt', 'yuxi-know']),

  // FastGPT
  fastgpt_url: z.string().optional(),
  fastgpt_appid: z.string().optional(),
  fastgpt_api_key: z.string().optional(),

  // Yuxi-Know
  yuxi_url: z.string().optional(),
  yuxi_api_key: z.string().optional(),
  yuxi_agent_id: z.string().optional(),

  // Common
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  system_prompt: z.string().optional(),
})
```

#### 2.4.2 聊天 API

**文件**: `src/app/api/ai/chat/route.ts`

根据 provider 路由到不同处理逻辑：

```typescript
export async function POST(request: NextRequest) {
  const settings = readAISettings()

  if (settings.provider === 'yuxi-know') {
    return handleYuxiKnowChat(request, settings)
  } else {
    return handleFastGPTChat(request, settings)  // 现有逻辑
  }
}

async function handleYuxiKnowChat(request: NextRequest, settings: AISettings) {
  const { message, history } = await request.json()

  const response = await fetch(`${settings.yuxiUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.yuxiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.yuxiAgentId,  // agent_id 作为 model
      messages: [
        ...history,
        { role: 'user', content: message }
      ],
      stream: false,
    }),
  })

  const data = await response.json()
  return NextResponse.json({
    success: true,
    data: { message: data.choices[0].message.content }
  })
}
```

#### 2.4.3 获取智能体列表 API

**新增文件**: `src/app/api/admin/settings/ai/agents/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const { url, apiKey } = await request.json()

  const response = await fetch(`${url}/v1/agents`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  })

  if (!response.ok) {
    return NextResponse.json({ success: false, error: 'Failed to fetch agents' })
  }

  const data = await response.json()
  return NextResponse.json({ success: true, agents: data.agents })
}
```

---

## 3. Yuxi-Know 改造

### 3.1 数据模型

**新增文件**: `src/storage/postgres/models_api_key.py`

```python
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from src.storage.postgres.models_business import Base
from src.utils.datetime_utils import utc_now_naive

class ApiKey(Base):
    """外部 API 密钥模型"""

    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now_naive)
    last_used_at = Column(DateTime, nullable=True)

    # 预留字段（阶段二）
    # department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    # created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "key": self.key,
            "name": self.name,
            "is_enabled": self.is_enabled,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
        }

    def to_safe_dict(self):
        """返回脱敏的 key（仅显示前8位和后4位）"""
        masked_key = f"{self.key[:8]}***{self.key[-4:]}" if len(self.key) > 12 else "***"
        return {
            **self.to_dict(),
            "key": masked_key,
        }
```

### 3.2 API Key 管理路由

**新增文件**: `server/routers/api_key_router.py`

```python
"""API Key 管理路由"""

import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.storage.postgres.models_business import User
from src.storage.postgres.models_api_key import ApiKey
from server.utils.auth_middleware import get_superadmin_user, get_db

api_key_router = APIRouter(prefix="/system/api-keys", tags=["api-keys"])


class ApiKeyCreate(BaseModel):
    name: str
    key: str | None = None  # 可选，不提供则自动生成


class ApiKeyUpdate(BaseModel):
    name: str | None = None
    is_enabled: bool | None = None


def generate_api_key() -> str:
    """生成 API Key: sk-yuxi-{32位随机字符}"""
    return f"sk-yuxi-{secrets.token_hex(16)}"


@api_key_router.get("")
async def list_api_keys(
    current_user: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db)
):
    """获取所有 API Key 列表（脱敏）"""
    result = await db.execute(select(ApiKey).order_by(ApiKey.created_at.desc()))
    keys = result.scalars().all()
    return {"keys": [k.to_safe_dict() for k in keys]}


@api_key_router.post("", status_code=status.HTTP_201_CREATED)
async def create_api_key(
    data: ApiKeyCreate,
    current_user: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db)
):
    """创建 API Key"""
    key_value = data.key if data.key else generate_api_key()

    # 检查是否重复
    existing = await db.execute(select(ApiKey).where(ApiKey.key == key_value))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="API Key 已存在")

    api_key = ApiKey(key=key_value, name=data.name)
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    # 创建时返回完整 key（仅此一次）
    return {"key": api_key.to_dict(), "message": "请保存此密钥，它不会再次显示完整内容"}


@api_key_router.put("/{key_id}")
async def update_api_key(
    key_id: int,
    data: ApiKeyUpdate,
    current_user: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db)
):
    """更新 API Key"""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(status_code=404, detail="API Key 不存在")

    if data.name is not None:
        api_key.name = data.name
    if data.is_enabled is not None:
        api_key.is_enabled = data.is_enabled

    await db.commit()
    return {"key": api_key.to_safe_dict()}


@api_key_router.delete("/{key_id}")
async def delete_api_key(
    key_id: int,
    current_user: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db)
):
    """删除 API Key"""
    result = await db.execute(select(ApiKey).where(ApiKey.id == key_id))
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(status_code=404, detail="API Key 不存在")

    await db.delete(api_key)
    await db.commit()
    return {"message": "已删除"}
```

### 3.3 OpenAI 兼容 API 路由

**新增文件**: `server/routers/openai_compat_router.py`

```python
"""OpenAI 兼容 API 路由"""

import time
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, status, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.storage.postgres.models_api_key import ApiKey
from src.agents import agent_manager
from src.models.chat import select_model
from src.utils.logging_config import logger
from server.utils.auth_middleware import get_db

openai_compat = APIRouter(prefix="/v1", tags=["openai-compatible"])


# ============= 请求/响应模型 =============

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str = Field(..., description="模型名称或智能体ID")
    messages: list[ChatMessage]
    stream: bool = False
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None


class ChatCompletionChoice(BaseModel):
    index: int = 0
    message: ChatMessage
    finish_reason: str = "stop"


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[ChatCompletionChoice]


class AgentInfo(BaseModel):
    id: str
    name: str
    description: str


# ============= API Key 验证 =============

async def verify_api_key(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db)
) -> ApiKey:
    """验证 API Key 并返回对应记录"""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header"
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization format. Use: Bearer <api_key>"
        )

    key_value = authorization.split("Bearer ")[1].strip()

    result = await db.execute(
        select(ApiKey).where(ApiKey.key == key_value, ApiKey.is_enabled == True)
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or disabled API key"
        )

    # 更新最后使用时间
    from src.utils.datetime_utils import utc_now_naive
    api_key.last_used_at = utc_now_naive()
    await db.commit()

    return api_key


# ============= 端点 =============

@openai_compat.get("/agents")
async def list_agents(api_key: ApiKey = Depends(verify_api_key)):
    """获取可用智能体列表"""
    agents_info = await agent_manager.get_agents_info()

    agents = [
        AgentInfo(
            id=info["id"],
            name=info.get("name", "Unknown"),
            description=info.get("description", "")
        )
        for info in agents_info
    ]

    return {"agents": agents}


@openai_compat.post("/chat/completions", response_model=ChatCompletionResponse)
async def chat_completions(
    request: ChatCompletionRequest,
    api_key: ApiKey = Depends(verify_api_key),
    db: AsyncSession = Depends(get_db)
):
    """OpenAI 兼容的聊天补全端点"""
    try:
        model_or_agent = request.model
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        # 检查是否为智能体
        if agent_manager.get_agent(model_or_agent):
            # 使用智能体处理
            agent = agent_manager.get_agent(model_or_agent)

            # 提取最后一条用户消息作为 query
            user_messages = [m for m in messages if m["role"] == "user"]
            if not user_messages:
                raise HTTPException(status_code=400, detail="No user message found")

            query = user_messages[-1]["content"]

            # 调用智能体（非流式）
            response_content = ""
            async for chunk in agent.run(query=query, config={}, meta={}):
                if hasattr(chunk, 'content') and chunk.content:
                    response_content += chunk.content

        else:
            # 使用普通模型
            model = select_model(model_name=model_or_agent)
            response = await model.call(messages, stream=False)
            response_content = response.content

        return ChatCompletionResponse(
            id=f"chatcmpl-{uuid.uuid4().hex[:8]}",
            created=int(time.time()),
            model=model_or_agent,
            choices=[
                ChatCompletionChoice(
                    message=ChatMessage(role="assistant", content=response_content)
                )
            ]
        )

    except Exception as e:
        logger.error(f"Chat completion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

### 3.4 路由注册

**修改文件**: `server/routers/__init__.py`

```python
from fastapi import APIRouter

from server.routers.auth_router import auth
from server.routers.chat_router import chat
from server.routers.api_key_router import api_key_router      # 新增
from server.routers.openai_compat_router import openai_compat  # 新增
# ... 其他 imports

router = APIRouter()

# 注册路由
router.include_router(openai_compat)    # /api/v1/*
router.include_router(api_key_router)   # /api/system/api-keys/*
router.include_router(system)
router.include_router(auth)
router.include_router(chat)
# ... 其他路由
```

### 3.5 公开路径配置

**修改文件**: `server/utils/auth_middleware.py`

```python
PUBLIC_PATHS = [
    r"^/api/auth/token$",
    r"^/api/auth/check-first-run$",
    r"^/api/auth/initialize$",
    r"^/api$",
    r"^/api/system/health$",
    r"^/api/system/info$",
    r"^/api/v1/.*$",  # 新增: OpenAI 兼容端点（使用 API Key 认证）
]
```

### 3.6 前端 API Key 管理页面

**新增文件**: `web/src/views/settings/ApiKeyManagement.vue`

基本功能：
- 列表展示所有 API Key（脱敏显示）
- 创建新 Key（支持手动输入或自动生成）
- 编辑 Key 名称
- 启用/禁用 Key
- 删除 Key

---

## 4. 实施任务清单

### 4.1 Yuxi-Know 后端

- [ ] 创建 `ApiKey` 数据模型并迁移数据库
- [ ] 实现 API Key 管理路由 (`/api/system/api-keys/*`)
- [ ] 实现 OpenAI 兼容路由 (`/api/v1/agents`, `/api/v1/chat/completions`)
- [ ] 配置公开路径白名单
- [ ] 注册新路由

### 4.2 Yuxi-Know 前端

- [ ] 创建 API Key 管理页面组件
- [ ] 添加路由入口（系统设置菜单下）
- [ ] 实现列表、创建、编辑、删除功能

### 4.3 客服平台后端

- [ ] 扩展 `AISettings` 类型定义
- [ ] 修改设置读写逻辑支持新字段
- [ ] 实现 Yuxi-Know 聊天处理函数
- [ ] 新增智能体列表代理 API

### 4.4 客服平台前端

- [ ] 修改设置页面添加 Provider 切换
- [ ] 实现 Yuxi-Know 配置表单
- [ ] 实现智能体下拉列表（手动刷新）
- [ ] 添加连接测试功能
- [ ] 国际化翻译

---

## 5. 测试验证

### 5.1 Yuxi-Know API 测试

```bash
# 1. 创建 API Key（通过后台页面）

# 2. 获取智能体列表
curl -X GET https://yuxi.example.com/api/v1/agents \
  -H "Authorization: Bearer sk-yuxi-xxx"

# 3. 聊天测试
curl -X POST https://yuxi.example.com/api/v1/chat/completions \
  -H "Authorization: Bearer sk-yuxi-xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "chatbot",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### 5.2 客服平台集成测试

1. 进入管理后台 → 设置 → AI 智能回复
2. 选择 Yuxi-Know 作为 AI 后端
3. 填写 Base URL 和 API Key
4. 点击「刷新列表」获取智能体
5. 选择智能体后点击「测试连接」
6. 保存设置
7. 客户端发起对话验证

---

## 6. 后续迭代（阶段二）

- API Key 关联部门权限
- 按部门筛选可用智能体
- API Key 使用统计和配额
- 流式响应支持
