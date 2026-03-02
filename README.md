# Fish Table Editor

捕鱼配置可视化编辑工具。

## 快速开始

1. 双击 `run_table_editor.bat`
2. 选择访问模式：
   - `1` 仅本地（`127.0.0.1`）
   - `2` 局域网（`0.0.0.0`）
3. 浏览器打开 `http://127.0.0.1:18888`

## 主要能力

- 可视化编辑 Script（脚本顺序、Group、GapTime、Arena、Type）
- 时间线预览与拖拽调节
- LLM 自动生成（支持失败回退本地算法）
- 本地方案保存/加载（`script_presets/`）

## 重要规则

- `Script&.xlsx` 是基准模板，不会被覆盖
- 每次保存都会自动重命名生成新文件（带时间戳）
- Boss 规则：
  - 每个 Arena 只能出现 1 次
  - 必须在该 Arena 最后一条脚本的后半段
  - 含 Boss 行 `type=2`

## 文档索引

- 详细文档：`PROJECT_DOCUMENTATION.md`
- LLM 测试报告：`LLM_TEST_REPORT.md`
- 旧版说明：`TABLE_EDITOR_README.md`
