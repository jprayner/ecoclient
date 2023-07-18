import { getHandles } from '../config';
import { removeUser } from '../protocol/simpleCli';

export const commandRemUser = async (
  serverStation: number,
  username: string,
) => {
  await removeUser(serverStation, username, await getHandles());
};
