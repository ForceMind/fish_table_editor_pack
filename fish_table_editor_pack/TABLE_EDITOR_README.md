# 渔场配置可视化编辑器（位于 `sheet/table`）

目标：
- 配置过程可视化，不只是导出结果
- 工具和产物都在 `sheet/table` 目录内
- 支持直接写回或另存 `Script` 表

## 启动

方式 1（推荐）：
- 双击 `run_table_editor.bat`
- 启动时会询问：
  - `1` 仅本地可见（`127.0.0.1`）
  - `2` 局域网可见（`0.0.0.0`）

方式 2（命令行）：
```powershell
cd "e:\Works\项目\game-fish-client\sheet\table"
python .\fish_table_editor.py --host 127.0.0.1 --port 18888
```

访问：
- `http://127.0.0.1:18888`

## 核心能力

1. 左侧鱼群库（筛选鱼群）  
- 可搜索 `GroupId / 中文鱼名 / 英文鱼名 / 路径ID`  
- 每个 Group 显示：  
  - 组内有哪些鱼  
  - 各鱼赔率  
  - 是否 Boss  
  - 鱼出现顺序

2. 中间大时间线  
- 选择场次后查看完整时间线  
- 显示事件数、总出生耗时、总清场耗时、平均 Group 间隔  
- 拖动区块右边缘可直接修改 `Group间隔(ms)`（即 Script 表里的 `GapTime`）

3. 下方脚本表  
- 拖拽“排序”列可改脚本顺序  
- 展开明细可看：  
  - 各 Group 的鱼出现顺序（中文名+赔率）  
  - 当前场次绝对开始时间、出生完成时间、清场完成时间  
  - 当前场次总耗时

4. 保存  
- “保存到 Script&.xlsx”：覆盖当前脚本表  
- “另存为...” ：保存新 xlsx 文件

## 文件说明

- 服务端：`fish_table_editor.py`
- 前端：`table_editor_web/`
- 启动脚本：`run_table_editor.bat`
