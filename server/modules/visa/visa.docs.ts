/** /api/docs：把 docs/API.md 直接渲染成一个页面，不引第三方 markdown 库。 */

const PAGE_STYLE = `
  body{margin:0;padding:40px 20px;background:#fdf7f0;color:#3b2f27;
       font:15px/1.75 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
  main{max-width:860px;margin:0 auto}
  h1{font-size:26px;margin:0 0 20px}
  h2{font-size:20px;margin:36px 0 12px;padding-bottom:6px;border-bottom:1px solid #ecdfd0}
  h3{font-size:16px;margin:24px 0 8px}
  p,li{color:#4a3a2f}
  code{background:#f3e7da;border-radius:4px;padding:1px 5px;font-size:13px;
       font-family:ui-monospace,Consolas,monospace}
  pre{background:#2f2620;color:#f6ecdf;border-radius:10px;padding:14px 16px;overflow:auto}
  pre code{background:none;color:inherit;padding:0;font-size:13px}
  table{border-collapse:collapse;width:100%;margin:12px 0;font-size:14px}
  th,td{border:1px solid #e6d7c7;padding:7px 10px;text-align:left;vertical-align:top}
  th{background:#f7ece0}
  a{color:#b4552c}
  ul,ol{padding-left:22px}
`

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function inline(text: string): string {
    return escapeHtml(text)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function renderTable(rows: string[]): string {
    const cells = (row: string) =>
        row
            .replace(/^\s*\|/, "")
            .replace(/\|\s*$/, "")
            .split("|")
            .map((cell) => cell.trim());
    const [head, , ...body] = rows;
    const headHtml = cells(head)
        .map((cell) => `<th>${inline(cell)}</th>`)
        .join("");
    const bodyHtml = body
        .map((row) => `<tr>${cells(row).map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`)
        .join("");
    return `<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

export function renderMarkdown(markdown: string): string {
    const lines = markdown.split(/\r?\n/);
    const out: string[] = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];

        if (!line.trim()) {
            index += 1;
            continue;
        }

        if (line.trim().startsWith("```")) {
            const code: string[] = [];
            index += 1;
            while (index < lines.length && !lines[index].trim().startsWith("```")) {
                code.push(lines[index]);
                index += 1;
            }
            index += 1;
            out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
            continue;
        }

        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading) {
            const level = heading[1].length;
            out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
            index += 1;
            continue;
        }

        if (line.trim().startsWith("|")) {
            const rows: string[] = [];
            while (index < lines.length && lines[index].trim().startsWith("|")) {
                rows.push(lines[index]);
                index += 1;
            }
            out.push(renderTable(rows));
            continue;
        }

        if (/^\s*[-*]\s+/.test(line)) {
            const items: string[] = [];
            while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
                items.push(lines[index].replace(/^\s*[-*]\s+/, ""));
                index += 1;
            }
            out.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
            continue;
        }

        if (/^\s*\d+\.\s+/.test(line)) {
            const items: string[] = [];
            while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
                items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
                index += 1;
            }
            out.push(`<ol>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ol>`);
            continue;
        }

        const paragraph: string[] = [];
        while (
            index < lines.length &&
            lines[index].trim() &&
            !lines[index].trim().startsWith("```") &&
            !lines[index].trim().startsWith("|") &&
            !/^#{1,6}\s/.test(lines[index]) &&
            !/^\s*[-*]\s+/.test(lines[index]) &&
            !/^\s*\d+\.\s+/.test(lines[index])
        ) {
            paragraph.push(lines[index].trim());
            index += 1;
        }
        out.push(`<p>${inline(paragraph.join(" "))}</p>`);
    }

    return out.join("\n");
}

export async function docsPage(): Promise<Response> {
    const file = Bun.file(`${process.cwd()}/docs/API.md`);
    if (!(await file.exists())) {
        return new Response("docs/API.md 不在部署目录里", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
    }

    const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VisaGo 接口文档</title>
<style>${PAGE_STYLE}</style>
</head>
<body><main>${renderMarkdown(await file.text())}</main></body>
</html>`;

    return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
    });
}
