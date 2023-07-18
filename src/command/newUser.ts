import { getHandles } from '../config';
import { newUser } from '../protocol/simpleCli';

export const commandNewUser = async (
  serverStation: number,
  username: string,
) => {
  await newUser(serverStation, username, await getHandles());
};
