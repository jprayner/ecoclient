import {
  getLocalStationNum,
  getServerStationNum,
  setLocalStationNum,
  setServerStationNum,
  deleteConfig,
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
});
