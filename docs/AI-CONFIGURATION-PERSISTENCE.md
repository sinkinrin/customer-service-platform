# AI Configuration Persistence Guide

**中文概览**: See [AI-CONFIGURATION-PERSISTENCE.zh-CN.md](./AI-CONFIGURATION-PERSISTENCE.zh-CN.md)

**Date**: 2025-11-06  
**Status**: ✅ **IMPLEMENTED**

---

## Overview

The AI auto-reply configuration is now **persistent across server restarts** using a hybrid storage approach:

1. **Sensitive Data** (API keys) → `.env.local` file
2. **Other Settings** (model, temperature, prompts, URLs) → `config/ai-settings.json` file

This ensures:
- ✅ Settings survive server restarts
- ✅ Sensitive data is kept secure
- ✅ Non-sensitive settings can be updated without server restart
- ✅ Configuration is version-controlled (example file only)

---

## File Structure

```
customer-service-platform/
├── .env.local                      # Sensitive data (API keys) - NOT in git
├── .gitignore                      # Excludes .env.local and ai-settings.json
├── config/
│   ├── ai-settings.json            # AI configuration - NOT in git
│   └── ai-settings.example.json    # Example configuration - IN git
└── src/
    └── lib/
        └── utils/
            └── ai-config.ts        # Configuration utility functions
```

---

## Configuration Files

### 1. `.env.local` (Sensitive Data)

**Purpose**: Store sensitive API keys that should never be committed to version control.

**Location**: Project root directory `.env.local`

**Content**:
```env
# Zammad Integration
ZAMMAD_URL=http://your-zammad-instance:8080/
ZAMMAD_API_TOKEN=your_zammad_api_token_here

# AI Auto-Reply Configuration (Sensitive Data)
# Note: FastGPT API Key is stored here for security
# Other AI settings are stored in config/ai-settings.json
FASTGPT_API_KEY=your-fastgpt-api-key-here
```

**Important Notes**:
- ✅ This file is in `.gitignore` and will NOT be committed
- ⚠️ Changing this file requires **server restart** to take effect
- 🔒 Keep this file secure - it contains sensitive credentials

---

### 2. `config/ai-settings.json` (Non-Sensitive Data)

**Purpose**: Store AI configuration that can be updated dynamically via the admin UI.

**Location**: `config/ai-settings.json` (project root)

**Content**:
```json
{
  "enabled": false,
  "model": "GPT-4o-mini",
  "temperature": 0.7,
  "systemPrompt": "You are a helpful customer service assistant.",
  "fastgptUrl": "https://your-fastgpt-instance.com",
  "fastgptAppId": "your-app-id"
}
```

**Important Notes**:
- ✅ This file is in `.gitignore` and will NOT be committed
- ✅ Changes to this file take effect **immediately** (no server restart needed)
- ✅ Updated automatically when admin saves settings via UI

---

### 3. `config/ai-settings.example.json` (Template)

**Purpose**: Provide a template for new installations.

**Location**: `config/ai-settings.example.json` (project root)

**Content**: Same as `ai-settings.json` but with placeholder values.

**Important Notes**:
- ✅ This file IS committed to version control
- ✅ Copy this to `ai-settings.json` for new installations
- ✅ Update with your actual configuration values

---

## How It Works

### Reading Configuration

When the server starts or when the admin views settings:

1. **Read `config/ai-settings.json`** for non-sensitive settings
2. **Read `process.env.FASTGPT_API_KEY`** from `.env.local` for API key
3. **Merge** both sources into a single configuration object
4. **Return** to the admin UI

**Code**: `src/lib/utils/ai-config.ts` → `readAISettings()`

---

### Writing Configuration

When the admin saves settings via the UI:

1. **Validate** the input using Zod schema
2. **Write non-sensitive settings** to `config/ai-settings.json`
3. **If API key provided**, update `.env.local` file
4. **Log warning** if API key was updated (requires server restart)
5. **Return** the saved configuration

**Code**: `src/lib/utils/ai-config.ts` → `writeAISettings()` and `updateEnvFile()`

---

## API Endpoints

### GET `/api/admin/settings/ai`

**Purpose**: Retrieve current AI configuration

**Response**:
```json
{
  "success": true,
  "data": {
    "enabled": false,
    "model": "GPT-4o-mini",
    "temperature": 0.7,
    "system_prompt": "You are a helpful customer service assistant.",
    "fastgpt_url": "https://your-fastgpt-instance.com",
    "fastgpt_appid": "your-app-id",
    "fastgpt_api_key": "fastgpt-xxxxxx"
  }
}
```

**Source**: Reads from `config/ai-settings.json` + `.env.local`

---

### PUT `/api/admin/settings/ai`

**Purpose**: Update AI configuration

**Request Body**:
```json
{
  "enabled": true,
  "model": "GPT-4o-mini",
  "temperature": 0.7,
  "system_prompt": "You are a helpful customer service assistant.",
  "fastgpt_url": "https://your-fastgpt-instance.com",
  "fastgpt_appid": "your-app-id",
  "fastgpt_api_key": "fastgpt-xxxxxx"
}
```

**Actions**:
1. Writes to `config/ai-settings.json` (all fields except API key)
2. Updates `.env.local` (API key only)
3. Returns updated configuration

**Important**: If API key is updated, **server restart required** for it to take effect.

---

## Usage Instructions

### For Administrators

#### 1. Initial Setup

1. Navigate to **Admin → Settings** (http://localhost:3010/admin/settings)
2. Scroll to **AI 智能回复** section
3. Toggle **启用 AI 智能回复** to ON
4. Fill in the configuration:
   - **AI 模型**: `GPT-4o-mini` (or your preferred model)
   - **Temperature**: `0.7` (0-2, recommended 0.7)
   - **系统提示词**: Your custom system prompt
   - **FastGPT URL**: Your FastGPT instance URL
   - **FastGPT App ID**: Your FastGPT application ID
   - **FastGPT API Key**: Your FastGPT API key
5. Click **保存设置** (Save Settings)

#### 2. Verify Persistence

1. Save your settings (as above)
2. **Restart the development server**:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```
3. Navigate back to **Admin → Settings**
4. ✅ Verify all settings are still present

#### 3. Test FastGPT Connection

1. After configuring all fields, click **测试 FastGPT 连接**
2. Wait for the test to complete (up to 10 seconds)
3. Check the result:
   - ✅ **Success**: Connection is working
   - ❌ **Failure**: Check error message and fix configuration

---

### For Developers

#### Reading Configuration in Code

```typescript
import { readAISettings } from '@/lib/utils/ai-config'

// Read current configuration
const settings = readAISettings()

console.log(settings.enabled)        // boolean
console.log(settings.model)          // string
console.log(settings.temperature)    // number
console.log(settings.systemPrompt)   // string
console.log(settings.fastgptUrl)     // string
console.log(settings.fastgptAppId)   // string
console.log(settings.fastgptApiKey)  // string (from .env.local)
```

#### Writing Configuration in Code

```typescript
import { writeAISettings, updateEnvFile } from '@/lib/utils/ai-config'

// Update non-sensitive settings
writeAISettings({
  enabled: true,
  model: 'GPT-4o-mini',
  temperature: 0.7,
  systemPrompt: 'You are a helpful assistant.',
  fastgptUrl: 'https://your-instance.com',
  fastgptAppId: 'your-app-id',
})

// Update API key (requires server restart)
updateEnvFile('your-new-api-key')
```

---

## Security Considerations

### ✅ What's Secure

1. **API keys are stored in `.env.local`** (not in git)
2. **`.gitignore` excludes sensitive files**
3. **API endpoints require admin authentication**
4. **File permissions** (ensure `.env.local` is not world-readable)

### ⚠️ Important Warnings

1. **Never commit `.env.local`** to version control
2. **Never commit `config/ai-settings.json`** to version control
3. **Keep `.env.local` file permissions restricted** (chmod 600 on Linux/Mac)
4. **Rotate API keys regularly** for security
5. **Use HTTPS** for FastGPT connections in production

---

## Troubleshooting

### Problem: Settings are lost after server restart

**Solution**:
1. Check if `config/ai-settings.json` exists
2. Check if `.env.local` has `FASTGPT_API_KEY`
3. Check server logs for errors reading configuration files

### Problem: API key not working after update

**Solution**:
1. Verify API key was saved to `.env.local`
2. **Restart the server** (required for env changes)
3. Check server logs for the new API key being loaded

### Problem: "Failed to save AI settings" error

**Solution**:
1. Check if `config/` directory exists (should be created automatically)
2. Check file permissions (ensure server can write to `config/`)
3. Check server logs for detailed error messages

---

## Migration from Mock Data

**Previous Implementation**: Settings were stored in `src/lib/mock-data.ts` (in-memory, lost on restart)

**New Implementation**: Settings are stored in persistent files

**Migration Steps**:
1. ✅ No migration needed - default values are used if files don't exist
2. ✅ First save via admin UI will create the configuration files
3. ✅ Old mock data is no longer used

---

## Conclusion

✅ **AI configuration is now fully persistent**  
✅ **Sensitive data is stored securely**  
✅ **Settings survive server restarts**  
✅ **Admin UI updates configuration files automatically**  
✅ **Production-ready implementation**

**Next Steps**:
1. Configure your FastGPT instance details
2. Test the connection
3. Enable AI auto-reply
4. Monitor AI responses in conversations

