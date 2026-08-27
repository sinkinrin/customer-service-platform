# FastGPT Trace Demo

A standalone Node.js 20 demo that visualizes FastGPT streaming execution details. It has no dependency on `customer-service-platform` and does not write to its database or configuration.

## Run

PowerShell:

```powershell
cd fastgpt-trace-demo
$env:FASTGPT_API_KEY = 'your-app-api-key'
npm start
```

Or copy `.env.example` to `.env`, fill in the key, then run:

```powershell
npm run start:env
```

Open <http://127.0.0.1:4173>.

To preview the interface without an API key, click **播放示例**. To make a real request, configure `FASTGPT_API_KEY` and click **调用 FastGPT**.

The FastGPT endpoint defaults to:

```text
http://47.252.29.254:8000/api/v1/chat/completions
```

## What it displays

- streamed answer text;
- workflow node status (`flowNodeStatus`);
- tool call, parameters, and result events;
- final workflow responses (`flowResponses`);
- knowledge-base citations from `quoteList`;
- the raw JSON payload for each event;
- normalized tool calls with merged parameter fragments;
- knowledge-search batches and query terms;
- answer `(CITE)` markers mapped back to evidence;
- HTTP status, upstream connection time, response bytes, lifecycle timing, and SSE event distribution;
- a safe request/response envelope that never includes the API key.

The proxy deliberately continues reading after FastGPT sends answer `[DONE]`, because `flowResponses` may arrive afterward.
