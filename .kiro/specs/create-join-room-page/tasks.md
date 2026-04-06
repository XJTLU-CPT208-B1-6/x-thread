# Implementation Plan: 创建/加入房间页面

## Overview

`HomeWorkspacePage.tsx` 已存在基础实现，本计划聚焦于补全缺失功能、修复不符合需求的细节，并为核心工具函数补充测试。所有代码基于 React + TypeScript + Tailwind CSS + Zustand 技术栈。

## Tasks

- [x] 1. 补全页面整体布局与视觉样式
  - [x] 1.1 校验并修复 Sidebar 固定宽度 320px、圆角 32px、阴影样式
    - 确认 `aside` 元素宽度为 `w-[320px]`，圆角为 `rounded-[32px]`
    - 确认主内容区 `Main_Content_Area` 占据剩余空间并支持垂直滚动（`overflow-y-auto`）
    - 确认页面背景使用蓝紫色径向渐变
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 修复 Sidebar 内容溢出问题，确保侧边栏内部可滚动
    - Sidebar 内部内容区域应使用 `overflow-y-auto flex-1` 以防止内容溢出
    - 操作按钮组应固定在底部（`mt-auto`）
    - _Requirements: 1.2_

- [x] 2. 完善用户头像区域（User Avatar Section）
  - [x] 2.1 实现头像显示逻辑：有头像显示图片，无头像显示姓名首字母
    - `SidebarAvatar` 组件已存在，确认 `getInitials` 函数逻辑正确
    - 确认渐变背景色为 `from-blue-400 via-blue-500 to-purple-500`
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 实现头像上传与移除按钮的完整交互
    - 确认"上传头像"按钮触发隐藏的 `<input type="file" accept="image/*">`
    - 确认文件类型校验（`image/` 前缀）和大小校验（≤ 450KB）逻辑存在
    - 确认有头像时显示"移除头像"按钮，无头像时隐藏
    - 确认上传/移除过程中显示加载指示器（`avatarBusy` 状态）
    - _Requirements: 2.6, 2.7, 2.8, 2.9, 2.10_

  - [x] 2.3 在头像区域下方显示用户名、账号标识和邮箱
    - 用户名使用粗体文字
    - 账号标识（`user.account`）显示在用户名下方
    - 邮箱（`user.email`）在存在时显示在账号标识下方
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 2.4 为 `getInitials` 工具函数编写单元测试
    - 测试单词输入返回前两个字符（大写）
    - 测试两个单词输入返回各自首字母
    - 测试空字符串返回默认值 "XT"
    - _Requirements: 2.2_

- [x] 3. 完善左侧导航菜单（Navigation Menu）
  - [x] 3.1 实现四个导航项的渲染与选中状态样式
    - 选中项：紫色背景（`bg-purple-600`）+ 白色文字
    - 未选中项：浅蓝色背景（`bg-blue-50`）+ 深色文字
    - 每个导航项左侧显示图标，右侧显示标签文字
    - "创建 / 加入房间"默认选中
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7_

  - [x] 3.2 为"正在参与的房间"和"14 天内的房间"添加数量徽章
    - 从 `overview.activeRooms.length` 和 `overview.roomHistory.length` 读取数量
    - 数量徽章使用圆形小标签样式
    - _Requirements: 3.5_

  - [x] 3.3 实现导航项点击切换主内容区
    - 点击导航项更新 `activeSection` 状态
    - 主内容区根据 `activeSection` 渲染对应内容
    - 为未选中导航项添加 hover 效果
    - _Requirements: 3.6, 3.8_

- [x] 4. 完善 AI 状态模块（AI Status Module）
  - [x] 4.1 实现 AI 状态模块的完整渲染
    - 标题显示 "AI Status"
    - 已配置时显示 `provider / model`，未配置时显示 "尚未保存账号级 AI 配置"
    - 显示 Active 计数（`overview.activeRooms.length`）和 History 计数（`overview.roomHistory.length`）
    - 数据加载中时计数显示 "..."（`overviewBusy` 为 true 时）
    - 使用浅蓝色背景、圆角和边框
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 5. 完善侧边栏底部操作按钮
  - [x] 5.1 实现"刷新工作台"按钮
    - 点击时调用 `refreshAccountData()`
    - 刷新图标在 `overviewBusy` 为 true 时旋转（`animate-spin`）
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.2 实现"退出登录"按钮
    - 使用琥珀色背景（`bg-amber-500`）
    - 点击时清除会话并跳转到登录页（重置到未登录状态）
    - _Requirements: 5.4, 5.7_

  - [x] 5.3 实现"注销账号"按钮
    - 使用红色边框和文字（`border-red-300 text-red-600`）
    - 点击时显示确认对话框
    - 确认后调用 `accountService.cancelAccount()` 并清除会话
    - 操作进行中时按钮禁用并显示加载状态
    - _Requirements: 5.5, 5.6, 5.8, 5.9_

- [x] 6. 完善主内容区顶部 Header
  - [x] 6.1 实现 Header 区域的完整渲染
    - 浅蓝色背景（`bg-blue-50/80`）
    - 面包屑显示当前 section 标签，使用大写紫色文字
    - 标题使用大号粗体文字，描述文字在标题下方
    - 右上角显示 `Account_Workspace_Badge`（含 Sparkles 图标和"账号工作台"文字）
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 7. 完善创建/加入房间主卡片（Room Workspace Card）
  - [x] 7.1 确认 `DashboardCard` 组件的样式符合规范
    - 圆角（`rounded-[30px]`）、边框、阴影
    - eyebrow 标签使用大写紫色文字（`text-purple-700`）
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 7.2 实现 Tab 切换器样式
    - 选中 tab：白色背景 + 阴影（`bg-white shadow-sm`）
    - 未选中 tab：透明背景 + 静音文字颜色
    - "创建房间" tab 默认选中
    - _Requirements: 7.5, 7.6, 7.7, 7.8, 7.9_

- [x] 8. 完善创建房间表单（Create Room Form）
  - [x] 8.1 实现表单字段的完整渲染
    - "讨论主题"文本输入，placeholder 为"例如：AI 如何改变工程协作"
    - "房间模式"下拉选择，选项为"线下协作"（ONSITE）和"远程协作"（REMOTE），默认"线下协作"
    - "人数上限"数字输入，默认 8，最小 2，最大 20
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

  - [x] 8.2 实现创建房间的提交逻辑
    - 提交按钮标签"创建并进入房间"，紫色背景
    - 未填写主题时显示错误"请输入讨论主题"
    - 调用 `roomService.createRoom()` 并在成功后导航到 `/room/:code/lobby`
    - 失败时在表单下方显示错误消息
    - 提交中按钮禁用并显示"处理中..."
    - _Requirements: 8.10, 8.11, 8.12, 8.13, 8.14, 8.15, 8.16_

- [x] 9. 完善加入房间表单（Join Room Form）
  - [x] 9.1 实现表单字段的完整渲染
    - "房间码"文本输入，placeholder 为"输入 6 位房间码"
    - 输入自动转大写（`toUpperCase()`）
    - 最大长度限制为 6 个字符（`maxLength={6}`）
    - 使用等宽字体和字间距（`font-mono tracking-widest` 或等效样式）
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 9.2 实现加入房间的提交逻辑
    - 提交按钮标签"加入并继续讨论"，紫色背景
    - 未填写房间码时显示错误"请输入房间码"
    - 调用 `roomService.joinRoom()` 并根据房间阶段导航到对应页面（使用 `resolveRoomPathFromPhase`）
    - 失败时在表单下方显示错误消息
    - 提交中按钮禁用并显示"处理中..."
    - _Requirements: 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13_

- [x] 10. 完善表单样式与交互反馈
  - [x] 10.1 统一表单输入框样式
    - 圆角 16px（`rounded-2xl`）
    - 默认状态：浅蓝色背景（`bg-blue-50/50`）
    - 聚焦状态：边框变紫色（`focus:border-purple-400`）、背景变白（`focus:bg-white`）、紫色光晕（`focus:ring-2 focus:ring-purple-100`）
    - 标签使用中等字重（`font-medium`）显示在输入框上方
    - 字段间距 16px（`gap-4`）
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 10.2 实现错误消息的显示与清除
    - 错误消息容器：圆角、红色边框（`border-rose-200`）和背景（`bg-rose-50`）
    - 用户修改表单输入时自动清除错误消息（在 `updateRoomForm` 中调用 `setRoomError('')`）
    - 按钮添加 hover 过渡效果（`transition hover:bg-purple-700`）
    - _Requirements: 10.8, 10.9, 10.10_

- [x] 11. 实现数据同步与状态管理
  - [x] 11.1 实现页面加载时的数据初始化
    - 页面挂载时调用 `refreshAccountData()`（通过 `useEffect`）
    - 同时获取账号概览（`accountService.getOverview()`）和 AI 设置（`accountService.getAiSettings()`）
    - 成功后更新 Sidebar 中的用户信息和房间统计
    - 失败时清除会话并重定向到登录状态
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 11.2 确认 Zustand store 的状态管理
    - `useUserStore` 存储用户信息，`useRoomStore` 存储当前房间
    - 认证 token 持久化到 `localStorage`（`authTokenStorageKey`）
    - 创建或加入房间成功后调用 `setRoom()` 更新 room store
    - API 错误统一提取 `error?.response?.data?.message` 并显示友好提示
    - _Requirements: 13.7, 13.8, 13.9, 13.10_

- [x] 12. Checkpoint - 确保核心功能完整
  - 确保所有测试通过，如有疑问请向用户确认。

- [x] 13. 响应式设计与颜色主题收尾
  - [x] 13.1 验证响应式布局
    - 桌面端（≥ 1024px）保持双栏布局
    - 表单字段在小屏幕上使用单列布局（`lg:grid-cols-2` 降级为单列）
    - 确保所有文字在不同屏幕尺寸下可读
    - 使用 Tailwind CSS 响应式工具类
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 13.2 验证颜色主题一致性
    - 主操作色：`purple-600`
    - 背景色系：`blue-50` 到 `blue-950`
    - 页面背景：蓝紫色径向渐变
    - 内容卡片：白色/浅色背景
    - 毛玻璃效果：`backdrop-blur` + 半透明背景
    - 字体：Inter（通过 Tailwind 默认 sans-serif 或显式配置）
    - 交互元素：平滑过渡（`transition`）
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10_

  - [x] 13.3 为 `formatTime` 和 `resolveRoomPathFromPhase` 工具函数编写单元测试
    - `formatTime`：测试有效日期格式化、null 返回"暂无"
    - `resolveRoomPathFromPhase`：测试各阶段（ICEBREAK、DISCUSS、REVIEW、默认）返回正确路径
    - _Requirements: 13.1_

- [x] 14. Final Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有疑问请向用户确认。

## Notes

- 标有 `*` 的子任务为可选项，可在 MVP 阶段跳过
- `HomeWorkspacePage.tsx` 已有大量实现，各任务以"校验并补全"为主，避免重复实现
- 每个任务引用了具体的需求条款以保证可追溯性
- 工具函数（`getInitials`、`formatTime`、`resolveRoomPathFromPhase`）已在页面文件中定义，可提取到 `frontend/src/utils/` 目录以便测试
