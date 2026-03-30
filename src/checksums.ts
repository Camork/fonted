import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import sudo from "sudo-prompt";
import tmp from "tmp";

const rootDir = vscode.env.appRoot;
const appDir = path.join(rootDir, "out");

const productFile = path.join(rootDir, "product.json");
const origFile = `${productFile}.orig.${vscode.version}`;

type ProductJson = {
  checksums?: Record<string, string>;
  [key: string]: unknown;
};

type SudoPrompt = {
  exec(
    command: string,
    options: { name: string },
    callback: (error?: Error | null) => void,
  ): void;
};

type Tmp = {
  file(callback: (err: Error | null, tmpPath: string) => void): void;
};

const sudoPrompt = sudo as SudoPrompt;
const tmpModule = tmp as Tmp;

const messages = {
  changed: (verb: string) =>
    `Checksums ${verb}. Please restart VSCode to see effect.`,
  unchanged: "No changes to checksums were necessary.",
  error: `An error occurred during execution.
Make sure you have write access rights to the VSCode files, see README`,
};

export async function apply() {
  const product = requireUncached(productFile);
  if (!product.checksums) {
    vscode.window.showInformationMessage(messages.unchanged);
  }
  const checksums = product.checksums;
  let changed = false;
  let message = messages.unchanged;
  for (const [filePath, curChecksum] of Object.entries(checksums ?? {})) {
    const checksum = computeChecksum(path.join(appDir, ...filePath.split("/")));
    if (checksum !== curChecksum) {
      if (checksums) {
        checksums[filePath] = checksum;
      }
      changed = true;
    }
  }
  if (changed) {
    const json = JSON.stringify(product, null, "\t");
    try {
      if (!fs.existsSync(origFile)) {
        await moveFile(productFile, origFile);
      }
      await writeFile(productFile, json);
      message = messages.changed("applied");
    } catch (err) {
      console.error(err);
      message = messages.error;
    }
  }
  vscode.window.showInformationMessage(message);
}

export async function restore() {
  let message = messages.unchanged;
  try {
    if (fs.existsSync(origFile)) {
      await deleteFile(productFile);
      await moveFile(origFile, productFile);
      message = messages.changed("restored");
    }
  } catch (err) {
    console.error(err);
    message = messages.error;
  }
  vscode.window.showInformationMessage(message);
}

function computeChecksum(file: string) {
  const contents = fs.readFileSync(file);
  return crypto
    .createHash("sha256")
    .update(contents)
    .digest("base64")
    .replace(/=+$/u, "");
}

export function cleanupOrigFiles() {
  const oldOrigFiles = fs
    .readdirSync(rootDir)
    .filter((file) => /\.orig\./u.test(file))
    .filter((file) => !file.endsWith(vscode.version));
  for (const file of oldOrigFiles) {
    void deleteFileAdmin(path.join(rootDir, file));
  }
}

function writeFile(
  filePath: string,
  writeString: string,
  encoding: BufferEncoding = "utf8",
) {
  return new Promise<void>((resolve, reject) => {
    try {
      fs.writeFileSync(filePath, writeString, encoding);
      resolve();
    } catch (err) {
      console.error(err);
      writeFileAdmin(filePath, writeString, encoding)
        .then(resolve)
        .catch(reject);
    }
  });
}

function writeFileAdmin(
  filePath: string,
  writeString: string,
  encoding: BufferEncoding = "utf8",
  promptName = "File Writer",
) {
  console.info("Writing file with administrator privileges ...");
  return new Promise<void>((resolve, reject) => {
    tmpModule.file((err, tmpPath) => {
      if (err) {
        reject(err);
      } else {
        fs.writeFile(tmpPath, writeString, encoding, (writeError) => {
          if (writeError) {
            reject(writeError);
          } else {
            sudoPrompt.exec(
              `${process.platform === "win32" ? "copy /y " : "cp -f "}"${tmpPath}" "${filePath}"`,
              { name: promptName },
              (error) => {
                if (error) {
                  reject(error);
                } else {
                  resolve();
                }
              },
            );
          }
        });
      }
    });
  });
}

function deleteFile(filePath: string) {
  return new Promise<void>((resolve, reject) => {
    try {
      fs.unlinkSync(filePath);
      resolve();
    } catch (err) {
      console.error(err);
      deleteFileAdmin(filePath).then(resolve).catch(reject);
    }
  });
}

function deleteFileAdmin(filePath: string, promptName = "File Deleter") {
  console.info("Deleting file with administrator privileges ...");
  return new Promise<void>((resolve, reject) => {
    sudoPrompt.exec(
      `${process.platform === "win32" ? "del /f /q " : "rm -f "}"${filePath}"`,
      { name: promptName },
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });
}

function moveFile(filePath: string, newPath: string) {
  return new Promise<void>((resolve, reject) => {
    try {
      fs.renameSync(filePath, newPath);
      resolve();
    } catch (err) {
      console.error(err);
      moveFileAdmin(filePath, newPath).then(resolve).catch(reject);
    }
  });
}

function moveFileAdmin(
  filePath: string,
  newPath: string,
  promptName = "File Renamer",
) {
  console.info("Renaming file with administrator privileges ...");
  return new Promise<void>((resolve, reject) => {
    sudoPrompt.exec(
      `${process.platform === "win32" ? "move /y " : "mv -f "}"${filePath}" "${newPath}"`,
      { name: promptName },
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });
}

function requireUncached(modulePath: string): ProductJson {
  return JSON.parse(fs.readFileSync(modulePath, "utf8")) as ProductJson;
}
