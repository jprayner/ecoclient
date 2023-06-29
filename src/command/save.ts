import { basename } from 'path';
import { spawnSync } from 'child_process';
import { save } from '../protocol/save';
import { getHandles } from '../config';

const basicLoadAddr = 0xffff0e00;
const basicExecAddr = 0xffff2b80;

export const commandSave = async (
  serverStation: number,
  localPath: string,
  optionalDestPath: string | undefined,
) => {
  const localFilenameNoBasSuffix = basename(localPath).replace(/\.bas$/, '');
  const destPath = optionalDestPath || localFilenameNoBasSuffix;

  let spawnResult;
  try {
    spawnResult = spawnSync('basictool', ['-t', `${localPath}`]);
    if (spawnResult.error) {
      throw spawnResult.error;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    console.error(
      'Failed to launch basictool utility which is required to convert tokenised BASIC' +
        `file to/from text. Is it installed and in your PATH? Error is: "${msg}"`,
    );
    return;
  }

  await save(
    serverStation,
    spawnResult.stdout,
    `${destPath}`,
    basicLoadAddr,
    basicExecAddr,
    await getHandles(),
  );
};
