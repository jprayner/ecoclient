import { getHandles } from '../config';
import { cdir } from '../protocol/simpleCli';

export const commandCdir = async (serverStation: number, dirPath: string) => {
  await cdir(serverStation, dirPath, await getHandles());
};
