import { existsSync, mkdirSync, writeFileSync, lstatSync, rmSync } from 'fs';

import { saveFileInfo } from '../common';
import { getHandles, getMetadataType } from '../config';
import { load } from '../protocol/load';
import { readAccessObjectInfo } from '../protocol/objectInfo';
import {
  isWildcardMatch,
  isWildcardName,
  parseFileSpecifier,
} from '../ecopath';
import { examineDir } from '../protocol/examine';
import {
  FileType,
  FileOverwriteTracker,
  promptOverwrite,
} from '../util/overwriteUtils';

const MAX_RETRIES = 3;

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

  const dirOverwriteResponse = await promptOverwriteDeleteIfNecessary(
    pathInfo.basename,
    FileType.Directory,
    overwriteTracker,
  );
  if (dirOverwriteResponse !== OverwritePromptResult.Skip) {
    if (dirOverwriteResponse !== OverwritePromptResult.DirExists) {
      mkdirSync(pathInfo.basename);
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
      dirPath ? `${dirPath}.${file.name}` : file.name,
      overwriteTracker,
    );
  }

  if (!recurse) {
    return;
  }

  for (const dir of dirMatches) {
    const remotePath = dirPath ? `${dirPath}.${dir.name}` : dir.name;
    console.log(`Getting dir: ${remotePath}`);
    const originalDir = process.cwd();

    const dirOverwriteResponse = await promptOverwriteDeleteIfNecessary(
      dir.name,
      FileType.Directory,
      overwriteTracker,
    );
    if (dirOverwriteResponse !== OverwritePromptResult.Skip) {
      if (dirOverwriteResponse !== OverwritePromptResult.DirExists) {
        mkdirSync(dir.name);
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
  const actualFilename = pathInfo.basename;

  if (!actualFilename) {
    throw new Error(
      `Unexpected path format in filename returned by server: ${result.actualFilename}`,
    );
  }

  switch (await getMetadataType()) {
    case 'inf': {
      const overwriteMainFileResult = await promptOverwriteDeleteIfNecessary(
        actualFilename,
        FileType.File,
        overwriteTracker,
      );
      if (overwriteMainFileResult !== OverwritePromptResult.Skip) {
        writeFileSync(actualFilename, result.data);
      }

      const overwriteInfFileResult = await promptOverwriteDeleteIfNecessary(
        `${actualFilename}.inf`,
        FileType.File,
        overwriteTracker,
      );
      if (overwriteInfFileResult !== OverwritePromptResult.Skip) {
        saveFileInfo(actualFilename, {
          originalFilename: actualFilename,
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
      const execAddr = result.execAddr
        .toString(16)
        .toUpperCase()
        .padStart(8, '0');
      const filenameWithAddrs = `${actualFilename},${loadAddr},${execAddr}`;

      const overwriteInfFileResult = await promptOverwriteDeleteIfNecessary(
        filenameWithAddrs,
        FileType.File,
        overwriteTracker,
      );
      if (overwriteInfFileResult !== OverwritePromptResult.Skip) {
        writeFileSync(filenameWithAddrs, result.data);
      }
      break;
    }

    default: {
      const overwritePlainFileResult = await promptOverwriteDeleteIfNecessary(
        actualFilename,
        FileType.File,
        overwriteTracker,
      );
      if (overwritePlainFileResult !== OverwritePromptResult.Skip) {
        console.log(`writing to ${actualFilename}`);
        writeFileSync(actualFilename, result.data);
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

const promptOverwriteDeleteIfNecessary = async (
  localFilename: string,
  newFileType: FileType,
  overwriteTracker: FileOverwriteTracker,
) => {
  if (!existsSync(localFilename)) {
    return OverwritePromptResult.Continue;
  }

  if (
    newFileType === FileType.Directory &&
    lstatSync(localFilename).isDirectory()
  ) {
    return OverwritePromptResult.DirExists;
  }

  if (await promptOverwrite(localFilename, overwriteTracker)) {
    rmSync(localFilename, { recursive: true, force: true });
    return OverwritePromptResult.Continue;
  } else {
    return OverwritePromptResult.Skip;
  }
};
