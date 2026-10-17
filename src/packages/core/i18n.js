/**
 * Startup UI language selection.
 *
 * The display language is chosen once per launch from the browser language:
 * Chinese browsers (zh-*) get the Chinese UI, everything else gets English.
 * There is deliberately no settings entry for this. Help text and document
 * content are not translated yet; the translator below only rewrites UI
 * strings rendered into the DOM (and skips help/document/content regions).
 */
export function detectLanguage(input) {
    return String(input || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

const browserLanguage = typeof navigator !== 'undefined'
    ? (Array.isArray(navigator.languages) && navigator.languages[0]) || navigator.language || 'en'
    : 'en';
export const uiLang = detectLanguage(browserLanguage);
export const uiLocale = uiLang === 'zh' ? 'zh-CN' : browserLanguage || 'en-US';

const ZH = {
    // Shell, taskbar, boot, start menu
    'Start': '开始', 'Tap to start': '点击开始', 'Windows 95 desktop': 'Windows 95 桌面',
    'Programs': '程序', 'Documents': '文档', 'Settings': '设置', 'Find': '查找', 'Help': '帮助',
    'Run': '运行', 'Run…': '运行…', 'Shut Down…': '关闭系统…', 'Shut Down Windows': '关闭 Windows',
    'Shut down the computer?': '关闭计算机？', 'Restart the computer?': '重新启动计算机？',
    'Restart the computer in MS-DOS mode?': '重新启动计算机并进入 MS-DOS 模式？',
    'It is now safe to turn off your computer.': '现在可以安全地关闭计算机了。',
    'Turn on computer': '打开计算机', 'Close Program': '关闭程序',
    'Running programs': '正在运行的程序', 'Select the program you want to close.': '选择要关闭的程序。',
    'End Task': '结束任务', 'Taskbar Properties': '任务栏属性', 'Taskbar options': '任务栏选项',
    'Always on top': '总在最前', 'Show clock': '显示时钟', 'Clear Documents': '清除文档记录',
    'Address Book': '通讯簿', 'New Contact': '新建联系人', 'Email address:': '电子邮件地址：',
    'Adjust Date/Time': '调整日期/时间', 'Cascade': '层叠窗口', 'Tile Horizontally': '横向平铺窗口',
    'Tile Vertically': '纵向平铺窗口', 'Minimize All Windows': '最小化所有窗口',
    'Volume': '音量', 'Date and time': '日期和时间', 'Local time': '本地时间',
    'Arrange Icons': '排列图标', 'by Name': '按名称', 'by Type': '按类型', 'by Size': '按大小',
    'Auto Arrange': '自动排列', 'Line Up Icons': '对齐图标', 'New': '新建', 'Folder': '文件夹',
    'Shortcut…': '快捷方式…', 'Create Shortcut': '创建快捷方式', 'Command line:': '命令行：',
    'Select a name for the shortcut:': '为快捷方式选择一个名称：', 'Text Document': '文本文档',
    '(Empty)': '（空）', 'Files or Folders…': '文件或文件夹…', 'Computer…': '计算机…', 'Taskbar…': '任务栏…',
    'Empty Recycle Bin': '清空回收站',
    'Are you sure you want to permanently delete all items in the Recycle Bin?': '确实要永久删除回收站中的所有项目吗？',
    'The browser could not save your virtual drive. Export a backup to keep a copy of your files.': '浏览器无法保存您的虚拟驱动器。请导出备份以保留文件副本。',
    'Storage Full': '存储空间已满',
    // Common controls and dialogs
    'OK': '确定', 'Yes': '是', 'No': '否', 'Cancel': '取消', 'Close': '关闭', 'Open': '打开',
    'Save': '保存', 'Apply': '应用', 'Print': '打印', 'Help Topics': '帮助主题', 'About': '关于',
    'Properties': '属性', 'Rename': '重命名', 'Refresh': '刷新', 'Delete': '删除', 'Explore': '浏览',
    'General': '常规', 'File Folder': '文件夹', 'Read-only': '只读', 'Type a new name:': '键入新名称：',
    'Confirm File Delete': '确认删除文件', 'New Folder': '新建文件夹', 'New Text Document': '新建文本文档',
    'This file is larger than the 16 MB import limit.': '此文件超过 16 MB 的导入限制。',
    'Import': '导入', 'Up One Level': '向上一级', 'Up one level': '向上一级',
    'Large Icons': '大图标', 'Small Icons': '小图标', 'List': '列表', 'Details': '详细资料',
    'Entire Network': '整个网络', 'Name': '名称', 'Size': '大小', 'Type': '类型', 'Modified': '修改时间',
    'Restore': '还原', 'This folder is empty.': '此文件夹为空。', 'Invert Selection': '反向选择',
    'Folders': '文件夹', 'Options…': '选项…', 'Import File…': '导入文件…', 'Export File…': '导出文件…',
    'Create new folder': '新建文件夹', 'File name': '文件名', 'File name:': '文件名：',
    'Files of type': '文件类型', 'Files of type:': '文件类型：', 'Look in': '查找范围', 'Look in:': '查找范围：',
    'New folder name:': '新文件夹名称：', 'Save As': '另存为', 'Save in:': '保存在：',
    'All Files (*.*)': '所有文件 (*.*)',
    'This file could not be found. Check the file name and try again.': '找不到此文件。请检查文件名后重试。',
    'Minimize': '最小化', 'Maximize': '最大化', 'Move': '移动', 'Untitled': '无标题', 'Window menu': '窗口菜单',
    // Application names
    'My Computer': '我的电脑', 'My Documents': '我的文档', 'Recycle Bin': '回收站',
    'Network Neighborhood': '网上邻居', 'Notepad': '记事本', 'WordPad': '写字板', 'Paint': '画图',
    'Calculator': '计算器', 'Character Map': '字符映射表', 'Clipboard Viewer': '剪贴板查看器',
    'Minesweeper': '扫雷', 'Solitaire': '纸牌', 'FreeCell': '空当接龙', 'Hearts': '红桃大战',
    'Control Panel': '控制面板', 'Display': '显示', 'Date/Time': '日期/时间', 'System': '系统',
    'Find Files or Folders': '查找文件或文件夹', 'Windows Help': 'Windows 帮助',
    'MS-DOS Prompt': 'MS-DOS 提示符', 'Registry Editor': '注册表编辑器', 'System Monitor': '系统监视器',
    'ScanDisk': '磁盘扫描程序', 'Disk Defragmenter': '磁盘碎片整理程序', 'Backup': '备份',
    'Microsoft Backup': 'Microsoft 备份', 'My Briefcase': '我的公文包', 'Media Player': '媒体播放机',
    'CD Player': 'CD 播放机', 'Volume Control': '音量控制', 'Sound Recorder': '录音机',
    'Windows Explorer': '资源管理器', 'Inbox': '收件箱', 'Welcome to Windows 95': '欢迎使用 Windows 95',
    'Desktop': '桌面', 'Files': '文件', 'Dial-Up Networking': '拨号网络', '3½ Floppy (A:)': '3.5 英寸软盘 (A:)',
    // Menus shared by applications
    'File': '文件', 'Edit': '编辑', 'View': '查看', 'Search': '搜索', 'Format': '格式', 'Insert': '插入',
    'Image': '图像', 'Colors': '颜色', 'Device': '设备', 'Options': '选项', 'Game': '游戏',
    'Open…': '打开…', 'Save As…': '另存为…', 'Exit': '退出', 'Undo': '撤销', 'Redo': '重做',
    'Cut': '剪切', 'Copy': '复制', 'Paste': '粘贴', 'Select All': '全选',
    'Find…': '查找…', 'Find Next': '查找下一个', 'Replace…': '替换…', 'Replace': '替换',
    'Time/Date': '时间/日期', 'Word Wrap': '自动换行', 'Font…': '字体…', 'Toolbar': '工具栏',
    'Format Bar': '格式栏', 'Print…': '打印…', 'Page Setup…': '页面设置…', 'Page Setup': '页面设置',
    'About Notepad': '关于记事本', 'About WordPad': '关于写字板', 'About Paint': '关于画图',
    'About Calculator': '关于计算器', 'About Media Player': '关于媒体播放机',
    'About Volume Control': '关于音量控制', 'About Sound Recorder': '关于录音机',
    'About Internet Explorer': '关于 Internet Explorer', 'About Microsoft Exchange': '关于 Microsoft Exchange',
    'About Windows 95': '关于 Windows 95', 'About Help': '关于帮助',
    'About Registry Editor': '关于注册表编辑器', 'About System Monitor': '关于系统监视器',
    'About Minesweeper': '关于扫雷', 'Cannot Run Program': '无法运行程序',
    'Native Windows and DOS binaries require a machine emulator. This desktop runs its built-in JavaScript applications.': '原生 Windows 和 DOS 二进制文件需要机器模拟器。此桌面运行其内置的 JavaScript 应用程序。',
    'The file could not be found:': '找不到此文件：',
    // Welcome and About
    'Windows 95 desktop recreation': 'Windows 95 桌面复刻', 'Version 1.0.0': '版本 1.0.0',
    'Registered to:': '授权给：', 'Windows User': 'Windows 用户', 'System Info…': '系统信息…',
    'Where do you want': '今天您想去', 'to go': '', 'today?': '哪里？',
    'Welcome to Windows 95. There’s a whole new world waiting on your desktop.': '欢迎使用 Windows 95。一个全新的世界正在您的桌面上等待着您。',
    'Explore Windows': '探索 Windows', 'Open My Documents': '打开我的文档',
    'Take a tour of Windows': '漫游 Windows', 'Open your documents': '打开您的文档',
    'Show this next time': '下次显示此窗口',
    'Type the name of a program, folder, or document, and Windows will open it for you.': '键入程序、文件夹或文档的名称，Windows 会为您打开它。',
    'Browse…': '浏览…',
    // Notepad, WordPad, Calculator
    'Untitled - Notepad': '无标题 - 记事本', 'Notepad document': '记事本文档',
    'Text Documents (*.txt)': '文本文档 (*.txt)', 'Find what:': '查找内容：', 'Replace with:': '替换为：',
    'Paper: A4 Margins: 20 mm  Choose a printer and adjust paper options in the print dialog.': '纸张：A4 页边距：20 毫米  在打印对话框中选择打印机并调整纸张选项。',
    'Import from computer…': '从计算机导入…', 'Export…': '导出…', 'For Help, press F1': '按 F1 获得帮助',
    'WordPad has finished searching the document.': '写字板已完成对文档的搜索。',
    'Document - WordPad': '文档 - 写字板', 'WordPad document': '写字板文档',
    'Rich Text Format (*.rtf)': 'RTF 格式 (*.rtf)', 'Rich Text Documents (*.rtf)': 'RTF 文档 (*.rtf)',
    'Font family': '字体', 'Font size': '字号', 'Bold': '粗体', 'Italic': '斜体', 'Underline': '下划线',
    'Align left': '左对齐', 'Center': '居中', 'Align right': '右对齐', 'Bullet list': '项目符号列表',
    'Text color': '文本颜色', 'Export as RTF…': '导出为 RTF…', 'Export as HTML…': '导出为 HTML…',
    'Date and Time…': '日期和时间…', 'Picture…': '图片…',
    'Use Paint to work with pictures. Rich documents currently contain formatted text.': '使用“画图”处理图片。富文本文档目前包含带格式的文本。',
    'Bullet Style': '项目符号样式', 'Paragraph': '段落', 'Left': '左', 'Right': '右',
    'Indent': '增加缩进', 'Outdent': '减少缩进', 'Calculator display': '计算器显示屏',
    'Error': '错误', 'Back': '后退', 'Standard': '标准型', 'Scientific': '科学型',
    'Degrees': '角度', 'Radians': '弧度',
    // Control Panel
    'Sounds': '声音', 'Keyboard': '键盘', 'Mouse': '鼠标', 'Regional Settings': '区域设置',
    'Fonts': '字体', 'Printers': '打印机', 'Network': '网络', 'Add/Remove Programs': '添加/删除程序',
    'Accessibility Options': '辅助功能选项', 'Multimedia': '多媒体', 'Passwords': '密码',
    'Modems': '调制解调器', 'Joystick': '游戏控制器', 'Add New Hardware': '添加新硬件', 'Power': '电源',
    'Display Properties': '显示属性', 'Background': '背景', 'Wallpaper': '墙纸',
    'Bricks': '砖墙', 'Clouds': '云', 'Tiles': '瓷砖', 'Weave': '编织', 'None': '无',
    'Desktop color': '桌面颜色', 'Screen Saver': '屏幕保护程序', 'Screen saver': '屏幕保护程序',
    'Starfield': '星空', 'Marquee': '滚动字幕', 'Mystify': '变幻线', 'Wait minutes': '等待分钟数',
    'Screen Saver:': '屏幕保护程序：', 'Preview': '预览', 'Settings…': '设置…',
    'Wait (minutes):': '等待（分钟）：',
    'Set the wait time to 0 to turn off the automatic screen saver.': '将等待时间设为 0 可关闭自动屏幕保护程序。',
    'Appearance': '外观', 'Color scheme': '配色方案', 'Scheme:': '方案：',
    'Windows Standard': 'Windows 标准', 'Desert': '沙漠', 'Marine': '海洋', 'Plum': '紫红',
    'High Contrast Black': '高对比度黑', 'High Contrast White': '高对比度白',
    'Choose the colors used for window titles, menus, and controls.': '选择窗口标题、菜单和控件使用的颜色。',
    'Item': '项目', 'Active Title Bar': '活动标题栏',
    'Windows Standard uses the original Windows 95 colors.': '“Windows 标准”使用原始的 Windows 95 颜色。',
    'Browser display adapter': '浏览器显示适配器', 'Desktop area': '桌面区域',
    'Graphics acceleration': '图形加速', 'Current renderer:': '当前渲染器：', 'Renderer': '渲染器',
    'Automatic': '自动', 'A change to the renderer takes effect after restarting.': '渲染器的更改将在重新启动后生效。',
    'Full Screen': '全屏', 'Preferred:': '首选：', 'Date/Time Properties': '日期/时间属性',
    'Date & Time': '日期和时间', 'Year': '年', 'Month': '月', 'Calendar': '日历', 'Time': '时间',
    'Changes apply to the clock on this desktop.': '更改将应用到此桌面的时钟。',
    'Time Zone': '时区', 'Time Zone:': '时区：', 'Time zone': '时区',
    'Choose how the taskbar clock displays the time.': '选择任务栏时钟显示时间的方式。',
    'System Properties': '系统属性', 'Browser-native desktop': '浏览器原生桌面',
    'File storage:': '文件存储：', 'Volume size:': '卷大小：',
    'Windows applications here run as JavaScript packages. Native Windows and DOS executable formats are not executed.': '此处的 Windows 应用程序以 JavaScript 包形式运行。不会执行原生的 Windows 和 DOS 可执行文件格式。',
    'Device Manager': '设备管理器', 'Computer': '计算机', 'Browser keyboard': '浏览器键盘',
    'Browser pointing device': '浏览器指针设备', 'Web Audio output': 'Web 音频输出',
    'Network — connected': '网络 — 已连接', 'Network — offline': '网络 — 未连接',
    'Performance': '性能', 'Open windows:': '打开的窗口：', 'Logical CPUs:': '逻辑处理器：',
    'Files and folders:': '文件和文件夹：', 'Virtual disk used:': '虚拟磁盘已用：',
    'Storage revision:': '存储修订号：', 'System Monitor…': '系统监视器…', 'Export Volume…': '导出卷…',
    'Buttons': '按钮', 'Customize your pointing device.': '自定义指针设备。',
    'Left-handed button configuration': '左手按钮配置', 'Double-click speed:': '双击速度：',
    'Motion': '移动', 'Pointer Trail': '鼠标轨迹', 'Show pointer trails': '显示鼠标轨迹', 'Short': '短', 'Long': '长',
    'Double-click to test': '双击此处测试', 'Folder opened': '文件夹已打开', 'Test area': '测试区域',
    'Pointers': '指针', 'Large': '大', 'Crosshair': '十字线', 'Speed': '速度',
    'Repeat delay:': '重复延迟：', 'Repeat rate:': '重复率：', 'Click here to test:': '单击此处测试：',
    'Keyboard test': '键盘测试',
    'Key repeat for browser text fields follows your computer’s keyboard settings.': '浏览器文本字段的按键重复遵循您计算机的键盘设置。',
    'Language': '语言', 'English (United States)': '英语（美国）', 'Samples': '示例',
    'Number:': '数字：', 'Date:': '日期：', 'Locale:': '区域：', 'Use 24-hour time': '使用 24 小时制',
    'Audio': '音频', 'Windows Default': 'Windows 默认', 'No Sounds': '无声',
    'Mute all sounds': '所有声音静音', 'Test': '测试', 'Volume Control…': '音量控制…',
    'Recording': '录制', 'Record sound through the microphone selected by your browser.': '通过浏览器选择的麦克风录制声音。',
    'Sound Recorder…': '录音机…', 'Use StickyKeys': '使用粘滞键', 'Use ToggleKeys': '使用切换键',
    'ToggleKeys plays a tone when Caps Lock changes.': '切换键会在 Caps Lock 状态变化时发出提示音。',
    'Use High Contrast': '使用高对比度', 'Sound': '声音', 'Show captions for system sounds': '为系统声音显示字幕',
    'Install/Uninstall': '安装/卸载',
    'Select a Windows component to show or hide it in the Start menu.': '选择要在“开始”菜单中显示或隐藏的 Windows 组件。',
    'Windows Setup': 'Windows 安装程序',
    'This desktop includes Accessories, Games, Communications, and System Tools.': '此桌面包含附件、游戏、通讯和系统工具。',
    'Show components': '显示组件', 'Configuration': '配置',
    'The following network components are available:': '以下网络组件可用：',
    'Browser Network Adapter': '浏览器网络适配器', 'TCP/IP — Browser HTTPS': 'TCP/IP — 浏览器 HTTPS',
    'Local virtual filesystem': '本地虚拟文件系统', 'Connection status: Online': '连接状态：联机',
    'Connection status: Offline': '连接状态：脱机', 'Identification': '标识', 'Computer name:': '计算机名：',
    'Workgroup:': '工作组：',
    'These names identify your local desktop. Browser networking uses the host computer’s connection.': '这些名称用于标识您的本地桌面。浏览器网络使用主机计算机的连接。',
    'User Profiles': '用户配置文件', 'User name:': '用户名：',
    'Documents and preferences belong to this browser profile.': '文档和首选项属于此浏览器配置文件。',
    'Privacy': '隐私',
    'Your virtual drive is stored in this browser. Export a backup before clearing browser storage.': '您的虚拟驱动器存储在此浏览器中。在清除浏览器存储之前，请导出备份。',
    'Back Up Files…': '备份文件…', 'Browser Print Service': '浏览器打印服务', 'Default printer': '默认打印机',
    'Use File → Print in Notepad or WordPad to choose a printer or save as PDF.': '使用记事本或写字板中的“文件 → 打印”选择打印机或另存为 PDF。',
    'Print Test Page': '打印测试页',
    'Font availability is provided by this browser and the Windows 95 desktop font package.': '字体可用性由此浏览器和 Windows 95 桌面字体包提供。',
    'No game controller detected. Connect a controller and press a button.': '未检测到游戏控制器。连接控制器并按一个按钮。',
    'Screen saver wait:': '屏幕保护等待：', 'Never': '从不', '1 minute': '1 分钟', '5 minutes': '5 分钟',
    '10 minutes': '10 分钟', '30 minutes': '30 分钟',
    'This is the same wait time as the Screen Saver tab in Display Properties; host sleep stays under your computer’s control.': '这与“显示属性”中的“屏幕保护程序”选项卡使用相同的等待时间；主机的睡眠仍由您的计算机控制。',
    'Browser hardware services': '浏览器硬件服务',
    'The desktop uses your browser’s display, keyboard, pointer, audio, and network connection.': '桌面使用您浏览器的显示器、键盘、指针、音频和网络连接。',
    'Serial modems and telephone calls require a physical device bridge, which is not installed.': '串行调制解调器和电话呼叫需要物理设备桥接，该桥接未安装。',
    'Native Windows drivers cannot be installed in this JavaScript environment.': '无法在此 JavaScript 环境中安装原生 Windows 驱动程序。',
    'Device Manager…': '设备管理器…', 'Display full path in the title bar': '在标题栏中显示完整路径',
    'Show all files': '显示所有文件', 'Show file extensions': '显示文件扩展名', 'Color:': '颜色：',
    // Multimedia, Internet, mail
    'Playback position': '播放位置', 'Ready': '就绪', 'Playing': '正在播放', 'Stopped': '已停止', 'Paused': '已暂停',
    'This media cannot be played. Choose an audio or video file supported by your browser.': '无法播放此媒体。请选择浏览器支持的音频或视频文件。',
    'Media files (*.wav, *.mp3, *.mp4, *.webm)': '媒体文件 (*.wav, *.mp3, *.mp4, *.webm)',
    'Play': '播放', 'Pause': '暂停', 'Stop': '停止', 'Rewind': '快退', 'Fast forward': '快进',
    'Eject': '弹出', 'Previous': '上一个', 'Next': '下一个', 'Start selection': '选择起点', 'End selection': '选择终点',
    'Scroll back': '向后滚动', 'Scroll forward': '向前滚动', 'Scale': '刻度', 'Seconds': '秒', 'Frames': '帧',
    'Play sample': '播放示例', 'Wave Audio': '波形音频', 'Video': '视频', 'CD Audio': 'CD 音频',
    'Repeat': '重复播放', 'Balance': '平衡', 'Balance:': '平衡：', 'Center': '中央',
    'Mute all': '全部静音', 'Mute': '静音', 'Position:': '位置：', 'Length:': '长度：',
    'The microphone could not be opened. Allow microphone access in your browser and try again.': '无法打开麦克风。请在浏览器中允许麦克风访问，然后重试。',
    'Record a sound first.': '请先录制声音。', 'Record': '录制', 'Go to end': '跳到末尾',
    'Audio Properties': '音频属性', 'Address': '地址', 'The Internet address is not valid.': 'Internet 地址无效。',
    'Browse your documents': '浏览您的文档', 'open it in a browser tab': '在浏览器标签页中打开',
    'If the website does not allow embedded viewing,': '如果网站不允许嵌入查看，',
    'Website': '网站', 'Done': '完成', 'Forward': '前进', 'Source': '源代码',
    'Favorites': '收藏夹', 'Add to Favorites…': '添加到收藏夹…', 'Go': '跳转',
    'HTML Files (*.htm, *.html)': 'HTML 文件 (*.htm, *.html)',
    'Inbox - Microsoft Exchange': '收件箱 - Microsoft Exchange', 'Outbox': '发件箱',
    'Sent Items': '已发送邮件', 'Deleted Items': '已删除邮件', 'Drafts': '草稿',
    'From:': '发件人：', 'To:': '收件人：', 'To': '收件人', 'Subject:': '主题：', 'Subject': '主题',
    'There are no items in this folder.': '此文件夹中没有项目。',
    'Untitled - Message': '无标题 - 邮件', 'Message body': '邮件正文', '(No subject)': '（无主题）',
    'The message is saved in the Outbox. A mail transport is required to deliver it.': '邮件已保存在发件箱中。需要邮件传输服务才能发送。',
    'Send': '发送', 'Save Draft': '保存草稿', 'Save this message in Drafts?': '将此邮件保存到草稿吗？',
    'New Message': '新邮件', 'Reply': '回复',
    // Paint
    'untitled - Paint': '无标题 - 画图', 'Paint drawing canvas': '画图绘图画布',
    'For Help, click Help Topics on the Help Menu.': '有关帮助，请单击“帮助”菜单上的“帮助主题”。',
    'PNG Image (*.png)': 'PNG 图像 (*.png)',
    'Images can be up to 4096 × 4096 pixels.': '图像最大可达 4096 × 4096 像素。',
    'Image Files (*.png, *.bmp, *.jpg)': '图像文件 (*.png, *.bmp, *.jpg)',
    'Paint cannot read this image. Try a PNG, BMP, JPEG, or GIF file.': '画图无法读取此图像。请尝试 PNG、BMP、JPEG 或 GIF 文件。',
    'Select a rectangular area of the picture.': '选择图片的矩形区域。',
    'Draws a free-form line one pixel wide.': '绘制一个像素宽的任意线条。',
    'Fills an area with the selected color.': '用所选颜色填充区域。',
    'Click the picture to insert text.': '单击图片以插入文本。',
    'Click to add points. Double-click to complete the polygon.': '单击以添加点。双击完成多边形。',
    'Drag a line, then click to set the curve.': '拖出一条直线，然后单击以设定曲线。',
    'Select': '选择', 'Free-form select': '任意形状选择', 'Eraser': '橡皮擦',
    'Fill with color': '用颜色填充', 'Pick color': '取色', 'Magnifier': '放大镜',
    'Pencil': '铅笔', 'Brush': '刷子', 'Airbrush': '喷枪', 'Text': '文字', 'Line': '直线',
    'Curve': '曲线', 'Rectangle': '矩形', 'Polygon': '多边形', 'Ellipse': '椭圆',
    'Rounded rectangle': '圆角矩形', 'Filled shapes': '填充形状', 'Color': '颜色',
    'Edit colors': '编辑颜色', 'Custom color': '自定义颜色',
    'Width × height (pixels):': '宽度 × 高度（像素）：', 'Attributes': '属性',
    'Enter a width and height between 1 and 4096.': '输入 1 到 4096 之间的宽度和高度。',
    'From File…': '来自文件…', 'Export PNG…': '导出 PNG…', 'Set As Wallpaper': '设为墙纸',
    'Clear Selection': '清除选择', 'The entire picture is selected.': '已选择整个图片。',
    'Tool Box': '工具箱', 'Color Box': '颜色框', 'Zoom': '缩放',
    'Flip Horizontal': '水平翻转', 'Flip Vertical': '垂直翻转', 'Rotate 90°': '旋转 90°',
    'Invert Colors': '反色', 'Attributes…': '属性…', 'Clear Image': '清除图像',
    'Edit Colors…': '编辑颜色…', 'Paint could not open this image.': '画图无法打开此图像。',
    // Utilities (help body text is intentionally not translated)
    'Find: All Files': '查找：所有文件', 'Named': '文件名', 'Containing text': '包含文字',
    'Containing text:': '包含文字：', 'Find Now': '开始查找', 'New Search': '新搜索',
    'Name & Location': '名称和位置', 'No files matched your search.': '没有找到符合搜索条件的文件。',
    'Enter the name of a file or folder to find.': '输入要查找的文件或文件夹的名称。',
    'Contents': '目录', 'Index': '索引', 'Search for:': '搜索：',
    'Find Help Topics': '查找帮助主题', 'No topics were found.': '未找到主题。',
    'Font': '字体', 'Characters to copy': '要复制的字符', 'Characters to copy:': '要复制的字符：',
    'Clipboard contents': '剪贴板内容', 'The Clipboard is empty.': '剪贴板为空。',
    'Value data:': '数值数据：', 'Edit String': '编辑字符串', 'Data': '数据',
    '(Default)': '（默认值）', 'Modify': '修改', 'Registry': '注册表',
    'Import Registry File…': '导入注册表文件…', 'Export Registry File…': '导出注册表文件…',
    'Key': '项', 'Key name:': '项名称：', 'New Key': '新建项', 'String Value': '字符串值',
    'Value name:': '值名称：', 'New Value': '新建值',
    'Finished searching through the registry.': '已完成对注册表的搜索。',
    'Clear History': '清除历史记录', 'Browser frame interval (milliseconds)': '浏览器帧间隔（毫秒）',
    'Select Start to check the virtual C: drive.': '选择“开始”以检查虚拟 C: 驱动器。',
    'Organizing the virtual directory…': '正在整理虚拟目录…', 'Checking files and folders…': '正在检查文件和文件夹…',
    'Virtual directory order optimized and saved.': '虚拟目录顺序已优化并保存。',
    'Drive (C:)': '驱动器 (C:)',
    'This map represents virtual files. Physical disk placement is managed by your browser.': '此图表示虚拟文件。物理磁盘位置由您的浏览器管理。',
    'Checks that each virtual file has a valid parent directory.': '检查每个虚拟文件是否具有有效的父目录。',
    'This is not a Windows 95 desktop backup.': '这不是 Windows 95 桌面备份。',
    'This backup has too many entries.': '此备份的条目过多。', 'Invalid backup entry.': '无效的备份条目。',
    'Invalid backup path.': '无效的备份路径。', 'The C: drive is missing.': '缺少 C: 驱动器。',
    'A parent directory is missing.': '缺少父目录。',
    'Replace the virtual drive with this backup? Open documents should be saved first.': '用此备份替换虚拟驱动器吗？应先保存打开的文档。',
    'Restore Backup': '还原备份', 'Restore': '还原',
    'Back up your files to a single archive on your computer.': '将文件备份到计算机上的单个存档中。',
    'Start Backup': '开始备份', 'Backup exported.': '备份已导出。', 'Restore…': '还原…',
    'Keep copies of files in My Briefcase. Use File → Export File to take a copy with you, or import a newer version from your computer.': '在“我的公文包”中保留文件的副本。使用“文件 → 导出文件”随身携带副本，或从计算机导入较新的版本。',
    // Games (rules/how-to bodies are help text and stay in English for now)
    'New game': '新游戏', 'Beginner': '初级', 'Intermediate': '中级', 'Expert': '高级',
    'Custom…': '自定义…', 'Rows, columns, mines:': '行数、列数、雷数：', 'Custom Field': '自定义雷区',
    'Use 8–24 rows, 8–30 columns, and fewer mines than squares.': '使用 8 到 24 行、8 到 30 列，且雷数少于方格数。',
    'Best Times…': '最佳时间…', 'Fastest Mine Sweepers': '最快扫雷者', 'Minesweeper board': '扫雷棋盘',
    'Congratulations!': '恭喜！', 'You won the game.': '您赢了。', 'Deal Again': '再发一局',
    'Hint': '提示', 'Select Game': '选择游戏', 'Game number (1–32000):': '游戏编号（1–32000）：',
    'New Game': '新游戏', 'Deal': '发牌', 'Select Game…': '选择游戏…', 'Restart Game': '重新开始游戏',
    'Draw One': '抽一张', 'Draw Three': '抽三张', 'Statistics…': '统计…', 'FreeCell Statistics': '空当接龙统计',
    'Game Over': '游戏结束', 'Hand Complete': '本局结束',
    'Scores have been added to the total.': '分数已计入总分。', 'Next Hand': '下一局',
    'Your turn. Choose a card to play.': '轮到您了。选择一张要出的牌。',
    'Game over.': '游戏结束。', 'Hand complete.': '本局结束。',
    'You': '您', 'West': '西家', 'North': '北家', 'East': '东家',
    'Face-down card': '面朝下的牌', 'Free cell': '空闲单元', 'Stock': '牌堆', 'Waste': '废牌堆',
    'Foundation': '回收堆', 'Tableau column': '纸牌列',
    'Hint: move the selected card to a foundation.': '提示：将所选牌移到回收堆。',
    // Remaining labels, fields and properties titles
    'Volume:': '音量：', 'Font:': '字体：', 'Named:': '名称：', 'Address:': '地址：', 'Home': '主页',
    'Wave': '波形', 'Open:': '打开：', 'Version:': '版本：', 'System:': '系统：', 'Computer:': '计算机：',
    'Graphics:': '图形：', 'Backspace': '退格', 'U+00A9 Copyright sign': 'U+00A9 版权符号',
    'Welcome to your Inbox': '欢迎使用收件箱', 'Windows 95 (D:)': 'Windows 95 (D:)',
    'Folder Options': '文件夹选项', 'Folder-options': '文件夹选项', 'Windows Chimes': 'Windows 钟声',
    'Sound - Sound Recorder': '声音 - 录音机', 'End': '末尾', 'How to Play': '游戏说明',
    'Import from Computer…': '从计算机导入…', 'Are you sure you want to:': '您确实要：',
    'No tableau or foundation move found. Try a free cell.': '未找到可移到纸牌列或回收堆的走法。试试空闲单元。',
    'Click the stock to draw another card.': '单击牌堆再抽一张牌。'
};

const SUITS = { Spades: '黑桃', Hearts: '红桃', Diamonds: '方块', Clubs: '梅花' };

/** Translates one rendered UI string (exact dictionary entries, then dynamic patterns). */
export function translateText(text, lang = uiLang) {
    if (lang !== 'zh' || typeof text !== 'string' || !text)
        return text;
    if (text.includes('\n'))
        return text.split('\n').map(line => translateText(line, lang)).join('\n');
    const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
    const core = match[2];
    if (!core)
        return text;
    let out = ZH[core];
    if (out === undefined)
        out = applyPatterns(core);
    return out === undefined ? text : match[1] + out + match[3];
}

function name(name) {
    return ZH[name] || name;
}

function applyPatterns(core) {
    let m;
    if ((m = /^(\d+) object\(s\)$/.exec(core))) return `${m[1]} 个对象`;
    if ((m = /^(\d+) object\(s\) selected\s+(.+)$/.exec(core))) return `已选 ${m[1]} 个对象    ${translateText(m[2], 'zh')}`;
    if ((m = /^(\d+) object\(s\) (.+)$/.exec(core))) return `${m[1]} 个对象 ${translateText(m[2], 'zh')}`;
    if ((m = /^(\d+) objects · (.+)$/.exec(core))) return `${m[1]} 个对象 · ${translateText(m[2], 'zh')}`;
    if ((m = /^(\d+) objects on the virtual volume$/.exec(core))) return `虚拟卷上有 ${m[1]} 个对象`;
    if ((m = /^(\d+) item\(s\)$/.exec(core))) return `${m[1]} 个项目`;
    if ((m = /^(\d+) cards$/.exec(core))) return `${m[1]} 张牌`;
    if ((m = /^(\d+) logical processors$/.exec(core))) return `${m[1]} 个逻辑处理器`;
    if ((m = /^([\d.]+) bytes$/.exec(core))) return `${m[1]} 字节`;
    if ((m = /^([\d.]+) minutes \(custom\)$/.exec(core))) return `${m[1]} 分钟（自定义）`;
    if ((m = /^(.+): (\d+) \(\+(\d+)\)$/.exec(core))) return `${name(m[1])}：${m[2]}（+${m[3]}）`;
    if ((m = /^Cannot find '(.+)'\. Make sure the name is correct and try again\.$/.exec(core))) return `找不到“${m[1]}”。请确认名称正确后重试。`;
    if ((m = /^Cannot find "(.+)"$/.exec(core))) return `找不到“${m[1]}”`;
    if ((m = /^Exploring - (.+)$/.exec(core))) return `正在浏览 - ${name(m[1])}`;
    if ((m = /^The text in the (.+) file has changed\.$/.exec(core))) return `“${m[1]}”文件中的文本已更改。`;
    if (/^Do you want to save the changes\?$/.test(core)) return '是否保存更改？';
    if ((m = /^Save changes to (.+)\??$/.exec(core))) return `保存对“${m[1]}”的更改？`;
    if ((m = /^Are you sure you want to (permanently delete|send to the Recycle Bin) (.+)\?$/.exec(core))) {
        const what = /^these (\d+) items$/.test(m[2]) ? `这 ${m[2].match(/\d+/)[0]} 个项目` : m[2];
        return m[1] === 'permanently delete' ? `确实要永久删除${what}吗？` : `确实要将${what}发送到回收站吗？`;
    }
    if ((m = /^Position: ([\d:.]+) sec\.$/.exec(core))) return `位置：${m[1]} 秒。`;
    if ((m = /^Length: ([\d:.]+) sec\.$/.exec(core))) return `长度：${m[1]} 秒。`;
    if ((m = /^Left (\d+)$/.exec(core))) return `左 ${m[1]}`;
    if ((m = /^Right (\d+)$/.exec(core))) return `右 ${m[1]}`;
    if ((m = /^Games won: (\d+)$/.exec(core))) return `获胜局数：${m[1]}`;
    if ((m = /^Score: (\d+)\s+Time: (\d+)\s+Moves: (\d+)$/.exec(core))) return `分数：${m[1]}    时间：${m[2]}    步数：${m[3]}`;
    if ((m = /^Game #(\d+)\s+Moves: (\d+)\s+Free cells: (\d+)$/.exec(core))) return `第 ${m[1]} 局    步数：${m[2]}    空闲单元：${m[3]}`;
    if ((m = /^FreeCell Game #(\d+)$/.exec(core))) return `空当接龙第 ${m[1]} 局`;
    if ((m = /^Hand (\d+)\s+Hearts (broken|not broken)\s+No-passing game$/.exec(core))) return `第 ${m[1]} 局    红桃${m[2] === 'broken' ? '已打破' : '未打破'}    不传牌`;
    if ((m = /^(.+) is thinking…$/.exec(core))) return `${name(m[1])} 正在思考…`;
    if ((m = /^Hint: move the selected card to column (\d+)\.$/.exec(core))) return `提示：将所选牌移到第 ${m[1]} 列。`;
    if ((m = /^Draw with the (.+) tool\.$/.exec(core))) return `使用${name(m[1])}工具绘图。`;
    if ((m = /^ScanDisk found no errors in (\d+) files and folders\.$/.exec(core))) return `磁盘扫描在 ${m[1]} 个文件和文件夹中未发现错误。`;
    if ((m = /^Restored (\d+) files and folders\.$/.exec(core))) return `已还原 ${m[1]} 个文件和文件夹。`;
    if ((m = /^Selected area: (.+) pixels\. Use Edit to copy or cut\.$/.exec(core))) return `选定区域：${m[1]} 像素。使用“编辑”进行复制或剪切。`;
    if ((m = /^Line width (\d+)$/.exec(core))) return `线宽 ${m[1]}`;
    if ((m = /^(.+) Properties$/.exec(core))) return `${name(m[1])} 属性`;
    if ((m = /^(.+) - (Media Player|CD Player)$/.exec(core))) return `${translateText(m[1], 'zh')} - ${name(m[2])}`;
    if ((m = /^(.+) - Sound Recorder$/.exec(core))) return `${translateText(m[1], 'zh')} - 录音机`;
    if ((m = /^Track (\d+) — (.+)$/.exec(core))) return `曲目 ${m[1]} — ${translateText(m[2], 'zh')}`;
    if ((m = /^Number: (.+)$/.exec(core))) return `数字：${m[1]}`;
    if ((m = /^Date: (.+)$/.exec(core))) return `日期：${m[1]}`;
    if ((m = /^Named: (.+)$/.exec(core))) return `名称：${m[1]}`;
    if ((m = /^Address: (.+)$/.exec(core))) return `地址：${m[1]}`;
    if ((m = /^Open: (.+)$/.exec(core))) return `打开：${m[1]}`;
    if ((m = /^Frame interval: (.+) ms\s+Windows: (\d+)\s+Volume: (.+)$/.exec(core))) return `帧间隔：${m[1]} 毫秒    窗口：${m[2]}    卷大小：${translateText(m[3], 'zh')}`;
    if ((m = /^(.+) balance$/.exec(core))) return `${name(m[1])} 平衡`;
    if ((m = /^(.+) volume$/.exec(core))) return `${name(m[1])} 音量`;
    if ((m = /^(.+) mute$/.exec(core))) return `${name(m[1])} 静音`;
    if ((m = /^Desktop color (#[0-9a-fA-F]{6})$/.exec(core))) return `桌面颜色 ${m[1]}`;
    if ((m = /^Color (#[0-9a-fA-F]{6})$/.exec(core))) return `颜色 ${m[1]}`;
    if ((m = /^Foundation (\d+)$/.exec(core))) return `回收堆 ${m[1]}`;
    if ((m = /^Free cell (\d+)$/.exec(core))) return `空闲单元 ${m[1]}`;
    if ((m = /^Tableau column (\d+)$/.exec(core))) return `纸牌列 ${m[1]}`;
    if ((m = /^Row (\d+) column (\d+), (.+)$/.exec(core))) {
        const state = { covered: '未翻开', flagged: '已插旗', mine: '地雷' }[m[3]] || m[3];
        return `第 ${m[1]} 行第 ${m[2]} 列，${state}`;
    }
    if ((m = /^(Ace|King|Queen|Jack|\d+) of (spades|hearts|diamonds|clubs)$/i.exec(core))) {
        const rank = { Ace: 'A', King: 'K', Queen: 'Q', Jack: 'J' }[m[1]] || m[1];
        const suit = SUITS[m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()];
        return `${suit}${rank}`;
    }
    if ((m = /^(Beginner|Intermediate|Expert): (.+) seconds$/.exec(core))) return `${ZH[m[1]]}：${m[2]} 秒`;
    if ((m = /^About (.+)$/.exec(core))) return `关于 ${name(m[1])}`;
    return undefined;
}

/** Short alias for code that builds UI strings directly. */
export const t = translateText;

const SKIP_SELECTOR = [
    'script', 'style', 'textarea', 'pre', 'code', '[contenteditable="true"]', '[data-i18n-skip]',
    '.menu-shortcut', '.help-layout', '.help-topics', '.help-page', '.dos-body', '.internet-page',
    '.wordpad-page', '.notepad-editor', '.char-grid', '.mail-preview'
].join(',');
const TRANSLATED_ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt'];

function skipped(node) {
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return !el || !!el.closest(SKIP_SELECTOR);
}

function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        if (skipped(node))
            return;
        const next = translateText(node.nodeValue, 'zh');
        if (next !== node.nodeValue) {
            const parent = node.parentElement;
            // Keep <option> values (used as setting keys) in English; only the label changes.
            if (parent?.tagName === 'OPTION' && !parent.hasAttribute('value'))
                parent.setAttribute('value', node.nodeValue.trim());
            node.nodeValue = next;
        }
        return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || skipped(node))
        return;
    for (const attr of TRANSLATED_ATTRIBUTES) {
        const value = node.getAttribute?.(attr);
        if (value) {
            const next = translateText(value, 'zh');
            if (next !== value)
                node.setAttribute(attr, next);
        }
    }
    for (const child of [...node.childNodes])
        translateNode(child);
}

/**
 * Installs the Chinese UI translator. No-ops for English. Runs once at
 * startup; a MutationObserver keeps dynamically created windows, menus and
 * dialogs translated as they appear.
 */
export function installI18n() {
    if (uiLang !== 'zh' || typeof document === 'undefined')
        return false;
    document.documentElement.lang = 'zh-CN';
    document.documentElement.dataset.uiLang = 'zh';
    translateNode(document.body);
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if (mutation.type === 'characterData')
                translateNode(mutation.target);
            else if (mutation.type === 'attributes')
                translateNode(mutation.target);
            else
                for (const node of mutation.addedNodes)
                    translateNode(node);
        }
    });
    observer.observe(document.body, {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: TRANSLATED_ATTRIBUTES
    });
    return true;
}
