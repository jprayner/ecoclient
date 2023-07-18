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

export const newUser = async (
  serverStation: number,
  username: string,
  handles: DirectoryHandles,
) => executeCliCommand(serverStation, `NEWUSER ${username}`, handles);

export const removeUser = async (
  serverStation: number,
  username: string,
  handles: DirectoryHandles,
) => executeCliCommand(serverStation, `REMUSER ${username}`, handles);

export const changePassword = (
  serverStation: number,
  oldPassword: string,
  newPassword: string,
  handles: DirectoryHandles,
) =>
  executeCliCommand(
    serverStation,
    `PASS ${oldPassword ? oldPassword : '""'} ${
      newPassword ? newPassword : '""'
    }`,
    handles,
  );

export const setPrivileged = async (
  serverStation: number,
  username: string,
  level: string,
  handles: DirectoryHandles,
) =>
  executeCliCommand(
    serverStation,
    `PRIV ${username} ${level ? level : 'N'}`,
    handles,
  );
