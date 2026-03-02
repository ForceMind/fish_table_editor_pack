# LLM JSON 可用性测试报告

测试时间：`2026-03-02 15:24:41`

## 1. 测试配置

- `baseUrl`: `https://maas-api.cn-huabei-1.xf-yun.com/v2`
- `model`: `xminimaxm25`
- `temperature`: `0.2`
- `timeoutSec`: `120`
- `maxTokens`: `2048`
- `minPerArena`: `6`

## 2. 测试步骤

1. 调用 `generate_scripts_by_llm(6, cfg, trace)` 获取 LLM 结果。
2. 对返回结果执行 `json.dumps -> json.loads`，验证 JSON 语法可用。
3. 检查每个 Arena 的脚本数量、`type=2` 行数、Boss 出现位置。
4. 调用 `write_script_table` 写入 xlsx，验证结果可被工具直接消费。

## 3. 测试结果

- JSON 语法：`OK_JSON_PARSE = True`
- 生成总行数：`36`
- 模型：`xminimaxm25`
- 写入结果：`WRITE_OK = True`
- 写入警告：`0`
- 调试轨迹条数：`85`

各 Arena 结果：

- Arena 1: `6` 行，`type2=1`，Boss 命中 `[(5, 3, 160, 4)]`
- Arena 2: `6` 行，`type2=1`，Boss 命中 `[(5, 5, 340, 6)]`
- Arena 3: `6` 行，`type2=1`，Boss 命中 `[(5, 2, 513, 3)]`
- Arena 4: `6` 行，`type2=1`，Boss 命中 `[(5, 6, 160, 7)]`
- Arena 5: `6` 行，`type2=1`，Boss 命中 `[(5, 5, 340, 9)]`
- Arena 6: `6` 行，`type2=1`，Boss 命中 `[(5, 42, 513, 43)]`

说明：

- Boss 命中 tuple 格式为 `(脚本索引, 组内位置, BossGroupId, 该脚本组长度)`。
- 上述结果满足“每场 Boss 仅一次，且在最后一条脚本后半段”。

## 4. 产物文件

- 输出文件：`E:\Privy\fish_table_editor_pack\LLM_TEST_OUTPUT.20260302_152431.xlsx`
- 文件大小：`8428` 字节

结论：

当前 LLM 最终生成 JSON 已通过语法、业务约束和落盘验证，可用于工具内保存与后续导出流程。
