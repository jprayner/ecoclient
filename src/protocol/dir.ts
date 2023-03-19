import { executeCliCommand } from '../common';

export const dir = async (
  serverStation: number,
  path: string,
) => {
  const serverReply = await executeCliCommand(
    serverStation,
    `DIR ${path}`,
  );

  if (serverReply.data.length < 1) {
    throw new Error(
      `Malformed response from station ${serverStation}: success but not enough data`,
    );
  }

  return {
    handleCurrentDir: serverReply.data[0],
  };
};
