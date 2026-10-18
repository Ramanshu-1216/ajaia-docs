/**
 * Browser walkthrough of every main flow, against a running app.
 *
 *   BASE_URL=http://localhost:3000 npm run e2e        (defaults to localhost:3000)
 *   SCREENSHOTS=1 npm run e2e                          (also writes docs/screenshots/*.png)
 *
 * Uses the locally installed Google Chrome via playwright-core (no browser download).
 * Works in a brand-new document and deletes everything it creates, so it is safe to run against
 * production without disturbing the seeded demo state.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const SHOTS = process.env.SCREENSHOTS === "1";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASSWORD = "ajaia-demo";
const RUN = `Walkthrough ${new Date().toISOString().slice(11, 19)}`;

const step = (msg) => console.log(`✓ ${msg}`);
const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(ROOT, "docs/screenshots", `${name}.png`) });

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const created = [];

  async function signIn(name, email, { screenshot } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log(`  [${name}] page error: ${e.message}`));
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    if (screenshot) await shot(page, screenshot);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`${BASE}/`);
    return page;
  }
  const saved = (page) => page.getByText("All changes saved").waitFor({ timeout: 15000 });
  const docId = (page) => new URL(page.url()).pathname.split("/").pop();

  try {
    // Alice: create, write with formatting, rename, persist
    const alice = await signIn("Alice", "alice@ajaia.dev", { screenshot: "01-login" });
    await shot(alice, "02-dashboard-owner");
    await alice.getByRole("button", { name: "New document" }).click();
    await alice.waitForURL(/\/documents\//);
    created.push(docId(alice));
    await alice.getByLabel("Document title").fill(RUN);
    const editor = alice.locator(".ProseMirror");
    await editor.click();
    await alice.getByLabel("Text style").selectOption("h1");
    await alice.keyboard.type("Launch plan");
    await alice.keyboard.press("Enter");
    await alice.keyboard.type("We ship the ");
    await alice.keyboard.press("Control+b");
    await alice.keyboard.type("editor beta");
    await alice.keyboard.press("Control+b");
    await alice.keyboard.type(" on Monday, ");
    await alice.keyboard.press("Control+i");
    await alice.keyboard.type("pending review");
    await alice.keyboard.press("Control+i");
    await alice.keyboard.type(" — owners are ");
    await alice.keyboard.press("Control+u");
    await alice.keyboard.type("accountable");
    await alice.keyboard.press("Control+u");
    await alice.keyboard.type(".");
    await alice.keyboard.press("Enter");
    await alice.getByLabel("Text style").selectOption("h2");
    await alice.keyboard.type("Open questions");
    await alice.keyboard.press("Enter");
    await alice.getByRole("button", { name: "Numbered list" }).click();
    await alice.keyboard.type("Who signs off on the release?");
    await alice.keyboard.press("Enter");
    await alice.keyboard.type("Do we need a migration guide?");
    await alice.keyboard.press("Enter");
    await alice.keyboard.press("Enter");
    await alice.getByRole("button", { name: "Bulleted list" }).click();
    await alice.keyboard.type("Draft lives here until launch");
    await saved(alice);
    await shot(alice, "03-editor");
    step("Created a document with H1/H2, bold, italic, underline, numbered + bulleted lists; autosaved");

    await alice.reload();
    await editor.locator("h1", { hasText: "Launch plan" }).waitFor();
    await editor.locator("strong", { hasText: "editor beta" }).waitFor();
    await editor.locator("em", { hasText: "pending review" }).waitFor();
    await editor.locator("u", { hasText: "accountable" }).waitFor();
    await editor.locator("ol li", { hasText: "migration guide" }).waitFor();
    await editor.locator("ul li", { hasText: "Draft lives here" }).waitFor();
    if ((await alice.getByLabel("Document title").inputValue()) !== RUN) throw new Error("title not persisted");
    step("Title and formatting persisted across reload");

    // Share: Carol can view, Bob can edit; unknown email is explained
    await alice.getByRole("button", { name: "Share" }).click();
    const dialog = alice.locator("dialog");
    for (const [email, role] of [["carol@ajaia.dev", "viewer"], ["bob@ajaia.dev", "editor"]]) {
      await dialog.getByLabel("Email address").fill(email);
      await dialog.getByLabel("Access level", { exact: true }).selectOption(role);
      await dialog.getByRole("button", { name: "Share" }).click();
      await dialog.getByRole("listitem").filter({ hasText: email }).waitFor();
    }
    await dialog.getByLabel("Email address").fill("nobody@ajaia.dev");
    await dialog.getByRole("button", { name: "Share" }).click();
    await dialog.getByText("No user with the email nobody@ajaia.dev.").waitFor();
    await shot(alice, "04-share-dialog");
    await dialog.getByLabel("Email address").fill("");
    await dialog.getByRole("button", { name: "Done" }).click();
    step("Shared with Carol (viewer) and Bob (editor); unknown email rejected with a clear message");

    // Carol: sees it under "Shared with you", read-only
    const carol = await signIn("Carol", "carol@ajaia.dev");
    await carol.getByRole("region", { name: "Shared with you" }).getByText(RUN).waitFor();
    await shot(carol, "05-dashboard-shared");
    await carol.getByRole("link", { name: RUN }).click();
    await carol.getByText("You can view this document").waitFor();
    if ((await carol.locator(".ProseMirror").getAttribute("contenteditable")) !== "false") throw new Error("viewer can type");
    if (await carol.getByRole("toolbar").count()) throw new Error("viewer sees the toolbar");
    await shot(carol, "06-viewer");
    step("Carol sees it under Shared with you, read-only with no toolbar");

    // Bob (editor) and Alice edit concurrently: the stale save is caught, not applied
    const bob = await signIn("Bob", "bob@ajaia.dev");
    await bob.getByRole("link", { name: RUN }).click();
    await bob.locator(".ProseMirror").waitFor();
    await editor.locator("p", { hasText: "We ship the" }).click();
    await alice.keyboard.press("End");
    await alice.keyboard.type(" Alice adds a note.");
    await saved(alice);
    await bob.locator(".ProseMirror p", { hasText: "We ship the" }).click();
    await bob.keyboard.press("End");
    await bob.keyboard.type(" Bob edits a stale copy.");
    await bob.getByText("Someone else saved changes to this document").waitFor({ timeout: 15000 });
    await shot(bob, "07-conflict");
    await bob.getByRole("button", { name: "Load latest version" }).click();
    await bob.locator(".ProseMirror p", { hasText: "Alice adds a note." }).waitFor();
    step("Bob's stale save raised a conflict; loading the latest version shows Alice's edit");

    // Import a .docx, then export Markdown
    await alice.goto(`${BASE}/`);
    await alice.locator('input[type="file"]').setInputFiles(path.join(ROOT, "samples/q4-planning-brief.docx"));
    await alice.waitForURL(/\/documents\//);
    created.push(docId(alice));
    await alice.locator(".ProseMirror h1", { hasText: "Q4 Planning Brief" }).waitFor();
    await alice.locator(".ProseMirror strong", { hasText: "Microsoft Word" }).waitFor();
    await alice.locator(".ProseMirror ul li", { hasText: "Cut onboarding time in half" }).waitFor();
    await shot(alice, "08-imported-docx");
    const [download] = await Promise.all([
      alice.waitForEvent("download"),
      alice.getByRole("button", { name: "Export .md" }).click(),
    ]);
    const md = readFileSync(await download.path(), "utf8");
    if (!md.includes("# Q4 Planning Brief") || !md.includes("**Microsoft Word**")) throw new Error(`bad export:\n${md}`);
    step(`Imported a .docx (headings, bold, bullets intact) and exported ${download.suggestedFilename()}`);

    // Unsupported upload is explained
    await alice.goto(`${BASE}/`);
    await alice.locator('input[type="file"]').setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("x") });
    await alice.getByText("Only .txt, .md and .docx files can be imported.").waitFor();
    step("Unsupported file type rejected with a clear message");

    // Clean up everything this run created
    for (const id of created) {
      const status = await alice.evaluate((id) => fetch(`/api/documents/${id}`, { method: "DELETE" }).then((r) => r.status), id);
      if (status !== 204) throw new Error(`cleanup failed for ${id}: ${status}`);
    }
    step(`Cleaned up ${created.length} documents`);
    console.log("\nALL FLOWS PASSED");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exit(1);
});
