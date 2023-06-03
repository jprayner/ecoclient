import { DirectoryHandles, executeCliCommand } from '../common';

export const iAm = async (
  serverStation: number,
  username: string,
  password?: string,
) => {
  const serverReply = await executeCliCommand(
    serverStation,
    password ? `I AM ${username} ${password}` : `I AM ${username}`,
    {
      userRoot: 0,
      current: 0,
      library: 0,
    },
  );
  if (serverReply.data.length < 4) {
    throw new Error(
      `Malformed response from station ${serverStation}: success but not enough data`,
    );
  }

  return {
    directoryHandles: {
      userRoot: serverReply.data[1],
      current: serverReply.data[0],
      library: serverReply.data[2],
    } as DirectoryHandles,
    bootOption: serverReply.data[3],
  };
};
