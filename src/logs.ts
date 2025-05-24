import fs, { existsSync } from "fs";

const LOG_WRAP_LIMIT = 79;
const LATEX_WARNING_REGEX = /^LaTeX(?:3| Font)? Warning: (.*)$/;
const HBOX_WARNING_REGEX = /^(Over|Under)full \\(v|h)box/;
const PACKAGE_WARNING_REGEX = /^((?:Package|Class|Module) \b.+\b Warning:.*)$/;
const LINES_REGEX = /lines? ([0-9]+)/;
const PACKAGE_REGEX = /^(?:Package|Class|Module) (\b.+\b) Warning/;
const FILE_LINE_ERROR_REGEX = /^([./].*):(\d+): (.*)/;

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  TYPESETTING = "typesetting",
  WARNING = "warning",
  ERROR = "error",
}

export type LogItem = {
  level: LogLevel;
  message: string;
  raw: string;
  line?: number;
  file?: string;
  content?: string;
};

interface FileEntry {
  path: string;
  files: FileEntry[];
}

enum State {
  NORMAL = 0,
  ERROR = 1,
}

interface LogTextState {
  lines: string[];
  row: number;
}

/**
 * Returns the index of a given LogLevel key.
 * @param key The LogLevel key as a string (e.g., "DEBUG")
 * @returns The index (0-based) of the key, or -1 if not found
 */
export function getLogLevelIndex(level: LogLevel): number {
  const entries = Object.entries(LogLevel);
  return entries.findIndex(([key, value]) => value === level);
}

function createLogText(text: string): LogTextState {
  const normalizedText = text.replace(/(\r\n)|\r/g, "\n");
  const wrappedLines = normalizedText.split("\n");
  const lines = [wrappedLines[0]];

  for (let i = 1; i < wrappedLines.length; i++) {
    const prevLine = wrappedLines[i - 1];
    const currentLine = wrappedLines[i];

    if (
      prevLine.length === LOG_WRAP_LIMIT &&
      prevLine.slice(-3) !== "..." &&
      currentLine.charAt(0) !== "!"
    ) {
      lines[lines.length - 1] += currentLine;
    } else {
      lines.push(currentLine);
    }
  }

  return {
    lines,
    row: 0,
  };
}

function nextLine(logState: LogTextState): string | false {
  logState.row++;
  if (logState.row >= logState.lines.length) {
    return false;
  } else {
    return logState.lines[logState.row];
  }
}

function rewindLine(logState: LogTextState): void {
  logState.row--;
}

function linesUpToNextWhitespaceLine(
  logState: LogTextState,
  stopAtError?: boolean
): string[] {
  return linesUpToNextMatchingLine(logState, /^ *$/, stopAtError);
}

function linesUpToNextMatchingLine(
  logState: LogTextState,
  match: RegExp,
  stopAtError?: boolean
): string[] {
  const lines: string[] = [];

  while (true) {
    const nextLineValue = nextLine(logState);

    if (nextLineValue === false) {
      break;
    }

    if (stopAtError && nextLineValue.match(/^! /)) {
      rewindLine(logState);
      break;
    }

    lines.push(nextLineValue);

    if (nextLineValue.match(match)) {
      break;
    }
  }

  return lines;
}

export function parseLog(logfile: string): LogItem[] {
  // check if log-file exists
  if (!existsSync(logfile)) {
    throw new Error("The log file was not found!");
  }

  // read log-file
  const logEntries = fs.readFileSync(logfile, "utf8");

  // check if log-file is empty
  if (logEntries.length === 0) {
    return [];
  }

  const log = createLogText(logEntries);

  let state = State.NORMAL;
  let logItem: LogItem | undefined;
  let currentLine: string | false;
  const logItems: LogItem[] = [];
  let currentFilePath: string | undefined;
  const fileStack: FileEntry[] = [];

  while ((currentLine = nextLine(log)) !== false) {
    if (state === State.NORMAL) {
      // Fatal error line
      if (
        currentLine[0] === "!" &&
        currentLine !==
          "!  ==> Fatal error occurred, no output PDF file produced!"
      ) {
        state = State.ERROR;
        logItem = {
          level: LogLevel.ERROR,
          message: currentLine.slice(2),
          content: "",
          raw: currentLine + "\n",
          file: currentFilePath,
        };

        // File line error
      } else if (FILE_LINE_ERROR_REGEX.test(currentLine)) {
        state = State.ERROR;
        logItem = parseFileLineError(currentLine);
        if (logItem) logItem.file = currentFilePath;

        // Runaway argument error
      } else if (!!currentLine.match(/^Runaway argument/)) {
        const item = parseRunawayArgumentError(currentLine, log);
        if (item) {
          item.file = currentFilePath;
          logItems.push(item);
        }
        // Warning lines
      } else if (!!currentLine.match(LATEX_WARNING_REGEX)) {
        const item = parseSingleWarningLine(currentLine, LATEX_WARNING_REGEX);
        if (item) {
          item.file = currentFilePath;
          logItems.push(item);
        }
        // Hbox warning lines
      } else if (!!currentLine.match(HBOX_WARNING_REGEX)) {
        const item = parseHboxLine(currentLine);
        if (item) {
          item.file = currentFilePath;
          logItems.push(item);
        }

        // Package warning lines
      } else if (!!currentLine.match(PACKAGE_WARNING_REGEX)) {
        const item = parseMultipleWarningLine(currentLine, log);
        if (item) {
          item.file = currentFilePath;
          logItems.push(item);
        }

        // Else
      } else {
        parseParensForFilenames(currentLine, 0, fileStack, currentFilePath);
        if (fileStack.length > 0) {
          currentFilePath = fileStack[fileStack.length - 1].path;
        }
      }
    }

    if (state === State.ERROR && logItem) {
      logItem.content += linesUpToNextMatchingLine(log, /^l\.[0-9]+/).join(
        "\n"
      );
      logItem.content += "\n";
      logItem.content += linesUpToNextWhitespaceLine(log, true).join("\n");
      logItem.content += "\n";
      logItem.content += linesUpToNextWhitespaceLine(log, true).join("\n");
      logItem.raw += logItem.content;
      const lineNo = logItem.raw.match(/l\.([0-9]+)/);
      if (lineNo && logItem.line === undefined) {
        logItem.line = parseInt(lineNo[1], 10);
      }
      logItems.push(logItem);
      state = State.NORMAL;
    }
  }

  return logItems;
}

function parseFileLineError(line: string): LogItem | undefined {
  const result = line.match(FILE_LINE_ERROR_REGEX);

  if (!result) {
    return;
  }

  return {
    line: parseInt(result[2], 10),
    file: result[1],
    level: LogLevel.ERROR,
    message: result[3],
    raw: line + "\n",
  };
}

function parseRunawayArgumentError(
  line: string,
  log: LogTextState
): LogItem | undefined {
  let content =
    linesUpToNextWhitespaceLine(log).join("\n") +
    "\n" +
    linesUpToNextWhitespaceLine(log).join("\n");
  let raw = content;
  let tempLineNo;
  const lineNo = raw.match(/l\.([0-9]+)/);
  if (lineNo) {
    tempLineNo = parseInt(lineNo[1], 10);
  }

  return {
    line: tempLineNo,
    level: LogLevel.ERROR,
    message: line,
    content: "",
    raw: line + "\n",
  };
}

function parseSingleWarningLine(
  line: string,
  prefixRegex: RegExp
): LogItem | undefined {
  const warningMatch = line.match(prefixRegex);

  if (!warningMatch) {
    return;
  }

  const warning = warningMatch[1];
  const lineMatch = warning.match(LINES_REGEX);
  const lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
  return {
    line: lineNumber,
    level: LogLevel.WARNING,
    message: warning,
    raw: warning,
  };
}

function parseMultipleWarningLine(
  line: string,
  log: LogTextState
): LogItem | undefined {
  let warningMatch = line.match(PACKAGE_WARNING_REGEX);

  if (!warningMatch) {
    return;
  }

  const warningLines = [warningMatch[1]];
  let lineMatch = line.match(LINES_REGEX);
  let lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
  const packageMatch = line.match(PACKAGE_REGEX);
  const packageName = packageMatch?.[1] || "";
  const prefixRegex = new RegExp(
    "(?:\\(" + packageName + "\\))*[\\s]*(.*)",
    "i"
  );

  let currentLine: string | false;
  while ((currentLine = nextLine(log))) {
    lineMatch = currentLine.match(LINES_REGEX);
    lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : lineNumber;
    warningMatch = currentLine.match(prefixRegex);
    if (warningMatch) {
      warningLines.push(warningMatch[1]);
    }
  }
  const rawMessage = warningLines.join(" ");
  return {
    line: lineNumber,
    level: LogLevel.WARNING,
    message: rawMessage,
    raw: rawMessage,
  };
}

function parseHboxLine(line: string): LogItem | undefined {
  const lineMatch = line.match(LINES_REGEX);
  const lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
  return {
    line: lineNumber,
    level: LogLevel.TYPESETTING,
    message: line,
    raw: line,
  };
}

function parseParensForFilenames(
  line: string,
  openParentheses: number = 0,
  fileStack: FileEntry[] = [],
  currentFilePath: string | undefined = undefined
): void {
  let currentLine = line;
  const pos = currentLine.search(/[()]/);
  if (pos !== -1) {
    const token = currentLine[pos];
    currentLine = currentLine.slice(pos + 1);
    if (token === "(") {
      const filePath = consumeFilePath(currentLine);
      if (filePath.path) {
        currentFilePath = filePath.path;
        const newFile: FileEntry = {
          path: filePath.path,
          files: [],
        };
        fileStack.push(newFile);
        // state.currentFileList.push(newFile);
        // state.currentFileList = newFile.files;
        currentLine = filePath.remaining;
      } else {
        openParentheses++;
      }
    } else if (token === ")") {
      if (openParentheses > 0) {
        openParentheses--;
      } else {
        if (fileStack.length > 1) {
          fileStack.pop();
          const previousFile = fileStack[fileStack.length - 1];
          currentFilePath = previousFile.path;
          // state.currentFileList = previousFile.files;
        }
      }
    }
    parseParensForFilenames(currentLine, openParentheses, fileStack);
  }
}

function consumeFilePath(line: string): {
  path: string | null;
  remaining: string;
} {
  if (!line.match(/^\/?([^ ()\\]+\/)+/)) {
    return { path: null, remaining: line };
  }

  let endOfFilePath = line.search(/[ ()\\]/);

  while (endOfFilePath !== -1 && line[endOfFilePath] === " ") {
    const partialPath = line.slice(0, endOfFilePath);
    if (/\.\w+$/.test(partialPath)) {
      break;
    }
    const remainingPath = line.slice(endOfFilePath + 1);
    if (/^\s*["()[\]]/.test(remainingPath)) {
      break;
    }
    const nextEndOfPath = remainingPath.search(/[ "()[\]]/);
    if (nextEndOfPath === -1) {
      endOfFilePath = -1;
    } else {
      endOfFilePath += nextEndOfPath + 1;
    }
  }

  let path: string;
  let remaining: string;
  if (endOfFilePath === -1) {
    path = line;
    remaining = "";
  } else {
    path = line.slice(0, endOfFilePath);
    remaining = line.slice(endOfFilePath);
  }
  return { path, remaining };
}
