import { basename, dirname, join, parse } from "path";
import {
  CommonArguments,
  LuaTexArguments,
  PDFTexArguments,
  XEtexArguments,
} from "./args";
import { cleanUpFiles, parseArguments } from "./utils";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { LogItem, LogLevel, parseLog } from "./logs";

export type RenderResult = {
  pdf?: string;
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
  args?: CompilerArgs<T>;
  logLevel?: LogLevel;
  passover?: number;
};

function assembleCompileCommand<T extends CompilerType>(
  src: string,
  options?: CompilerOptions<T>
): string {
  const compiler = options?.compiler || CompilerType.PDFTex;
  const prependString = compiler === CompilerType.LUATex ? "--" : "-";

  const commandArgs: string[] = Object.entries(options?.args || {}).map(
    ([key, value]) => prependString + parseArguments(key, value)
  );

  return [compiler, ...commandArgs, src].join(" ");
}

function compile<T extends CompilerType>(
  src: string,
  options?: CompilerOptions<T>
) {
  const cwd = dirname(src);
  const srcBasename = basename(src);
  const command = assembleCompileCommand(srcBasename, options);

  execSync(command, { cwd });

  return join(
    options?.args?.outputDirectory || cwd,
    (options?.args?.jobname || srcBasename) + ".pdf"
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
): RenderResult {
  // TODO check if compiler is installed

  if (!existsSync(src)) {
    throw new Error("The Source file was not found!");
  }

  const passover = options?.passover || 2;
  const logLevel = options?.logLevel || LogLevel.INFO;

  const srcDir = dirname(src);
  const srcBasename = parse(src).name;

  let pdf = undefined;
  let logs: LogItem[] = [];

  try {
    for (let i = 0; i < passover; i++) {
      pdf = compile(src, options);
    }
  } catch (error) {
    // Do nothing, we will return the logs
  }

  logs = parseLog(
    `${join(srcDir, options?.args?.jobname || srcBasename)}.log`
  ).filter((log) => log.level >= logLevel);

  // Clean up temporary files
  cleanUpFiles(srcDir);

  return {
    pdf,
    logs,
  };
}
