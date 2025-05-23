import fs from "fs";
import { extname, join } from "path";

export function copyDirectory(source: string, dest: string) {
  if (!fs.existsSync(source)) {
    throw new Error(`Source directory does not exist: ${source}`);
  }

  if (!fs.statSync(source).isDirectory()) {
    throw new Error(`Source is not a directory: ${source}`);
  }

  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Get a list of files in the source directory
  const files = fs.readdirSync(source);

  // Copy each file individually to the temp folder
  files.forEach((file) => {
    const tempSrc = join(source, file);

    if (tempSrc === dest) {
      return; // Skip copying the destination directory itself
    }

    const tempDest = join(dest, file);
    // Check if the current item is a directory
    if (fs.statSync(tempSrc).isDirectory()) {
      // Recursively copy subdirectories
      copyDirectory(tempSrc, tempDest);
    } else {
      // Copy files
      fs.copyFileSync(tempSrc, tempDest);
    }
  });
}

export function kebabize(str: string) {
  return str
    .split("")
    .map((letter, idx) =>
      letter.toUpperCase() === letter
        ? `${idx !== 0 ? "-" : ""}${letter.toLowerCase()}`
        : letter
    )
    .join("");
}

export const switchArguments: string[] = [
  "fileLineError",
  "mktex",
  "shellEscape",
  "parseFirstLine",
];

export function parseArguments(
  key: string,
  value: boolean | string | number
): string {
  switch (typeof value) {
    case "boolean":
      if (switchArguments.includes(key)) {
        if (!value) {
          key = `no${key[0].toUpperCase()}${key.slice(1)}`;
        }
      }
      return kebabize(key);
    case "string":
      return `${kebabize(key)}=${value.toString()}`;
    case "number":
    default:
      return `${kebabize(key)}=${value.toString()}`;
  }
}

export function cleanUpFiles(
  dir: string,
  extToDelete: string[] = [
    ".log",
    ".aux",
    ".out",
    ".toc",
    ".xdv",
    ".bbl",
    ".bcf",
  ]
) {
  // Check if the directory exists
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Invalid directory: ${dir}`);
  }

  // Clean up files in the directory
  fs.readdirSync(dir).forEach((file) => {
    const filePath = join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      // Recursively clean up subdirectories
      cleanUpFiles(filePath, extToDelete);
    } else if (
      fs.statSync(filePath).isFile() &&
      extToDelete.includes(extname(file))
    ) {
      fs.unlinkSync(filePath);
    }
  });
}
