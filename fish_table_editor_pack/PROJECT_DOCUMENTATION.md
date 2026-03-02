# Fish Table Editor 项目文档

## 1. 项目目标

本工具用于可视化编辑捕鱼脚本配置，围绕以下表进行协同：

- `Arena&.xlsx`：渔场/房间定义。
- `Fish&.xlsx`：基础鱼数据（名称、赔率等）。
- `Group&.xlsx`：鱼群组合（由多条鱼、路径、间隔组成）。
- `Route&.xlsx`：路径定义。
- `Script&.xlsx`：脚本编排（组顺序、脚本间隔、场次、类型）。

核心目标：

- 配置过程可视化（不是仅导出结果可视化）。
- 支持手工拖拽调节和自动生成。
- 保留 `Script&.xlsx` 作为基准模板，不直接覆盖。

## 2. 目录结构

- `fish_table_editor.py`：后端服务、Excel 读写、LLM 调用、规则校验。
- `table_editor_web/index.html`：页面结构。
- `table_editor_web/styles.css`：样式。
- `table_editor_web/app.js`：前端交互、时间线、自动生成、调试输出。
- `script_presets/`：本地方案快照。
- `run_table_editor.bat`：Windows 启动脚本。

## 3. 启动方式

### 3.1 批处理启动（推荐）

运行 `run_table_editor.bat`，启动时可选择：

- 仅本地可见：`127.0.0.1`
- 局域网可见：`0.0.0.0`

默认端口：`18888`

### 3.2 命令行启动

```powershell
python .\fish_table_editor.py --host 127.0.0.1 --port 18888
```

## 4. 主要功能

### 4.1 可视化编辑

- 左侧鱼群库支持按关键字、Boss 状态筛选。
- 中部时间线支持查看脚本绝对时间、出生完成时间、清场完成时间。
- 下方脚本表支持编辑 ScriptId、GapTime、Arena、Type、GroupIds。
- 支持拖拽调整脚本顺序与时间间隔。

### 4.2 自动生成

支持三种模式：

- `auto`：优先 LLM，失败自动回退本地算法。
- `llm`：仅 LLM。
- `local`：仅本地算法。

LLM 配置项：

- `Base URL`
- `Model`
- `API Key`
- `Temperature`
- `Max Tokens`（默认 2048）
- `minPerArena`

### 4.3 方案管理

- 将当前脚本保存到 `script_presets/`。
- 支持加载、删除、重命名（通过另存新名实现）本地方案。

## 5. 数据与规则约束

### 5.1 Boss 规则（硬约束）

对每个 Arena：

- Boss 只能出现 1 次。
- Boss 必须在该 Arena 的最后一条脚本中。
- Boss 必须位于最后脚本的后半段。
- 含 Boss 的行 `type=2`；否则 `type=1`。

### 5.2 Group 合法性

- 只能使用当前 Arena 已配置可用的 Group。
- 若模型返回非法 Group，会自动过滤；极端情况下会回填一个合法普通组，避免整行失效。

## 6. 保存策略（重要）

`Script&.xlsx` 作为基准模板，只读取，不覆盖。

每次保存都会自动生成新文件名：

- 默认保存：`Script.generated.YYYYMMDD_HHMMSS.xlsx`
- 另存为前缀：`<prefix>.YYYYMMDD_HHMMSS.xlsx`
- 若同秒重名，自动追加 `_01/_02/...`

## 7. LLM 调试机制

前端控制台会打印：

- `[AI-REQ-JSON]`：发送到 `/api/generate-script-ai` 的完整请求。
- `[AI-RES-JSON]`：后端完整响应。
- `[AI-DEBUG]`：后端调试轨迹（提示词、请求体、原始返回、解析来源、异常）。

后端调试项包括：

- `AI system prompt`
- `request payload`
- `raw response text`
- `finish_reason`
- `extracted source`
- `exception`

## 8. 后端接口

- `GET /api/data`：读取全部表并返回前端结构化数据。
- `POST /api/generate-script-ai`：LLM 生成（含 debug 字段）。
- `POST /api/save-script`：保存脚本到新 xlsx 文件（不覆盖基准）。
- `POST /api/preset/save`：保存本地方案。
- `POST /api/preset/load`：加载本地方案。
- `POST /api/preset/delete`：删除本地方案。
- `GET /api/health`：健康检查。

## 9. 常见问题

### 9.1 “大模型未返回文本内容”/“返回不是合法JSON”

- 检查 `Base URL/Model/API Key` 是否匹配服务商。
- 降低 `minPerArena` 或 `Max Tokens`（建议先 2048）。
- 查看控制台 `[AI-DEBUG]` 中的 `raw response text` 和 `finish_reason`。

### 9.2 接口偶发超时

- 该版本已按 Arena 分批调用并带重试。
- 仍超时时，建议重试一次或切到 `auto` 模式走本地回退。

### 9.3 乱码问题

- 统一用 UTF-8 打开编辑器和终端。
- BAT 文件建议用 ANSI/GBK 保存以兼容老 cmd；前端资源用 UTF-8。

## 10. 版本说明（当前）

当前版本已完成：

- LLM 逐 Arena 生成。
- 失败重试链路（含 JSON 修复重试）。
- Boss 规则硬校验 + 自动修正。
- 基准 `Script&.xlsx` 保护。
- 页面新增 `Max Tokens` 配置。
