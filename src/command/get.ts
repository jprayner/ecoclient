import * as fs from 'fs';

import { getKeyPress, logProgress, saveFileInfo } from '../common';
import { getHandles, getMetadataType } from '../config';
import { load } from '../protocol/load';
import { readAccessObjectInfo } from '../protocol/objectInfo';
import {
  isWildcardMatch,
  isWildcardName,
  parseFileSpecifier,
} from '../ecopath';
import { examineDir } from '../protocol/examine';

const MAX_RETRIES = 3;

enum FileType {
  File,
  Directory,
}

class FileOverwriteTracker {
  constructor(private overwriteAll: boolean) {}

  public get isOverwriteAllSelected() {
    return this.overwriteAll;
  }

  public selectOverwriteAll() {
    this.overwriteAll = true;
  }
}

export const commandGet = async (
  serverStation: number,
  filename: string,
  recurse: boolean,
  force: boolean,
) => {
  const overwriteTracker = new FileOverwriteTracker(force);
  const pathInfo = parseFileSpecifier(filename);

  if (!pathInfo.basename || isWildcardName(pathInfo.basename)) {
    await getMultipleFiles(
      serverStation,
      pathInfo.dirname || '',
      pathInfo.basename || '*',
      recurse,
      overwriteTracker,
    );
    return;
  }

  const accessInfo = await readAccessObjectInfo(
    serverStation,
    filename,
    await getHandles(),
  );
  if (!accessInfo.fileExists) {
    throw new Error(`File not found: ${filename}`);
  }

  const isDir = accessInfo.access.includes('D');
  if (!isDir) {
    await getSingleFileWithRetries(serverStation, filename, overwriteTracker);
    return;
  }

  if (!recurse) {
    throw new Error(`'${filename}' is a directory, specify -r to recurse`);
  }

  const originalDir = process.cwd();

  const dirOverwriteResponse = await promptOverwriteIfNecessary(
    pathInfo.basename,
    FileType.Directory,
    overwriteTracker,
  );
  if (dirOverwriteResponse !== OverwritePromptResult.Skip) {
    if (dirOverwriteResponse !== OverwritePromptResult.DirExists) {
      fs.mkdirSync(pathInfo.basename);
    }

    process.chdir(pathInfo.basename);
    await getMultipleFiles(
      serverStation,
      filename,
      '*',
      recurse,
      overwriteTracker,
    );
    process.chdir(originalDir);
  }
};

const getMultipleFiles = async (
  serverStation: number,
  dirPath: string,
  wildcardPattern: string,
  recurse: boolean,
  overwriteTracker: FileOverwriteTracker,
) => {
  const allObjects = await examineDir(
    serverStation,
    dirPath,
    await getHandles(),
  );
  const allObjectMatches = allObjects.filter(f =>
    isWildcardMatch(wildcardPattern, f.name),
  );
  const dirMatches = allObjectMatches.filter(f => f.access.includes('D'));
  const fileMatches = allObjectMatches.filter(f => !f.access.includes('D'));

  for (const file of fileMatches) {
    await getSingleFileWithRetries(
      serverStation,
      [dirPath, file.name].join('.'),
      overwriteTracker,
    );
  }

  if (recurse) {
    for (const dir of dirMatches) {
      const remotePath = `${dirPath}.${dir.name}`;
      console.log(`Getting dir: ${remotePath}`);
      const originalDir = process.cwd();

      const dirOverwriteResponse = await promptOverwriteIfNecessary(
        dir.name,
        FileType.Directory,
        overwriteTracker,
      );
      if (dirOverwriteResponse !== OverwritePromptResult.Skip) {
        if (dirOverwriteResponse !== OverwritePromptResult.DirExists) {
          fs.mkdirSync(dir.name);
        }

        process.chdir(dir.name);
        await getMultipleFiles(
          serverStation,
          remotePath,
          '*',
          recurse,
          overwriteTracker,
        );
        process.chdir(originalDir);
      }
    }
  }
};

const getSingleFileWithRetries = async (
  serverStation: number,
  srcFilename: string,
  overwriteTracker: FileOverwriteTracker,
) => {
  for (let retry = 0; retry <= MAX_RETRIES; retry++) {
    console.log(
      `Getting file: ${srcFilename}` + (retry === 0 ? '' : ` (retry ${retry})`),
    );
    try {
      await getSingleFile(serverStation, srcFilename, overwriteTracker);
      break;
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      if (retry === MAX_RETRIES) {
        console.error(`Giving up on ${srcFilename}`);
      }
    }
  }
};

const getSingleFile = async (
  serverStation: number,
  srcFilename: string,
  overwriteTracker: FileOverwriteTracker,
) => {
  const result = await load(serverStation, srcFilename, await getHandles());
  const pathInfo = parseFileSpecifier(result.actualFilename);
  const localFilename = pathInfo.basename;

  if (!localFilename) {
    throw new Error(
      `Unexpected path format in filename returned by server: ${result.actualFilename}`,
    );
  }

  switch (await getMetadataType()) {
    case 'inf': {
      const overwriteMainFileResult = await promptOverwriteIfNecessary(
        localFilename,
        FileType.File,
        overwriteTracker,
      );
      if (overwriteMainFileResult !== OverwritePromptResult.Skip) {
        fs.writeFileSync(localFilename, result.data);
      }

      const overwriteInfFileResult = await promptOverwriteIfNecessary(
        `${localFilename}.inf`,
        FileType.File,
        overwriteTracker,
      );
      if (overwriteInfFileResult !== OverwritePromptResult.Skip) {
        saveFileInfo(localFilename, {
          originalFilename: result.actualFilename,
          loadAddr: result.loadAddr,
          execAddr: result.execAddr,
        });
      }

      break;
    }

    case 'filename': {
      const loadAddr = result.loadAddr
        .toString(16)
        .toUpperCase()
        .padStart(8, '0');
      const execAddr = result.loadAddr
        .toString(16)
        .toUpperCase()
        .padStart(8, '0');
      const filenameWithAddrs = `${localFilename},${loadAddr},${execAddr}`;

      const overwriteInfFileResult = await promptOverwriteIfNecessary(
        filenameWithAddrs,
        FileType.File,
        overwriteTracker,
      );
      if (overwriteInfFileResult !== OverwritePromptResult.Skip) {
        fs.writeFileSync(filenameWithAddrs, result.data);
      }
      break;
    }

    default: {
      const overwritePlainFileResult = await promptOverwriteIfNecessary(
        localFilename,
        FileType.File,
        overwriteTracker,
      );
      if (overwritePlainFileResult !== OverwritePromptResult.Skip) {
        console.log(`writing to ${localFilename}`);
        fs.writeFileSync(localFilename, result.data);
      }
      break;
    }
  }
};

enum OverwritePromptResult {
  Continue,
  Skip,
  DirExists,
}

const promptOverwriteIfNecessary = async (
  localFilename: string,
  newFileType: FileType,
  overwriteTracker: FileOverwriteTracker,
) => {
  if (!fs.existsSync(localFilename)) {
    return OverwritePromptResult.Continue;
  }

  if (
    newFileType === FileType.Directory &&
    fs.lstatSync(localFilename).isDirectory()
  ) {
    return OverwritePromptResult.DirExists;
  }

  if (overwriteTracker.isOverwriteAllSelected) {
    fs.rmSync(localFilename, { recursive: true, force: true });
    return OverwritePromptResult.Continue;
  }

  if (!process.stdin.isTTY) {
    console.error(`File already exists: ${localFilename}`);
    process.exit(1);
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    logProgress(
      `File ${localFilename} will be overwritten, OK? [Y]es/[A]ll/[S]kip/[Q]uit]`,
    );

    const key = await getKeyPress();
    logProgress('');
    switch (key) {
      case 'y':
      case 'Y':
        fs.rmSync(localFilename, { recursive: true, force: true });
        return OverwritePromptResult.Continue;
        break;
      case 'a':
      case 'A':
        fs.rmSync(localFilename, { recursive: true, force: true });
        overwriteTracker.selectOverwriteAll();
        return OverwritePromptResult.Continue;
        break;
      case 's':
      case 'S':
        return OverwritePromptResult.Skip;
        break;
      case 'q':
      case 'Q':
        logProgress('');
        process.exit(1);
    }
  }
};
