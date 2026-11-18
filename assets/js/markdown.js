// Rendu Markdown sécurisé (sans dépendance) — le HTML saisi est toujours échappé.
export function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function normaliserTexte(str) {
    return String(str ?? "").replace(/\r\n?/g, "\n");
}

function markdownInline(text) {
    const codes = [];
    let out = escapeHtml(text).replace(/`([^`\n]+)`/g, (_, c) => {
        codes.push(c);
        return `\u0000${codes.length - 1}\u0000`;
    });

    out = out
        .replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g, (_, a, b) => `<strong>${a || b}</strong>`)
        .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
        .replace(/(^|[^\w_])_([^_\n]+)_(?![\w_])/g, "$1<em>$2</em>")
        .replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

    return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}

export function renderMarkdown(src) {
    const lines = normaliserTexte(src).split("\n");
    const html = [];
    let i = 0;

    const LIST = /^\s*([-*+]|\d+\.)\s+/;
    const isBlockStart = (l) =>
        /^\s*```/.test(l) || /^#{1,4}\s/.test(l) || LIST.test(l) ||
        /^>\s?/.test(l) || /^\s*(-{3,}|\*{3,})\s*$/.test(l);

    while (i < lines.length) {
        const line = lines[i];
        if (line.trim() === "") { i++; continue; }

        if (/^\s*```/.test(line)) {
            const buf = [];
            i++;
            while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
            i++;
            html.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
            continue;
        }

        const h = line.match(/^(#{1,4})\s+(.*)$/);
        if (h) {
            html.push(`<h${h[1].length}>${markdownInline(h[2])}</h${h[1].length}>`);
            i++; continue;
        }

        if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { html.push("<hr>"); i++; continue; }

        if (/^>\s?/.test(line)) {
            const buf = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
            html.push(`<blockquote>${buf.map(markdownInline).join("<br>")}</blockquote>`);
            continue;
        }

        if (LIST.test(line)) {
            const ordered = /^\s*\d+\./.test(line);
            const items = [];
            while (i < lines.length && LIST.test(lines[i])) {
                items.push(`<li>${markdownInline(lines[i].replace(LIST, ""))}</li>`);
                i++;
            }
            const tag = ordered ? "ol" : "ul";
            html.push(`<${tag}>${items.join("")}</${tag}>`);
            continue;
        }

        // Paragraphe : chaque saut de ligne simple devient un <br>
        const buf = [];
        while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) buf.push(lines[i++]);
        html.push(`<p>${buf.map(markdownInline).join("<br>")}</p>`);
    }

    return html.join("");
}
