# node-latex-render

Render latex documents using nodejs

## Prerequisites

At least one of the supported LaTeX compilers installed.

- PDFTeX
- LuaTeX
- XETeX

## Install

```
npm install node-latex-render
```

or

```
yarn add node-latex-render
```

## Example

```javascript
import { render } from "node-latex-render";

const src = "./path/to/src.tex";
const options = {
  compiler: "pdflatex",
  args: {
    jobname: "example",
    outputComment: "This is an example",
  },
};

const { pdf, logs } = render(src, options); // Returns path to pdf and log items
```

or

```javascript
import { render } from "node-latex-render";

const src = "main.tex";
const files = {
  "main.tex": new TextEncoder().encode(`\\documentclass{article}
                                        \\begin{document}
                                            Hello, world!
                                        \\end{document}`).buffer,
};
const options = {
  compiler: "pdflatex",
  args: "-jobname=example",
};

const { pdf, logs } = render(src, files, compiler); // Returns pdf buffer and log items
```

## Logs

The `logs` returned by the `render` function contain detailed information about the LaTeX compilation process. Below are the types used for the logs:

```typescript
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
```

Each `LogItem` represents a single log entry with the following properties:

- `level`: The severity level of the log (e.g., `debug`, `info`, `warning`, etc.).
- `message`: A human-readable message describing the log.
- `raw`: The raw log output from the LaTeX compiler.
- `line` (optional): The line number in the source file where the log entry occurred.
- `file` (optional): The file associated with the log entry.
- `content` (optional): Additional content related to the log entry.

## Supported Arguments

This section details the supported arguments for each LaTeX compiler.

### Common Arguments

| Argument          | Type                                                      | Description                                                               |
| ----------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `draftmode`       | `boolean`                                                 | Enables draft mode, which speeds up compilation by not generating output. |
| `fileLineError`   | `boolean`                                                 | Print file:line:error style messages.                                     |
| `fmt`             | `string`                                                  | Specifies a precompiled format file to use.                               |
| `ini`             | `boolean`                                                 | Start in INI mode (used for creating format files).                       |
| `interaction`     | `batchmode \| nonstopmode \| scrollmode \| errorstopmode` | Sets the interaction mode (e.g.,`batchmode`, `nonstopmode`).              |
| `jobname`         | `string`                                                  | Specifies the name of the output files.                                   |
| `kpathseaDebug`   | `number`                                                  | Sets the Kpathsea debugging flags.                                        |
| `mktex`           | `boolean`                                                 | Enable/disable `mktex` script (e.g. `mktexpk`, `mktextfm` or `mktexfmt`). |
| `mktexFMT`        | `tex \| tfm`                                              | Enable/disable `mktexfmt` script for a specific format.                   |
| `outputComment`   | `string`                                                  | Specifies a DVI comment.                                                  |
| `outputDirectory` | `string`                                                  | Specifies the directory for output files.                                 |
| `progname`        | `string`                                                  | Sets the program name.                                                    |
| `recorder`        | `boolean`                                                 | Enable filename recorder.                                                 |
| `shellEscape`     | `boolean`                                                 | Enable restricted `\\write18{shell command}`.                             |
| `shellRestricted` | `boolean`                                                 | Enable restricted `\\write18{shell command}`.                             |
| `synctex`         | `number`                                                  | Generate SyncTeX data.                                                    |

### LuaTeX Arguments

| Argument       | Type         | Description                                      |
| -------------- | ------------ | ------------------------------------------------ |
| `debugFormat`  | `boolean`    | Debug format loading.                            |
| `lua`          | `string`     | Specifies a Lua initialization file.             |
| `nosocket`     | `boolean`    | Disable the Lua socket library.                  |
| `outputFormat` | `dvi \| pdf` | Specifies the output format (e.g.,`pdf`, `dvi`). |
| `safer`        | `boolean`    | Disable easily exploitable TeX primitives.       |
| `utc`          | `number`     | Force UTC time.                                  |
| `luaonly`      | `boolean`    | Run Lua code and exit.                           |
| `luaconly`     | `boolean`    | Bytecode compile Lua files.                      |
| `luahashchars` | `boolean`    | Tune the Lua initial hash size.                  |

### XETeX Arguments

| Argument         | Type      | Description                                              |
| ---------------- | --------- | -------------------------------------------------------- |
| `etex`           | `boolean` | Enable e-TeX extensions.                                 |
| `mltex`          | `boolean` | Enable MLTeX extensions (for multi-lingual typesetting). |
| `outputDriver`   | `string`  | Specifies the output driver (e.g.,`xdvipdfmx`).          |
| `parseFirstLine` | `boolean` | Parse the first line of the input file for options.      |
| `papersize`      | `string`  | Specifies the paper size.                                |
| `srcSpecials`    | `string`  | Insert source specials into the output.                  |
| `bit8`           | `boolean` | Enable 8-bit input.                                      |

### PDFTeX Arguments

| Argument         | Type         | Description                                             |
| ---------------- | ------------ | ------------------------------------------------------- |
| `enc`            | `boolean`    | Enable `encTeX` extensions (for character translation). |
| `etex`           | `boolean`    | Enable e-TeX extensions.                                |
| `ipc`            | `boolean`    | Send DVI or PDF output to a socket.                     |
| `ipcStart`       | `boolean`    | As `ipc`, but starts the server at the other end.       |
| `mltex`          | `boolean`    | Enable MLTeX extensions.                                |
| `outputFormat`   | `dvi \| pdf` | Specifies the output format (e.g.,`pdf`, `dvi`).        |
| `parseFirstLine` | `boolean`    | Parse the first line of the input file for options.     |
| `srcSpecials`    | `string`     | Insert source specials into the output.                 |
| `translateFile`  | `string`     | Specifies a character translation file.                 |
| `bit8`           | `boolean`    | Enable 8-bit input.                                     |
