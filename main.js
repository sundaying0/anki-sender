'use strict';

const obsidian = require('obsidian');

// ============================================================
// 默认设置
// ============================================================
const DEFAULT_SETTINGS = {
    deckName: '新思维词汇',
    modelName: 'XXHK - 划线',
    tags: [],
    enablePronunciation: false,
    ankiConnectUrl: 'http://localhost:8765',
    dictionaryApiKey: ''
};

// ============================================================
// 发送确认弹窗
// ============================================================
class SendConfirmModal extends obsidian.Modal {
    constructor(app, defaultSource, autoTags, hint) {
        super(app);
        this.defaultSource = defaultSource;
        this.autoTags = autoTags || [];
        this.tags = this.autoTags.join(' ');
        this.source = defaultSource;
        this.hint = hint || '';
        this.submitted = false;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h3', { text: '发送到 Anki' });

        // 使弹窗可拖动
        this.makeDraggable();

        // 词根标签（自动填入识别到的词根）
        const tagDesc = this.autoTags.length > 0
            ? '✅ 自动识别自构词行，可修改'
            : this.hint
                ? '⚠️ ' + this.hint + '，请手动输入'
                : '空格分隔，如 ced cess pro';
        new obsidian.Setting(contentEl)
            .setName('词根标签')
            .setDesc(tagDesc)
            .addText((text) =>
                text
                    .setPlaceholder('ced cess')
                    .setValue(this.tags)
                    .onChange((value) => { this.tags = value; })
            );

        // 来源
        new obsidian.Setting(contentEl)
            .setName('来源')
            .setDesc('自动填入当前笔记标题，可修改')
            .addText((text) =>
                text
                    .setValue(this.defaultSource)
                    .onChange((value) => { this.source = value; })
            );

        // 按钮
        const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

        const cancelBtn = btnRow.createEl('button', { text: '取消' });
        cancelBtn.addEventListener('click', () => this.close());

        const sendBtn = btnRow.createEl('button', { text: '发送', cls: 'mod-cta' });
        sendBtn.addEventListener('click', () => {
            this.submitted = true;
            this.close();
        });
    }

    onClose() {
        this.contentEl.empty();
    }

    makeDraggable() {
        const modal = this.modalEl || this.containerEl.parentElement;
        if (!modal) return;

        modal.style.cursor = 'move';
        let isDragging = false, startX, startY, offsetX = 0, offsetY = 0, rafId;

        modal.addEventListener('mousedown', (e) => {
            // 排除交互元素：输入框、按钮、下拉框不触发拖动
            if (e.target.closest('input, button, select, textarea, a')) return;
            isDragging = true;
            startX = e.clientX - offsetX;
            startY = e.clientY - offsetY;
            modal.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                offsetX = e.clientX - startX;
                offsetY = e.clientY - startY;
                modal.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
                rafId = null;
            });
        });

        document.addEventListener('mouseup', () => { isDragging = false; });
    }
}

// ============================================================
// 批量发送弹窗
// ============================================================
class BatchSendModal extends obsidian.Modal {
    constructor(app, sections, deckName, onSend) {
        super(app);
        this.sections = sections;       // parseArticle() 返回的段落列表
        this.deckName = deckName;
        this.onSend = onSend;           // 回调：(selectedSections) => Promise<void>
        this.selected = new Set(sections.map((_, i) => i)); // 默认全选
        this.isSending = false;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h3', { text: `批量发送到 Anki — ${this.sections.length} 个词条` });

        this.makeDraggable();

        // 工具栏：全选/全不选 + 目标牌组
        const toolbar = contentEl.createDiv({ cls: 'batch-toolbar', style: 'display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;' });

        const selectAllBtn = toolbar.createEl('button', { text: '全选' });
        selectAllBtn.addEventListener('click', () => {
            this.sections.forEach((_, i) => this.selected.add(i));
            this.renderCheckboxes();
        });

        const deselectAllBtn = toolbar.createEl('button', { text: '全不选' });
        deselectAllBtn.addEventListener('click', () => {
            this.selected.clear();
            this.renderCheckboxes();
        });

        toolbar.createEl('span', {
            text: `目标牌组：${this.deckName}`,
            style: 'margin-left:auto;color:var(--text-muted);font-size:0.9em;'
        });

        // checkbox 列表容器（可滚动）
        this.listContainer = contentEl.createDiv({
            cls: 'batch-list',
            style: 'max-height:400px;overflow-y:auto;border:1px solid var(--background-modifier-border);border-radius:6px;padding:8px;'
        });
        this.renderCheckboxes();

        // 按钮行
        const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

        const cancelBtn = btnRow.createEl('button', { text: '取消' });
        cancelBtn.addEventListener('click', () => {
            if (!this.isSending) this.close();
        });

        this.sendBtn = btnRow.createEl('button', { text: `发送 ${this.sections.length} 条`, cls: 'mod-cta' });
        this.sendBtn.addEventListener('click', () => this.handleSend());
    }

    renderCheckboxes() {
        this.listContainer.empty();
        for (let i = 0; i < this.sections.length; i++) {
            const s = this.sections[i];
            const row = this.listContainer.createDiv({
                style: 'display:flex;align-items:baseline;gap:8px;padding:4px 6px;border-radius:4px;cursor:pointer;'
            });
            row.addEventListener('mouseenter', () => { row.style.background = 'var(--background-modifier-hover)'; });
            row.addEventListener('mouseleave', () => { row.style.background = ''; });

            const checkbox = row.createEl('input', { type: 'checkbox' });
            checkbox.checked = this.selected.has(i);
            checkbox.style.margin = '0';
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) this.selected.add(i);
                else this.selected.delete(i);
                this.updateSendButton();
            });

            // 点击整行切换 checkbox
            row.addEventListener('click', (e) => {
                if (e.target === checkbox) return;
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) this.selected.add(i);
                else this.selected.delete(i);
                this.updateSendButton();
            });

            // 序号 + 单词 + 预览
            const label = row.createEl('span', {
                style: 'font-size:0.9em;line-height:1.4;'
            });
            label.createEl('strong', { text: `${i + 1}. ` });
            label.createEl('span', { text: s.word, style: 'color:var(--text-accent);font-weight:600;' });
            if (s.preview) {
                label.createEl('span', { text: `  ${s.preview}`, style: 'color:var(--text-muted);' });
            }
        }
        this.updateSendButton();
    }

    updateSendButton() {
        if (this.sendBtn) {
            this.sendBtn.setText(`发送 ${this.selected.size} 条`);
        }
    }

    async handleSend() {
        if (this.selected.size === 0) {
            new obsidian.Notice('⚠️ 请至少选择一个词条');
            return;
        }
        if (this.isSending) return;

        this.isSending = true;
        this.sendBtn.setText('发送中...');
        this.sendBtn.disabled = true;

        const selectedSections = [...this.selected].sort((a, b) => a - b).map(i => this.sections[i]);

        try {
            await this.onSend(selectedSections);
        } finally {
            this.isSending = false;
            this.close();
        }
    }

    onClose() {
        this.contentEl.empty();
    }

    makeDraggable() {
        const modal = this.modalEl || this.containerEl.parentElement;
        if (!modal) return;

        modal.style.cursor = 'move';
        let isDragging = false, startX, startY, offsetX = 0, offsetY = 0, rafId;

        modal.addEventListener('mousedown', (e) => {
            if (e.target.closest('input, button, select, textarea, a')) return;
            isDragging = true;
            startX = e.clientX - offsetX;
            startY = e.clientY - offsetY;
            modal.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
                offsetX = e.clientX - startX;
                offsetY = e.clientY - startY;
                modal.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
                rafId = null;
            });
        });

        document.addEventListener('mouseup', () => { isDragging = false; });
    }
}

// ============================================================
// 插件主体
// ============================================================
class AnkiSenderPlugin extends obsidian.Plugin {

    async onload() {
        await this.loadSettings();

        // 注册命令（可在设置 → 快捷键中自定义，默认 Ctrl+Shift+A）
        this.addCommand({
            id: 'send-to-anki',
            name: '发送选中文字到 Anki',
            icon: 'paper-plane',
            editorCallback: (editor) => {
                this.sendToAnki(editor);
            },
            hotkeys: [{ modifiers: ['Ctrl', 'Shift'], key: 'a' }]
        });

        // 注册批量发送命令（默认 Ctrl+Shift+B）
        this.addCommand({
            id: 'send-batch-to-anki',
            name: '批量发送文章到 Anki',
            icon: 'list',
            editorCallback: (editor) => this.sendBatchToAnki(editor),
            hotkeys: [{ modifiers: ['Ctrl', 'Shift'], key: 'b' }]
        });

        // 右键菜单：选中文字 → 单条发送；无选中 → 批量发送
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor) => {
                const selection = editor.getSelection();
                menu.addSeparator();
                if (selection) {
                    // 有选中文字 → 单条发送
                    menu.addItem((item) => {
                        item
                            .setTitle('发送到 Anki')
                            .setIcon('paper-plane')
                            .onClick(() => this.sendToAnki(editor));
                    });
                } else {
                    // 无选中文字 → 批量发送
                    menu.addItem((item) => {
                        item
                            .setTitle('批量发送到 Anki')
                            .setIcon('list')
                            .onClick(() => this.sendBatchToAnki(editor));
                    });
                }
            })
        );

        // 状态栏提示
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.setText('Anki Sender');
        this.statusBarItem.setAttribute('title', 'Anki Sender 已加载。右键选中文字或快捷键发送到 Anki');

        // 加载设置面板
        this.addSettingTab(new AnkiSenderSettingTab(this.app, this));

        console.log('Anki Sender plugin loaded');
    }

    onunload() {
        console.log('Anki Sender plugin unloaded');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // --------------------------------------------------------
    // 获取当前活动文件信息
    // --------------------------------------------------------
    getActiveFile() {
        return this.app.workspace.getActiveFile();
    }

    // --------------------------------------------------------
    // 从文件名提取词根
    // 匹配格式：022-cap-cip-capt-capit头词根.md
    // --------------------------------------------------------
    extractRootsFromFileName(basename) {
        const match = basename.match(/^\d+-(.+?)头词根$/);
        if (!match) return [];

        // 按 - 分割，过滤空值
        return match[1]
            .split('-')
            .map(r => r.trim().toLowerCase())
            .filter(Boolean);
    }

    // --------------------------------------------------------
    // 判断选中文字是否为单词条目
    // 单词条目格式：word /phonetic/（词性）
    // --------------------------------------------------------
    isWordEntry(text) {
        const trimmed = text.trim().replace(/^[-*]\s+/, '').replace(/\*\*/g, '');
        // 匹配：英文字母开头 + 音标 /xxx/ 或中文词性括号
        // 支持派生词行格式（如 "- **relation** /rɪˈleɪʃn/（名词）"）
        return /^[a-zA-Z]+\s+\/.+\/\s*[（(]/.test(trimmed);
    }

    // --------------------------------------------------------
    // 从选中文字附近读取构词行，提取词根/词缀
    // 构词行格式：**构词**：chap(= cap) + -el(小)
    // 提取结果按构词行中从左到右的出现顺序排列
    // --------------------------------------------------------
    extractEtymologyRoots(editor, selectedText) {
        const posRoots = [];  // { pos, root } 用于按位置排序
        const selStart = editor.getCursor('from').line;
        const selEnd = editor.getCursor('to').line;
        const totalLines = editor.lineCount();

        // 扫描范围：从选区起始行往下 5 行，到选区结束行往下 5 行
        // 这样无论用户选中单行还是整段，都能找到构词行
        const scanStart = selStart;
        const scanEnd = Math.min(Math.max(selEnd, selStart) + 5, totalLines);

        for (let i = scanStart; i < scanEnd; i++) {
            const line = editor.getLine(i);

            // 匹配构词行
            if (line.includes('构词') || line.includes('词根') || line.includes('词缀')) {
                // 记录捕获组在构词行中的位置，用于按出现顺序排序
                const pos = (m) => m.index + m[0].indexOf(m[1]);

                // 1A: (= xxx) 在非字母非/处截断，长度2-6 → 如 chap(= cap)、sui-(= self，自己)
                for (const m of line.matchAll(/=\s*([a-zA-Z]{2,6})(?![a-zA-Z/])/g)) {
                    posRoots.push({ pos: pos(m), root: m[1].toLowerCase() });
                }
                // 1B: (= xxx/单字中文) → 如 cab(= cap/头)、cipit(= capit/头)
                for (const m of line.matchAll(/=\s*([a-zA-Z]{2,})\/[一-鿿]{1}[）)]/g)) {
                    posRoots.push({ pos: pos(m), root: m[1].toLowerCase() });
                }
                // 1C: (= xxx-) 以 - 截断 → 如 (= ex-) 中的 ex
                for (const m of line.matchAll(/=\s*([a-zA-Z]{2,})-/g)) {
                    posRoots.push({ pos: pos(m), root: m[1].toLowerCase() });
                }
                // 1D: xxx-(中文) 前缀格式（必须有 - 前缀）
                //    如 con-(= thoroughly，彻底) → 提取 con
                for (const m of line.matchAll(/\b([a-zA-Z]{2,})-(?=\s*[（(][^）)]*[一-鿿])/g)) {
                    posRoots.push({ pos: pos(m), root: m[1].toLowerCase() });
                }
                // 1E: 括号前的拼写形式（记住单词构成）
                //    如 sist(= stand/站) → sist, cape(斗篷/头) → cape
                for (const m of line.matchAll(/\b([a-zA-Z]{2,})[（(](?=[^）)]*[/=])/g)) {
                    posRoots.push({ pos: pos(m), root: m[1].toLowerCase() });
                }
                // 2. 提取词根：xxx(中文) 且括号内无 = 和 /，同时支持全角括号
                //    如 capt(头)、capit(头)、acu(尖)、aud（听）
                for (const m of line.matchAll(/-?\b([a-zA-Z]{2,})\s*[（(](?![^)）]*[/=])[^)）]{0,4}[一-鿿][^)）]{0,2}[)）]/g)) {
                    posRoots.push({ pos: pos(m), root: m[1].toLowerCase() });
                }
                // 3. 提取 -xxx(含义) 中的词缀 → 如 -el(小) 中的 el
                for (const m of line.matchAll(/-([a-zA-Z]+)\s*[（(]/g)) {
                    posRoots.push({ pos: pos(m), root: m[1].toLowerCase() });
                }
                // 4. 提取裸词缀：-xxx 后面跟空格/+/→/行尾（无括号）
                //    如 cipit(= capit/头) + -ate → 提取 ate
                for (const m of line.matchAll(/-([a-zA-Z]{2,})(?=\s*[+→\s]|$)/g)) {
                    posRoots.push({ pos: pos(m), root: m[1].toLowerCase() });
                }
                break;
            }
        }

        // 按在构词行中从左到右的出现顺序排序，去重保留首次出现
        const seen = new Set();
        const roots = [];
        posRoots.sort((a, b) => a.pos - b.pos);
        for (const { root } of posRoots) {
            if (!seen.has(root)) {
                seen.add(root);
                roots.push(root);
            }
        }
        return roots;
    }

    // --------------------------------------------------------
    // 从 frontmatter 读取 root 字段
    // 使用 Obsidian metadataCache，无需手动解析 YAML
    // 返回：string[] 如 ['cap', 'cip', 'capt', 'capit']
    // --------------------------------------------------------
    getFrontmatterRoots(file) {
        if (!file) return [];
        const cache = this.app.metadataCache.getFileCache(file);
        const fm = cache && cache.frontmatter;
        if (!fm || !fm.root) return [];

        // root 格式可能是 "cap/cip/capt/capit" 或 "cap cip capt capit"
        return fm.root
            .toString()
            .split(/[/\s]+/)
            .map(r => r.trim().toLowerCase())
            .filter(Boolean);
    }

    // --------------------------------------------------------
    // 自动检测词根标签
    // 只从构词行提取该词实际用到的词根，不做 fallback 全量填入
    // 返回：{ tags: string[], isWord: boolean, hint: string }
    //   hint: 当构词行提取不到时，给用户的提示信息
    // --------------------------------------------------------
    detectWordRoots(editor, selectedText, isWord) {
        if (!isWord) {
            return { tags: [], hint: '' };
        }

        // 单词条目：只从构词行提取该词实际用到的词根
        const etyRoots = this.extractEtymologyRoots(editor, selectedText);

        if (etyRoots.length > 0) {
            return { tags: etyRoots, isWord: true, hint: '' };
        }

        // 构词行没提取到 → 提示用户手动输入，不自动填入全部词根
        const file = this.getActiveFile();
        const fmRoots = this.getFrontmatterRoots(file);
        const hint = fmRoots.length > 0
            ? `未找到构词行，本课词根：${fmRoots.join(' ')}`
            : '';
        return { tags: [], hint };
    }

    // --------------------------------------------------------
    // 从选中文字中提取所有带音标的单词
    // 匹配格式：word /phonetic/
    // 支持去除行首 - * 和 ** 标记
    // --------------------------------------------------------
    findWordsWithPhonetics(text) {
        const words = [];
        const seen = new Set();
        // 去除 ** 粗体标记后全文扫描
        // 支持两种格式：word /phonetic/（普通文本）和 word | /phonetic/（表格单元格）
        // \/[^/]{3,} 匹配 /音标/，结尾 \/ 可选（兼容选区截断）
        const cleaned = text.replace(/\*\*/g, '');
        const matches = cleaned.matchAll(/([a-zA-Z]+)(?:\s+|\s*\|\s*)\/[^/]{3,}\/?/g);
        for (const m of matches) {
            const word = m[1].toLowerCase();
            if (!seen.has(word)) {
                seen.add(word);
                words.push(word);
            }
        }
        return words;
    }

    // --------------------------------------------------------
    // 批量获取单词发音
    // 返回 [{ word, filename }] 数组
    // --------------------------------------------------------
    async fetchPronunciations(words) {
        const results = [];
        for (const word of words) {
            const filename = await this.fetchPronunciation(word);
            if (filename) {
                results.push({ word, filename });
            }
        }
        return results;
    }

    // --------------------------------------------------------
    // 构建发音按钮 HTML（含音量滑块，localStorage 记忆）
    // --------------------------------------------------------
    buildPronunciationHtml(pronunciations) {
        if (!pronunciations.length) return '';
        const btnStyle = 'background:#f0f0f0;border:1px solid #ccc;border-radius:4px;padding:4px 12px;cursor:pointer;font-size:14px;margin-right:6px;';
        const buttons = pronunciations
            .map(p => {
                const onclick = `var v=+(localStorage.getItem('anki-sender-vol')||'0.8');` +
                    `var a=new Audio('${p.word}.mp3');a.volume=v;a.play();`;
                return `<button id="anki-play-${p.word}" style="${btnStyle}" onclick="${onclick}">🔊 ${p.word}</button>`;
            })
            .join('');
        const volumeBar = `<span style="margin-left:8px;font-size:13px;color:#888;">🔈</span>` +
            `<input id="anki-vol" type="range" min="0" max="100" value="80" style="width:80px;vertical-align:middle;" ` +
            `oninput="var v=this.value/100;document.getElementById('anki-vol-val').textContent=v.toFixed(1);localStorage.setItem('anki-sender-vol',v);">` +
            `<span id="anki-vol-val" style="font-size:12px;color:#888;">0.8</span>`;
        return `<div style="margin-top:8px;">${buttons}${volumeBar}</div>`;
    }
    // --------------------------------------------------------
    // 发音获取（Merriam-Webster API）
    // 返回音频文件名（如 "achieve.mp3"），失败返回 null
    // --------------------------------------------------------
    async fetchPronunciation(word) {
        if (!this.settings.dictionaryApiKey) return null;
        try {
            const resp = await obsidian.requestUrl({
                url: `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${this.settings.dictionaryApiKey}`,
                method: 'GET'
            });
            const data = resp.json;
            if (!Array.isArray(data) || !data.length) return null;
            if (typeof data[0] === 'string') return null; // 返回的是建议词，不是词条

            const sound = data[0].hwi && data[0].hwi.prs && data[0].hwi.prs[0] && data[0].hwi.prs[0].sound;
            if (!sound || !sound.audio) return null;

            // 拼接音频 URL：首字母作为子目录
            const dir = sound.audio.charAt(0);
            const audioUrl = `https://media.merriam-webster.com/audio/prons/en/us/wav/${dir}/${sound.audio}.wav`;

            const filename = `${word}.mp3`;
            await this.ankiRequest('storeMediaFile', {
                filename,
                url: audioUrl
            });
            return filename;
        } catch {
            return null;
        }
    }

    // --------------------------------------------------------
    // 核心：发送选中文字到 Anki
    // --------------------------------------------------------
    async sendToAnki(editor) {
        const selectedText = editor.getSelection();

        if (!selectedText || selectedText.trim().length === 0) {
            new obsidian.Notice('⚠️ 请先选中要发送的文字');
            return;
        }

        // 1. 检测 Anki 是否运行
        const isConnected = await this.checkAnkiConnection();
        if (!isConnected) {
            new obsidian.Notice(
                '❌ 无法连接 Anki。请确保：\n' +
                '1. Anki 已打开\n' +
                '2. 已安装 AnkiConnect 插件 (代码: 2055492159)',
                8000
            );
            return;
        }

        // 2. 判断是否为单词条目 + 自动检测词根标签
        const isWord = this.isWordEntry(selectedText);
        const { tags: autoTags, hint } = this.detectWordRoots(editor, selectedText, isWord);

        // 3. 弹窗确认标签和来源
        const file = this.getActiveFile();
        const defaultSource = file ? file.basename : '';
        const modal = new SendConfirmModal(this.app, defaultSource, autoTags, hint);

        await new Promise((resolve) => {
            modal.onClose = () => {
                modal.contentEl.empty();
                resolve();
            };
            modal.open();
        });

        if (!modal.submitted) return;

        // 4. 处理标签
        const wordRoots = modal.tags
            .split(/\s+/)
            .filter(Boolean);

        // 5. 查询发音（开启发音时，自动识别选中文字中所有带音标的单词）
        let pronunciations = [];
        if (this.settings.enablePronunciation) {
            const words = this.findWordsWithPhonetics(selectedText);
            if (words.length > 0) {
                pronunciations = await this.fetchPronunciations(words);
            }
        }

        // 6. 构建卡片内容
        const htmlContent = this.markdownToHtml(selectedText);
        const sourceRef = modal.source
            ? `<div style="margin-top:12px;"><span class="myref" style="text-decoration:underline;">来源：${modal.source}</span></div>`
            : '';
        const audioRef = this.buildPronunciationHtml(pronunciations);
        const fullContent = htmlContent + sourceRef + audioRef;

        // 6. 确保牌组存在
        await this.ensureDeck(this.settings.deckName);

        // 7. 按模板类型选择字段
        const fields = this.buildFields(fullContent);

        // 8. 发送请求
        const notice = new obsidian.Notice('⏳ 正在发送到 Anki...', 0);

        try {
            const result = await this.ankiRequest('addNote', {
                note: {
                    deckName: this.settings.deckName,
                    modelName: this.settings.modelName,
                    fields,
                    tags: [...this.settings.tags, ...wordRoots],
                    options: { allowDuplicate: false }
                }
            });

            notice.hide();

            if (result.error) {
                if (result.error.includes('duplicate')) {
                    new obsidian.Notice('⚠️ 内容已存在于 [' + this.settings.deckName + '] 牌组中', 4000);
                } else {
                    new obsidian.Notice('❌ Anki 错误: ' + result.error, 6000);
                }
            } else {
                const rootInfo = wordRoots.length > 0 ? '，词根：' + wordRoots.join(' ') : '';
                new obsidian.Notice('✅ 已发送到 [' + this.settings.deckName + '] 牌组' + rootInfo, 3000);
            }

        } catch (err) {
            notice.hide();
            new obsidian.Notice('❌ 发送失败: ' + err.message, 6000);
        }
    }

    // --------------------------------------------------------
    // 解析文章中的词条段落
    // 按 ### N. 格式拆分，返回 [{ number, title, content, word, preview }]
    // --------------------------------------------------------
    async parseArticleSections(file) {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        const sections = [];
        let currentSection = null;

        for (const line of lines) {
            const headingMatch = line.match(/^### (\d+)\.\s+(.+)/);
            if (headingMatch) {
                if (currentSection) sections.push(currentSection);
                currentSection = {
                    number: headingMatch[1],
                    title: headingMatch[2],  // "courage /ˈkɜːrɪdʒ/（名词）"
                    content: headingMatch[2] + '\n',  // 只保留标题文字，去掉 ### N. 前缀
                    startLine: 0
                };
            } else if (currentSection) {
                currentSection.content += line + '\n';
            }
        }
        if (currentSection) sections.push(currentSection);

        // 清理：去掉首尾 --- 分隔线和多余空行
        sections.forEach(s => {
            s.content = s.content.replace(/^-{3,}\s*\n/gm, '').trim();
            // 提取第一个单词作为卡片标题
            s.word = s.title.match(/^(\S+)\s+\//)?.[1] || s.title.split(/\s/)[0];
            // 截取预览文本（前 3 行去掉标题）
            s.preview = s.content.split('\n').slice(1, 4).join(' ').substring(0, 80);
        });

        return sections;
    }

    // --------------------------------------------------------
    // 批量发送入口：解析文章 → 弹窗 → 逐条发送
    // --------------------------------------------------------
    async sendBatchToAnki(editor) {
        const file = this.getActiveFile();
        if (!file) {
            new obsidian.Notice('⚠️ 请先打开一篇笔记');
            return;
        }

        // 1. 检测 Anki 是否运行
        const isConnected = await this.checkAnkiConnection();
        if (!isConnected) {
            new obsidian.Notice(
                '❌ 无法连接 Anki。请确保：\n' +
                '1. Anki 已打开\n' +
                '2. 已安装 AnkiConnect 插件 (代码: 2055492159)',
                8000
            );
            return;
        }

        // 2. 解析文章段落
        const sections = await this.parseArticleSections(file);
        if (sections.length === 0) {
            new obsidian.Notice('⚠️ 未找到 ### N. 格式的词条段落');
            return;
        }

        // 3. 弹窗选择要发送的词条
        const modal = new BatchSendModal(
            this.app,
            sections,
            this.settings.deckName,
            async (selectedSections) => {
                await this.sendBatchCards(selectedSections, file);
            }
        );
        modal.open();
    }

    // --------------------------------------------------------
    // 批量发送卡片：逐条发送，失败不阻塞
    // --------------------------------------------------------
    async sendBatchCards(sections, file) {
        await this.ensureDeck(this.settings.deckName);

        let success = 0, failed = 0, skipped = 0;
        const total = sections.length;
        const notice = new obsidian.Notice(`⏳ 批量发送中 0/${total}`, 0);

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];

            // 更新进度
            notice.setMessage(`⏳ 批量发送中 ${i + 1}/${total}`);

            // 1. Markdown → HTML
            const htmlContent = this.markdownToHtml(section.content);
            const sourceRef = `<div style="margin-top:12px;"><span class="myref" style="text-decoration:underline;">来源：${file.basename}</span></div>`;
            const fullContent = htmlContent + sourceRef;

            // 2. 发音（如果开启）
            let audioRef = '';
            if (this.settings.enablePronunciation) {
                const words = this.findWordsWithPhonetics(section.content);
                if (words.length > 0) {
                    const prons = await this.fetchPronunciations(words);
                    audioRef = this.buildPronunciationHtml(prons);
                }
            }

            // 3. 标签：全局标签 + frontmatter 词根
            const rootTags = this.getFrontmatterRoots(file);
            const tags = [...this.settings.tags, ...rootTags];

            // 4. 发送
            try {
                const fields = this.buildFields(fullContent + audioRef);
                const result = await this.ankiRequest('addNote', {
                    note: {
                        deckName: this.settings.deckName,
                        modelName: this.settings.modelName,
                        fields,
                        tags,
                        options: { allowDuplicate: false }
                    }
                });
                if (result.error) {
                    if (result.error.includes('duplicate')) {
                        skipped++;
                    } else {
                        failed++;
                    }
                } else {
                    success++;
                }
            } catch {
                failed++;
            }
        }

        // 5. 汇总通知
        notice.hide();
        const msg = `✅ 批量发送完成：${success} 条成功，${skipped} 条重复跳过` +
                    (failed > 0 ? `，${failed} 条失败` : '');
        new obsidian.Notice(msg, 5000);
    }

    // --------------------------------------------------------
    // 按模板类型构建字段
    // --------------------------------------------------------
    buildFields(content) {
        const model = this.settings.modelName;

        if (model === 'XXHK - 划线') {
            return { '引用': content };
        }
        if (model === 'XXHK - 批注') {
            return { '批注': content, '引用': '' };
        }
        if (model === 'XXHK - 问答') {
            return { '问题': content, '答案': '', '引用': '' };
        }
        if (['Cloze', '填空题'].includes(model)) {
            return { '文字': content, '背面额外': '' };
        }
        // Basic / 问答题 等
        return { '正面': content, '背面': '' };
    }

    // --------------------------------------------------------
    // AnkiConnect API 通用请求方法（使用 Obsidian requestUrl）
    // --------------------------------------------------------
    async ankiRequest(action, params = {}) {
        const response = await obsidian.requestUrl({
            url: this.settings.ankiConnectUrl,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, version: 6, params })
        });
        return response.json;
    }

    // --------------------------------------------------------
    // 检测 AnkiConnect 是否可连接
    // --------------------------------------------------------
    async checkAnkiConnection() {
        try {
            const result = await this.ankiRequest('version');
            return result.result !== undefined;
        } catch {
            return false;
        }
    }

    // --------------------------------------------------------
    // 确保牌组存在（不存在则创建）
    // --------------------------------------------------------
    async ensureDeck(deckName) {
        try {
            await this.ankiRequest('createDeck', { deck: deckName });
        } catch {
            // 牌组可能已存在，忽略错误
        }
    }

    // --------------------------------------------------------
    // Markdown → HTML 转换
    // 支持：粗体、斜体、高亮、行内代码、Wikilink、删除线、
    //       无序列表（- item）、表格（| col |）
    // --------------------------------------------------------
    markdownToHtml(text) {
        let html = text;

        // 粗体: **text** → <b>text</b>
        html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

        // 斜体: *text* → <i>text</i>（不匹配粗体的 **）
        html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<i>$1</i>');

        // 高亮: ==text== → <mark>text</mark>
        html = html.replace(/==(.+?)==/g, '<mark>$1</mark>');

        // 行内代码: `text` → <code>text</code>
        html = html.replace(/`(.+?)`/g, '<code>$1</code>');

        // Wikilink: [[text]] → text（去掉链接标记，保留文字）
        html = html.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2');
        html = html.replace(/\[\[([^\]]+)\]\]/g, '$1');

        // 删除线: ~~text~~ → <s>text</s>
        html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');

        // ---- 结构化转换（逐行处理）----

        const lines = html.split('\n');
        const processed = [];
        let inList = false;
        let inTable = false;

        for (const line of lines) {
            const trimmed = line.trim();
            const isTable = trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
            const isSeparator = isTable && /^\|[\s\-:|]+\|$/.test(trimmed);
            const isList = /^- .+/.test(trimmed);

            // 无序列表: - item → <li>item</li>
            if (isList) {
                if (!inList) {
                    if (inTable) { processed.push('</table>'); inTable = false; }
                    processed.push('<ul>');
                    inList = true;
                }
                processed.push('<li>' + trimmed.substring(2) + '</li>');
                continue;
            }

            // 表格: | col | col | → <tr><td>col</td>...</tr>
            if (isTable) {
                if (isSeparator) continue; // 跳过分隔行 |---|---|
                if (!inTable) {
                    if (inList) { processed.push('</ul>'); inList = false; }
                    processed.push('<table style="border-collapse:collapse;border:1px solid #ccc;">');
                    inTable = true;
                }
                const cells = trimmed.slice(1, -1).split('|');
                const row = cells.map(c => '<td style="border:1px solid #ccc;padding:4px 8px;">' + c.trim() + '</td>').join('');
                processed.push('<tr>' + row + '</tr>');
                continue;
            }

            // 非列表/非表格行 → 关闭正在渲染的列表或表格
            if (inList) { processed.push('</ul>'); inList = false; }
            if (inTable) { processed.push('</table>'); inTable = false; }
            processed.push(line);
        }

        // 末尾收尾
        if (inList) processed.push('</ul>');
        if (inTable) processed.push('</table>');

        // 换行处理：与 Obsidian 渲染一致
        // - 段落间空行 → <br>（分段）
        // - 段落内单换行 → 忽略（同段落软换行）
        // - 列表项/表格行间 → 忽略（紧凑排列）
        const result = [];
        let sawBlank = false;

        for (let i = 0; i < processed.length; i++) {
            const el = processed[i];
            if (el === '') { sawBlank = true; continue; }
            if (sawBlank) {
                const tag = el.trim().match(/^<(\w+)/);
                // 空行后不是 <li> 或 <td> → 插入 <br>（段落分隔）
                if (!tag || (tag[1] !== 'li' && tag[1] !== 'td')) {
                    result.push('<br>');
                }
            }
            result.push(el);
            sawBlank = false;
        }
        html = result.join('\n').replace(/\n/g, '');

        return html;
    }
}

// ============================================================
// 设置面板
// ============================================================
class AnkiSenderSettingTab extends obsidian.PluginSettingTab {

    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Anki Sender 设置' });

        // 牌组名称
        new obsidian.Setting(containerEl)
            .setName('牌组名称')
            .setDesc('目标 Anki 牌组，不存在时自动创建')
            .addText((text) =>
                text
                    .setPlaceholder('新思维词汇')
                    .setValue(this.plugin.settings.deckName)
                    .onChange(async (value) => {
                        this.plugin.settings.deckName = value;
                        await this.plugin.saveSettings();
                    })
            );

        // 笔记类型
        new obsidian.Setting(containerEl)
            .setName('笔记类型')
            .setDesc('Anki 中的卡片模板类型')
            .addDropdown((dropdown) =>
                dropdown
                    .addOption('XXHK - 划线', 'XXHK - 划线（默认）')
                    .addOption('XXHK - 批注', 'XXHK - 批注')
                    .addOption('XXHK - 问答', 'XXHK - 问答')
                    .addOption('填空题', '填空题 (Cloze)')
                    .addOption('问答题', '问答题 (Basic)')
                    .setValue(this.plugin.settings.modelName)
                    .onChange(async (value) => {
                        this.plugin.settings.modelName = value;
                        await this.plugin.saveSettings();
                    })
            );

        // 默认标签
        new obsidian.Setting(containerEl)
            .setName('默认标签')
            .setDesc('自动附加的 Anki 标签，多个用空格分隔（每张卡可额外输入词根标签）')
            .addText((text) =>
                text
                    .setPlaceholder('如需全局标签可在此设置')
                    .setValue(this.plugin.settings.tags.join(' '))
                    .onChange(async (value) => {
                        this.plugin.settings.tags = value.split(/\s+/).filter(Boolean);
                        await this.plugin.saveSettings();
                    })
            );

        // 单词发音
        new obsidian.Setting(containerEl)
            .setName('单词发音')
            .setDesc('开启后，发送单词时自动下载发音音频并嵌入卡片（点击播放按钮收听）。数据来源：Merriam-Webster（需配置 API Key）')
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.enablePronunciation)
                    .onChange(async (value) => {
                        this.plugin.settings.enablePronunciation = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Merriam-Webster API Key
        new obsidian.Setting(containerEl)
            .setName('Merriam-Webster API Key')
            .setDesc('必填。发音数据来源 Merriam-Webster（免费 1000 次/天）。注册获取：dictionaryapi.com')
            .addText((text) =>
                text
                    .setPlaceholder('留空则仅使用 Free Dictionary')
                    .setValue(this.plugin.settings.dictionaryApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.dictionaryApiKey = value;
                        await this.plugin.saveSettings();
                    })
            );

        // AnkiConnect 地址
        new obsidian.Setting(containerEl)
            .setName('AnkiConnect 地址')
            .setDesc('默认为 http://localhost:8765，一般不需要修改')
            .addText((text) =>
                text
                    .setPlaceholder('http://localhost:8765')
                    .setValue(this.plugin.settings.ankiConnectUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.ankiConnectUrl = value;
                        await this.plugin.saveSettings();
                    })
            );

        // 快捷键提示
        containerEl.createEl('h3', { text: '快捷键' });
        containerEl.createEl('p', {
            text: 'Ctrl + Shift + A：发送选中文字。Ctrl + Shift + B：批量发送当前文章。可在"设置 → 快捷键"中搜索"Anki"自定义修改。'
        });

        // 使用说明
        containerEl.createEl('h3', { text: '单条发送' });
        const instructions = containerEl.createEl('ol');
        instructions.createEl('li', { text: '确保 Anki 已打开并安装 AnkiConnect 插件' });
        instructions.createEl('li', { text: '在编辑器中选中要发送的文字' });
        instructions.createEl('li', { text: '右键 → "发送到 Anki"，或按快捷键' });
        instructions.createEl('li', { text: '弹窗中自动填入词根标签（单词）和来源（文章名），确认后发送' });
        instructions.createEl('li', { text: '发送后在 Anki 中用 Ctrl+U 下划线标记关键词，实现主动回忆' });

        containerEl.createEl('h3', { text: '批量发送' });
        const batchInstructions = containerEl.createEl('ol');
        batchInstructions.createEl('li', { text: '打开包含 ### N. 格式词条的笔记（如新思维词汇）' });
        batchInstructions.createEl('li', { text: '不选中文字 → 右键 → "批量发送到 Anki"，或按 Ctrl+Shift+B' });
        batchInstructions.createEl('li', { text: '弹窗列出所有词条，默认全选，可取消不需要的词条' });
        batchInstructions.createEl('li', { text: '点击发送后逐条处理，重复内容自动跳过，最后显示汇总' });

        // AnkiConnect 安装提示
        containerEl.createEl('h3', { text: 'AnkiConnect 安装' });
        const ankiInstructions = containerEl.createEl('ol');
        ankiInstructions.createEl('li', { text: '打开 Anki' });
        ankiInstructions.createEl('li', { text: '工具 → 插件 → 获取插件' });
        ankiInstructions.createEl('li', { text: '输入代码: 2055492159，点击安装' });
        ankiInstructions.createEl('li', { text: '重启 Anki 生效' });
    }
}

module.exports = AnkiSenderPlugin;
