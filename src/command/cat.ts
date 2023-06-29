import { getHandles } from '../config';
import { examineDir } from '../protocol/examine';
import { readDirAccessObjectInfo } from '../protocol/objectInfo';

export const commandCat = async (serverStation: number, dirPath: string) => {
  const dirInfo = await readDirAccessObjectInfo(
    serverStation,
    dirPath,
    await getHandles(),
  );
  const files = await examineDir(serverStation, dirPath, await getHandles());

  console.log(
    `[${dirInfo.dirName} (${dirInfo.cycleNum}) - ${
      dirInfo.isOwner ? 'Owner' : 'Public'
    }]`,
  );
  for (const f of files) {
    console.log(
      `${f.name.padEnd(10)} ${f.loadAddress.padEnd(8)} ${f.execAddress.padEnd(
        8,
      )}  ${f.sizeBytes.toString(10).padStart(8)} ${f.access.padEnd(10)} ${
        f.date
      } ${f.id}`,
    );
  }
};
