import { readAccessObjectInfo } from '../protocol/objectInfo';
import { save } from '../protocol/save';
import { getHandles } from '../config';
import {
  loadFileInfo,
  isLoadExecFilename,
  fileInfoFromFilename,
} from '../common';
import * as fs from 'fs';
import { commandPut } from './put';
import { promptOverwrite } from '../util/overwriteUtils';

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('fs', () => ({
  __esModule: true,
  ...jest.requireActual('fs'),
}));

jest.mock('../config');
jest.mock('../common');
jest.mock('../protocol/objectInfo');
jest.mock('../protocol/save');
jest.mock('../protocol/examine');
jest.mock('../util/overwriteUtils');

const readAccessObjectInfoMock = jest.mocked(readAccessObjectInfo);
const getHandlesMock = jest.mocked(getHandles);
const loadFileInfoMock = jest.mocked(loadFileInfo);
const saveMock = jest.mocked(save);
const promptOverwriteMock = jest.mocked(promptOverwrite);
const isValidLoadExecFilenameMock = jest.mocked(isLoadExecFilename);
const fileInfoFromFilenameMock = jest.mocked(fileInfoFromFilename);

describe('commandPut', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('single file upload', () => {
    it('should successfully upload a single file without metadata', async () => {
      getHandlesMock.mockResolvedValue({
        userRoot: 1,
        current: 2,
        library: 3,
      });

      jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
      mockLstat(['MYFILE']);

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

    it('should successfully upload a single file with metadata in filename', async () => {
      getHandlesMock.mockResolvedValue({
        userRoot: 1,
        current: 2,
        library: 3,
      });

      jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
      mockLstat(['MYFILE,12345678,87654321']);

      readAccessObjectInfoMock.mockResolvedValue({
        fileExists: false,
        access: null,
      });
      isValidLoadExecFilenameMock.mockReturnValue(true);
      fileInfoFromFilenameMock.mockReturnValue({
        originalFilename: 'MYFILE',
        loadAddr: 0x12345678,
        execAddr: 0x87654321,
      });
      jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => Buffer.from([1, 2, 3]));

      await commandPut(254, 'MYFILE,12345678,87654321', false, false);

      expect(saveMock).toHaveBeenCalledWith(
        254,
        Buffer.from([1, 2, 3]),
        'MYFILE',
        0x12345678,
        0x87654321,
        {
          userRoot: 1,
          current: 2,
          library: 3,
        },
      );
    });

    it('should successfully upload a single file with .inf metadata', async () => {
      getHandlesMock.mockResolvedValue({
        userRoot: 1,
        current: 2,
        library: 3,
      });

      jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
      mockLstat(['MYFILE']);

      readAccessObjectInfoMock.mockResolvedValue({
        fileExists: false,
        access: null,
      });
      jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => Buffer.from([1, 2, 3]));

      loadFileInfoMock.mockReturnValue({
        originalFilename: 'MYFILE',
        loadAddr: 0x12345678,
        execAddr: 0x87654321,
      });
      await commandPut(254, 'MYFILE', false, false);

      expect(saveMock).toHaveBeenCalledWith(
        254,
        Buffer.from([1, 2, 3]),
        'MYFILE',
        0x12345678,
        0x87654321,
        {
          userRoot: 1,
          current: 2,
          library: 3,
        },
      );
    });

    it('should not overwrite a file if confirmation refused', async () => {
      getHandlesMock.mockResolvedValue({
        userRoot: 1,
        current: 2,
        library: 3,
      });

      jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
      mockLstat(['MYFILE']);

      jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => Buffer.from([1, 2, 3]));
      readAccessObjectInfoMock.mockResolvedValue({
        fileExists: true,
        access: 'WR/R',
      });
      promptOverwriteMock.mockResolvedValue(false);

      await commandPut(254, 'MYFILE', false, false);

      expect(saveMock).not.toHaveBeenCalled();
    });

    it('should overwrite a file if confirmed (or force option specified)', async () => {
      getHandlesMock.mockResolvedValue({
        userRoot: 1,
        current: 2,
        library: 3,
      });

      jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
      mockLstat(['MYFILE']);

      jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => Buffer.from([1, 2, 3]));
      readAccessObjectInfoMock.mockResolvedValue({
        fileExists: true,
        access: 'WR/R',
      });
      promptOverwriteMock.mockResolvedValue(true);

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

  describe('multiple file upload', () => {
    it('should successfully upload multiple files matching wildcard', async () => {
      getHandlesMock.mockResolvedValue({
        userRoot: 1,
        current: 2,
        library: 3,
      });

      jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
      jest.spyOn(fs, 'readdirSync').mockImplementation(() => [
        {
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
          name: 'MYFILE1',
        },
        {
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
          name: 'MYFILE2',
        },
        {
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
          name: 'IGNOREME',
        },
      ]);
      mockLstat(['MYFILE1', 'MYFILE2']);

      readAccessObjectInfoMock.mockResolvedValue({
        fileExists: false,
        access: null,
      });
      jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => Buffer.from([1, 2, 3]));

      await commandPut(254, 'MYFILE*', false, false);

      expect(saveMock).toHaveBeenCalledWith(
        254,
        Buffer.from([1, 2, 3]),
        'MYFILE1',
        0xffffffff,
        0xffffffff,
        {
          userRoot: 1,
          current: 2,
          library: 3,
        },
      );
      expect(saveMock).toHaveBeenCalledWith(
        254,
        Buffer.from([1, 2, 3]),
        'MYFILE2',
        0xffffffff,
        0xffffffff,
        {
          userRoot: 1,
          current: 2,
          library: 3,
        },
      );
    });

    it('should successfully upload subdirectory matching wildcard', async () => {
      getHandlesMock.mockResolvedValue({
        userRoot: 1,
        current: 2,
        library: 3,
      });

      jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
      jest.spyOn(fs, 'readdirSync').mockImplementation(path => {
        if (path.toString().includes('MYDIR')) {
          return [
            {
              isFile: () => true,
              isDirectory: () => false,
              isBlockDevice: () => false,
              isCharacterDevice: () => false,
              isFIFO: () => false,
              isSocket: () => false,
              isSymbolicLink: () => false,
              name: 'MYFILE1',
            },
          ];
        } else {
          return [
            {
              isFile: () => false,
              isDirectory: () => true,
              isBlockDevice: () => false,
              isCharacterDevice: () => false,
              isFIFO: () => false,
              isSocket: () => false,
              isSymbolicLink: () => false,
              name: 'MYDIR',
            },
          ];
        }
      });
      mockLstat(['MYFILE1', 'MYFILE2']);

      readAccessObjectInfoMock.mockImplementation((serverStation, filepath) => {
        return Promise.resolve(
          filepath.toString() === 'MYDIR'
            ? { fileExists: true, access: 'DWR/R' }
            : { fileExists: false, access: null },
        );
      });
      jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => Buffer.from([1, 2, 3]));

      await commandPut(254, 'MY*', true, true);

      expect(saveMock).toHaveBeenCalledWith(
        254,
        Buffer.from([1, 2, 3]),
        'MYDIR.MYFILE1',
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

  describe('directory upload', () => {
    it('should successfully upload directory', async () => {
      getHandlesMock.mockResolvedValue({
        userRoot: 1,
        current: 2,
        library: 3,
      });

      jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
      jest.spyOn(fs, 'readdirSync').mockImplementation(() => [
        {
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
          name: 'MYFILE1',
        },
        {
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
          name: 'MYFILE2',
        },
      ]);
      mockLstat(['MYFILE1', 'MYFILE2']);

      readAccessObjectInfoMock.mockImplementation((serverStation, filepath) => {
        return Promise.resolve(
          filepath.toString() === 'MYDIR'
            ? { fileExists: true, access: 'DWR/R' }
            : { fileExists: false, access: null },
        );
      });
      jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation(() => Buffer.from([1, 2, 3]));

      await commandPut(254, 'MYDIR', true, false);

      expect(saveMock).toHaveBeenCalledWith(
        254,
        Buffer.from([1, 2, 3]),
        'MYDIR.MYFILE1',
        0xffffffff,
        0xffffffff,
        {
          userRoot: 1,
          current: 2,
          library: 3,
        },
      );
      expect(saveMock).toHaveBeenCalledWith(
        254,
        Buffer.from([1, 2, 3]),
        'MYDIR.MYFILE2',
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
});

const mockLstat = (filePaths: string[]) => {
  jest.spyOn(fs, 'lstatSync').mockImplementation(path => {
    return {
      isFile: () => filePaths.includes(path.toString()),
      isBlockDevice: () => false,
      isSymbolicLink: () => false,
      isCharacterDevice: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      isDirectory: () => !filePaths.includes(path.toString()),
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
