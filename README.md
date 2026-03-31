# 边狱巴士公司路线计算器

一个纯前端的边狱巴士公司路线规划工具。

它主要用来：

- 选择目标 EGO 饰品
- 根据楼层与卡包出现规则推算路线
- 支持关键词、等级、卡包限定、已选状态等筛选
- 支持手动锁定楼层卡包
- 支持方案码分享与恢复思路

## 运行方式

直接打开 [index.html](E:\EGOtest\index.html) 即可使用。

这是一个静态页面，不依赖后端。

## 主要功能

- EGO 检索与筛选
  - 搜索 EGO / 关键词 / 卡包
  - 按关键词筛选
  - 按等级筛选
  - 按是否卡包限定筛选
  - 只看已选 / 未选 EGO
- EGO 选择
  - 单个点选
  - 关键词一键多选
- 路线规划
  - 自动生成 1 到 15 层路线
  - 已选卡包不会在后续楼层重复出现
  - 同一层可同时承载多个目标卡包
  - 楼层区域仅显示该层卡包可获得的已选卡包限定 EGO
- 手动干预
  - 每层可手动指定卡包
  - 可恢复为自动推荐
  - 路线卡片支持拖拽排序
- 分享
  - 复制方案码
  - 复制带标题的分享文本
  - 输入方案码或整段分享文本自动识别并恢复方案

## 文件结构

- [index.html](E:\EGOtest\index.html)
  页面结构
- [styles.css](E:\EGOtest\styles.css)
  界面样式
- [app.js](E:\EGOtest\app.js)
  前端逻辑、路线计算、方案码逻辑
- [data/ego-items.js](E:\EGOtest\data\ego-items.js)
  EGO 数据，页面实际读取
- [data/ego-items.json](E:\EGOtest\data\ego-items.json)
  EGO 数据的 JSON 版本，便于查看和处理
- [data/packs.js](E:\EGOtest\data\packs.js)
  卡包数据，页面实际读取
- [data/packs.json](E:\EGOtest\data\packs.json)
  卡包数据的 JSON 版本

## 数据格式

### EGO 数据

`data/ego-items.js` 中每条 EGO 大致包含这些字段：

```js
{
  id: "9001",
  name: "炼狱炎蝶之梦",
  description: "效果描述",
  level: "二级",
  keywords: ["烧伤"],
  packDisplay: "所有卡包",
  packOptions: [],
  allPacks: true,
  acquisition: "事件-红焰蛾",
  icon: "./assets/ego/9001.png"
}
```

常用字段说明：

- `id`
  唯一标识
- `name`
  EGO 名称
- `description`
  描述文本
- `level`
  等级
- `keywords`
  用于筛选和批量选择
- `packDisplay`
  原始卡包显示名
- `packOptions`
  可掉落该 EGO 的卡包 id 列表
- `allPacks`
  是否为所有卡包通用
- `acquisition`
  获得方式或来源
- `icon`
  图标路径

### 卡包数据

`data/packs.js` 中每条卡包大致包含这些字段：

```js
{
  id: "28",
  name: "地狱鸡",
  floors: [2],
  keywords: [""],
  note: "",
  icon: "./assets/packs/28.jpg"
}
```

常用字段说明：

- `id`
  卡包唯一标识
- `name`
  卡包名称
- `floors`
  该卡包可能出现的楼层
- `keywords`
  当前可用于路线评分
- `note`
  特殊备注
- `icon`
  卡包图标路径

## 方案码说明

当前分享使用方案码，不再依赖文件导入导出。

方案码会保存：

- 已选 EGO
- 手动锁定的楼层卡包
- 当前筛选条件

可用方式：

1. 点击“复制方案码”
2. 点击“复制分享文本”
3. 把收到的方案码或整段分享文本粘贴到方案码输入框
4. 点击“应用方案码”

## 数据维护建议

- 新增 EGO 时，优先补齐 `id`、`name`、`level`、`keywords`、`packOptions`
- 若某 EGO 是所有卡包通用，设置：
  - `allPacks: true`
  - `packOptions: []`
- 若某 EGO 是卡包限定，设置：
  - `allPacks: false`
  - `packOptions: ["卡包id"]`
- 素材文件暂时缺失时可以先保留路径，不会阻塞功能

## 注意

- 这是本地静态工具，刷新页面不会自动保存当前方案
- 需要长期保存思路时，建议复制方案码
- 路线结果是基于当前录入数据和前端规则推算，不代表唯一最优解
