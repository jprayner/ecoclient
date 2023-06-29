import * as fs from 'fs';
import * as path from 'path';
import { fileInfoFromFilename, loadFileInfo } from '../common';
import { save } from '../protocol/save';
import { getHandles } from '../config';

export const commandPut = async (serverStation: number, filename: string) => {
  const fileInfo =
    fileInfoFromFilename(path.basename(filename)) || loadFileInfo(filename);
  const fileData = fs.readFileSync(filename);
  const fileTitle = `${path.basename(filename)}`;
  await save(
    serverStation,
    fileData,
    fileInfo?.originalFilename || fileTitle,
    fileInfo?.loadAddr || 0xffffffff,
    fileInfo?.execAddr || 0xffffffff,
    await getHandles(),
  );
};
