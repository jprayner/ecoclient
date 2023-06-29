import * as fs from 'fs';

import { saveFileInfo } from '../common';
import { getHandles, getMetadataType } from '../config';
import { load } from '../protocol/load';

export const commandGet = async (serverStation: number, filename: string) => {
  const result = await load(serverStation, filename, await getHandles());
  switch (await getMetadataType()) {
    case 'inf':
      fs.writeFileSync(result.actualFilename, result.data);
      saveFileInfo(result.actualFilename, {
        originalFilename: result.actualFilename,
        loadAddr: result.loadAddr,
        execAddr: result.execAddr,
      });
      break;

    case 'filename': {
      const loadAddr = result.loadAddr
        .toString(16)
        .toUpperCase()
        .padStart(8, '0');
      const execAddr = result.loadAddr
        .toString(16)
        .toUpperCase()
        .padStart(8, '0');
      fs.writeFileSync(
        `${result.actualFilename},${loadAddr},${execAddr}`,
        result.data,
      );
      break;
    }
    default:
      fs.writeFileSync(result.actualFilename, result.data);
      break;
  }
};
