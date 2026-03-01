(() => {
  // node_modules/@oblivionocean/minigfm/dist/index.mjs
  var MiniGFM = class {
    constructor(options) {
      this.options = options || {};
    }
    /**
    * 解析Markdown文本并返回HTML字符串
    * @param {string} markdown - Markdown文本
    * @returns {string} HTML字符串
    */
    parse(markdown) {
      if (typeof markdown != "string") return "";
      const codeBlocks = [], codeInline = [];
      markdown = markdown.replace(/(?:^|\n)[^\\]?(`{3,4})[ ]*(\w*?)\n([\s\S]*?)\n\1/g, (_, __, lang, code) => {
        codeBlocks.push({ lang: lang.trim(), code: code.trim() });
        return `<!----CODEBLOCK${codeBlocks.length - 1}---->`;
      }).replace(/([^\\])`([^`]+)`/g, (_, after, code) => {
        codeInline.push(this.escapeHTML(code));
        return `${after}<!----CODEINLINE${codeInline.length - 1}---->`;
      }).replace(/\\([\\*_{}[\]()#+\-.!`])/g, (_, m) => `&#${m.charCodeAt(0)}`).replace(/%%[\n ][^%]+[\n ]%%/g, "");
      markdown = this.parseInlines(this.parseBlocks(markdown)).replace(
        /<!----CODEINLINE(\d+)---->/g,
        (_, id) => codeInline[id] ? `<code>${codeInline[id]}</code>` : ""
      ).replace(/<!----CODEBLOCK(\d+)---->/g, (_, id) => {
        if (!codeBlocks[id]) return "";
        const { lang, code } = codeBlocks[id];
        let highlighted = code;
        if (this.options.hljs) try {
          highlighted = (lang ? this.options.hljs.highlight(code, { language: lang }) : this.options.hljs.highlightAuto(code)).value;
        } catch {
        }
        return lang ? `<pre lang="${lang}"><code class="hljs ${lang} lang-${lang}">${highlighted}</code></pre>` : `<pre><code>${highlighted}</code></pre>`;
      });
      return !this.options.unsafe ? this.safeHTML(markdown) : markdown;
    }
    /**
     * 解析跨行元素和行级块
     * @param {string} text - 待处理的文本
     * @returns {string} 处理后的文本
     * @private
     * @static
     */
    parseBlocks(text) {
      return text.replace(/^[^\\]?\s*(#{1,6}) ([^\n]+)$/gm, (match, level, content) => {
        return `<h${level.length}>${content}</h${level.length}>`;
      }).replace(/^[ \t]*[-\*\+][ \t]+\[([ ]*[ xX]?)\]\s([^\n]+)$/gm, (match, checked, content) => {
        return `<li><input type="checkbox" ${checked.trim().toLowerCase() === "x" ? "checked" : ""} disabled> ${content}</li>`;
      }).replace(/^[ \t]*[-\*\+] ([^\n]+)$/gm, `<li>$1</li>`).replace(/^[ \t]*(\d+\.) ([^\n]+)$/gm, `<li>$1 $2</li>`).replace(/^ {0,3}(([*_-])( *\2 *){2,})(?:\s*$|$)/gm, () => "<hr/>").replace(/^[ \t]*((?:\>[ \t]*)+)([^\n]*)$/gm, (match, sep, content) => {
        let num = sep.length / 2;
        if (content.trim() === "") return "";
        return "<blockquote>".repeat(num) + content + "</blockquote>".repeat(num);
      }).replace(/^([^\n]*\|[^\n]*)\n([-:| ]+\|)+[-\| ]*\n((?:[^\n]*\|[^\n]*(?:\n|$))*)/gm, (match, headers, align, rows) => {
        return this.parseTable(headers, align, rows);
      }).split(/\n{2,}|\\\n/g).map((s) => /^<(\w+)/.test(s) ? s : `<p>${s}</p>`).join("<br />");
    }
    /**
     * 解析表格
     * @param {Array} headers 表头
     * @param {String} alignLine 对齐方式
     * @param {Array} rows 表格行
     * @return {String}
     * @private
     */
    parseTable(headers, alignLine, rows) {
      const headerCols = headers.split("|").map((h) => h.trim()).filter(Boolean);
      const aligns = this.parseTableAlignment(alignLine);
      const bodyRows = rows.trim().split("\n").reduce((arr, line) => {
        if (!line.includes("|")) return arr;
        const cols = line.split("|").slice(1, -1).map((c) => c.trim());
        arr.push(headerCols.map((_, i) => cols[i] || ""));
        return arr;
      }, []);
      const table = ["<table>", "<thead><tr>"];
      headerCols.forEach((h, i) => {
        table.push(`<th${aligns[i] ? ` align="${aligns[i]}"` : ""}>${h}</th>`);
      });
      table.push("</tr></thead>");
      if (bodyRows.length) {
        table.push("<tbody>");
        bodyRows.forEach((row) => {
          table.push(
            "<tr>",
            ...row.map((c, j) => `<td${aligns[j] ? ` align="${aligns[j]}"` : ""}>${c}</td>`),
            "</tr>"
          );
        });
        table.push("</tbody>");
      }
      return [...table, "</table>"].join("");
    }
    /**
     * 解析表格对齐方式
     * @param {string} alignLine
     * @returns {Array}
     * @private
     * @static
     */
    parseTableAlignment(alignLine) {
      return alignLine.split("|").map((part) => part.trim()).filter(Boolean).map((part) => {
        const left = part.startsWith(":");
        const right = part.endsWith(":");
        return left && right ? "center" : left ? "left" : right ? "right" : null;
      });
    }
    /**
     * 解析内联表达式
     * @param {string} text
     * @return {string} 解析后的文本
     * @private
     * @static
     */
    parseInlines(text) {
      return text.replace(/[\*\_]{2}(.+?)[\*\_]{2}/g, "<strong>$1</strong>").replace(
        /(?<!\*)_(.+?)_(?!\*)|(?<!\*)\*(.+?)\*(?!\*)/,
        (match, g1, g2) => `<em>${g1 || g2}</em>`
      ).replace(/~~(.+?)~~/g, "<del>$1</del>").replace(/\<([^\s@\>]+@[^\s@\>]+\.[^\s@\>]+)\>/g, '<a href="mailto:$1">$1</a>').replace(/\<((?:https?:\/\/|ftp:\/\/|mailto:|tel:)[^\>\s]+)\>/g, '<a href="$1">$1</a>').replace(/\!\[([^\]]*)\]\(([^\)]+)\)/g, '<img src="$2" alt="$1">').replace(/\[([^\]]+)\]\(([^\) ]+)[ ]?(\"[^\)\"]+\")?\)/g, (match, desc, url, title) => `<a href="${url}"${title ? " title=" + title : ""}>${desc}</a>`);
    }
    /**
     * 转义 HTML 字符串
     * @param {string} text
     * @returns {string}
     */
    escapeHTML(text) {
      return text.replace(/[&<>"']/g, (m) => `&#${m.charCodeAt(0)}`);
    }
    /**
     * 安全化 HTML 字符串
     * @param {string} text
     * @returns {string}
     */
    safeHTML(text) {
      return text.replace(/<(\/?)\s*(script|iframe|object|embed|frame|link|meta|style|svg|math)[^>]*>/gi, (m) => this.escapeHTML(m)).replace(/\s(?!data-)[\w-]+=\s*["'\s]*(javascript:|data:|expression:)[^"'\s>]*/gi, "").replace(
        /\<[^\>]+\>/g,
        (tag) => tag.replace(/\s+on\w+\s*=\s*["']?[^"'\\]*["']?/gi, "")
      );
    }
  };

  // sidepanel.js
  var GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  var STORAGE_KEY = "gemini_api_key";
  var THEME_STORAGE_KEY = "themePreference";
  var THEME_DEFAULT = "default";
  function applyTheme(theme) {
    document.documentElement.className = theme && theme !== THEME_DEFAULT ? theme : "";
  }
  async function applyReadingMode() {
    const { [THEME_STORAGE_KEY]: theme } = await chrome.storage.local.get(THEME_STORAGE_KEY);
    applyTheme(theme);
    return theme;
  }
  var outputEl = document.getElementById("output");
  var smartSummaryBtn = document.getElementById("smart-summary");
  var keyTakeawaysBtn = document.getElementById("key-takeaways");
  var themeSelector = document.getElementById("theme-selector");
  var md = new MiniGFM();
  async function getApiKey() {
    const { [STORAGE_KEY]: key } = await chrome.storage.local.get(STORAGE_KEY);
    return key ?? null;
  }
  async function getActiveTabUrl() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url?.includes("youtube.com/watch")) return null;
    return tab.url;
  }
  async function fetchSummary(url, mode) {
    const key = await getApiKey();
    if (!key) {
      showError("No API key. Add one in extension options.");
      return;
    }
    const prompt = mode === "smart_summary" ? "Provide a concise summary of this YouTube video in 3-5 sentences." : "List key takeaways with clear section headers (e.g. **Motivation:**, **Technologies:**). Use bullet points and numbered steps where appropriate. Keep each bullet concise (1-2 sentences).";
    const body = {
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          {
            file_data: {
              file_uri: url
            }
          }
        ]
      }]
    };
    const res = await fetch(`${GEMINI_API}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (res.status === 429) {
      showError("Rate limit exceeded. Try again later.");
      return;
    }
    if (res.status === 400) {
      showError("Video may be private or unlisted.");
      return;
    }
    if (!res.ok) {
      showError(`Request failed: ${res.status}`);
      return;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      showError("No content in response.");
      return;
    }
    outputEl.innerHTML = md.parse(text);
    outputEl.hidden = false;
  }
  function showError(msg) {
    outputEl.replaceChildren();
    const p = document.createElement("p");
    p.className = "error";
    p.textContent = msg;
    outputEl.appendChild(p);
    outputEl.hidden = false;
  }
  function setLoading(loading) {
    smartSummaryBtn.disabled = loading;
    keyTakeawaysBtn.disabled = loading;
  }
  smartSummaryBtn.addEventListener("click", async () => {
    const url = await getActiveTabUrl();
    if (!url) {
      showError("Open a YouTube video first.");
      return;
    }
    setLoading(true);
    try {
      await fetchSummary(url, "smart_summary");
    } finally {
      setLoading(false);
    }
  });
  keyTakeawaysBtn.addEventListener("click", async () => {
    const url = await getActiveTabUrl();
    if (!url) {
      showError("Open a YouTube video first.");
      return;
    }
    setLoading(true);
    try {
      await fetchSummary(url, "key_takeaways");
    } finally {
      setLoading(false);
    }
  });
  themeSelector.addEventListener("change", (e) => {
    const value = e.target.value;
    chrome.storage.local.set({ [THEME_STORAGE_KEY]: value });
    applyTheme(value);
  });
  (async function init() {
    const savedTheme = await applyReadingMode();
    themeSelector.value = savedTheme || THEME_DEFAULT;
  })();
})();
