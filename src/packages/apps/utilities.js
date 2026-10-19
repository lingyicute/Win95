import { el, button, field, download, fileInput, formatSize } from '@win95/ui/dom.js';
import { icon, fileIcon } from '@win95/ui/icons.js';
import { menuBar, popup } from '@win95/ui/menu.js';
import { combo } from '@win95/ui/select.js';
import { baseName, normalizePath, parentPath } from '@win95/core/filesystem.js';
import { uiLang } from '@win95/core/i18n.js';
/** The title and body of a topic, in the language the desktop is running. */
/** Every topic, in the order the Contents list shows them. */
export const helpTopicsOrder = () => Object.keys(helpTopics);
export const helpTopic = (key, lang = uiLang) => {
    const topic = helpTopics[key];
    if (lang !== 'zh' || !topic?.zh)
        return topic;
    return topic.zh;
};

export function findFiles(s) {
    const w = s.wm.create({ title: 'Find: All Files', icon: 'find', width: 560, height: 365 });
    w.body.classList.add('find-body');
    const name = el('input', { value: '', 'aria-label': 'Named', placeholder: '' }), containing = el('input', { 'aria-label': 'Containing text' }), folder = combo({ ariaLabel: 'Look in', options: ['C:\\', 'C:\\My Documents', 'C:\\Windows', 'C:\\Windows\\Desktop'] }), results = el('div', { class: 'find-results inset' });
    const search = () => {
        results.replaceChildren();
        let nodes = s.fs.search(name.value, folder.value);
        if (containing.value)
            nodes = nodes.filter(n => n.type === 'file' && (n.content || '').toLowerCase().includes(containing.value.toLowerCase()));
        for (const n of nodes)
            results.append(el('button', { class: 'find-result', ondblclick: () => s.open(n.path), onclick: e => { results.querySelectorAll('button').forEach(b => b.classList.remove('pressed')); e.currentTarget.classList.add('pressed'); }, oncontextmenu: e => { e.preventDefault(); popup(s.files.menu([n.path], parentPath(n.path)), e.clientX, e.clientY); } }, icon(fileIcon(n), 16), baseName(n.path), el('span', { text: parentPath(n.path) })));
        w.status(`${nodes.length} file(s) found`);
        if (!nodes.length)
            results.append(el('p', { style: { padding: '12px' }, text: 'No files matched your search.' }));
    };
    w.body.append(el('div', { class: 'tab-strip' }, button('Name & Location', () => { }, { class: 'active' })), el('div', { class: 'row', style: { alignItems: 'flex-start' } }, el('div', { class: 'stack', style: { flex: 1 } }, field('Named:', name), field('Containing text:', containing), field('Look in:', folder)), el('div', { class: 'stack' }, button('Find Now', search, { class: 'default-button' }), button('New Search', () => { name.value = ''; containing.value = ''; results.replaceChildren(); w.status('Ready'); }))), results);
    w.status('Enter the name of a file or folder to find.');
    name.onkeydown = e => {
        if (e.key === 'Enter')
            search();
    };
    return w;
}
/**
 * Help is content, not chrome: it is written in both languages here rather than rewritten in
 * place by the UI dictionary, which would translate the prose only while it left the menu names
 * inside it in English - and would also translate a file name a topic quotes. A topic without a
 * 'zh' entry falls back to English instead of half-translating.
 */
const HELP_LANGS = ['en', 'zh'];
const helpTopics = {
    welcome: { title: 'Welcome to Windows 95', body: '<h1>Welcome to Windows 95</h1><p>Your desktop is the starting point for everything you do. Use the Start menu to run a program, find a file, or change a setting.</p><h2>A few things to try</h2><ul><li>Double-click <b>My Computer</b> to explore your drives.</li><li>Open <b>Notepad</b> and save your first document.</li><li>Draw a picture in <b>Paint</b>.</li><li>Make yourself at home in <b>Control Panel → Display</b>.</li></ul><p>Documents and settings are kept in this browser.</p>', zh: { title: '欢迎使用 Windows 95', body: '<h1>欢迎使用 Windows 95</h1><p>桌面是你开始一切操作的地方。用「开始」菜单运行程序、查找文件或更改设置。</p><h2>先试试这几件事</h2><ul><li>双击<b>我的电脑</b>查看你的驱动器。</li><li>打开<b>记事本</b>，保存你的第一份文档。</li><li>在<b>画图</b>里画一幅画。</li><li>到<b>控制面板 → 显示</b>里把桌面布置成自己喜欢的样子。</li></ul><p>文档和设置都保存在这个浏览器中。</p>' } },
    files: { title: 'Working with files', body: '<h1>Working with files and folders</h1><p>Your personal documents live in <b>C:\\My Documents</b>. Every program uses the same virtual drive.</p><ul><li>Double-click a file to open it in its associated program.</li><li>Right-click to copy, rename, delete, or view properties.</li><li>Drag a file into a folder to move it. Hold <kbd>Ctrl</kbd> to copy.</li><li>Choose <b>File → Import File</b> or drop files from your computer into Explorer.</li><li>Deleted files go to the <b>Recycle Bin</b>. Right-click them and choose <b>Restore</b>.</li></ul><p>Use Microsoft Backup to export a copy of your virtual drive.</p>', zh: { title: '处理文件', body: '<h1>处理文件和文件夹</h1><p>你的个人文档放在 <b>C:\\My Documents</b> 里。每个程序用的都是同一个虚拟驱动器。</p><ul><li>双击文件，就会用它关联的程序打开。</li><li>右键单击可以复制、重命名、删除或查看属性。</li><li>把文件拖到文件夹里即可移动；按住 <kbd>Ctrl</kbd> 则改为复制。</li><li>选择<b>文件 → 导入文件…</b>，或把电脑里的文件拖进资源管理器。</li><li>删除的文件会进入<b>回收站</b>。右键单击它们并选择<b>还原</b>。</li></ul><p>也可以用 Microsoft 备份导出虚拟驱动器的一份副本。</p>' } },
    windows: { title: 'Managing windows', body: '<h1>Managing windows</h1><p>Drag the title bar to move a window. Drag an edge or corner to change its size.</p><ul><li>Click the minimize button to put a window on the taskbar.</li><li>Click its taskbar button to bring it back.</li><li>Double-click the title bar to maximize or restore.</li><li>Click the icon at the left of the title bar for its system menu.</li><li>Right-click the taskbar to cascade or tile windows.</li></ul>', zh: { title: '管理窗口', body: '<h1>管理窗口</h1><p>拖动标题栏可移动窗口；拖动边缘或角落可改变大小。</p><ul><li>单击最小化按钮，把窗口收到任务栏上。</li><li>单击任务栏上的按钮再把它调回来。</li><li>双击标题栏可最大化或还原。</li><li>单击标题栏最左边的图标，打开该窗口的系统菜单。</li><li>右键单击任务栏可层叠或平铺窗口。</li></ul>' } },
    applications: { title: 'Programs and accessories', body: '<h1>Programs at your fingertips</h1><p>Open <b>Start → Programs</b> to find your applications.</p><ul><li><b>Accessories:</b> Notepad, WordPad, Paint, Calculator, Character Map, Clipboard Viewer.</li><li><b>Games:</b> Solitaire, FreeCell, Minesweeper, Hearts.</li><li><b>Multimedia:</b> Media Player, Sound Recorder, Volume Control, CD Player.</li><li><b>System Tools:</b> Backup, ScanDisk, Disk Defragmenter, System Monitor, Registry Editor.</li><li><b>MS-DOS Prompt:</b> a command interpreter over your virtual drive.</li></ul>', zh: { title: '程序与附件', body: '<h1>触手可及的程序</h1><p>打开<b>开始 → 程序</b>就能找到你的应用程序。</p><ul><li><b>附件：</b>记事本、写字板、画图、计算器、字符映射表、剪贴板查看器。</li><li><b>游戏：</b>纸牌、空当接龙、扫雷、红桃大战。</li><li><b>多媒体：</b>媒体播放机、录音机、音量控制、CD 播放机。</li><li><b>系统工具：</b>备份、磁盘扫描程序、磁盘碎片整理程序、系统监视器、注册表编辑器。</li><li><b>MS-DOS 提示符：</b>运行在虚拟驱动器上的命令解释器。</li></ul>' } },
    notepad: { title: 'Notepad', body: '<h1>Writing with Notepad</h1><p>Notepad edits plain-text files. Type your text, then choose <b>File → Save</b>.</p><ul><li><kbd>Ctrl+S</kbd> saves the file.</li><li><kbd>Ctrl+O</kbd> opens a file.</li><li><kbd>Ctrl+F</kbd> finds text. <kbd>F3</kbd> finds the next match.</li><li><kbd>F5</kbd> inserts the time and date.</li><li>Choose <b>Edit → Word Wrap</b> to fit long lines.</li><li><b>File → Export</b> downloads a copy to your computer.</li></ul>', zh: { title: '记事本', body: '<h1>用记事本写字</h1><p>记事本编辑纯文本文件。输入文字后选择<b>文件 → 保存</b>。</p><ul><li><kbd>Ctrl+S</kbd> 保存文件。</li><li><kbd>Ctrl+O</kbd> 打开文件。</li><li><kbd>Ctrl+F</kbd> 查找文本，<kbd>F3</kbd> 查找下一处。</li><li><kbd>F5</kbd> 插入时间与日期。</li><li>勾选<b>编辑 → 自动换行</b>可折行显示长行。</li><li><b>文件 → 导出</b>会把一份副本下载到你的电脑。</li></ul>' } },
    wordpad: { title: 'WordPad', body: '<h1>Writing with WordPad</h1><p>Create formatted documents with bold, italic, underline, fonts, colors, paragraph alignment, and bullet lists.</p><p>Select text before clicking a formatting button. Save documents as RTF in the virtual drive, or export HTML to your computer.</p><p>The RTF text reader supports formatting, fonts, colors, paragraphs, and Unicode. Embedded objects, pictures, and page layout are outside the supported text format.</p>', zh: { title: '写字板', body: '<h1>用写字板写字</h1><p>创建带格式的文档：粗体、斜体、下划线、字体、颜色、段落对齐和项目符号列表。</p><p>先选中文字，再单击格式按钮。文档以 RTF 格式存入虚拟驱动器，也可以导出 HTML 到你的电脑。</p><p>RTF 文字读取器支持格式、字体、颜色、段落和 Unicode。嵌入对象、图片和页面排版不在受支持的文本格式之内。</p>' } },
    paint: { title: 'Paint', body: '<h1>Drawing with Paint</h1><p>Select a tool on the left, choose a color, then draw on the canvas.</p><ul><li>Use the pencil, brush, eraser, spray, line, curve, polygon, rectangle, or ellipse.</li><li>The paint bucket fills connected pixels of one color.</li><li>Right-click a palette color to select the background color.</li><li>Use Select and Edit → Copy/Cut/Paste for picture regions.</li><li>Choose Image → Attributes to resize the picture.</li><li>Invert Colors, flip, and rotate work on the entire picture.</li><li>Save or export as PNG. Set your drawing as the wallpaper from the File menu.</li></ul>', zh: { title: '画图', body: '<h1>用画图作画</h1><p>在左边选择工具，挑一种颜色，然后在画布上作画。</p><ul><li>可用铅笔、刷子、橡皮、喷枪、直线、曲线、多边形、矩形或椭圆。</li><li>油漆桶会填充相连的同色像素。</li><li>右键单击调色板上的颜色可选择背景色。</li><li>先框选区域，再用「编辑 → 复制/剪切/粘贴」处理图片的一部分。</li><li>选择「图像 → 属性」可调整图片大小。</li><li>反色、翻转和旋转作用于整幅图片。</li><li>可保存或导出为 PNG。也可以在「文件」菜单里把作品设为墙纸。</li></ul>' } },
    calculator: { title: 'Calculator', body: '<h1>Calculator</h1><p>Use the keypad or your keyboard. Standard mode evaluates operations as you enter them.</p><p>The memory buttons clear, recall, store, and add to the memory. <b>CE</b> clears the current entry; <b>C</b> clears the calculation.</p><p>Scientific mode adds trigonometric, logarithmic, power, and factorial functions. Choose degrees or radians from View.</p>', zh: { title: '计算器', body: '<h1>计算器</h1><p>可以用数字键盘，也可以用主键盘。标准型会在你输入的同时算出结果。</p><p>内存按钮用于清除、读出、存放和累加内存。<b>CE</b> 清除当前输入，<b>C</b> 清除整个算式。</p><p>科学型增加三角函数、对数、幂和阶乘。可在「查看」菜单里选择角度制或弧度制。</p>' } },
    minesweeper: { title: 'Minesweeper', body: '<h1>Minesweeper</h1><p>A field hides a set number of mines. Open every square that is not one. A square that is safe shows a number: how many of the eight squares around it hold a mine.</p><h2>Working a field</h2><ul><li>Left-click a covered square to open it. The first click of a field is always safe, and opens a clear patch to start from.</li><li>Right-click a square to plant a flag where you think a mine is. The counter at the top left counts the mines still to be found.</li><li>Once all the mines around a number are flagged, double-click the number - or click it with the middle button - to open the squares around it in one go.</li><li>On a touch screen, press and hold a square to flag it.</li><li>Open a mine and the field is lost. Open every safe square and the clock stops; your time is kept as a best time.</li></ul><h2>Fields and times</h2><ul><li><b>Beginner:</b> 8 × 8 with 10 mines. <b>Intermediate:</b> 16 × 16 with 40. <b>Expert:</b> 16 × 30 with 99.</li><li><b>Game → Custom…</b> sets rows, columns and mines of your own.</li><li><b>Game → Best Times…</b> shows the fastest times at each level.</li><li><b>Game → New</b> or <kbd>F2</kbd> builds a fresh field.</li></ul>', zh: { title: '扫雷', body: '<h1>扫雷</h1><p>一片雷区里埋着固定数量的雷。把没有雷的格子全部翻开。安全翻开的格子会显示一个数字：它周围八格里一共有几颗雷。</p><h2>怎么扫</h2><ul><li>左键单击未翻开的格子就能翻开。每局的第一下一定安全，还会翻开一片空地让你起步。</li><li>右键单击格子，就在你认为是雷的地方插上旗子。左上角的计数器显示还剩几颗雷没找到。</li><li>某个数字周围的雷都插好旗之后，双击这个数字——或用中键单击——就能一次翻开它周围的格子。</li><li>触摸屏上，按住格子不放即可插旗。</li><li>翻开一颗雷，这一局就输了。把所有安全格子翻完，计时停止，用时会被记成最快纪录。</li></ul><h2>雷区与纪录</h2><ul><li><b>初级：</b>8 × 8，10 颗雷。<b>中级：</b>16 × 16，40 颗。<b>高级：</b>16 × 30，99 颗。</li><li><b>游戏 → 自定义…</b>可以自己设定行数、列数和雷数。</li><li><b>游戏 → 最快纪录…</b>列出各级别的最快用时。</li><li><b>游戏 → 新游戏</b>或 <kbd>F2</kbd> 重新布雷。</li></ul>' } },
    hearts: { title: 'Hearts', body: '<h1>Hearts</h1><p>Four players, thirteen cards each: you against West, North and East. The aim is to take no penalty cards - every heart costs 1 point and the queen of spades costs 13. A hand is played trick by trick; when anyone reaches 100 points the match ends, and the lowest score wins.</p><h2>Playing a hand</h2><ul><li>The holder of the two of clubs leads the first trick.</li><li>Follow the suit that was led whenever you hold one. Without it you may throw anything away - which is how penalty points get taken.</li><li>The highest card of the suit led wins the trick and leads the next one.</li><li>You may not lead a heart until hearts are broken - that is, until a heart has been discarded on another suit.</li><li>The first trick carries no points unless the lead leaves you nothing but penalty cards to play.</li><li>Cards you may not play are shown dimmed, so only a legal card can be chosen.</li></ul><h2>Scoring</h2><ul><li>Each heart: 1 point. The queen of spades: 13 points.</li><li>Take all 26 points in one hand and you shoot the moon: every opponent takes 26 instead, and you keep none.</li><li>Scores are added at the end of each hand. The match ends once a total reaches 100; the lowest total wins.</li></ul><p>This table plays no-passing Hearts: the cards are dealt and play begins straight away, with nothing passed to another player.</p><p><kbd>F2</kbd> deals a new game at any time.</p>', zh: { title: '红桃大战', body: '<h1>红桃大战</h1><p>四个人、每人十三张牌：你对着西家、北家和东家。目标是尽量不吃罚分牌——每张红桃 1 分，黑桃 Q 13 分。一局一墩一墩地打；有人先满 100 分，比赛就结束，分数最低的人获胜。</p><h2>打一局</h2><ul><li>梅花 2 的持有者先出第一墩。</li><li>手上有领出的花色时，必须跟着出这门花色。没有这门花色时可以随便垫牌——罚分就是这样吃进来的。</li><li>领出花色里最大的牌赢下这一墩，并由它领出下一墩。</li><li>红桃还没被“打开”之前不能主动领出红桃：也就是说，得先有人在别的花色上垫过一张红桃。</li><li>第一墩不计分，除非领出的牌让你除了罚分牌之外没别的可出。</li><li>不能出的牌会显示得暗一些，只有合法的牌才点得下去。</li></ul><h2>计分</h2><ul><li>每张红桃 1 分，黑桃 Q 13 分。</li><li>一局里把 26 分全吃了就是“全收”（shoot the moon）：每位对手各记 26 分，你自己一分不记。</li><li>每局结束结算。有人总分满 100 分比赛结束，总分最低的人获胜。</li></ul><p>这张桌子打的是“不过牌”的红桃：发完牌直接开打，不往别人手里递牌。</p><p>随时按 <kbd>F2</kbd> 可以重新开局。</p>' } },
    freecell: { title: 'FreeCell', body: '<h1>FreeCell</h1><p>All 52 cards are dealt face up into eight columns. Four free cells and four foundations wait above the columns. Move every card onto the foundations, building each suit from Ace to King, and the game is won - and since nothing is face down, nearly every deal can be worked out.</p><h2>The table</h2><ul><li><b>Tableau:</b> the eight columns, built downwards in alternating colours - a red 6 goes on a black 7. Any card may be placed in an empty column.</li><li><b>Free cells:</b> four spaces that each hold one card, room to park a card while you work.</li><li><b>Foundations:</b> four piles, one for each suit, built upwards from the Ace.</li></ul><h2>Moving cards</h2><ul><li>Click a card, then click where it should go. Or drag it there.</li><li>Double-click a card to send it to a foundation.</li><li>A run of cards already in order moves together, as long as there is room: one card, plus one for each empty free cell, doubled for every empty column other than the one you are moving to.</li><li><b>Game → Undo</b> or <kbd>Ctrl+Z</kbd> takes back the last move.</li><li><b>Game → Hint</b> or <kbd>H</kbd> picks out a card that can be played.</li></ul><h2>Numbered deals</h2><ul><li>Every deal is a number from 1 to 1,000,000; a new window picks a fresh one.</li><li><b>Game → Select Game…</b> or <kbd>F3</kbd> returns to a number you have played before.</li><li><b>Game → Restart Game</b> deals the same number again from the start.</li><li><b>Game → Statistics…</b> counts the games won.</li><li><b>Game → New Game</b> or <kbd>F2</kbd> deals a new game.</li></ul>', zh: { title: '空当接龙', body: '<h1>空当接龙</h1><p>52 张牌全部正面朝上发成八列。上方有四个空当和四个基牌堆。把每张牌都送上基牌堆、每种花色从 A 排到 K，这一局就赢了——因为牌都是明的，几乎每一局都解得开。</p><h2>桌面</h2><ul><li><b>牌列：</b>下面的八列，按红黑相间、从大到小往下接——红 6 接在黑 7 上。空出来的一列可以放任何牌。</li><li><b>空当：</b>四个位置，每个放一张牌，是腾挪时的落脚点。</li><li><b>基牌堆：</b>四摞，每种花色一摞，从 A 开始往上排。</li></ul><h2>移动牌</h2><ul><li>先单击一张牌，再单击要放的位置；也可以直接拖过去。</li><li>双击一张牌，会把它送到基牌堆。</li><li>已经排好的连续一段可以整段搬走，前提是放得下：一张，加上每个空当一张，再按你要移入的那一列之外每空出一列翻一倍。</li><li><b>游戏 → 撤销</b>或 <kbd>Ctrl+Z</kbd> 退回上一步。</li><li><b>游戏 → 提示</b>或 <kbd>H</kbd> 会挑出一张能打的牌。</li></ul><h2>编号牌局</h2><ul><li>每一局都有编号，从 1 到 1,000,000；新开的窗口会随机挑一个。</li><li><b>游戏 → 选择牌局…</b>或 <kbd>F3</kbd> 可以回到玩过的编号。</li><li><b>游戏 → 重新开始本局</b>把同一个编号从头再发一次。</li><li><b>游戏 → 统计…</b>统计赢过多少局。</li><li><b>游戏 → 新游戏</b>或 <kbd>F2</kbd> 发一局新的。</li></ul>' } },
    solitaire: { title: 'Solitaire', body: '<h1>Solitaire</h1><p>Solitaire deals a standard 52-card deck into seven columns. The aim is to build all four suits up from Ace to King on the foundations at the top right; every card that arrives there is one you no longer have to move.</p><h2>The table</h2><ul><li><b>Stock:</b> the face-down pile at the top left. Click it to turn cards over.</li><li><b>Waste:</b> the cards the stock has turned over. Only the last one can be played.</li><li><b>Tableau:</b> the seven columns below. Build them downwards in alternating colours - a red 6 goes on a black 7. An empty column takes a King.</li><li><b>Foundations:</b> the four empty spaces at the top right, one per suit, built upwards from the Ace.</li></ul><h2>Draw One and Draw Three</h2><p>Choose <b>Game → Draw One</b> to turn over one card at a time, or <b>Game → Draw Three</b> to turn over three. The choice is remembered, and it changes the game: turning one card leaves every card within reach, while turning three buries two of every three until the stock comes round again.</p><p>In Draw Three the cards lie fanned out in the waste, and only the face of the fan can be taken; the two behind it are out of reach until a later pass. When the stock is empty, click it to turn the waste back into a new stock - that costs 100 points, and can be done as often as you like.</p><h2>Moving cards</h2><ul><li>Click a card, then click where it should go. Or drag it there.</li><li>Double-click a card to send it to a foundation.</li><li><b>Game → Undo</b> or <kbd>Ctrl+Z</kbd> takes back the last move.</li><li><b>Game → Hint</b> or <kbd>H</kbd> picks out a card that can be played.</li><li><b>Game → Deal</b> or <kbd>F2</kbd> deals a new table.</li></ul><h2>Scoring</h2><ul><li>Waste to tableau: 5 points.</li><li>Turning over a face-down tableau card: 5 points.</li><li>Card to a foundation: 10 points.</li><li>Card from a foundation back to the tableau: 15 points off.</li><li>Turning the waste back into a stock: 100 points off.</li></ul><p>Turn over every card and the table is won.</p>', zh: { title: '纸牌', body: '<h1>纸牌</h1><p>纸牌把一副 52 张的牌发成七列。目标是把四种花色分别从 A 一路排到 K，送到右上角的四个基牌堆上；送上去一张，就少一张要操心的牌。</p><h2>桌面</h2><ul><li><b>牌堆：</b>左上角扣着的一摞。单击它就能翻牌。</li><li><b>废牌堆：</b>翻出来的牌放在这里，只有最上面那张可以打出去。</li><li><b>牌列：</b>下面的七列，按红黑相间、从大到小往下接——红 6 接在黑 7 上。空出来的一列可以放 K。</li><li><b>基牌堆：</b>右上角四个空位，每种花色一个，从 A 开始往上排。</li></ul><h2>抽一张与抽三张</h2><p>选 <b>游戏 → 抽一张</b> 每次翻一张，选 <b>游戏 → 抽三张</b> 每次翻三张。这个选择会被记住，它改变的是整局：抽一张时每张牌都摸得到，抽三张时每三张里有两张会被压住，要等牌堆转一圈回来才够得着。</p><p>抽三张时，几张牌在废牌堆里摊开，只有最上面那张拿得走，后面两张要等到下一轮。牌堆翻空以后，单击空牌堆可以把废牌重新扣成一摞——每次倒扣 100 分，翻多少次都行。</p><h2>移动牌</h2><ul><li>先单击一张牌，再单击要放的位置；也可以直接拖过去。</li><li>双击一张牌，会把它送到基牌堆。</li><li><b>游戏 → 撤销</b>或 <kbd>Ctrl+Z</kbd> 退回上一步。</li><li><b>游戏 → 提示</b>或 <kbd>H</kbd> 会挑出一张能打的牌。</li><li><b>游戏 → 发牌</b>或 <kbd>F2</kbd> 重新开一局。</li></ul><h2>计分</h2><ul><li>废牌堆的牌接到牌列：加 5 分。</li><li>翻开牌列里扣着的牌：加 5 分。</li><li>把牌送上基牌堆：加 10 分。</li><li>把牌从基牌堆拿回牌列：减 15 分。</li><li>把废牌重新扣成牌堆：减 100 分。</li></ul><p>把所有牌都翻出来、送上基牌堆，这一局就赢了。</p>' } },
    pinball: { title: '3D Pinball', body: '<h1>3D Pinball for Windows - Space Cadet</h1><p>Keep the silver ball on the table for as long as you can. The lanes, ramps and bumpers that light up are the shots worth taking; finishing a mission promotes you and sets the next one. You start with three balls, and the panel beside the table shows the ball in play, your score, whose turn it is and what the table is asking of you.</p><h2>Keys</h2><ul><li><kbd>Z</kbd> left flipper, <kbd>/</kbd> right flipper.</li><li><kbd>Space</kbd> pulls the plunger: hold it down, let go to launch the ball.</li><li><kbd>X</kbd>, <kbd>.</kbd> and the up arrow bump the table left, right and up. A bump can rescue a ball on the edge, but the table answers Careful... and then TILT! if you overdo it, and a tilted table stops answering the flippers.</li><li><kbd>F2</kbd> starts a new game, <kbd>F3</kbd> pauses and resumes it.</li><li><kbd>F5</kbd> turns the sound on and off, <kbd>F6</kbd> the music, <kbd>F8</kbd> shows the keys the game is using.</li></ul><h2>Ranks and missions</h2><p>Promotions come from the missions the table sets: hit the targets the lights point at and the panel announces the next one. The ladder runs Cadet, Ensign, Lieutenant, Captain, Lt Commander, Commander, Commodore, Admiral and Fleet Admiral. Past the top, the score simply keeps climbing.</p><h2>Playing well</h2><ul><li>Raise a flipper as the ball rolls onto it to catch and steady it, then aim your shot.</li><li>Watch the panel: it says when to deploy the ball, which mission is running, and when a ball is lost.</li><li>Choose Options, then Select Players for two to four players. They take turns, and the panel shows whose ball it is.</li><li>Game, then New Game, deals a fresh set of balls at any time.</li></ul>', zh: { title: '三维弹球', body: '<h1>三维弹球：太空军校生</h1><p>让银球在台面上待得越久越好。亮起的球道、坡道和弹柱就是该打的目标；完成一项任务就会晋升，同时派下下一项。开局有三颗球，球台旁边的面板会显示当前是第几颗球、得分、轮到谁，以及球台在要你做什么。</p><h2>按键</h2><ul><li><kbd>Z</kbd> 左挡板，<kbd>/</kbd> 右挡板。</li><li><kbd>Space</kbd> 拉弹射杆：按住蓄力，松手发球。</li><li><kbd>X</kbd>、<kbd>.</kbd> 和上方向键分别向左、向右、向上撞台。轻撞能把台边的球救回来，撞多了球台先显示 Careful...，再显示 TILT!，倾斜之后挡板就不再响应。</li><li><kbd>F2</kbd> 开新局，<kbd>F3</kbd> 暂停与继续。</li><li><kbd>F5</kbd> 开关音效，<kbd>F6</kbd> 开关音乐，<kbd>F8</kbd> 查看游戏正在使用的按键。</li></ul><h2>军衔与任务</h2><p>晋升来自球台派下的任务：照着灯光打中目标，面板就会宣告下一项任务。军衔依次是军校生、少尉、中尉、上尉、少校、中校、准将、少将、舰队上将。升到顶之后，就只是让分数继续往上爬了。</p><h2>打好一局</h2><ul><li>球滚到挡板上时把挡板抬起，就能把球接住稳住，再瞄准打出去。</li><li>留意面板：什么时候发球、正在做哪项任务、什么时候丢了一颗球，它都会写出来。</li><li>在「选项 → 选择玩家」里可以设成二到四人，轮流出杆，面板会显示轮到谁。</li><li>「游戏 → 新游戏」随时重新发满球再开一局。</li></ul>' } },
    settings: { title: 'Changing settings', body: '<h1>Make Windows your own</h1><p>Open <b>Control Panel</b> from My Computer or Start → Settings.</p><ul><li><b>Display:</b> wallpaper, colors, themes, screen savers.</li><li><b>Date/Time:</b> the desktop clock and time zone.</li><li><b>Sounds:</b> volume and sound scheme.</li><li><b>Regional Settings:</b> time and number conventions.</li><li><b>Add/Remove Programs:</b> choose which components appear in Programs.</li><li><b>System:</b> inspect the renderer, virtual disk, and devices provided by the browser.</li></ul><p>Use Apply to keep a change without closing the dialog.</p>', zh: { title: '更改设置', body: '<h1>把 Windows 调成你自己的</h1><p>从我的电脑或「开始 → 设置」打开<b>控制面板</b>。</p><ul><li><b>显示：</b>墙纸、颜色、主题、屏幕保护程序。</li><li><b>日期/时间：</b>桌面时钟和时区。</li><li><b>声音：</b>音量与声音方案。</li><li><b>区域设置：</b>时间与数字习惯。</li><li><b>添加/删除程序：</b>选择在「程序」里出现哪些组件。</li><li><b>系统：</b>查看浏览器提供的渲染器、虚拟磁盘和设备。</li></ul><p>单击「应用」可保留改动而不关闭对话框。</p>' } },
    keyboard: { title: 'Keyboard shortcuts', body: '<h1>Keyboard shortcuts</h1><ul><li><kbd>Ctrl+Esc</kbd> — Start menu.</li><li><kbd>Alt+F4</kbd> — Close active window.</li><li><kbd>Alt+Space</kbd> — Window menu.</li><li><kbd>Alt+Tab</kbd> — Switch programs.</li><li><kbd>F2</kbd> — Rename a selected file.</li><li><kbd>F3</kbd> — Find.</li><li><kbd>Ctrl+C</kbd>, <kbd>Ctrl+X</kbd>, <kbd>Ctrl+V</kbd> — Copy, cut, paste.</li><li><kbd>Delete</kbd> — Recycle selected files.</li><li><kbd>Shift+Delete</kbd> — Delete files permanently.</li></ul><p>Your browser or computer may reserve some shortcuts. Every operation is also available through menus.</p>', zh: { title: '键盘快捷键', body: '<h1>键盘快捷键</h1><ul><li><kbd>Ctrl+Esc</kbd> — 「开始」菜单。</li><li><kbd>Alt+F4</kbd> — 关闭当前窗口。</li><li><kbd>Alt+Space</kbd> — 窗口菜单。</li><li><kbd>Alt+Tab</kbd> — 切换程序。</li><li><kbd>F2</kbd> — 重命名所选文件。</li><li><kbd>F3</kbd> — 查找。</li><li><kbd>Ctrl+C</kbd>、<kbd>Ctrl+X</kbd>、<kbd>Ctrl+V</kbd> — 复制、剪切、粘贴。</li><li><kbd>Delete</kbd> — 把所选文件放入回收站。</li><li><kbd>Shift+Delete</kbd> — 永久删除文件。</li></ul><p>你的浏览器或电脑可能占用了部分快捷键。每个操作在菜单里也都能找到。</p>' } },
    dos: { title: 'MS-DOS Prompt', body: '<h1>Using the command prompt</h1><p>Type <b>HELP</b> to see available commands. The prompt uses the same C: drive as Explorer.</p><p>Examples:</p><pre>CD "C:\\My Documents"\nDIR\nTYPE "Read Me.txt"\nECHO Hello &gt; hello.txt\nSTART NOTEPAD\nTREE C:\\</pre><p>This is a command interpreter implemented in JavaScript. It does not execute native DOS or Windows binary programs.</p>', zh: { title: 'MS-DOS 提示符', body: '<h1>使用命令提示符</h1><p>输入 <b>HELP</b> 查看可用的命令。这里的 C: 盘和资源管理器用的是同一个。</p><p>例子：</p><pre>CD "C:\\My Documents"\nDIR\nTYPE "Read Me.txt"\nECHO Hello &gt; hello.txt\nSTART NOTEPAD\nTREE C:\\</pre><p>这是一个用 JavaScript 实现的命令解释器，它不会执行原生的 DOS 或 Windows 二进制程序。</p>' } },
    about: { title: 'About this desktop', body: '<h1>About this desktop</h1><p>This is an independent browser-native recreation of the Windows 95 experience, organized into reusable JavaScript packages.</p><p>Classic window controls and text use HTML and CSS. Raster surfaces are presented through WebGPU, with WebGL2 and Canvas 2D fallbacks. Paint includes a WebGPU compute operation for pixel inversion.</p><p>The virtual volume is saved in IndexedDB, with a local-storage fallback. Save a backup before clearing browser data.</p><p>The desktop does not contain the Windows kernel, Win32/Win16 binary loaders, a DOS machine emulator, or native hardware drivers. Networked desktop services and embedded OLE objects are not emulated.</p><p>W95FA is by Alina Sava under the SIL Open Font License. Original Windows icons remain Microsoft artwork. The Chinese pixel font WenQuanYi Bitmap Song is by the WenQuanYi Project under the GNU GPL v2 with the font embedding exception. See the included asset provenance for sources.</p>', zh: { title: '关于这个桌面', body: '<h1>关于这个桌面</h1><p>这是一个独立实现的、浏览器原生的 Windows 95 体验，按可复用的 JavaScript 包组织。</p><p>经典的窗口控件与文字使用 HTML 和 CSS。位图画面通过 WebGPU 呈现，并回退到 WebGL2 与 Canvas 2D。画图中包含一个用 WebGPU compute 实现的反色操作。</p><p>虚拟卷保存在 IndexedDB 中，并可回退到本地存储。清理浏览器数据之前请先保存一份备份。</p><p>这个桌面不含 Windows 内核、Win32/Win16 二进制加载器、DOS 机器模拟器或原生硬件驱动。联网的桌面服务与嵌入的 OLE 对象也未模拟。</p><p>W95FA 由 Alina Sava 制作，采用 SIL 开放字体许可证。原版 Windows 图标仍是 Microsoft 的美术作品。中文点阵字体文泉驿点阵宋体（WenQuanYi Bitmap Song）由文泉驿项目提供，采用带字体嵌入许可例外的 GNU GPL v2。各项素材的出处见随附的资源说明。</p>' } }
};
export function help(s, args = {}) {
    let topic = args.topic || 'welcome';
    const w = s.wm.create({ title: 'Windows Help', icon: 'help', width: 650, height: 465 });
    const toolbar = el('div', { class: 'explorer-toolbar' }, button('Contents', () => show('welcome')), button('Index', () => show('applications')), button('Search', async () => {
        const q = await s.ui.prompt('Search for:', '', 'Find Help Topics', { owner: w });
        if (q) {
            const plain = t => `${t.title} ${t.body.replace(/<[^>]+>/g, ' ')}`.toLowerCase();
            const t = Object.keys(helpTopics).find(k => plain(helpTopic(k)).includes(q.toLowerCase()));
            t ? show(t) : s.ui.message('No topics were found.', 'Windows Help', ['OK'], { owner: w });
        }
    }), el('div', { class: 'toolbar-divider' }), button('Print', () => window.print()));
    const layout = el('div', { class: 'help-layout' }), topics = el('div', { class: 'help-topics inset' }), page = el('article', { class: 'help-page inset' });
    const show = t => { topic = helpTopics[t] ? t : 'welcome'; const { title, body } = helpTopic(topic); page.innerHTML = body; [...topics.children].forEach(n => n.classList.toggle('active', n.dataset.topic === topic)); w.status(title); };
    for (const k of Object.keys(helpTopics))
        topics.append(button(helpTopic(k).title, () => show(k), { 'data-topic': k }));
    layout.append(topics, page);
    w.body.append(toolbar, layout);
    w.setMenu(menuBar([{ label: 'File', items: [{ label: 'Exit', action: () => w.close() }] }, { label: 'Help', items: [{ label: 'About Help', action: () => s.about('Windows Help', 'help') }] }]));
    show(topic);
    return w;
}
export function characterMap(s) {
    const w = s.wm.create({ title: 'Character Map', icon: 'font', width: 525, height: 310, resizable: false });
    w.body.style.padding = '10px';
    w.body.style.gap = '8px';
    let selected = '©';
    const grid = el('div', { class: 'char-grid inset' }), font = combo({ ariaLabel: 'Font', options: ['Arial', 'Times New Roman', 'Courier New', 'W95FA'], value: 'Times New Roman' }), copy = el('input', { 'aria-label': 'Characters to copy' }), label = el('span', { text: 'U+00A9 Copyright sign' });
    for (let i = 160; i < 256; i++) {
        const c = String.fromCharCode(i);
        const b = button(c, () => { selected = c; grid.querySelectorAll('button').forEach(n => n.classList.remove('selected')); b.classList.add('selected'); label.textContent = 'U+' + i.toString(16).toUpperCase().padStart(4, '0') + '   ' + c; }, { ondblclick: () => copy.value += c });
        grid.append(b);
    }
    font.onchange = () => grid.querySelectorAll('button').forEach(b => b.style.fontFamily = font.value);
    w.body.append(field('Font:', font), grid, el('div', { class: 'row' }, field('Characters to copy:', copy), button('Select', () => copy.value += selected), button('Copy', () => s.copyText(copy.value))), label);
    return w;
}
export function clipboardViewer(s) { const w = s.wm.create({ title: 'Clipboard Viewer', icon: 'document', width: 450, height: 290 }); const display = el('textarea', { class: 'notepad-editor', readOnly: true, 'aria-label': 'Clipboard contents' }); const refresh = () => display.value = s.clipboard?.type === 'text' ? s.clipboard.text : s.clipboard?.type === 'files' ? s.clipboard.paths.join('\n') : 'The Clipboard is empty.'; w.body.append(display); w.setMenu(menuBar([{ label: 'File', items: [{ label: 'Save As…', action: () => download('Clipboard.txt', display.value) }, { label: 'Exit', action: () => w.close() }] }, { label: 'Edit', items: [{ label: 'Delete', action: () => { s.clipboard = null; refresh(); } }, { label: 'Refresh', action: refresh }] }])); refresh(); const timer = setInterval(refresh, 500); w.onClosed.push(() => clearInterval(timer)); return w; }
export function registryEditor(s) {
    let data = s.settings.get('registry', { 'HKEY_CLASSES_ROOT': { '.txt': 'txtfile', '.rtf': 'rtffile', '.png': 'Paint.Picture' }, 'HKEY_CURRENT_USER': {}, 'HKEY_CURRENT_USER\\Control Panel\\Desktop': { Wallpaper: s.settings.get('wallpaper', 'None'), Color: s.settings.get('desktopColor', '#008080') }, 'HKEY_LOCAL_MACHINE': {}, 'HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion': { ProductName: 'Microsoft Windows 95', Version: '4.00.950', RegisteredOwner: s.settings.get('owner', 'Windows User') }, 'HKEY_USERS': {}, 'HKEY_CURRENT_CONFIG': {}, 'HKEY_DYN_DATA': {} }), key = 'HKEY_CURRENT_USER\\Control Panel\\Desktop', selected = null;
    const w = s.wm.create({ title: 'Registry Editor', icon: 'control', width: 620, height: 390 });
    const layout = el('div', { class: 'registry-layout' }), tree = el('div', { class: 'registry-tree inset' }), values = el('div', { class: 'registry-values inset' });
    layout.append(tree, values);
    w.body.append(layout);
    const persist = () => {
        s.settings.set('registry', data);
        if (key === 'HKEY_CURRENT_USER\\Control Panel\\Desktop') {
            if (data[key].Color)
                s.settings.set('desktopColor', data[key].Color);
            if (data[key].Wallpaper)
                s.settings.set('wallpaper', data[key].Wallpaper);
        }
        render();
    };
    const edit = async (name) => {
        const v = await s.ui.prompt('Value data:', String(data[key][name] ?? ''), 'Edit String', { owner: w });
        if (v !== null) {
            data[key][name] = v;
            persist();
        }
    };
    const render = () => {
        tree.replaceChildren();
        values.replaceChildren(el('div', { class: 'registry-header' }, el('span', { text: 'Name' }), el('span', { text: 'Data' })));
        for (const k of Object.keys(data)) {
            const depth = k.split('\\').length - 1;
            tree.append(el('button', { class: 'tree-item' + (k === key ? ' selected' : ''), style: { paddingLeft: (depth * 10 + 3) + 'px' }, onclick: () => { key = k; selected = null; render(); } }, icon('folder', 16), k.split('\\').at(-1)));
        }
        for (const [n, v] of Object.entries(data[key] || {})) {
            const row = el('div', { class: 'registry-row' + (selected === n ? ' selected' : ''), onclick: () => { selected = n; render(); }, ondblclick: () => edit(n) }, el('span', { text: n || '(Default)' }), el('span', { text: String(v) }));
            row.oncontextmenu = e => { e.preventDefault(); popup([{ label: 'Modify', action: () => edit(n) }, { label: 'Delete', action: () => { delete data[key][n]; persist(); } }], e.clientX, e.clientY); };
            values.append(row);
        }
        w.status('My Computer\\' + key);
    };
    const exportReg = () => {
        let text = 'REGEDIT4\r\n';
        for (const [k, vals] of Object.entries(data)) {
            text += '\r\n[' + k + ']\r\n';
            for (const [n, v] of Object.entries(vals))
                text += JSON.stringify(n) + '=' + JSON.stringify(String(v)) + '\r\n';
        }
        download('Registry.reg', text);
    };
    w.setMenu(menuBar([{ label: 'Registry', items: [{ label: 'Import Registry File…', action: () => fileInput('.reg', async (f) => {
                        const text = await f.text();
                        let k;
                        for (const line of text.split(/\r?\n/)) {
                            const m = line.match(/^\[([^\]]+)\]$/);
                            if (m) {
                                k = m[1];
                                if (!/^HKEY_[A-Z_]+(?:\\[^\x00-\x1f]*)?$/.test(k))
                                    continue;
                                data[k] ??= {};
                            }
                            else if (k && data[k]) {
                                const a = line.match(/^("(?:\\.|[^"\\])*"|@)=("(?:\\.|[^"\\])*"|dword:[0-9a-fA-F]{8})$/);
                                if (a)
                                    try {
                                        const n = a[1] === '@' ? '' : JSON.parse(a[1]), v = a[2].startsWith('dword:') ? parseInt(a[2].slice(6), 16) : JSON.parse(a[2]);
                                        Object.defineProperty(data[k], n, { value: v, writable: true, enumerable: true, configurable: true });
                                    }
                                    catch { }
                            }
                        }
                        persist();
                    }) }, { label: 'Export Registry File…', action: exportReg }, null, { label: 'Exit', action: () => w.close() }] }, { label: 'Edit', items: () => [{ label: 'New', items: [{ label: 'Key', action: async () => {
                                const n = await s.ui.prompt('Key name:', 'New Key', 'Registry Editor', { owner: w });
                                if (n && !/[\\\r\n]/.test(n)) {
                                    const path = key + '\\' + n;
                                    data[path] = {};
                                    key = path;
                                    persist();
                                }
                            } }, { label: 'String Value', action: async () => {
                                const n = await s.ui.prompt('Value name:', 'New Value', 'Registry Editor', { owner: w });
                                if (n) {
                                    Object.defineProperty(data[key], n, { value: '', writable: true, enumerable: true, configurable: true });
                                    persist();
                                    await edit(n);
                                }
                            } }] }, { label: 'Modify', disabled: selected === null, action: () => edit(selected) }, { label: 'Delete', disabled: selected === null, action: () => { delete data[key][selected]; selected = null; persist(); } }, null, { label: 'Find…', action: async () => {
                        const q = await s.ui.prompt('Find what:', '', 'Find', { owner: w });
                        if (q) {
                            const found = Object.keys(data).find(k => (k + JSON.stringify(data[k])).toLowerCase().includes(q.toLowerCase()));
                            if (found) {
                                key = found;
                                render();
                            }
                            else
                                s.ui.message('Finished searching through the registry.', 'Registry Editor', ['OK'], { owner: w });
                        }
                    } }] }, { label: 'View', items: [{ label: 'Refresh', action: render }] }, { label: 'Help', items: [{ label: 'About Registry Editor', action: () => s.about('Registry Editor', 'control') }] }]));
    render();
    return w;
}
export function systemMonitor(s) {
    const w = s.wm.create({ title: 'System Monitor', icon: 'computer', width: 530, height: 305 });
    const canvas = el('canvas', { class: 'monitor-canvas', width: 500, height: 210 }), ctx = canvas.getContext('2d'), samples = [];
    w.body.append(canvas);
    let frame = 0, last = performance.now(), sum = 0, count = 0, elapsed = 0;
    const tick = now => {
        const delta = now - last;
        last = now;
        if (delta < 1000) {
            sum += delta;
            count++;
        }
        elapsed += delta;
        if (elapsed >= 500) {
            const ms = count ? sum / count : 0;
            samples.push(ms);
            if (samples.length > 100)
                samples.shift();
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, 500, 210);
            ctx.strokeStyle = '#003000';
            for (let x = 0; x < 500; x += 25) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, 210);
                ctx.stroke();
            }
            for (let y = 0; y < 210; y += 25) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(500, y);
                ctx.stroke();
            }
            ctx.strokeStyle = '#0f0';
            ctx.beginPath();
            samples.forEach((v, i) => { const x = i * 5, y = 200 - Math.min(190, v * 3); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
            ctx.stroke();
            w.status(`Frame interval: ${ms.toFixed(1)} ms       Windows: ${s.wm.windows.length}       Volume: ${formatSize(s.fs.size('C:\\'))}`);
            elapsed = 0;
            sum = 0;
            count = 0;
        }
        frame = requestAnimationFrame(tick);
    };
    w.setMenu(menuBar([{ label: 'File', items: [{ label: 'Exit', action: () => w.close() }] }, { label: 'View', items: [{ label: 'Clear History', action: () => samples.length = 0 }] }, { label: 'Help', items: [{ label: 'About System Monitor', action: () => s.about('System Monitor', 'computer') }] }]));
    w.body.prepend(el('div', { class: 'row', style: { padding: '7px' } }, el('span', { style: { color: '#008000' }, text: '■' }), 'Browser frame interval (milliseconds)'));
    frame = requestAnimationFrame(tick);
    w.onClosed.push(() => cancelAnimationFrame(frame));
    return w;
}
export function diskUtility(s, args = {}) {
    const defrag = !!args.defrag;
    const w = s.wm.create({ title: defrag ? 'Disk Defragmenter' : 'ScanDisk', icon: defrag ? 'defrag' : 'scandisk', width: 475, height: 380, resizable: false });
    w.body.style.padding = '12px';
    w.body.style.gap = '10px';
    const map = el('div', { class: 'disk-map' }), progress = el('div', { class: 'progress' }, el('div', { style: { width: '0%' } })), result = el('p', { text: 'Select Start to check the virtual C: drive.' }), nodes = [...s.fs.nodes.values()].filter(n => n.path.startsWith('C:'));
    for (let i = 0; i < 256; i++)
        map.append(el('span', { class: 'disk-block' + (i < nodes.length * 3 ? ' used' : '') }));
    let timer;
    const start = () => {
        let index = 0, errors = [];
        startButton.disabled = true;
        result.textContent = defrag ? 'Organizing the virtual directory…' : 'Checking files and folders…';
        timer = setInterval(async () => {
            if (w.closed)
                return;
            const n = nodes[index];
            if (n && n.path.length > 3 && s.fs.get(parentPath(n.path))?.type !== 'folder')
                errors.push(n.path);
            const end = Math.min(256, Math.round((index + 1) / nodes.length * 256));
            for (let i = 0; i < end; i++)
                map.children[i].classList.add('scanned');
            progress.firstChild.style.width = Math.min(100, (index + 1) / nodes.length * 100) + '%';
            index++;
            if (index >= nodes.length) {
                clearInterval(timer);
                if (defrag) {
                    s.fs.nodes = new Map([...s.fs.nodes].sort(([a], [b]) => a.localeCompare(b)));
                    s.fs.changed();
                    await s.fs.flush();
                }
                result.textContent = errors.length ? `${errors.length} invalid directory references found.` : defrag ? 'Virtual directory order optimized and saved.' : `ScanDisk found no errors in ${nodes.length} files and folders.`;
                startButton.disabled = false;
            }
        }, Math.max(25, 1200 / nodes.length));
    };
    const startButton = button('Start', start);
    w.body.append(el('div', { class: 'row' }, icon('disk', 32), el('div', {}, el('b', { text: 'Drive (C:)' }), el('p', { text: `${nodes.length} objects · ${formatSize(s.fs.size('C:\\'))}` }))), result, map, progress, el('p', { class: 'muted', text: defrag ? 'This map represents virtual files. Physical disk placement is managed by your browser.' : 'Checks that each virtual file has a valid parent directory.' }), el('div', { class: 'dialog-buttons' }, startButton, button('Close', () => w.close())));
    w.onClosed.push(() => clearInterval(timer));
    return w;
}
export function backup(s) {
    const w = s.wm.create({ title: 'Microsoft Backup', icon: 'backup', width: 540, height: 355 });
    w.body.style.padding = '12px';
    w.body.style.gap = '12px';
    const list = el('div', { class: 'inset', style: { flex: 1, overflow: 'auto', padding: '9px' } });
    for (const n of s.fs.list('C:\\'))
        list.append(el('div', { class: 'row', style: { padding: '5px' } }, icon(fileIcon(n), 16), n.path, el('span', { class: 'spacer' }), formatSize(s.fs.size(n.path))));
    const restore = () => fileInput('.json', async (f) => {
        try {
            const data = JSON.parse(await f.text());
            if (data.format !== 'win95-volume' || data.version !== 1 || !Array.isArray(data.nodes))
                throw new Error('This is not a Windows 95 desktop backup.');
            if (data.nodes.length > 50000)
                throw new Error('This backup has too many entries.');
            const nodes = new Map();
            for (const pair of data.nodes) {
                if (!Array.isArray(pair) || pair.length !== 2)
                    throw new Error('Invalid backup entry.');
                const n = pair[1];
                if (!n || !['file', 'folder'].includes(n.type) || typeof n.path !== 'string' || !/^C:\\|^A:\\|^D:\\/.test(n.path) || n.type === 'file' && typeof n.content !== 'string')
                    throw new Error('Invalid backup entry.');
                const path = normalizePath(n.path);
                if (path !== n.path)
                    throw new Error('Invalid backup path.');
                nodes.set(path.toLowerCase(), { path, type: n.type, content: n.content, mime: n.mime, created: Number(n.created) || Date.now(), modified: Number(n.modified) || Date.now(), originalPath: n.originalPath });
            }
            if (!nodes.has('c:\\'))
                throw new Error('The C: drive is missing.');
            for (const n of nodes.values())
                if (n.path.length > 3 && nodes.get(normalizePath(parentPath(n.path)).toLowerCase())?.type !== 'folder')
                    throw new Error('A parent directory is missing.');
            if (await s.ui.message('Replace the virtual drive with this backup? Open documents should be saved first.', 'Restore Backup', ['Yes', 'No'], { owner: w, height: 190 }) !== 'Yes')
                return;
            s.fs.nodes = nodes;
            s.fs.changed();
            await s.fs.flush();
            s.ui.message(`Restored ${nodes.size} files and folders.`, 'Microsoft Backup', ['OK'], { owner: w });
        }
        catch (e) {
            s.ui.error(e, w);
        }
    });
    /* No tab strip: its "Backup" page never moved and its "Restore" page was a
       second copy of the button at the bottom, so the two cards only made the
       dialog look like it had modes it did not have. */
    w.body.append(el('p', { text: 'Back up your files to a single archive on your computer.' }), list, el('div', { class: 'dialog-buttons' }, button('Start Backup', () => { download('Windows95-Backup-' + new Date().toISOString().slice(0, 10) + '.json', s.fs.export(), 'application/json'); w.status('Backup exported.'); }, { class: 'default-button' }), button('Restore…', restore), button('Close', () => w.close())));
    w.status(`${s.fs.nodes.size} objects on the virtual volume`);
    return w;
}
export function briefcase(s) {
    const path = 'C:\\My Documents\\My Briefcase';
    if (!s.fs.exists(path))
        s.fs.mkdir(path);
    const w = s.launch('explorer', { path });
    s.ui.message('Keep copies of files in My Briefcase. Use File → Export File to take a copy with you, or import a newer version from your computer.', 'My Briefcase', ['OK'], { icon: 'briefcase' });
    return w;
}
