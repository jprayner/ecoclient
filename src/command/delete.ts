import { getHandles } from '../config';
import { readAccessObjectInfo } from '../protocol/objectInfo';
import { deleteFile } from '../protocol/simpleCli';
import {
  isWildcardMatch,
  isWildcardName,
  parseFileSpecifier,
} from '../ecopath';
import { examineDir } from '../protocol/examine';
import {
  DeletePromptTracker,
  FileType,
  promptDelete,
} from '../util/deleteUtils';

const MAX_RETRIES = 3;

export const commandDelete = async (
  serverStation: number,
  filename: string,
  recurse: boolean,
  force: boolean,
) => {
  const overwriteTracker = new DeletePromptTracker(force);
  const pathInfo = parseFileSpecifier(filename);

  if (!pathInfo.basename || isWildcardName(pathInfo.basename)) {
    await deleteMultipleFiles(
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
  if (isDir) {
    await deleteDir(serverStation, filename, recurse, overwriteTracker);
  } else {
    await deleteSingleFileWithRetries(
      serverStation,
      filename,
      FileType.File,
      overwriteTracker,
    );
  }
};

const deleteDir = async (
  serverStation: number,
  remotePath: string,
  recurse: boolean,
  promptTracker: DeletePromptTracker,
) => {
  if (!recurse) {
    throw new Error(`'${remotePath}' is a directory, specify -r to recurse`);
  }

  if (!(await promptDelete(remotePath, FileType.Directory, promptTracker))) {
    return false;
  }

  if (
    !(await deleteMultipleFiles(
      serverStation,
      remotePath,
      '*',
      recurse,
      promptTracker,
    ))
  ) {
    return false;
  }

  console.log(`Deleting directory: ${remotePath}`);
  if (!(await deleteFile(serverStation, remotePath, await getHandles()))) {
    return false;
  }

  return true;
};

const deleteMultipleFiles = async (
  serverStation: number,
  dirPath: string,
  wildcardPattern: string,
  recurse: boolean,
  promptTracker: DeletePromptTracker,
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

  let deletedAll = true;
  for (const file of fileMatches) {
    const filePath = dirPath ? `${dirPath}.${file.name}` : file.name;
    if (
      !(await deleteSingleFileWithRetries(
        serverStation,
        filePath,
        FileType.File,
        promptTracker,
      ))
    ) {
      deletedAll = false;
    }
  }

  for (const dir of dirMatches) {
    const remotePath = dirPath ? `${dirPath}.${dir.name}` : dir.name;
    if (!(await deleteDir(serverStation, remotePath, recurse, promptTracker))) {
      deletedAll = false;
    }
  }

  return deletedAll;
};

const deleteSingleFileWithRetries = async (
  serverStation: number,
  srcFilename: string,
  type: FileType,
  promptTracker: DeletePromptTracker,
) => {
  if (!(await promptDelete(srcFilename, FileType.File, promptTracker))) {
    return false;
  }

  for (let retry = 0; retry <= MAX_RETRIES; retry++) {
    console.log(
      `Deleting ${
        type === FileType.File ? 'file' : 'directory'
      }: ${srcFilename}` + (retry === 0 ? '' : ` (retry ${retry})`),
    );
    try {
      await deleteFile(serverStation, srcFilename, await getHandles());
      return true;
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      if (retry === MAX_RETRIES) {
        console.error(`Giving up on ${srcFilename}`);
      }
    }
  }

  return false;
};
