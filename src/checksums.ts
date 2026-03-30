import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

const PRODUCT_JSON_PATH = "product.json";

type ProductJson = {
	checksums?: Record<string, string>;
	[key: string]: unknown;
};

export function syncChecksums(appRoot: string, relativePaths: string[]) {
	const productJsonPath = path.join(appRoot, PRODUCT_JSON_PATH);
	const productJsonContent = fs.readFileSync(productJsonPath, "utf8");
	const product = JSON.parse(productJsonContent) as ProductJson;

	if (!product.checksums) {
		return;
	}

	let hasChanges = false;
	const targetFiles = new Set(
		relativePaths.map((relativePath) => path.resolve(appRoot, relativePath)),
	);

	for (const [checksumKey, currentChecksum] of Object.entries(
		product.checksums,
	)) {
		const filePath = resolveChecksumFilePath(appRoot, checksumKey);
		if (targetFiles.size > 0 && !targetFiles.has(filePath)) {
			continue;
		}
		if (!fs.existsSync(filePath)) {
			continue;
		}

		const checksum = computeChecksum(filePath);
		if (currentChecksum === checksum) {
			continue;
		}

		product.checksums[checksumKey] = checksum;
		hasChanges = true;
	}

	if (!hasChanges) {
		return;
	}

	const lineEnding = productJsonContent.includes("\r\n") ? "\r\n" : "\n";
	const nextContent = `${JSON.stringify(product, null, "\t").replace(/\n/g, lineEnding)}${lineEnding}`;

	fs.writeFileSync(productJsonPath, nextContent, "utf8");
}

function computeChecksum(filePath: string) {
	const content = new Uint8Array(fs.readFileSync(filePath));
	return crypto
		.createHash("sha256")
		.update(content)
		.digest("base64")
		.replace(/=+$/u, "");
}

function resolveChecksumFilePath(appRoot: string, checksumKey: string) {
	const normalizedSegments = checksumKey
		.replace(/^[./\\]+/u, "")
		.split(/[\\/]+/u)
		.filter((segment) => segment.length > 0);
	return path.resolve(appRoot, ...normalizedSegments);
}
