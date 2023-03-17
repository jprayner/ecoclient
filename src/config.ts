import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const configDir = '.ecoclient';
const configFilename = 'config.json';
const configDirPath = path.join(os.homedir(), configDir);
const configFilePath = path.join(configDirPath, configFilename);

type Config = {
  localStationNum: number | undefined;
  serverStationNum: number;
};

const defaultConfig: Config = {
  localStationNum: undefined,
  serverStationNum: 254,
};

export const getLocalStationNum = async (): Promise<number | undefined> => {
  const { localStationNum } = await readConfigOrUseDefault();
  return localStationNum;
};

export const getServerStationNum = async (): Promise<number> => {
  const { serverStationNum } = await readConfigOrUseDefault();
  return serverStationNum;
};

export const setLocalStationNum = async (stationNum: number): Promise<void> => {
  if (!isValidStationNum(stationNum)) {
    throw new Error(`Invalid station number ${stationNum}`);
  }
  const config = await readConfigOrUseDefault();
  config.localStationNum = stationNum;
  await writeConfig(config);
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

  return {
    localStationNum:
      validStationNumOrUndefined(localStationNum) ??
      defaultConfig.localStationNum,
    serverStationNum:
      validStationNumOrUndefined(serverStationNum) ??
      defaultConfig.serverStationNum,
  };
};

const readConfigOrUseDefault = async (): Promise<Config> => {
  try {
    return await readConfig();
  } catch (e) {
    return {
      localStationNum: defaultConfig.localStationNum,
      serverStationNum: defaultConfig.serverStationNum,
    };
  }
};

const writeConfig = async (config: Config): Promise<void> => {
  if (!(await fileAccessible(configFilePath))) {
    await fs.promises.mkdir(configDirPath);
  }
  await fs.promises.writeFile(configFilePath, JSON.stringify(config, null, 2));
};
