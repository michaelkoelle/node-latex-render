import { basename, dirname, join, parse, posix } from "path";
import {
  CommonArguments,
  LuaTexArguments,
  PDFTexArguments,
  XEtexArguments,
} from "./args";
import { cleanUpFiles, parseArguments } from "./utils";
import { execSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { getLogLevelIndex, LogItem, LogLevel, parseLog } from "./logs";
import { tmpdir } from "os";

export type RenderResult = {
  pdf?: string;
  logs: LogItem[];
};

export type RenderResultBuffer = {
  pdf?: ArrayBuffer;
  logs: LogItem[];
};

export enum CompilerType {
  PDFTex = "pdflatex",
  LUATex = "luatex",
  XETex = "xetex",
}

type CompilerArgs<T extends CompilerType> =
  | (T extends CompilerType.LUATex
      ? LuaTexArguments
      : T extends CompilerType.XETex
      ? XEtexArguments
      : T extends CompilerType.PDFTex
      ? PDFTexArguments
      : never) &
      CommonArguments;

type CompilerOptions<T extends CompilerType> = {
  compiler?: T;
  args?: CompilerArgs<T> | string;
  logLevel?: LogLevel;
  passover?: number;
};

function assembleCompileCommand<T extends CompilerType>(
  src: string,
  options?: CompilerOptions<T>
): string {
  const compiler = options?.compiler || CompilerType.PDFTex;
  let commandArgs: string = "";

  if (typeof options?.args === "string") {
    commandArgs = options.args;
  } else {
    const prependString = compiler === CompilerType.LUATex ? "--" : "-";

    const commandArgsTemp: string[] = Object.entries(options?.args || {}).map(
      ([key, value]) => prependString + parseArguments(key, value)
    );
    commandArgs = commandArgsTemp.join(" ");
  }

  return [compiler, commandArgs, src].join(" ");
}

function compile<T extends CompilerType>(
  src: string,
  options?: CompilerOptions<T>
): string {
  const cwd = dirname(src);
  const srcBasename = basename(src);
  const fileName = parse(src).name;
  const command = assembleCompileCommand(srcBasename, options);

  execSync(command, { cwd });

  const outputDirectory =
    typeof options?.args === "object" &&
    options?.args !== null &&
    "outputDirectory" in options.args
      ? (options.args as any).outputDirectory
      : cwd;
  const jobname =
    typeof options?.args === "object" &&
    options?.args !== null &&
    "jobname" in options.args
      ? (options.args as any).jobname
      : fileName;

  return join(outputDirectory, jobname + ".pdf");
}

function isCompilerOptions<T extends CompilerType>(
  obj: any,
  obj2: any
): obj is CompilerOptions<T> {
  // If both are undefined, default to treating as empty CompilerOptions
  if (obj === undefined && obj2 === undefined) return true;

  // Must be an object and obj2 must not be provided
  if (typeof obj !== "object" || obj === null || obj2 !== undefined)
    return false;

  // Either an empty object or has known CompilerOptions keys
  return (
    Object.keys(obj).length === 0 ||
    "compiler" in obj ||
    "args" in obj ||
    "logLevel" in obj ||
    "passover" in obj
  );
}
/**
 * Renders a LaTeX source file into a PDF.
 *
 * @param src - The path to the LaTeX source file.
 * @param options - Optional configuration for the compiler, including arguments, log level, and number of passes.
 * @returns An object containing the path to the generated PDF (if successful) and the parsed log items.
 */
export function render<T extends CompilerType>(
  src: string,
  options?: CompilerOptions<T>
): RenderResult;

/**
 * Renders a LaTeX source file into a PDF.
 *
 * @param src - The path to the LaTeX source file.
 * @param files - A map of file names to their contents as ArrayBuffers.
 * @param options - Optional configuration for the compiler, including arguments, log level, and number of passes.
 * @returns An object containing the PDF as an ArrayBuffer (if successful) and the parsed log items.
 */
export function render<T extends CompilerType>(
  src: string,
  files: Record<string, ArrayBuffer>,
  options?: CompilerOptions<T>
): RenderResultBuffer;

export function render<T extends CompilerType>(
  src: string,
  optsOrFiles?: Record<string, ArrayBuffer> | CompilerOptions<T>,
  opts?: CompilerOptions<T>
): RenderResult | RenderResultBuffer {
  // TODO check if compiler is installed

  let options: CompilerOptions<T> | undefined;
  let files: Record<string, ArrayBuffer> | undefined;
  let tempDir: string | undefined;
  let source: string = src;

  if (isCompilerOptions<T>(optsOrFiles, opts)) {
    // Local files
    options = optsOrFiles as CompilerOptions<T>;
  } else {
    // Buffer files
    files = optsOrFiles as Record<string, ArrayBuffer>;
    options = opts as CompilerOptions<T>;

    // Save buffer files to a temporary directory
    tempDir = mkdtempSync(join(tmpdir(), "latex-"));
    source = join(tempDir, src);

    for (const [filename, buffer] of Object.entries(files)) {
      // if the file is nested, create the necessary directories
      const filePath = join(tempDir, filename);
      const dirPath = dirname(filePath);
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
      // Write the buffer to the file
      writeFileSync(filePath, Buffer.from(buffer));
    }
  }

  if (!existsSync(source)) {
    throw new Error("The Source file was not found!");
  }

  const passover = options?.passover || 2;
  const logLevel = options?.logLevel || LogLevel.INFO;

  const srcDir = dirname(source);
  const srcBasename = parse(source).name;

  let pdf: string | undefined = undefined;
  let logs: LogItem[] = [];

  try {
    for (let i = 0; i < passover; i++) {
      pdf = compile(source, options);
    }
  } catch (error) {
    // Do nothing, we will return the logs
  }

  const jobname =
    typeof options?.args === "object" &&
    options?.args !== null &&
    "jobname" in options.args
      ? (options.args as any).jobname
      : srcBasename;

  logs = parseLog(`${join(srcDir, jobname)}.log`).filter(
    (log) => getLogLevelIndex(log.level) >= getLogLevelIndex(logLevel)
  );

  // Clean up temporary files
  cleanUpFiles(srcDir);

  if (!tempDir) {
    // Just return the local path to the PDF
    return {
      pdf,
      logs,
    };
  }

  // Read file to buffer
  if (!pdf) {
    rmSync(tempDir, { recursive: true });
    return {
      pdf: undefined,
      logs,
    };
  }

  const pdfBuffer = readFileSync(pdf);
  rmSync(tempDir, { recursive: true });

  return {
    pdf: pdfBuffer.buffer,
    logs,
  };
}
