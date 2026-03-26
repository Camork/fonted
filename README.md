# fonted

An extension to change the UI font of vscode. That's all it does.

Compared to the original `fonted`, this version also updates VS Code's checksum metadata after patching `workbench.html`, so enabling the font hack is less likely to trigger the usual corrupt / unsupported installation warning.


<img src="assets/dark.png" alt="dark" />

## Usage

After installation, provide the setting: `"fonted.font": "Pragmata Pro Mono"`, run the `Fonted: Enable` command (from the command palette). Then restart VS Code when prompted.

`Fonted: Enable` and `Fonted: Disable` now update VS Code's workbench checksum automatically, so you should not see the usual corrupt / unsupported installation warning after toggling the font patch.

