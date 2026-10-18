import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { describe, expect, it } from "vitest";
import { htmlToMarkdown } from "@/lib/exporters";
import { importFile, MAX_IMPORT_BYTES } from "@/lib/importers";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("importFile", () => {
  it("turns plain text into escaped paragraphs and uses the file name as the title", async () => {
    const result = await importFile("Meeting notes.v2.txt", bytes("Line one\r\nline two\n\n\nSecond <para> & more"));
    expect(result.title).toBe("Meeting notes.v2");
    expect(result.html).toBe("<p>Line one<br />line two</p><p>Second &lt;para&gt; &amp; more</p>");
  });

  it("converts markdown structure and strips embedded scripts", async () => {
    const md = "# Plan\n\nSome **bold** and _italic_.\n\n- one\n- two\n\n1. first\n\n<script>alert(1)</script>";
    const { html } = await importFile("plan.md", bytes(md));
    expect(html).toContain("<h1>Plan</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toMatch(/<ul>\s*<li>one<\/li>/);
    expect(html).toMatch(/<ol>\s*<li>first<\/li>/);
    expect(html).not.toContain("script");
  });

  it("preserves headings and inline formatting from .docx", async () => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: "Quarterly plan", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({
              children: [
                new TextRun({ text: "Important", bold: true }),
                new TextRun(" and "),
                new TextRun({ text: "underlined", underline: {} }),
              ],
            }),
          ],
        },
      ],
    });
    const { title, html } = await importFile("Plan.docx", new Uint8Array(await Packer.toBuffer(doc)));
    expect(title).toBe("Plan");
    expect(html).toContain("<h1>Quarterly plan</h1>");
    expect(html).toContain("<strong>Important</strong>");
    expect(html).toContain("<u>underlined</u>");
  });

  it("rejects unsupported, oversized and unreadable files with clear errors", async () => {
    await expect(importFile("photo.png", bytes("x"))).rejects.toMatchObject({ status: 415 });
    await expect(importFile("big.txt", new Uint8Array(MAX_IMPORT_BYTES + 1))).rejects.toMatchObject({
      status: 413,
    });
    await expect(importFile("broken.docx", bytes("not a zip"))).rejects.toMatchObject({ status: 422 });
  });
});

describe("htmlToMarkdown", () => {
  it("exports headings, emphasis, underline and lists", () => {
    const md = htmlToMarkdown(
      "<h1>Title</h1><p><strong>b</strong> <em>i</em> <u>u</u></p><ul><li><p>one</p></li></ul><ol><li><p>first</p></li></ol>",
    );
    expect(md).toContain("# Title");
    expect(md).toContain("**b** _i_ <u>u</u>");
    expect(md).toMatch(/^-\s+one$/m);
    expect(md).toMatch(/^1\.\s+first$/m);
  });
});
