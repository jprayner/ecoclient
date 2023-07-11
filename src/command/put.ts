import * as fs from 'fs';
import * as path from 'path';
import { fileInfoFromFilename, loadFileInfo } from '../common';
import { save } from '../protocol/save';
import { getHandles } from '../config';
import { readAccessObjectInfo } from '../protocol/objectInfo';
import { isValidName } from '../ecopath';
import { cdir, deleteFile } from '../protocol/simpleCli';
import {
  FileOverwriteTracker,
  FileType,
  promptOverwrite,
} from '../util/overwriteUtils';

const MAX_RETRIES = 3;

const isWildcardMatch = (filename: string, pattern: string) => {
  const regExp = new RegExp(
    `^${pattern.toLowerCase().replace('*', '.*').replace('?', '.')}$`,
  );
  return regExp.test(filename.toLowerCase());
};

const putSingleFileWithRetries = async (
  serverStation: number,
  localFilePath: string,
  remoteDir: string,
  overwriteTracker: FileOverwriteTracker,
) => {
  if (path.extname(localFilePath).toLowerCase() === '.inf') {
    // silently skip .inf files
    return;
  }
  if (!isValidName(path.basename(localFilePath))) {
    console.log(`Skipping '${localFilePath}' (not a valid Econet filename)`);
    return;
  }

  console.log(`Putting file ${localFilePath}...`);
  const remoteFilePath = remoteDir
    ? `${remoteDir}.${path.basename(localFilePath)}`
    : path.basename(localFilePath);
  if (
    (await promptOverwriteDeleteIfNecessary(
      serverStation,
      remoteFilePath,
      FileType.File,
      overwriteTracker,
    )) === OverwritePromptResult.Skip
  ) {
    return;
  }

  for (let retry = 0; retry <= MAX_RETRIES; retry++) {
    console.log(
      `Putting file: ${localFilePath}` +
        (retry === 0 ? '' : ` (retry ${retry})`),
    );
    try {
      await putSingleFile(serverStation, localFilePath, remoteDir);
      break;
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      if (retry === MAX_RETRIES) {
        console.error(`Giving up on ${localFilePath}`);
      }
    }
  }
};

const putSingleFile = async (
  serverStation: number,
  localFilePath: string,
  remoteDir: string,
) => {
  const parsedLocalFilePath = path.parse(path.normalize(localFilePath));
  const fileInfo =
    fileInfoFromFilename(parsedLocalFilePath.base) ||
    loadFileInfo(localFilePath);
  const fileData = fs.readFileSync(localFilePath);
  const remoteFileBase = fileInfo?.originalFilename || parsedLocalFilePath.base;
  const remoteFilePath = remoteDir
    ? `${remoteDir}.${remoteFileBase}`
    : remoteFileBase;
  await save(
    serverStation,
    fileData,
    remoteFilePath,
    fileInfo?.loadAddr || 0xffffffff,
    fileInfo?.execAddr || 0xffffffff,
    await getHandles(),
  );
};

const putMultipleFiles = async (
  serverStation: number,
  localDirPath: string,
  filenameExpression: string,
  remotePath: string,
  recurse: boolean,
  overwriteTracker: FileOverwriteTracker,
) => {
  if (!fs.existsSync(localDirPath)) {
    throw new Error(`Directory not found: ${localDirPath}`);
  }
  if (!fs.lstatSync(localDirPath).isDirectory()) {
    throw new Error(`Not a directory: ${localDirPath}`);
  }

  const dirEntries = fs.readdirSync(localDirPath, { withFileTypes: true });
  const dirNames = dirEntries
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .filter(n => isWildcardMatch(n, filenameExpression));
  const fileNames = dirEntries
    .filter(e => e.isFile())
    .map(e => e.name)
    .filter(n => isWildcardMatch(n, filenameExpression));

  if (remotePath) {
    const accessInfo = await readAccessObjectInfo(
      serverStation,
      remotePath,
      await getHandles(),
    );
    if (!accessInfo.fileExists) {
      throw new Error(`Destination path '${remotePath}' not found`);
    }

    const isDir = accessInfo.access.includes('D');
    if (!isDir) {
      throw new Error(`Destination path '${remotePath}' is not a directory`);
    }
  }

  for (const fileName of fileNames) {
    await putSingleFileWithRetries(
      serverStation,
      path.join(localDirPath, fileName),
      remotePath,
      overwriteTracker,
    );
  }

  if (!recurse) {
    return;
  }

  for (const dirName of dirNames) {
    const localSubdirPath = path.join(localDirPath, dirName);
    const remoteSubdirPath = remotePath ? [remotePath, dirName].join('.') : dirName;

    if (!isValidName(dirName)) {
      console.log(`Skipping '${dirName}' (not a valid Econet filename)`);
      continue;
    }

    switch (await promptOverwriteDeleteIfNecessary(
        serverStation,
        remoteSubdirPath,
        FileType.Directory,
        overwriteTracker,
      )) {
    case OverwritePromptResult.Skip:
      continue;
    case OverwritePromptResult.Continue:
      await cdir(serverStation, remoteSubdirPath, await getHandles());
      break;
    case OverwritePromptResult.DirExists:
      break;
    }

    await putMultipleFiles(
      serverStation,
      localSubdirPath,
      '*',
      remoteSubdirPath,
      recurse,
      overwriteTracker,
    );
  }
};

export const commandPut = async (
  serverStation: number,
  localPath: string,
  recurse: boolean,
  force: boolean,
) => {
  const overwriteTracker = new FileOverwriteTracker(force);

  const parsedPath = path.parse(path.normalize(localPath));

  if (parsedPath.name.includes('*') || parsedPath.name.includes('?')) {
    await putMultipleFiles(
      serverStation,
      parsedPath.dir || process.cwd(),
      parsedPath.name,
      '',
      recurse,
      overwriteTracker,
    );
    return;
  }

  if (!fs.existsSync(localPath)) {
    throw new Error(`File not found: ${localPath}`);
  }

  if (fs.lstatSync(localPath).isDirectory()) {
    const remoteDir = parsedPath.base; // TODO: prepend remote path if specified
    if (!recurse) {
      throw new Error(`'${localPath}' is a directory, specify -r to recurse`);
    }

    if (!isValidName(parsedPath.base)) {
      throw new Error(
        `Directory '${parsedPath.base}' is not a valid Econet filename`,
      );
    }

    switch (
      await promptOverwriteDeleteIfNecessary(
        serverStation,
        remoteDir,
        FileType.Directory,
        overwriteTracker,
      )
    ) {
      case OverwritePromptResult.Skip:
        return;
      case OverwritePromptResult.Continue:
        await cdir(serverStation, remoteDir, await getHandles());
        break;
      case OverwritePromptResult.DirExists:
        break;
    }

    await putMultipleFiles(
      serverStation,
      localPath,
      '*',
      remoteDir,
      recurse,
      overwriteTracker,
    );
    return;
  }

  await putSingleFileWithRetries(
    serverStation,
    localPath,
    '',
    overwriteTracker,
  );
};

enum OverwritePromptResult {
  Continue,
  Skip,
  DirExists,
}

const promptOverwriteDeleteIfNecessary = async (
  serverStation: number,
  remotePath: string,
  newFileType: FileType,
  overwriteTracker: FileOverwriteTracker,
) => {
  const accessInfo = await readAccessObjectInfo(
    serverStation,
    remotePath,
    await getHandles(),
  );
  if (!accessInfo.fileExists) {
    return OverwritePromptResult.Continue;
  }

  if (newFileType === FileType.Directory && accessInfo.access.includes('D')) {
    return OverwritePromptResult.DirExists;
  }

  if (await promptOverwrite(remotePath, overwriteTracker)) {
    console.log(`Deleting existing file ${remotePath}...`);
    await deleteFile(serverStation, remotePath, await getHandles());
    return OverwritePromptResult.Continue;
  } else {
    return OverwritePromptResult.Skip;
  }
};
