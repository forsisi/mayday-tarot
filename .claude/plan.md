# 6项修复计划

## 1. [TarotScrollBoard.tsx] 渐进减速 + 防重复抽牌
- INDEX_POINT 时设 targetVelocity=0，每帧 friction 减速，直到 |v|<0.01 再触发选中
- stopAndSelect 加防重入锁 `selectingRef`，避免重复触发
- 验证：食指伸出→卡牌逐渐减慢→停稳→选中，不会跳转

## 2. [App.tsx] 手势速度设置面板
- handleHandMove 中速度系数降低到 1.2
- 在 GestureController 旁边加小型设置面板（慢0.6/中1.2/快2.5 三档）
- 用 state 存储 speedMultiplier
- 验证：切换档位后扒动速度明显变化

## 3. [TarotCard.tsx] 移除内侧金色边框
- 封面外层 `border-2 border-amber-400/40` 改为无边框
- 只保留最外层卡牌的 `border-amber-400/50`
- 验证：封面周围无金框，只有最外层细框

## 4. [App.tsx] 播放页封面放大
- CARD_DETAIL 左侧卡片从 lg:w-[42%] 改为 lg:w-[48%]
- TarotCard 整体 scale 增大
- 验证：播放页封面明显更大

## 5. [TarotScrollBoard.tsx + App.tsx] 布局调整
- 卡牌尺寸从 200x310/230x350 增大到 240x370/280x430
- 卡牌容器居中
- GestureController 摄像头 orb 从 w-44→w-52
- 手势组件整体 max-w-sm→max-w-xs，比卡牌小
- 验证：卡牌居中且大，摄像头清晰，手势面板紧凑
