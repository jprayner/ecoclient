import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DirectoryHandles } from './common';

const configDir = '.ecoclient';
const configFilename = 'config.json';
const configDirPath = path.join(os.homedir(), configDir);
const configFilePath = path.join(configDirPath, configFilename);

type Config = {
  localStationNum: number | undefined;
  serverStationNum: number;
  handleUserRootDir: number | undefined;
  handleCurrentDir: number | undefined;
  handleLibDir: number | undefined;
};

const defaultConfig: Config = {
  localStationNum: undefined,
  serverStationNum: 254,
  handleUserRootDir: undefined,
  handleCurrentDir: undefined,
  handleLibDir: undefined,
};

export const getLocalStationNum = async (): Promise<number | undefined> => {
  const { localStationNum } = await readConfigOrUseDefault();
  return localStationNum;
};

export const setLocalStationNum = async (stationNum: number): Promise<void> => {
  if (!isValidStationNum(stationNum)) {
    throw new Error(`Invalid station number ${stationNum}`);
  }
  const config = await readConfigOrUseDefault();
  config.localStationNum = stationNum;
  await writeConfig(config);
};

export const getServerStationNum = async (): Promise<number> => {
  const { serverStationNum } = await readConfigOrUseDefault();
  return serverStationNum;
};

export const setServerStationNum = async (
  stationNum: number,
): Promise<void> => {
  if (!isValidStationNum(stationNum)) {
    throw new Error(`Invalid station number ${stationNum}`);
  }

  const config = await readConfigOrUseDefault();
  config.serverStationNum = stationNum;
  await writeConfig(config);
};

export const getHandles = async (): Promise<DirectoryHandles> => {
  const config = await readConfigOrUseDefault();
  if (
    config.handleUserRootDir === undefined ||
    config.handleCurrentDir === undefined ||
    config.handleLibDir === undefined
  ) {
    throw new Error(
      'Directory handle(s) missing from config file - please run I AM command',
    );
  }
  return {
    userRoot: config.handleUserRootDir,
    current: config.handleCurrentDir,
    library: config.handleLibDir,
  };
};

export const getHandleUserRootDir = async (): Promise<number | undefined> => {
  const { handleUserRootDir } = await readConfigOrUseDefault();
  return handleUserRootDir;
};

export const setHandleUserRootDir = async (handle: number): Promise<void> => {
  const config = await readConfigOrUseDefault();
  config.handleUserRootDir = handle;
  await writeConfig(config);
};

export const getHandleCurrentDir = async (): Promise<number | undefined> => {
  const { handleCurrentDir } = await readConfigOrUseDefault();
  return handleCurrentDir;
};

export const setHandleCurrentDir = async (handle: number): Promise<void> => {
  const config = await readConfigOrUseDefault();
  config.handleCurrentDir = handle;
  await writeConfig(config);
};

export const getHandleLibDir = async (): Promise<number | undefined> => {
  const { handleLibDir } = await readConfigOrUseDefault();
  return handleLibDir;
};

export const setHandleLibDir = async (handle: number): Promise<void> => {
  const config = await readConfigOrUseDefault();
  config.handleLibDir = handle;
  await writeConfig(config);
};

export const deleteConfig = async (): Promise<void> => {
  if (!(await fileAccessible(configFilePath))) {
    return;
  }

  await fs.promises.rm(configFilePath);

  try {
    await fs.promises.rmdir(configDirPath);
  } catch (e) {
    // ignore
  }
};

const fileAccessible = async (f: string) => {
  try {
    await fs.promises.stat(f);
    return true;
  } catch {
    return false;
  }
};

const isValidStationNum = (stationNum: number | undefined): boolean => {
  if (typeof stationNum === 'undefined') {
    return false;
  }
  if (Math.floor(stationNum) !== stationNum) {
    return false; // not an integer
  }
  return stationNum > 0 && stationNum < 255;
};

const validStationNumOrUndefined = (
  stationNum: number | undefined,
): number | undefined =>
  isValidStationNum(stationNum) ? stationNum : undefined;

const readConfig = async (): Promise<Config> => {
  if (!(await fileAccessible(configFilePath))) {
    throw new Error(
      `Config file ${configFilePath} does not exist or is not accessible`,
    );
  }

  const file = await fs.promises.readFile(configFilePath);
  const fileAsObject = JSON.parse(file.toString()) as unknown;
  if (!(fileAsObject && typeof fileAsObject === 'object')) {
    throw new Error(
      `Config file ${configFilePath} does not contain a JSON object`,
    );
  }

  const localStationNum =
    'localStationNum' in fileAsObject &&
    typeof fileAsObject.localStationNum === 'number'
      ? fileAsObject.localStationNum
      : undefined;

  const serverStationNum =
    'serverStationNum' in fileAsObject &&
    typeof fileAsObject.serverStationNum === 'number'
      ? fileAsObject.serverStationNum
      : undefined;

  const handleUserRootDir =
    'handleUserRootDir' in fileAsObject &&
    typeof fileAsObject.handleUserRootDir === 'number'
      ? fileAsObject.handleUserRootDir
      : undefined;

  const handleCurrentDir =
    'handleCurrentDir' in fileAsObject &&
    typeof fileAsObject.handleCurrentDir === 'number'
      ? fileAsObject.handleCurrentDir
      : undefined;

  const handleLibDir =
    'handleLibDir' in fileAsObject &&
    typeof fileAsObject.handleLibDir === 'number'
      ? fileAsObject.handleLibDir
      : undefined;

  return {
    localStationNum:
      validStationNumOrUndefined(localStationNum) ??
      defaultConfig.localStationNum,
    serverStationNum:
      validStationNumOrUndefined(serverStationNum) ??
      defaultConfig.serverStationNum,
    handleUserRootDir,
    handleCurrentDir,
    handleLibDir,
  };
};

const readConfigOrUseDefault = async (): Promise<Config> => {
  try {
    return await readConfig();
  } catch (e) {
    return {
      localStationNum: defaultConfig.localStationNum,
      serverStationNum: defaultConfig.serverStationNum,
      handleUserRootDir: defaultConfig.handleUserRootDir,
      handleCurrentDir: defaultConfig.handleCurrentDir,
      handleLibDir: defaultConfig.handleLibDir,
    };
  }
};

const writeConfig = async (config: Config): Promise<void> => {
  if (!(await fileAccessible(configFilePath))) {
    await fs.promises.mkdir(configDirPath);
  }
  await fs.promises.writeFile(configFilePath, JSON.stringify(config, null, 2));
};
