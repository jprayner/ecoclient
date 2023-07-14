import { readAccessObjectInfo } from '../protocol/objectInfo';
import { load } from '../protocol/load';
import { examineDir } from '../protocol/examine';
import { getHandles, getMetadataType } from '../config';
import * as fs from 'fs';
import { commandGet } from './get';
import { promptOverwrite } from '../util/overwriteUtils';

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('fs', () => ({
  __esModule: true,
  ...jest.requireActual('fs'),
}));

jest.mock('../config');
jest.mock('../protocol/objectInfo');
jest.mock('../protocol/load');
jest.mock('../protocol/examine');
jest.mock('../util/overwriteUtils');

const readAccessObjectInfoMock = jest.mocked(readAccessObjectInfo);
const loadMock = jest.mocked(load);
const examineDirMock = jest.mocked(examineDir);
const getMetadataTypeMock = jest.mocked(getMetadataType);
const getHandlesMock = jest.mocked(getHandles);
const promptOverwriteMock = jest.mocked(promptOverwrite);

// eslint-disable-next-line @typescript-eslint/unbound-method
const originalChdir = process.chdir;

describe('commandGet', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.chdir = () => {
      return undefined;
    };
  });

  afterEach(() => {
    process.chdir = originalChdir;
  });

  describe('single file', () => {
    it('should get a single file successfully without metadata', async () => {
      mockCommonFunctions();
      getMetadataTypeMock.mockResolvedValue('none');
      jest.spyOn(fs, 'existsSync').mockImplementation(() => false);

      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');

      await commandGet(254, 'MYFILE', false, false);

      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE',
        Buffer.from([1, 2, 3]),
      );
    });

    it('should get a single file successfully with filename-based metadata', async () => {
      mockCommonFunctions();
      getMetadataTypeMock.mockResolvedValue('filename');
      jest.spyOn(fs, 'existsSync').mockImplementation(() => false);

      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');

      await commandGet(254, 'MYFILE', false, false);

      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE,12345678,87654321',
        Buffer.from([1, 2, 3]),
      );
    });

    it('should get a single file successfully with .inf metadata', async () => {
      mockCommonFunctions();
      getMetadataTypeMock.mockResolvedValue('inf');
      jest.spyOn(fs, 'existsSync').mockImplementation(() => false);

      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');

      await commandGet(254, 'MYFILE', false, false);

      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE',
        Buffer.from([1, 2, 3]),
      );
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE.inf',
        Buffer.from('MYFILE     12345678 87654321\n'),
      );
    });

    it('should not overwrite a regular file if confirmation declined', async () => {
      mockCommonFunctions();
      getMetadataTypeMock.mockResolvedValue('inf');
      jest.spyOn(fs, 'existsSync').mockImplementation(() => true);

      promptOverwriteMock.mockResolvedValue(false);

      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');
      const rmSyncSpy = jest.spyOn(fs, 'rmSync');

      await commandGet(254, 'MYFILE', false, false);

      expect(writeFileSyncSpy).not.toHaveBeenCalled();
      expect(rmSyncSpy).not.toHaveBeenCalled();
    });

    it('should not overwrite an .inf file if confirmation declined', async () => {
      mockCommonFunctions();
      getMetadataTypeMock.mockResolvedValue('inf');
      jest
        .spyOn(fs, 'existsSync')
        .mockImplementation(filename => filename.toString().endsWith('.inf'));

      promptOverwriteMock.mockResolvedValue(false);

      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');
      const rmSyncSpy = jest.spyOn(fs, 'rmSync');

      await commandGet(254, 'MYFILE', false, false);

      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE',
        Buffer.from([1, 2, 3]),
      );
      expect(writeFileSyncSpy).not.toHaveBeenCalledWith(
        'MYFILE.inf',
        Buffer.from('MYFILE     12345678 87654321\n'),
      );
      expect(rmSyncSpy).not.toHaveBeenCalled();
    });

    it('should overwrite a single file successfully after confirmation', async () => {
      mockCommonFunctions();
      getMetadataTypeMock.mockResolvedValue('inf');
      jest
        .spyOn(fs, 'existsSync')
        .mockImplementation(filename => !filename.toString().endsWith('.inf'));

      promptOverwriteMock.mockResolvedValue(true);

      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');
      const rmSyncSpy = jest.spyOn(fs, 'rmSync');

      await commandGet(254, 'MYFILE', false, false);

      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE',
        Buffer.from([1, 2, 3]),
      );
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE.inf',
        Buffer.from('MYFILE     12345678 87654321\n'),
      );
      expect(rmSyncSpy).toHaveBeenCalledWith('MYFILE', {
        force: true,
        recursive: true,
      });
    });

    it('should get a single file successfully with .inf metadata and existing .inf file after overwrite confirmation', async () => {
      mockCommonFunctions();
      getMetadataTypeMock.mockResolvedValue('inf');
      jest
        .spyOn(fs, 'existsSync')
        .mockImplementation(filename => filename.toString().endsWith('.inf'));

      promptOverwriteMock.mockResolvedValue(true);

      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');
      const rmSyncSpy = jest.spyOn(fs, 'rmSync');

      await commandGet(254, 'MYFILE', false, false);

      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE',
        Buffer.from([1, 2, 3]),
      );
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE.inf',
        Buffer.from('MYFILE     12345678 87654321\n'),
      );
      expect(rmSyncSpy).toHaveBeenCalledWith('MYFILE.inf', {
        force: true,
        recursive: true,
      });
    });
  });

  describe('multiple files', () => {
    it('should get multiple files successfully', async () => {
      mockCommonFunctions();

      loadMock.mockResolvedValueOnce({
        loadAddr: 0x12345678,
        execAddr: 0x87654321,
        size: 3,
        access: 0,
        date: 0,
        actualFilename: 'MYFILE2',
        data: Buffer.from([3, 2, 1]),
      });

      examineDirMock.mockResolvedValue([
        {
          id: '1',
          name: 'MYFILE',
          loadAddress: '12345678',
          execAddress: '87654321',
          sizeBytes: 3,
          access: 'WR/R',
          date: '01-01-2021',
        },
        {
          id: '2',
          name: 'MYFILE2',
          loadAddress: '12345678',
          execAddress: '87654321',
          sizeBytes: 3,
          access: 'WR/R',
          date: '01-01-2021',
        },
      ]);

      getMetadataTypeMock.mockResolvedValue('none');
      jest.spyOn(fs, 'existsSync').mockImplementation(() => false);

      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');

      await commandGet(254, 'MYFILE*', false, false);

      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE',
        Buffer.from([1, 2, 3]),
      );
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE2',
        Buffer.from([3, 2, 1]),
      );
    });

    it('should get dir if recursion option specified', async () => {
      mockCommonFunctions();

      loadMock.mockResolvedValueOnce({
        loadAddr: 0x12345678,
        execAddr: 0x87654321,
        size: 3,
        access: 0,
        date: 0,
        actualFilename: 'MYFILE2',
        data: Buffer.from([3, 2, 1]),
      });

      examineDirMock.mockImplementation(async (station, dirPath) => {
        switch (dirPath) {
          case '':
            return Promise.resolve([
              {
                id: '0',
                name: 'MYDIR',
                loadAddress: 'FFFFFFFF',
                execAddress: 'FFFFFFFF',
                sizeBytes: 3,
                access: 'DWR/R',
                date: '01-01-2021',
              },
              {
                id: '1',
                name: 'MYFILE',
                loadAddress: '12345678',
                execAddress: '87654321',
                sizeBytes: 3,
                access: 'WR/R',
                date: '01-01-2021',
              },
            ]);
            break;
          case 'MYDIR':
            return Promise.resolve([
              {
                id: '2',
                name: 'MYFILE2',
                loadAddress: '12345678',
                execAddress: '87654321',
                sizeBytes: 3,
                access: 'WR/R',
                date: '01-01-2021',
              },
            ]);

          default:
            throw new Error(`Unexpected dirPath: ${dirPath}`);
        }
      });

      getMetadataTypeMock.mockResolvedValue('none');
      jest.spyOn(fs, 'existsSync').mockImplementation(() => false);

      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');
      const mkDirSyncSpy = jest
        .spyOn(fs, 'mkdirSync')
        .mockImplementation(() => {
          return undefined;
        });

      await commandGet(254, 'MY*', true, false);

      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE',
        Buffer.from([1, 2, 3]),
      );
      expect(mkDirSyncSpy).toHaveBeenCalledWith('MYDIR');
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE2',
        Buffer.from([3, 2, 1]),
      );
    });

    it('should skip dirs if no recursion option specified', async () => {
      mockCommonFunctions();

      loadMock.mockResolvedValueOnce({
        loadAddr: 0x12345678,
        execAddr: 0x87654321,
        size: 3,
        access: 0,
        date: 0,
        actualFilename: 'MYFILE2',
        data: Buffer.from([3, 2, 1]),
      });

      examineDirMock.mockResolvedValue([
        {
          id: '0',
          name: 'MYDIR',
          loadAddress: 'FFFFFFFF',
          execAddress: 'FFFFFFFF',
          sizeBytes: 3,
          access: 'DWR/R',
          date: '01-01-2021',
        },
        {
          id: '1',
          name: 'MYFILE',
          loadAddress: '12345678',
          execAddress: '87654321',
          sizeBytes: 3,
          access: 'WR/R',
          date: '01-01-2021',
        },
        {
          id: '2',
          name: 'MYFILE2',
          loadAddress: '12345678',
          execAddress: '87654321',
          sizeBytes: 3,
          access: 'WR/R',
          date: '01-01-2021',
        },
      ]);

      getMetadataTypeMock.mockResolvedValue('none');
      jest.spyOn(fs, 'existsSync').mockImplementation(() => false);

      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');
      const mkDirSyncSpy = jest.spyOn(fs, 'mkdirSync');

      await commandGet(254, 'MYFILE*', false, false);

      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE',
        Buffer.from([1, 2, 3]),
      );
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE2',
        Buffer.from([3, 2, 1]),
      );
      expect(mkDirSyncSpy).not.toHaveBeenCalled();
    });
  });

  describe('dir copy', () => {
    it('should get dir successfully', async () => {
      getHandlesMock.mockResolvedValue({
        userRoot: 1,
        current: 2,
        library: 3,
      });
      readAccessObjectInfoMock.mockResolvedValue({
        fileExists: true,
        access: 'DWR/R',
      });
      examineDirMock.mockResolvedValue([
        {
          id: '1',
          name: 'MYFILE',
          loadAddress: '12345678',
          execAddress: '87654321',
          sizeBytes: 3,
          access: 'WR/R',
          date: '01-01-2021',
        },
      ]);
      loadMock.mockResolvedValue({
        loadAddr: 0x12345678,
        execAddr: 0x87654321,
        size: 3,
        access: 0,
        date: 0,
        actualFilename: 'MYFILE',
        data: Buffer.from([1, 2, 3]),
      });

      getMetadataTypeMock.mockResolvedValue('none');
      jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
      const mkDirSyncSpy = jest
        .spyOn(fs, 'mkdirSync')
        .mockImplementation(() => {
          return undefined;
        });
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');

      await commandGet(254, 'MYDIR', true, false);

      expect(mkDirSyncSpy).toHaveBeenCalledWith('MYDIR');
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'MYFILE',
        Buffer.from([1, 2, 3]),
      );
    });

    it('should error if dir download attempted without recurse option', async () => {
      getHandlesMock.mockResolvedValue({
        userRoot: 1,
        current: 2,
        library: 3,
      });
      readAccessObjectInfoMock.mockResolvedValue({
        fileExists: true,
        access: 'DWR/R',
      });

      getMetadataTypeMock.mockResolvedValue('none');
      jest.spyOn(fs, 'existsSync').mockImplementation(() => false);

      const mkDirSyncSpy = jest
        .spyOn(fs, 'mkdirSync')
        .mockImplementation(() => {
          return undefined;
        });
      const writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync');

      await expect(commandGet(254, 'MYDIR', false, false)).rejects.toThrow(
        "'MYDIR' is a directory, specify -r to recurse",
      );

      expect(mkDirSyncSpy).not.toHaveBeenCalled();
      expect(writeFileSyncSpy).not.toHaveBeenCalled();
    });
  });
});

const mockCommonFunctions = () => {
  getHandlesMock.mockResolvedValueOnce({
    userRoot: 1,
    current: 2,
    library: 3,
  });
  readAccessObjectInfoMock.mockResolvedValueOnce({
    fileExists: true,
    access: 'WR/R',
  });
  loadMock.mockResolvedValueOnce({
    loadAddr: 0x12345678,
    execAddr: 0x87654321,
    size: 3,
    access: 0,
    date: 0,
    actualFilename: 'MYFILE',
    data: Buffer.from([1, 2, 3]),
  });
};
