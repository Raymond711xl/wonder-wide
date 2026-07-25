# 远迹 · Footprint Atlas

无需登录的个人旅行足迹原型。世界层用静态国家热度地图表达足迹强度，国家层展示城市、停留方式、地点与积分。

## 地图架构

- 本地 GeoJSON 只在启动时投影一次，不加载远程地图瓦片。
- 国家轮廓、城市节点、序号与标签共享同一个 SVG 坐标系。
- 缩放只改变 SVG `viewBox`，城市锚点不会与地图漂移。
- 世界层显示国家热度与国家摘要；点击国家进入城市层。
- 记录暂存于浏览器 `localStorage`，无需登录。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

## 验证

```bash
npm run lint
npm test
```
