# 晃悠 · Wander Wide

无需登录的个人旅行足迹原型。世界层用静态国家热度地图表达足迹密度，国家层展示城市、到访日期、出游性质与景点。

## 地图架构

- 本地 GeoJSON 只在启动时投影一次，不加载远程地图瓦片。
- 国家轮廓、城市节点、序号与标签共享同一个 SVG 坐标系。
- 缩放只改变 SVG `viewBox`，城市锚点不会与地图漂移。
- 世界层显示国家热度与国家摘要；点击国家进入城市层。
- 未到访国家统一使用暖灰底色，已到访国家按城市数与到访性质显示四级热度。
- 左上角覆盖率会随全球 / 国家视图切换；城市分母采用 GeoNames `cities15000` 口径。
- 中国与西班牙国家视图使用本地 geoBoundaries 细边界，不依赖运行时远程请求。
- 城市层的已记录节点只做展示，不再触发没有内容的二次放大。
- 出游性质使用六级内部权重驱动国家热度，但不向用户展示分值。
- 台湾轮廓与城市记录统一归入中国。
- 记录暂存于浏览器 `localStorage`，无需登录。

## 地图数据

- 城市统计：GeoNames `cities15000`，CC BY 4.0。
- 国家内部边界：geoBoundaries `gbOpen`，CC BY 4.0；中国为 ADM2 县级行政区，西班牙为 ADM2 省级行政区。
- 运行 `node scripts/normalize-map-data.mjs /path/to/cities15000.txt` 可重新压缩边界并生成城市统计。

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
