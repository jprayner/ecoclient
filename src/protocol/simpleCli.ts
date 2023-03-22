import { DirectoryHandles, executeCliCommand } from '../common';

export const bye = async (serverStation: number, handles: DirectoryHandles) =>
  executeCliCommand(serverStation, 'BYE', handles);
export const cdir = async (
  serverStation: number,
  dirName: string,
  handles: DirectoryHandles,
) => executeCliCommand(serverStation, `CDIR ${dirName}`, handles);
export const deleteFile = async (
  serverStation: number,
  filePath: string,
  handles: DirectoryHandles,
) => executeCliCommand(serverStation, `DELETE ${filePath}`, handles);
export const access = async (
  serverStation: number,
  filePath: string,
  accessString: string,
  handles: DirectoryHandles,
) =>
  executeCliCommand(
    serverStation,
    `ACCESS ${filePath} ${accessString}`,
    handles,
  );
