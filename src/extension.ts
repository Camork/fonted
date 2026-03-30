// The module 'vscode' contains the VS Code extensibility API
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { apply, cleanupOrigFiles, restore } from "./checksums";

const STYLE_ID_TAG = '<style id="fonted">';
const WORKBENCH_RELATIVE_PATHS = [
  "out/vs/code/electron-sandbox/workbench/workbench.html",
  "out/vs/code/electron-browser/workbench/workbench.html",
] as const;

export function activate(context: vscode.ExtensionContext) {
  const enable = vscode.commands.registerCommand("fonted.enable", async () => {
    try {
      await setFont(context);
      await apply();
    } catch (error) {
      showError("enable Fonted", error);
    }
  });

  context.subscriptions.push(enable);

  const disable = vscode.commands.registerCommand(
    "fonted.disable",
    async () => {
      try {
        await unsetFont();
        await restore();
      } catch (error) {
        showError("disable Fonted", error);
      }
    },
  );

  context.subscriptions.push(disable);

  cleanupOrigFiles();

  const shouldAutoFix = vscode.workspace
    .getConfiguration()
    .get("fonted.autoFix");
  if (shouldAutoFix) {
    void apply();
  }
}

export function deactivate() {}

function getAppRoot() {
  return vscode.env.appRoot;
}

function getWorkbenchInfo() {
  for (const relativePath of WORKBENCH_RELATIVE_PATHS) {
    const absolutePath = path.join(getAppRoot(), relativePath);

    if (fs.existsSync(absolutePath)) {
      return {
        absolutePath,
        relativePath,
      };
    }
  }

  throw new Error("Unable to find VS Code workbench.html");
}

function getWorkbenchHtml() {
  const html = fs.readFileSync(getWorkbenchInfo().absolutePath, "utf8");
  return html;
}

function getStyleMarkup() {
  const font = getFont();

  const fontStretch = font.fontStretch
    ? `font-stretch: ${font.fontStretch};`
    : "";

  const style = `{font-family: "${font.fontFamily}" !important; ${fontStretch}}`;

  return `<style id="fonted">
  :is(.mac, .windows, .linux, :host-context(.OS), .monaco-inputbox input):not(.monaco-mouse-cursor-text) ${style}
  </style>`;
}

async function setFont(_context: vscode.ExtensionContext) {
  const font = getFont();

  if (!font.fontFamily) {
    await unsetFont();
    return;
  }

  const html = getWorkbenchHtml();

  if (html.includes(STYLE_ID_TAG)) {
    return;
  }

  const newHtml = html.replace("</head>", `${getStyleMarkup()}</head>`);

  save(newHtml);
  await promptRestart();
}

async function unsetFont() {
  const html = getWorkbenchHtml();

  if (!html.includes(STYLE_ID_TAG)) {
    return;
  }

  const newHtml = html.replace(
    /<style id="fonted">(?:[^<]*\n)*([^<]*)<\/style>/gm,
    "",
  );

  save(newHtml);
  await promptRestart();
}

function save(html: string) {
  const workbenchInfo = getWorkbenchInfo();
  fs.writeFileSync(workbenchInfo.absolutePath, html);
}

function getConfig(name: string) {
  return vscode.workspace.getConfiguration().get(`fonted.${name}`);
}

function getFont() {
  return {
    fontFamily: getConfig("font") as string | undefined,
    fontStretch: getConfig("fontStretch") as string | undefined,
  };
}

function showError(action: string, error: unknown) {
  const reason = error instanceof Error ? error.message : String(error);
  void vscode.window.showErrorMessage(
    `Unable to ${action}. ${reason || "Unknown error."}`,
  );
}

// Copied from https://github.dev/iocave/monkey-patch/blob/b75dd36951132aae10b898a345cda489f0a5e3d6/src/extension.ts#L188
async function promptRestart() {
  // This is a hacky way to display the restart prompt
  const v = vscode.workspace.getConfiguration().inspect("window.titleBarStyle");
  if (v !== undefined) {
    const value = vscode.workspace
      .getConfiguration()
      .get("window.titleBarStyle");
    await vscode.workspace
      .getConfiguration()
      .update(
        "window.titleBarStyle",
        value === "native" ? "custom" : "native",
        vscode.ConfigurationTarget.Global,
      );
    vscode.workspace
      .getConfiguration()
      .update(
        "window.titleBarStyle",
        v.globalValue,
        vscode.ConfigurationTarget.Global,
      );
  }
}
