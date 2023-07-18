import { getHandles } from '../config';
import { changePassword } from '../protocol/simpleCli';

export const commandPass = async (
  serverStation: number,
  oldPassword: string,
  newPassword: string,
) => {
  await changePassword(
    serverStation,
    oldPassword,
    newPassword,
    await getHandles(),
  );
};
