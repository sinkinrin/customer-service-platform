# Yuxi-Know OpenAI 兼容 API 集成 - 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在客服平台和 Yuxi-Know 之间建立 OpenAI 兼容的 API 通道，支持 AI 后端切换和 API Key 管理

**Architecture:** 分两个项目并行开发：Yuxi-Know 提供 OpenAI 兼容端点 + API Key 管理；客服平台扩展设置页面支持 Provider 切换

**Tech Stack:**
- Yuxi-Know: FastAPI + SQLAlchemy + Vue.js 3 + Ant Design Vue
- 客服平台: Next.js 16 + React 19 + TypeScript + shadcn/ui

**项目路径:**
- 客服平台: `C:\Users\cassi\Desktop\ho\customer-service-platform`
- Yuxi-Know: `C:\Users\cassi\Desktop\ho\customer-service-platform\Yuxi-Know`

---

## Part 1: Yuxi-Know 后端改造

### Task 1: 创建 ApiKey 数据模型

**Files:**
- Create: `Yuxi-Know/src/storage/postgres/models_api_key.py`

**Step 1: 创建 ApiKey 模型文件**

```python
"""外部 API 密钥模型"""

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from src.storage.postgres.models_business import Base
from src.utils.datetime_utils import format_utc_datetime, utc_now_naive


class ApiKey(Base):
    """外部 API 密钥模型"""

    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now_naive)
    last_used_at = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "key": self.key,
            "name": self.name,
            "is_enabled": self.is_enabled,
            "created_at": format_utc_datetime(self.created_at) if self.created_at else None,
            "last_used_at": format_utc_datetime(self.last_used_at) if self.last_used_at else None,
        }

    def to_safe_dict(self):
        """返回脱敏的 key（仅显示前8位和后4位）"""
        masked_key = f"{self.key[:8]}***{self.key[-4:]}" if len(self.key) > 12 else "***"
        return {
            **self.to_dict(),
            "key": masked_key,
        }
```

**Step 2: 在 models_business.py 末尾导入以触发表创建**

修改 `Yuxi-Know/src/storage/postgres/models_business.py`，在文件末尾添加：

```python
# 导入 ApiKey 模型以确保表被创建
from src.storage.postgres.models_api_key import ApiKey  # noqa: F401
```

**Step 3: 验证**

重启 Yuxi-Know 后端容器，检查 api_keys 表是否创建：
```bash
docker compose restart api-dev
docker compose logs api-dev --tail 50
```

**Step 4: Commit**

```bash
cd Yuxi-Know
git add src/storage/postgres/models_api_key.py src/storage/postgres/models_business.py
git commit -m "feat: add ApiKey model for external API authentication"
```

---

### Task 2: 实现 API Key 管理路由

**Files:**
- Create: `Yuxi-Know/server/routers/api_key_router.py`
- Modify: `Yuxi-Know/server/routers/__init__.py`

**Step 1: 创建 API Key 路由文件**

```python
"""API Key 管理路由"""

import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.utils.auth_middleware import get_db, get_superadmin_user
from src.storage.postgres.models_api_key import ApiKey
from src.storage.postgres.models_business import User


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
    db: AsyncSession = Depends(get_db),
):
    """获取所有 API Key 列表（脱敏）"""
    result = await db.execute(select(ApiKey).order_by(ApiKey.created_at.desc()))
    keys = result.scalars().all()
    return {"keys": [k.to_safe_dict() for k in keys]}


@api_key_router.post("", status_code=status.HTTP_201_CREATED)
async def create_api_key(
    data: ApiKeyCreate,
    current_user: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
):
    """创建 API Key"""
    key_value = data.key.strip() if data.key else generate_api_key()

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
    db: AsyncSession = Depends(get_db),
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
    await db.refresh(api_key)
    return {"key": api_key.to_safe_dict()}


@api_key_router.delete("/{key_id}")
async def delete_api_key(
    key_id: int,
    current_user: User = Depends(get_superadmin_user),
    db: AsyncSession = Depends(get_db),
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

**Step 2: 注册路由**

修改 `Yuxi-Know/server/routers/__init__.py`：

```python
from fastapi import APIRouter

from server.routers.api_key_router import api_key_router  # 新增
from server.routers.auth_router import auth
from server.routers.chat_router import chat
from server.routers.dashboard_router import dashboard
from server.routers.department_router import department
from server.routers.evaluation_router import evaluation
from server.routers.graph_router import graph
from server.routers.knowledge_router import knowledge
from server.routers.mcp_router import mcp
from server.routers.mindmap_router import mindmap
from server.routers.system_router import system
from server.routers.task_router import tasks

router = APIRouter()

# 注册路由结构
router.include_router(api_key_router)  # /api/system/api-keys/* (新增)
router.include_router(system)  # /api/system/*
router.include_router(auth)  # /api/auth/*
router.include_router(chat)  # /api/chat/*
router.include_router(dashboard)  # /api/dashboard/*
router.include_router(department)  # /api/departments/*
router.include_router(knowledge)  # /api/knowledge/*
router.include_router(evaluation)  # /api/evaluation/*
router.include_router(mindmap)  # /api/mindmap/*
router.include_router(graph)  # /api/graph/*
router.include_router(tasks)  # /api/tasks/*
router.include_router(mcp)  # /api/system/mcp-servers/*
```

**Step 3: 验证**

```bash
# 登录获取 token，然后测试 API
curl -X GET http://localhost:5050/api/system/api-keys \
  -H "Authorization: Bearer <superadmin_token>"
```

**Step 4: Commit**

```bash
cd Yuxi-Know
git add server/routers/api_key_router.py server/routers/__init__.py
git commit -m "feat: add API Key management endpoints"
```

---

### Task 3: 实现 OpenAI 兼容 API 路由

**Files:**
- Create: `Yuxi-Know/server/routers/openai_compat_router.py`
- Modify: `Yuxi-Know/server/routers/__init__.py`
- Modify: `Yuxi-Know/server/utils/auth_middleware.py`

**Step 1: 创建 OpenAI 兼容路由**

```python
"""OpenAI 兼容 API 路由"""

import time
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.utils.auth_middleware import get_db
from src.agents import agent_manager
from src.storage.postgres.models_api_key import ApiKey
from src.utils.datetime_utils import utc_now_naive
from src.utils.logging_config import logger


openai_compat = APIRouter(prefix="/v1", tags=["openai-compatible"])


# ============= 请求/响应模型 =============


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str = Field(..., description="模型名称或智能体ID")
    messages: list[ChatMessage]
    stream: bool = False
    temperature: float | None = 0.7
    max_tokens: int | None = None


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
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> ApiKey:
    """验证 API Key 并返回对应记录"""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization format. Use: Bearer <api_key>",
        )

    key_value = authorization.split("Bearer ")[1].strip()

    result = await db.execute(select(ApiKey).where(ApiKey.key == key_value, ApiKey.is_enabled == True))  # noqa: E712
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or disabled API key",
        )

    # 更新最后使用时间
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
            description=info.get("description", ""),
        )
        for info in agents_info
    ]

    return {"agents": agents}


@openai_compat.post("/chat/completions", response_model=ChatCompletionResponse)
async def chat_completions(
    request: ChatCompletionRequest,
    api_key: ApiKey = Depends(verify_api_key),
):
    """OpenAI 兼容的聊天补全端点"""
    try:
        model_or_agent = request.model
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        # 检查是否为智能体
        agent = agent_manager.get_agent(model_or_agent)
        if agent:
            # 提取最后一条用户消息作为 query
            user_messages = [m for m in messages if m["role"] == "user"]
            if not user_messages:
                raise HTTPException(status_code=400, detail="No user message found")

            query = user_messages[-1]["content"]

            # 调用智能体（非流式）
            response_content = ""
            async for chunk in agent.run(query=query, config={}, meta={}):
                if hasattr(chunk, "content") and chunk.content:
                    response_content += chunk.content

        else:
            # 使用普通模型
            from src.models.chat import select_model

            model = select_model(model_name=model_or_agent)
            response = await model.call(messages, stream=False)
            response_content = response.content

        return ChatCompletionResponse(
            id=f"chatcmpl-{uuid.uuid4().hex[:8]}",
            created=int(time.time()),
            model=model_or_agent,
            choices=[ChatCompletionChoice(message=ChatMessage(role="assistant", content=response_content))],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat completion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

**Step 2: 注册 OpenAI 兼容路由**

修改 `Yuxi-Know/server/routers/__init__.py`，添加导入和注册：

```python
from server.routers.openai_compat_router import openai_compat  # 新增

# 在 router = APIRouter() 之后添加：
router.include_router(openai_compat)  # /api/v1/* (新增)
```

**Step 3: 配置公开路径**

修改 `Yuxi-Know/server/utils/auth_middleware.py`，在 `PUBLIC_PATHS` 列表中添加：

```python
PUBLIC_PATHS = [
    r"^/api/auth/token$",  # 登录
    r"^/api/auth/check-first-run$",  # 检查是否首次运行
    r"^/api/auth/initialize$",  # 初始化系统
    r"^/api$",  # Health Check
    r"^/api/system/health$",  # Health Check
    r"^/api/system/info$",  # 获取系统信息配置
    r"^/api/v1/.*$",  # OpenAI 兼容端点（使用 API Key 认证）
]
```

**Step 4: 验证**

```bash
# 先通过后台创建一个 API Key，然后测试：
curl -X GET http://localhost:5050/api/v1/agents \
  -H "Authorization: Bearer sk-yuxi-xxx"

curl -X POST http://localhost:5050/api/v1/chat/completions \
  -H "Authorization: Bearer sk-yuxi-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model": "chatbot", "messages": [{"role": "user", "content": "你好"}]}'
```

**Step 5: Commit**

```bash
cd Yuxi-Know
git add server/routers/openai_compat_router.py server/routers/__init__.py server/utils/auth_middleware.py
git commit -m "feat: add OpenAI-compatible API endpoints with API Key auth"
```

---

### Task 4: Yuxi-Know 前端 - API Key 管理页面

**Files:**
- Create: `Yuxi-Know/web/src/components/settings/ApiKeyManagement.vue`
- Create: `Yuxi-Know/web/src/apis/api_key_api.js`
- Modify: `Yuxi-Know/web/src/components/SettingsModal.vue`

**Step 1: 创建 API 封装**

创建 `Yuxi-Know/web/src/apis/api_key_api.js`：

```javascript
import { apiGet, apiPost, apiPut, apiDelete } from './base'

export const apiKeyApi = {
  // 获取所有 API Key
  list: () => apiGet('/api/system/api-keys'),

  // 创建 API Key
  create: (data) => apiPost('/api/system/api-keys', data),

  // 更新 API Key
  update: (id, data) => apiPut(`/api/system/api-keys/${id}`, data),

  // 删除 API Key
  delete: (id) => apiDelete(`/api/system/api-keys/${id}`)
}
```

**Step 2: 创建 API Key 管理组件**

创建 `Yuxi-Know/web/src/components/settings/ApiKeyManagement.vue`：

```vue
<template>
  <div class="api-key-management">
    <div class="section-header">
      <h3>外部 API 密钥</h3>
      <a-button type="primary" @click="showCreateModal">
        <template #icon><PlusOutlined /></template>
        创建密钥
      </a-button>
    </div>

    <a-table :columns="columns" :dataSource="apiKeys" :loading="loading" rowKey="id" :pagination="false">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'is_enabled'">
          <a-switch
            :checked="record.is_enabled"
            @change="(checked) => toggleEnabled(record.id, checked)"
          />
        </template>
        <template v-if="column.key === 'actions'">
          <a-space>
            <a-button size="small" @click="showEditModal(record)">编辑</a-button>
            <a-popconfirm title="确定删除此密钥?" @confirm="deleteKey(record.id)">
              <a-button size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 创建/编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEditing ? '编辑密钥' : '创建密钥'"
      @ok="handleSubmit"
      :confirmLoading="submitting"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item label="名称" required>
          <a-input v-model:value="form.name" placeholder="例如：客服平台-生产环境" />
        </a-form-item>
        <a-form-item v-if="!isEditing" label="密钥（留空自动生成）">
          <a-input v-model:value="form.key" placeholder="sk-yuxi-xxx 或留空自动生成" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 显示新创建的 Key -->
    <a-modal
      v-model:open="showKeyModal"
      title="密钥已创建"
      :footer="null"
      :closable="false"
    >
      <a-alert
        message="请立即复制此密钥，关闭后将无法再次查看完整内容"
        type="warning"
        showIcon
        style="margin-bottom: 16px"
      />
      <a-input-group compact>
        <a-input :value="newKeyValue" readonly style="width: calc(100% - 80px)" />
        <a-button type="primary" @click="copyKey">复制</a-button>
      </a-input-group>
      <div style="margin-top: 16px; text-align: right">
        <a-button @click="showKeyModal = false">我已保存</a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { apiKeyApi } from '@/apis/api_key_api'

const apiKeys = ref([])
const loading = ref(false)
const modalVisible = ref(false)
const submitting = ref(false)
const isEditing = ref(false)
const editingId = ref(null)
const showKeyModal = ref(false)
const newKeyValue = ref('')

const form = ref({
  name: '',
  key: ''
})

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '密钥', dataIndex: 'key', key: 'key' },
  { title: '启用', key: 'is_enabled', width: 80 },
  { title: '最后使用', dataIndex: 'last_used_at', key: 'last_used_at' },
  { title: '操作', key: 'actions', width: 150 }
]

const fetchKeys = async () => {
  loading.value = true
  try {
    const res = await apiKeyApi.list()
    apiKeys.value = res.keys || []
  } catch (e) {
    message.error('获取密钥列表失败')
  } finally {
    loading.value = false
  }
}

const showCreateModal = () => {
  isEditing.value = false
  editingId.value = null
  form.value = { name: '', key: '' }
  modalVisible.value = true
}

const showEditModal = (record) => {
  isEditing.value = true
  editingId.value = record.id
  form.value = { name: record.name, key: '' }
  modalVisible.value = true
}

const handleSubmit = async () => {
  if (!form.value.name.trim()) {
    message.warning('请输入名称')
    return
  }

  submitting.value = true
  try {
    if (isEditing.value) {
      await apiKeyApi.update(editingId.value, { name: form.value.name })
      message.success('更新成功')
    } else {
      const payload = { name: form.value.name }
      if (form.value.key.trim()) {
        payload.key = form.value.key.trim()
      }
      const res = await apiKeyApi.create(payload)
      message.success('创建成功')
      // 显示完整 key
      newKeyValue.value = res.key.key
      showKeyModal.value = true
    }
    modalVisible.value = false
    fetchKeys()
  } catch (e) {
    message.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const toggleEnabled = async (id, enabled) => {
  try {
    await apiKeyApi.update(id, { is_enabled: enabled })
    message.success(enabled ? '已启用' : '已禁用')
    fetchKeys()
  } catch (e) {
    message.error('操作失败')
  }
}

const deleteKey = async (id) => {
  try {
    await apiKeyApi.delete(id)
    message.success('已删除')
    fetchKeys()
  } catch (e) {
    message.error('删除失败')
  }
}

const copyKey = () => {
  navigator.clipboard.writeText(newKeyValue.value)
  message.success('已复制到剪贴板')
}

onMounted(fetchKeys)
</script>

<style lang="less" scoped>
.api-key-management {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
    }
  }
}
</style>
```

**Step 3: 添加到设置弹窗**

修改 `Yuxi-Know/web/src/components/SettingsModal.vue`：

在 template 中添加侧边栏项：
```vue
<div
  class="sider-item"
  :class="{ activesec: activeTab === 'apikey' }"
  @click="activeTab = 'apikey'"
  v-if="userStore.isSuperAdmin"
>
  <KeyOutlined class="icon" />
  <span>API 密钥</span>
</div>
```

在内容区域添加：
```vue
<div v-show="activeTab === 'apikey'" v-if="userStore.isSuperAdmin">
  <ApiKeyManagement />
</div>
```

在 script 中添加导入：
```javascript
import { KeyOutlined } from '@ant-design/icons-vue'
import ApiKeyManagement from './settings/ApiKeyManagement.vue'
```

**Step 4: Commit**

```bash
cd Yuxi-Know
git add web/src/apis/api_key_api.js web/src/components/settings/ApiKeyManagement.vue web/src/components/SettingsModal.vue
git commit -m "feat: add API Key management UI in settings"
```

---

## Part 2: 客服平台改造

### Task 5: 扩展 AI 配置类型和读写逻辑

**Files:**
- Modify: `src/lib/utils/ai-config.ts`
- Modify: `src/app/api/admin/settings/ai/route.ts`

**Step 1: 扩展类型定义**

修改 `src/lib/utils/ai-config.ts`：

```typescript
/**
 * AI Configuration Utility
 *
 * Handles reading and writing AI auto-reply configuration
 * Supports multiple providers: FastGPT and Yuxi-Know
 */

import fs from 'fs'
import path from 'path'
import { logger } from '@/lib/utils/logger'

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

  // Common (legacy, kept for compatibility)
  model: string
  temperature: number
  systemPrompt: string
}

const CONFIG_PATH = path.join(process.cwd(), 'config', 'ai-settings.json')

const DEFAULT_SETTINGS: AISettings = {
  enabled: false,
  provider: 'fastgpt',
  fastgptUrl: '',
  fastgptAppId: '',
  fastgptApiKey: '',
  yuxiUrl: '',
  yuxiApiKey: '',
  yuxiAgentId: '',
  model: 'GPT-4o-mini',
  temperature: 0.7,
  systemPrompt: 'You are a helpful customer service assistant.',
}

/**
 * Read AI settings from config file and environment variables
 */
export function readAISettings(): AISettings {
  try {
    let fileSettings: Partial<AISettings> = {}

    if (fs.existsSync(CONFIG_PATH)) {
      const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8')
      fileSettings = JSON.parse(fileContent)
    }

    // Merge with defaults and environment variables
    return {
      ...DEFAULT_SETTINGS,
      ...fileSettings,
      // API keys from env (fallback)
      fastgptApiKey: fileSettings.fastgptApiKey || process.env.FASTGPT_API_KEY || '',
      yuxiApiKey: fileSettings.yuxiApiKey || process.env.YUXI_API_KEY || '',
    }
  } catch (error) {
    logger.error('AIConfig', 'Error reading settings', {
      data: { error: error instanceof Error ? error.message : error },
    })
    return DEFAULT_SETTINGS
  }
}

/**
 * Write AI settings to config file
 */
export function writeAISettings(settings: Partial<AISettings>): void {
  try {
    const configDir = path.dirname(CONFIG_PATH)
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    const currentSettings = readAISettings()
    const newSettings = {
      ...currentSettings,
      ...settings,
    }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newSettings, null, 2), 'utf-8')
    logger.info('AIConfig', 'Settings saved', { data: { provider: newSettings.provider } })
  } catch (error) {
    logger.error('AIConfig', 'Error writing settings', {
      data: { error: error instanceof Error ? error.message : error },
    })
    throw error
  }
}

/**
 * Update .env.local file with API key (legacy support)
 */
export function updateEnvFile(apiKey: string): void {
  // Keep existing implementation for backwards compatibility
  const envPath = path.join(process.cwd(), '.env.local')
  try {
    let envContent = ''
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8')
    }

    const keyPattern = /^FASTGPT_API_KEY=.*$/m
    if (keyPattern.test(envContent)) {
      envContent = envContent.replace(keyPattern, `FASTGPT_API_KEY=${apiKey}`)
    } else {
      envContent += `\nFASTGPT_API_KEY=${apiKey}`
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8')
  } catch (error) {
    logger.error('AIConfig', 'Error updating .env.local', {
      data: { error: error instanceof Error ? error.message : error },
    })
  }
}
```

**Step 2: 扩展 API Route Schema**

修改 `src/app/api/admin/settings/ai/route.ts`，更新 Schema 和处理逻辑：

```typescript
const AISettingsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['fastgpt', 'yuxi-know']).optional(),

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

更新 GET 和 PUT 处理逻辑以支持新字段（snake_case <-> camelCase 转换）。

**Step 3: Commit**

```bash
git add src/lib/utils/ai-config.ts src/app/api/admin/settings/ai/route.ts
git commit -m "feat: extend AI settings to support multiple providers"
```

---

### Task 6: 实现 Yuxi-Know 聊天处理

**Files:**
- Modify: `src/app/api/ai/chat/route.ts`

**Step 1: 添加 Yuxi-Know 处理函数**

在现有文件中添加 provider 路由逻辑：

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { readAISettings, AISettings } from '@/lib/utils/ai-config'
import { getApiLogger } from '@/lib/utils/api-logger'

// ... existing ChatRequestSchema ...

export async function POST(request: NextRequest) {
  const log = getApiLogger('AIChatAPI', request)
  const startedAt = Date.now()

  try {
    const body = await request.json()
    const parsed = ChatRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }

    const settings = readAISettings()

    if (!settings.enabled) {
      return NextResponse.json({ success: false, error: 'AI chat is disabled' }, { status: 403 })
    }

    // Route to appropriate provider
    if (settings.provider === 'yuxi-know') {
      return handleYuxiKnowChat(parsed.data, settings, log, startedAt)
    } else {
      return handleFastGPTChat(parsed.data, settings, log, startedAt)
    }
  } catch (error) {
    log.error('AI chat error', {
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : error,
    })
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

async function handleYuxiKnowChat(
  data: { conversationId: string; message: string; history?: Array<{ role: string; content: string }> },
  settings: AISettings,
  log: ReturnType<typeof getApiLogger>,
  startedAt: number
) {
  const { message, history = [] } = data

  if (!settings.yuxiUrl || !settings.yuxiApiKey || !settings.yuxiAgentId) {
    return NextResponse.json({ success: false, error: 'Yuxi-Know is not configured' }, { status: 500 })
  }

  const messages = [
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: message },
  ]

  const yuxiUrl = settings.yuxiUrl.endsWith('/')
    ? `${settings.yuxiUrl}api/v1/chat/completions`
    : `${settings.yuxiUrl}/api/v1/chat/completions`

  log.info('Yuxi-Know request', {
    messageLength: message.length,
    historyLength: history.length,
    agentId: settings.yuxiAgentId,
  })

  const response = await fetch(yuxiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.yuxiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.yuxiAgentId,
      messages,
      stream: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    log.error('Yuxi-Know API error', {
      status: response.status,
      latencyMs: Date.now() - startedAt,
      errorPreview: errorText.slice(0, 200),
    })
    return NextResponse.json({ success: false, error: 'Failed to get AI response' }, { status: 500 })
  }

  const responseData = await response.json()
  const aiMessage = responseData.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.'

  log.info('Yuxi-Know response', {
    status: response.status,
    latencyMs: Date.now() - startedAt,
    responseLength: aiMessage.length,
  })

  return NextResponse.json({
    success: true,
    data: { message: aiMessage, model: settings.yuxiAgentId },
  })
}

// Rename existing logic to handleFastGPTChat
async function handleFastGPTChat(/* existing parameters */) {
  // ... existing FastGPT implementation ...
}
```

**Step 2: Commit**

```bash
git add src/app/api/ai/chat/route.ts
git commit -m "feat: add Yuxi-Know chat handler with provider routing"
```

---

### Task 7: 新增获取智能体列表 API

**Files:**
- Create: `src/app/api/admin/settings/ai/agents/route.ts`

**Step 1: 创建代理 API**

```typescript
/**
 * Yuxi-Know Agents Proxy API
 *
 * Fetches available agents from Yuxi-Know server
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/utils/auth'
import { z } from 'zod'

const RequestSchema = z.object({
  url: z.string().url(),
  apiKey: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    await requireRole(['admin'])

    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }

    const { url, apiKey } = parsed.data
    const agentsUrl = url.endsWith('/') ? `${url}api/v1/agents` : `${url}/api/v1/agents`

    const response = await fetch(agentsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { success: false, error: `Failed to fetch agents: ${response.status}`, details: errorText.slice(0, 200) },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({ success: true, agents: data.agents || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/admin/settings/ai/agents/route.ts
git commit -m "feat: add proxy API for fetching Yuxi-Know agents"
```

---

### Task 8: 修改前端设置页面

**Files:**
- Modify: `src/app/admin/settings/page.tsx`
- Modify: `messages/en.json` (and other locale files)

**Step 1: 更新设置页面 UI**

更新 `src/app/admin/settings/page.tsx` 添加 Provider 切换和 Yuxi-Know 配置表单：

```tsx
// 在 interface AISettings 中添加新字段
interface AISettings {
  enabled: boolean
  provider: 'fastgpt' | 'yuxi-know'
  // FastGPT
  fastgpt_url: string
  fastgpt_appid: string
  fastgpt_api_key: string
  // Yuxi-Know
  yuxi_url: string
  yuxi_api_key: string
  yuxi_agent_id: string
  // Common
  model: string
  temperature: number
  system_prompt: string
}

// 添加 agents state
const [agents, setAgents] = useState<Array<{ id: string; name: string; description: string }>>([])
const [loadingAgents, setLoadingAgents] = useState(false)

// 添加获取 agents 的函数
const fetchAgents = async () => {
  if (!aiSettings.yuxi_url || !aiSettings.yuxi_api_key) {
    toast.error('请先填写 URL 和 API Key')
    return
  }
  setLoadingAgents(true)
  try {
    const response = await fetch('/api/admin/settings/ai/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: aiSettings.yuxi_url, apiKey: aiSettings.yuxi_api_key }),
    })
    const data = await response.json()
    if (data.success) {
      setAgents(data.agents)
      toast.success(`已加载 ${data.agents.length} 个智能体`)
    } else {
      toast.error(data.error || '获取智能体失败')
    }
  } catch {
    toast.error('获取智能体失败')
  } finally {
    setLoadingAgents(false)
  }
}

// 在 UI 中添加 Provider 切换 Radio 和 Yuxi-Know 配置区块
```

**Step 2: 添加国际化文案**

在 `messages/en.json` 和其他语言文件的 `settings.ai` 下添加：

```json
{
  "provider": {
    "label": "AI Provider",
    "fastgpt": "FastGPT",
    "yuxiKnow": "Yuxi-Know"
  },
  "yuxiKnow": {
    "title": "Yuxi-Know Configuration",
    "url": "Base URL",
    "urlHint": "e.g., https://yuxi.example.com",
    "apiKey": "API Key",
    "apiKeyHint": "The API key created in Yuxi-Know settings",
    "agent": "Agent",
    "agentHint": "Select an agent to handle conversations",
    "refreshAgents": "Refresh List",
    "testConnection": "Test Connection"
  }
}
```

**Step 3: Commit**

```bash
git add src/app/admin/settings/page.tsx messages/*.json
git commit -m "feat: add provider switching and Yuxi-Know config UI"
```

---

## 验证清单

### Yuxi-Know 端

- [ ] `api_keys` 表已创建
- [ ] 可以通过后台创建/编辑/删除 API Key
- [ ] `GET /api/v1/agents` 返回智能体列表
- [ ] `POST /api/v1/chat/completions` 能正确调用智能体并返回响应

### 客服平台端

- [ ] 设置页面可以切换 Provider
- [ ] Yuxi-Know 配置区块正常显示/隐藏
- [ ] 点击"刷新列表"能获取智能体
- [ ] 保存设置后 AI 对话使用正确的后端

---

## 测试命令

```bash
# Yuxi-Know API 测试
curl -X GET http://localhost:5050/api/v1/agents \
  -H "Authorization: Bearer sk-yuxi-xxx"

curl -X POST http://localhost:5050/api/v1/chat/completions \
  -H "Authorization: Bearer sk-yuxi-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model": "chatbot", "messages": [{"role": "user", "content": "你好"}]}'

# 客服平台测试
npm run dev
# 访问 http://localhost:3010/admin/settings
```
