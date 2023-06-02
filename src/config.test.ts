import {
  getLocalStationNum,
  getServerStationNum,
  setLocalStationNum,
  setServerStationNum,
  deleteConfig,
  getHandles,
  getHandleCurrentDir,
  getHandleUserRootDir,
  getHandleLibDir,
  setHandleCurrentDir,
  setHandleUserRootDir,
  setHandleLibDir,
  getSaveThrottleMs,
} from './config';

let originalLocalStationNum: number | undefined;
let originalServerStationNum: number;

describe('config', () => {
  beforeAll(async () => {
    originalLocalStationNum = await getLocalStationNum();
    originalServerStationNum = await getServerStationNum();
  });

  afterAll(async () => {
    await deleteConfig();
    if (typeof originalLocalStationNum !== 'undefined') {
      await setLocalStationNum(originalLocalStationNum);
    }
    await setServerStationNum(originalServerStationNum);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await deleteConfig();
  });

  it('should return correct defaults where no configuration exists', async () => {
    expect(await getLocalStationNum()).toBeUndefined();
    expect(await getServerStationNum()).toEqual(254);
    expect(await getSaveThrottleMs()).toEqual(200);
  });

  it('should save local station number correctly', async () => {
    expect(await getLocalStationNum()).toBeUndefined();
    expect(await getServerStationNum()).toEqual(254);
    await setLocalStationNum(1);
    expect(await getLocalStationNum()).toEqual(1);
    expect(await getServerStationNum()).toEqual(254);
  });

  it('should save server station number correctly', async () => {
    expect(await getLocalStationNum()).toBeUndefined();
    expect(await getServerStationNum()).toEqual(254);
    await setServerStationNum(10);
    expect(await getServerStationNum()).toEqual(10);
  });

  it('should prevent setting a non-integer local station number', async () => {
    await expect(setLocalStationNum(1.1)).rejects.toThrowError(
      'Invalid station number 1.1',
    );
  });

  it('should prevent setting a non-integer server station number', async () => {
    await expect(setServerStationNum(1.1)).rejects.toThrowError(
      'Invalid station number 1.1',
    );
  });

  it('should successfully set and fetch directory handles', async () => {
    await setHandleUserRootDir(1);
    await setHandleCurrentDir(2);
    await setHandleLibDir(3);
    expect(await getHandles()).toEqual({
      userRoot: 1,
      current: 2,
      library: 3,
    });
  });

  it('should throw error on attempt to retrieve undefined directory handles', async () => {
    await expect(getHandles()).rejects.toThrowError(
      'Directory handle(s) missing from config file - please run I AM command',
    );
  });

  it('should retrieve user root directory handle', async () => {
    await setHandleUserRootDir(1);
    expect(await getHandleUserRootDir()).toEqual(1);
  });

  it('should retrieve current directory handle', async () => {
    await setHandleCurrentDir(2);
    expect(await getHandleCurrentDir()).toEqual(2);
  });

  it('should retrieve library directory handle', async () => {
    await setHandleLibDir(3);
    expect(await getHandleLibDir()).toEqual(3);
  });
});
