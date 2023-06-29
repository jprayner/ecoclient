import * as fs from 'fs';

import { getHandles } from '../config';
import { load } from '../protocol/load';
import { spawnSync } from 'child_process';

export const commandLoad = async (serverStation: number, filename: string) => {
  const result = await load(serverStation, filename, await getHandles());
  const tempFile = `${result.actualFilename}.tmp`;
  fs.writeFileSync(tempFile, result.data);

  try {
    const spawnResult = spawnSync('basictool', [tempFile]);
    if (spawnResult.error) {
      throw spawnResult.error;
    }
    fs.writeFileSync(`${result.actualFilename}.bas`, spawnResult.stdout);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    console.error(
      'Failed to launch basictool utility which is required to convert tokenised BASIC' +
        `file to/from text format. Is it installed and in your PATH? Error is: "${msg}"`,
    );
  }

  fs.rmSync(tempFile, { force: true });
};
