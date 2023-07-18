import { getHandles } from '../config';
import { setPrivileged } from '../protocol/simpleCli';

export const commandPriv = async (
  serverStation: number,
  username: string,
  level: string,
) => {
  await setPrivileged(serverStation, username, level, await getHandles());
};
