export enum InteractionMode {
  Batch = "batchmode",
  Nonstop = "nonstopmode",
  Scroll = "scrollmode",
  Error = "errorstopmode",
}

export enum MktexFMT {
  Tex = "tex",
  Tfm = "tfm",
}

export enum OutputFMT {
  DVI = "dvi",
  PDF = "pdf",
}

export type CommonArguments = {
  draftmode?: boolean;
  fileLineError?: boolean;
  fmt?: string;
  // haltOnError?: boolean;
  ini?: boolean;
  interaction?: InteractionMode;
  jobname?: string;
  kpathseaDebug?: number;
  mktex?: boolean;
  mktexFMT?: MktexFMT;
  outputComment?: string;
  outputDirectory?: string;
  progname?: string;
  recorder?: boolean;
  shellEscape?: boolean;
  shellRestricted?: boolean;
  synctex?: number;
};

export type LuaTexArguments = {
  debugFormat?: boolean;
  lua?: string;
  nosocket?: boolean;
  outputFormat?: OutputFMT;
  safer?: boolean;
  utc?: number;
  luaonly?: boolean;
  luaconly?: boolean;
  luahashchars?: boolean;
};

export type XEtexArguments = {
  etex?: boolean;
  mltex?: boolean;
  outputDriver?: string;
  parseFirstLine?: boolean;
  papersize?: string;
  srcSpecials?: string;
  bit8?: boolean;
};

export type PDFTexArguments = {
  enc?: boolean;
  etex?: boolean;
  ipc?: boolean;
  ipcStart?: boolean;
  mltex?: boolean;
  outputFormat?: OutputFMT;
  parseFirstLine?: boolean;
  srcSpecials?: string;
  translateFile?: string;
  bit8?: boolean;
};
