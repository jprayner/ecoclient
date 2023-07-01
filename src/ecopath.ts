export const isValidName = (filename: string) => {
  const validFilename = /^[a-zA-Z0-9!_-]{1,10}$/;
  return validFilename.test(filename);
};

export const isValidWildcardName = (filename: string) => {
  const validFilename = /^[a-zA-Z0-9!_*#-]{1,10}$/;
  return validFilename.test(filename);
};

const validatePathParts = (pathParts: string[]) => {
  for (const pathPart of pathParts) {
    if (!isValidWildcardName(pathPart)) {
      throw new Error(`Invalid path part '${pathPart}'`);
    }
  }
  return pathParts;
};

export const isWildcardMatch = (wildcard: string, filename: string) => {
  if (!isValidWildcardName(wildcard)) {
    throw new Error(`Invalid wildcard '${wildcard}'`);
  }
  if (!isValidName(filename)) {
    throw new Error(`Invalid filename '${filename}'`);
  }

  const regExp = new RegExp(`^${wildcard.replace('*', '.*').replace('#', '.')}$`);
  return regExp.test(filename);
};

export const parseDirBase = (pathPart: string) => {
  switch (pathPart.charAt(0)) {
    case ':':
    case '$':
      if (pathPart.length === 1) {  
        return {
          dirBase: pathPart.charAt(0),
          discName: undefined,
        };
      }

      if (!isValidName(pathPart.substring(1))) {
        throw new Error(`Invalid disc name '${pathPart.substring(1)}'`);
      }

      return {
        dirBase: pathPart,
        discName: pathPart.substring(1),
      };

    case '@': // relative to current directory
      // fall-through

    // eslint-disable-next-line no-fallthrough
    case '&': // relative to user root directory

    // eslint-disable-next-line no-fallthrough
    case '^': // relative to parent directory
      if (pathPart.length > 1) {
        return undefined;
      }

      return {
        dirBase: pathPart.charAt(0),
        discName: undefined,
      };
    default:
      return undefined;
  }
};

export type FileSpecifier = {
  dirBase: string | undefined,
  discName: string | undefined,
  pathParts: string[],
  dirname: string | undefined,
  basename: string | undefined,
};

export const parseFileSpecifier: (path: string) => FileSpecifier = function (path: string) {
  // <directory base> ::= :[<disc name>] || $[<disc name>] || & || @ || ^
  // <directory specifier> ::= [<directory base>.] {<name>. }<name>

  const parts = path.split('.');
  const parseDirBaseResult = parseDirBase(parts[0]);

  switch (parts.length) {
    case 1:
      if (parseDirBaseResult) {
        return {
          dirBase: parseDirBaseResult.dirBase,
          discName: parseDirBaseResult.discName,
          pathParts: [],
          dirname: parts[0],
          basename: undefined,
        };  
      } else {
        return {
          dirBase: undefined,
          discName: undefined,
          pathParts: [],
          dirname: undefined,
          basename: parts[0],
        };  
      }

    case 2:
      if (parseDirBaseResult) {
        return {
          dirBase: parseDirBaseResult.dirBase,
          discName: parseDirBaseResult.discName,
          pathParts: [],
          dirname: parts[0],
          basename: parts[1],
        };
      } else {
        return {
          dirBase: undefined,
          discName: undefined,
          pathParts: validatePathParts([parts[0]]),
          dirname: parts[0],
          basename: parts[1],
        };
      }
  
    default:
      if (parseDirBaseResult) {
        return {
          dirBase: parseDirBaseResult.dirBase,
          discName: parseDirBaseResult.discName,
          pathParts: validatePathParts(parts.slice(1, parts.length - 1)),
          dirname: parts.slice(0, parts.length - 1).join('.'),
          basename: parts[parts.length - 1],
        };
      } else {
        return {
          dirBase: undefined,
          discName: undefined,
          pathParts: validatePathParts(parts.slice(0, parts.length - 1)),
          dirname: parts.slice(0, parts.length - 1).join('.'),
          basename: parts[parts.length - 1],
        };
      }
  }
};
