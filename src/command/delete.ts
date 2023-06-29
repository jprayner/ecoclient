import { getHandles } from '../config';
import { deleteFile } from '../protocol/simpleCli';

export const commandDelete = async (
  serverStation: number,
  pathToDelete: string,
) => {
  await deleteFile(serverStation, pathToDelete, await getHandles());
};
