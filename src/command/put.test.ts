import { readAccessObjectInfo } from '../protocol/objectInfo';
import { save } from '../protocol/save';
import { getHandles } from '../config';
import * as fs from 'fs';
import { commandPut } from './put';

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('fs', () => ({
  __esModule: true,
  ...jest.requireActual('fs'),
}));

jest.mock('../config');
jest.mock('../protocol/objectInfo');
jest.mock('../protocol/save');
jest.mock('../protocol/examine');
jest.mock('../util/overwriteUtils');

const readAccessObjectInfoMock = jest.mocked(readAccessObjectInfo);
const getHandlesMock = jest.mocked(getHandles);
const saveMock = jest.mocked(save);

describe('commandGet', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('single file', async () => {
    getHandlesMock.mockResolvedValue({
      userRoot: 1,
      current: 2,
      library: 3,
    });

    jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
    mockLstat(false);

    readAccessObjectInfoMock.mockResolvedValue({
      fileExists: false,
      access: null,
    });
    jest
      .spyOn(fs, 'readFileSync')
      .mockImplementation(() => Buffer.from([1, 2, 3]));

    await commandPut(254, 'MYFILE', false, false);

    expect(saveMock).toHaveBeenCalledWith(
      254,
      Buffer.from([1, 2, 3]),
      'MYFILE',
      0xffffffff,
      0xffffffff,
      {
        userRoot: 1,
        current: 2,
        library: 3,
      },
    );
  });
});

const mockLstat = (isDirectory: boolean) => {
  jest.spyOn(fs, 'lstatSync').mockImplementation(() => {
    return {
      isFile: () => !isDirectory,
      isBlockDevice: () => false,
      isSymbolicLink: () => false,
      isCharacterDevice: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      isDirectory: () => isDirectory,
      dev: 0,
      ino: 0,
      mode: 0,
      nlink: 0,
      uid: 0,
      gid: 0,
      rdev: 0,
      size: 0,
      blksize: 0,
      blocks: 0,
      atimeMs: 0,
      mtimeMs: 0,
      ctimeMs: 0,
      birthtimeMs: 0,
      atime: new Date(),
      mtime: new Date(),
      ctime: new Date(),
      birthtime: new Date(),
    };
  });
};
