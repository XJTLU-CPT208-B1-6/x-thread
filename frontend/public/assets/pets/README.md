# Pet Sprites

此目录包含宠物的精灵图资源。

## 目录结构

```
assets/pets/
├── cat/
│   ├── idle.png      # 空闲状态
│   ├── happy.png     # 开心状态
│   ├── busy.png      # 忙碌状态
│   ├── hungry.png    # 饥饿状态
│   └── reaction.png  # 互动反应
└── dog/
    ├── idle.png
    ├── happy.png
    ├── busy.png
    ├── hungry.png
    └── reaction.png
```

## 精灵图规格

- 尺寸：512×128 像素（每帧 128×128，共 4 帧）
- 格式：PNG（支持透明背景）
- 风格：像素艺术
- 渲染：使用 `image-rendering: pixelated` 保持清晰度

## 占位符说明

在正式精灵图制作完成前，系统会使用 Emoji 作为占位符显示。
