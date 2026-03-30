import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const packageJsonPath = join(process.cwd(), "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const packageName = packageJson.name ?? "fonted";
const packageVersion = packageJson.version ?? "0.0.0";
const vsixName = `${packageName}-${packageVersion}.vsix`;

rmSync(vsixName, { force: true });

execFileSync(
	"zip",
	[
		"-rq",
		vsixName,
		".",
		"-x",
		".git/*",
		".github/*",
		"node_modules/*",
		"*.vsix",
	],
	{ stdio: "inherit" },
);

console.log(`Created ${vsixName}`);
