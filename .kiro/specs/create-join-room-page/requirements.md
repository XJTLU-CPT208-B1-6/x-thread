# Requirements Document

## Introduction

本文档定义了「创建/加入房间」页面的功能需求。该页面是 X-Thread 协作平台的核心入口，用户登录后可以通过该页面创建新的讨论房间或加入现有房间。页面采用现代 B 端工作台设计风格，使用紫色作为主色调，提供简洁专业的用户体验。

## Glossary

- **Frontend_Application**: X-Thread 前端应用，基于 React + TypeScript + Tailwind CSS 构建
- **Sidebar**: 左侧固定导航栏，包含用户信息、导航菜单和状态信息
- **Main_Content_Area**: 右侧主内容区域，显示当前选中功能的详细内容
- **Room_Workspace_Card**: 创建/加入房间的主功能卡片
- **Create_Room_Form**: 创建房间表单，包含讨论主题、房间模式、人数上限等字段
- **Join_Room_Form**: 加入房间表单，包含房间码输入字段
- **Navigation_Item**: 侧边栏中的导航项，可点击切换不同功能区域
- **AI_Status_Module**: 显示 AI 配置状态和房间统计信息的模块
- **User_Avatar_Section**: 用户头像区域，显示头像、用户名、邮箱和上传按钮
- **Tab_Switcher**: 选项卡切换器，用于在「创建房间」和「加入房间」之间切换
- **Breadcrumb**: 面包屑导航，显示当前页面位置
- **Account_Workspace_Badge**: 右上角的「账号工作台」标识

## Requirements

### Requirement 1: 页面整体布局

**User Story:** 作为用户，我希望页面采用左右分栏布局，左侧是固定导航栏，右侧是主内容区，以便清晰地组织功能和内容。

#### Acceptance Criteria

1. THE Frontend_Application SHALL render a two-column layout with a fixed Sidebar on the left and Main_Content_Area on the right
2. THE Sidebar SHALL have a fixed width of 320px and SHALL NOT scroll with the main content
3. THE Main_Content_Area SHALL occupy the remaining horizontal space and SHALL support vertical scrolling
4. THE Frontend_Application SHALL apply a radial gradient background with blue and purple tones
5. THE Frontend_Application SHALL use rounded corners (32px border-radius) for both Sidebar and Main_Content_Area containers
6. THE Frontend_Application SHALL apply soft shadows to create depth and visual hierarchy

### Requirement 2: 左侧导航栏用户信息区域

**User Story:** 作为用户，我希望在侧边栏顶部看到我的头像、用户名和邮箱，并能上传或移除头像，以便管理我的个人信息。

#### Acceptance Criteria

1. THE User_Avatar_Section SHALL display the user's avatar image if available
2. WHERE no avatar is uploaded, THE User_Avatar_Section SHALL display initials derived from the user's name on a gradient background
3. THE User_Avatar_Section SHALL display the user's name in bold text below the avatar
4. THE User_Avatar_Section SHALL display the user's account identifier below the name
5. WHERE the user has an email, THE User_Avatar_Section SHALL display it below the account identifier
6. THE User_Avatar_Section SHALL include an "上传头像" button that opens a file picker
7. WHERE an avatar exists, THE User_Avatar_Section SHALL include a "移除头像" button
8. WHEN the user uploads an avatar, THE Frontend_Application SHALL validate that the file is an image format
9. WHEN the user uploads an avatar, THE Frontend_Application SHALL validate that the file size is under 450KB
10. WHEN avatar upload or removal is in progress, THE User_Avatar_Section SHALL display a loading indicator

### Requirement 3: 左侧导航栏核心功能导航

**User Story:** 作为用户，我希望通过侧边栏导航菜单快速切换不同功能区域，并能看到当前选中的项，以便高效地访问各个功能。

#### Acceptance Criteria

1. THE Sidebar SHALL display four Navigation_Items: "创建 / 加入房间", "AI 设置", "正在参与的房间", "14 天内的房间"
2. WHEN a Navigation_Item is selected, THE Frontend_Application SHALL highlight it with a purple background and white text
3. WHEN a Navigation_Item is not selected, THE Frontend_Application SHALL display it with a light blue background and dark text
4. THE Navigation_Item for "创建 / 加入房间" SHALL be selected by default when the page loads
5. THE Navigation_Items for "正在参与的房间" and "14 天内的房间" SHALL display a count badge showing the number of rooms
6. WHEN a Navigation_Item is clicked, THE Frontend_Application SHALL update the Main_Content_Area to display the corresponding content
7. THE Navigation_Item SHALL include an icon on the left and label text on the right
8. WHEN the user hovers over an unselected Navigation_Item, THE Frontend_Application SHALL apply a hover effect

### Requirement 4: 左侧导航栏 AI 状态模块

**User Story:** 作为用户，我希望在侧边栏看到 AI 配置状态和房间统计信息，以便了解当前系统状态。

#### Acceptance Criteria

1. THE AI_Status_Module SHALL display a section titled "AI Status"
2. WHERE the user has configured AI settings, THE AI_Status_Module SHALL display the provider and model name
3. WHERE the user has not configured AI settings, THE AI_Status_Module SHALL display "尚未保存账号级 AI 配置"
4. THE AI_Status_Module SHALL display an "Active" counter showing the number of active rooms
5. THE AI_Status_Module SHALL display a "History" counter showing the number of historical rooms
6. WHEN account data is being refreshed, THE AI_Status_Module SHALL display "..." for the counters
7. THE AI_Status_Module SHALL use a light blue background with rounded corners and border

### Requirement 5: 左侧导航栏操作按钮

**User Story:** 作为用户，我希望在侧边栏底部有刷新、退出登录和注销账号的按钮，以便管理我的会话和账号。

#### Acceptance Criteria

1. THE Sidebar SHALL display three action buttons at the bottom: "刷新工作台", "退出登录", "注销账号"
2. THE "刷新工作台" button SHALL include a refresh icon that rotates when data is being refreshed
3. WHEN the "刷新工作台" button is clicked, THE Frontend_Application SHALL fetch the latest account data
4. WHEN the "退出登录" button is clicked, THE Frontend_Application SHALL clear the user session and return to the login page
5. WHEN the "注销账号" button is clicked, THE Frontend_Application SHALL display a confirmation dialog
6. WHEN account cancellation is confirmed, THE Frontend_Application SHALL delete the account and clear the session
7. THE "退出登录" button SHALL use an amber background color
8. THE "注销账号" button SHALL use a red border and text color
9. WHEN an action is in progress, THE corresponding button SHALL be disabled and display a loading state

### Requirement 6: 主内容区顶部导航

**User Story:** 作为用户，我希望在主内容区顶部看到面包屑导航和当前功能的标题描述，以便了解当前所在位置。

#### Acceptance Criteria

1. THE Main_Content_Area SHALL display a header section with a light blue background
2. THE header SHALL display a Breadcrumb showing the current section label in uppercase purple text
3. THE header SHALL display the section title in large bold text
4. THE header SHALL display a description text below the title
5. THE header SHALL display an Account_Workspace_Badge in the top-right corner
6. THE Account_Workspace_Badge SHALL include a sparkles icon and the text "账号工作台"
7. THE header SHALL use consistent typography and spacing with the design system

### Requirement 7: 创建/加入房间主卡片

**User Story:** 作为用户，我希望在主内容区看到一个卡片，包含创建房间和加入房间两个选项卡，以便选择我要执行的操作。

#### Acceptance Criteria

1. THE Room_Workspace_Card SHALL display a card with rounded corners, border, and shadow
2. THE Room_Workspace_Card SHALL display an eyebrow label "Room Workspace" in uppercase purple text
3. THE Room_Workspace_Card SHALL display a title "创建或加入房间"
4. THE Room_Workspace_Card SHALL display a description "登录后你可以直接继续现有讨论，也可以发起一个新的房间。"
5. THE Room_Workspace_Card SHALL include a Tab_Switcher with two tabs: "创建房间" and "加入房间"
6. THE "创建房间" tab SHALL be selected by default
7. WHEN a tab is clicked, THE Frontend_Application SHALL switch the displayed form
8. THE selected tab SHALL have a white background and shadow
9. THE unselected tab SHALL have a transparent background and muted text color

### Requirement 8: 创建房间表单

**User Story:** 作为用户，我希望填写讨论主题、选择房间模式和设置人数上限来创建房间，以便发起新的协作讨论。

#### Acceptance Criteria

1. WHEN the "创建房间" tab is selected, THE Room_Workspace_Card SHALL display the Create_Room_Form
2. THE Create_Room_Form SHALL include a "讨论主题" text input field
3. THE "讨论主题" input SHALL display placeholder text "例如：AI 如何改变工程协作"
4. THE Create_Room_Form SHALL include a "房间模式" dropdown select field
5. THE "房间模式" dropdown SHALL offer two options: "线下协作" (ONSITE) and "远程协作" (REMOTE)
6. THE "房间模式" dropdown SHALL default to "线下协作"
7. THE Create_Room_Form SHALL include a "人数上限" number input field
8. THE "人数上限" input SHALL default to 8
9. THE "人数上限" input SHALL enforce a minimum value of 2 and maximum value of 20
10. THE Create_Room_Form SHALL include a submit button labeled "创建并进入房间"
11. THE submit button SHALL use a purple background color
12. WHEN the submit button is clicked without a topic, THE Frontend_Application SHALL display an error message "请输入讨论主题"
13. WHEN the submit button is clicked with valid data, THE Frontend_Application SHALL call the room creation API
14. WHEN room creation succeeds, THE Frontend_Application SHALL navigate to the room lobby page
15. WHEN room creation fails, THE Frontend_Application SHALL display an error message below the form
16. WHEN room creation is in progress, THE submit button SHALL be disabled and display "处理中..."

### Requirement 9: 加入房间表单

**User Story:** 作为用户，我希望输入房间码来快速加入现有房间，以便参与他人创建的讨论。

#### Acceptance Criteria

1. WHEN the "加入房间" tab is selected, THE Room_Workspace_Card SHALL display the Join_Room_Form
2. THE Join_Room_Form SHALL include a "房间码" text input field
3. THE "房间码" input SHALL display placeholder text "输入 6 位房间码"
4. THE "房间码" input SHALL automatically convert input to uppercase
5. THE "房间码" input SHALL limit input to 6 characters maximum
6. THE "房间码" input SHALL use monospace font with letter-spacing for better readability
7. THE Join_Room_Form SHALL include a submit button labeled "加入并继续讨论"
8. THE submit button SHALL use a purple background color
9. WHEN the submit button is clicked without a room code, THE Frontend_Application SHALL display an error message "请输入房间码"
10. WHEN the submit button is clicked with a valid code, THE Frontend_Application SHALL call the room join API
11. WHEN room join succeeds, THE Frontend_Application SHALL navigate to the appropriate room phase page
12. WHEN room join fails, THE Frontend_Application SHALL display an error message below the form
13. WHEN room join is in progress, THE submit button SHALL be disabled and display "处理中..."

### Requirement 10: 表单样式和交互

**User Story:** 作为用户，我希望表单输入框和按钮有清晰的视觉反馈，以便知道我的操作状态。

#### Acceptance Criteria

1. THE Frontend_Application SHALL apply rounded corners (16px border-radius) to all form inputs and buttons
2. THE Frontend_Application SHALL use a light blue background for form inputs in their default state
3. WHEN a form input receives focus, THE Frontend_Application SHALL change the border color to purple
4. WHEN a form input receives focus, THE Frontend_Application SHALL apply a purple ring shadow
5. WHEN a form input receives focus, THE Frontend_Application SHALL change the background to white
6. THE Frontend_Application SHALL display form labels in medium-weight font above each input
7. THE Frontend_Application SHALL use consistent spacing (16px gap) between form fields
8. WHEN an error message is displayed, THE Frontend_Application SHALL show it in a rounded container with red border and background
9. THE Frontend_Application SHALL clear error messages when the user modifies form input
10. THE Frontend_Application SHALL apply hover effects to buttons with smooth transitions

### Requirement 11: 响应式设计

**User Story:** 作为用户，我希望页面在不同屏幕尺寸下都能正常显示，以便在各种设备上使用。

#### Acceptance Criteria

1. THE Frontend_Application SHALL maintain the two-column layout on desktop screens (width >= 1024px)
2. THE Frontend_Application SHALL ensure the Sidebar remains visible and functional at all supported screen sizes
3. THE Frontend_Application SHALL apply responsive grid layouts to form fields on smaller screens
4. THE Frontend_Application SHALL ensure all text remains readable at different screen sizes
5. THE Frontend_Application SHALL ensure all interactive elements remain accessible and clickable
6. THE Frontend_Application SHALL use Tailwind CSS responsive utilities for breakpoint-based styling

### Requirement 12: 颜色主题和视觉风格

**User Story:** 作为用户，我希望页面使用一致的紫色主题和现代设计风格，以便获得专业的视觉体验。

#### Acceptance Criteria

1. THE Frontend_Application SHALL use purple (purple-600) as the primary action color for buttons and highlights
2. THE Frontend_Application SHALL use blue tones (blue-50 to blue-950) for backgrounds, text, and borders
3. THE Frontend_Application SHALL apply radial gradients with blue and purple tones to the page background
4. THE Frontend_Application SHALL use rounded corners consistently throughout the interface
5. THE Frontend_Application SHALL apply soft shadows to create depth and visual hierarchy
6. THE Frontend_Application SHALL use white and light backgrounds for content cards
7. THE Frontend_Application SHALL use semi-transparent backgrounds with backdrop blur for glassmorphism effects
8. THE Frontend_Application SHALL maintain sufficient contrast ratios for accessibility
9. THE Frontend_Application SHALL use consistent typography with the Inter font family
10. THE Frontend_Application SHALL apply smooth transitions to interactive elements

### Requirement 13: 数据同步和状态管理

**User Story:** 作为用户，我希望页面能自动同步我的账号数据和房间列表，以便看到最新的信息。

#### Acceptance Criteria

1. WHEN the page loads, THE Frontend_Application SHALL fetch the user's account overview data
2. WHEN the page loads, THE Frontend_Application SHALL fetch the user's AI settings
3. WHEN account data is fetched successfully, THE Frontend_Application SHALL update the Sidebar with the latest information
4. WHEN account data fetch fails, THE Frontend_Application SHALL clear the session and redirect to login
5. WHEN the user clicks "刷新工作台", THE Frontend_Application SHALL re-fetch all account data
6. WHEN data is being fetched, THE Frontend_Application SHALL display loading indicators
7. THE Frontend_Application SHALL store user data in Zustand stores for state management
8. THE Frontend_Application SHALL persist authentication tokens in local storage
9. WHEN the user creates or joins a room, THE Frontend_Application SHALL update the room store
10. THE Frontend_Application SHALL handle API errors gracefully and display user-friendly error messages
