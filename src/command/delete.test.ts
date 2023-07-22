import { readAccessObjectInfo } from '../protocol/objectInfo';
import { deleteFile } from '../protocol/simpleCli';
import { examineDir } from '../protocol/examine';
import { getHandles } from '../config';
import { promptDelete } from '../util/deleteUtils';
import { commandDelete } from './delete';

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('fs', () => ({
  __esModule: true,
  ...jest.requireActual('fs'),
}));

jest.mock('../config');
jest.mock('../protocol/simpleCli');
jest.mock('../util/deleteUtils');
jest.mock('../protocol/objectInfo');
jest.mock('../protocol/examine');

const readAccessObjectInfoMock = jest.mocked(readAccessObjectInfo);
const examineDirMock = jest.mocked(examineDir);
const deleteFileMock = jest.mocked(deleteFile);
const getHandlesMock = jest.mocked(getHandles);
const promptDeleteMock = jest.mocked(promptDelete);

// eslint-disable-next-line @typescript-eslint/unbound-method
const originalChdir = process.chdir;

describe('commandDelete', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.chdir = () => {
      return undefined;
    };
  });

  afterEach(() => {
    process.chdir = originalChdir;
  });

  it('should delete a single file successfully', async () => {
    mockCommonFunctions();
    readAccessObjectInfoMock.mockResolvedValue({
      fileExists: true,
      access: 'WR/R',
    });
    promptDeleteMock.mockResolvedValue(true);

    await commandDelete(254, 'MYFILE', false, false);

    expect(deleteFileMock).toHaveBeenCalledWith(254, 'MYFILE', {
      userRoot: 1,
      current: 2,
      library: 3,
    });
  });

  it('should handle deletion of a non-existant single file', async () => {
    mockCommonFunctions();
    readAccessObjectInfoMock.mockResolvedValue({
      fileExists: false,
      access: null,
    });
    promptDeleteMock.mockResolvedValue(true);

    await expect(commandDelete(254, 'MYFILE', false, false)).rejects.toThrow(
      'File not found: MYFILE',
    );
  });

  it('should delete a directory containing a file successfully', async () => {
    mockCommonFunctions();
    readAccessObjectInfoMock.mockResolvedValueOnce({
      fileExists: true,
      access: 'DWR/R',
    });
    promptDeleteMock.mockResolvedValue(true);
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

    await commandDelete(254, 'MYDIR', true, false);

    expect(deleteFileMock).toHaveBeenCalledWith(254, 'MYDIR.MYFILE', {
      userRoot: 1,
      current: 2,
      library: 3,
    });
    expect(deleteFileMock).toHaveBeenCalledWith(254, 'MYDIR', {
      userRoot: 1,
      current: 2,
      library: 3,
    });
  });

  it('should delete a directory containing a populated subdirectory successfully', async () => {
    mockCommonFunctions();
    readAccessObjectInfoMock.mockResolvedValueOnce({
      fileExists: true,
      access: 'DWR/R',
    });
    promptDeleteMock.mockResolvedValue(true);
    examineDirMock.mockResolvedValueOnce([
      {
        id: '1',
        name: 'SUBDIR',
        loadAddress: '12345678',
        execAddress: '87654321',
        sizeBytes: 3,
        access: 'DWR/R',
        date: '01-01-2021',
      },
    ]);
    examineDirMock.mockResolvedValueOnce([
      {
        id: '2',
        name: 'SOMEFILE',
        loadAddress: '12345678',
        execAddress: '87654321',
        sizeBytes: 3,
        access: 'WR/R',
        date: '01-01-2021',
      },
    ]);

    await commandDelete(254, 'MYDIR', true, false);

    expect(deleteFileMock).toHaveBeenCalledWith(254, 'MYDIR.SUBDIR.SOMEFILE', {
      userRoot: 1,
      current: 2,
      library: 3,
    });

    expect(deleteFileMock).toHaveBeenCalledWith(254, 'MYDIR.SUBDIR', {
      userRoot: 1,
      current: 2,
      library: 3,
    });

    expect(deleteFileMock).toHaveBeenCalledWith(254, 'MYDIR', {
      userRoot: 1,
      current: 2,
      library: 3,
    });
  });

  it('should delete files matching a wildcard pattern', async () => {
    mockCommonFunctions();
    promptDeleteMock.mockResolvedValue(true);
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
      {
        id: '3',
        name: 'NOMATCH',
        loadAddress: '12345678',
        execAddress: '87654321',
        sizeBytes: 3,
        access: 'WR/R',
        date: '01-01-2021',
      },
    ]);

    await commandDelete(254, 'MY*', true, false);

    expect(deleteFileMock).toHaveBeenCalledWith(254, 'MYFILE', {
      userRoot: 1,
      current: 2,
      library: 3,
    });
    expect(deleteFileMock).toHaveBeenCalledWith(254, 'MYFILE2', {
      userRoot: 1,
      current: 2,
      library: 3,
    });
    expect(deleteFileMock).not.toHaveBeenCalledWith(254, 'NOMATCH', {
      userRoot: 1,
      current: 2,
      library: 3,
    });
  });
});

const mockCommonFunctions = () => {
  getHandlesMock.mockResolvedValue({
    userRoot: 1,
    current: 2,
    library: 3,
  });
  deleteFileMock.mockImplementation(async () => {
    return Promise.resolve({
      controlByte: 0,
      port: 0,
      commandCode: 0,
      resultCode: 0,
      data: Buffer.from([]),
    });
  });
};
