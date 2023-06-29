import { iAm } from '../protocol/iAm';
import {
  setHandleCurrentDir,
  setHandleLibDir,
  setHandleUserRootDir,
} from '../config';

export const commandIAm = async (
  serverStation: number,
  username: string,
  password: string,
) => {
  const result = await iAm(serverStation, username, password);
  await setHandleUserRootDir(result.directoryHandles.userRoot);
  await setHandleCurrentDir(result.directoryHandles.current);
  await setHandleLibDir(result.directoryHandles.library);
};
