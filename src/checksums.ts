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

  for (const relativePath of relativePaths) {
    if (!(relativePath in product.checksums)) {
      continue;
    }

    const checksum = computeChecksum(path.join(appRoot, relativePath));

    if (product.checksums[relativePath] === checksum) {
      continue;
    }

    product.checksums[relativePath] = checksum;
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
