import { fsControlByte, fsPort, executeCliCommand } from '../common';
import { iAm } from './iAm';

jest.mock('../common');

const executeCliCommandMock = jest.mocked(executeCliCommand);

describe('iAm protocol handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call executeCliCommand with the correct arguments', async () => {
    executeCliCommandMock.mockResolvedValueOnce({
      controlByte: fsControlByte,
      port: fsPort,
      commandCode: 0,
      resultCode: 0,
      data: Buffer.from([0, 1, 2, 3]),
    });
    const result = await iAm(254, 'JPR93', 'MYPASS');
    expect(executeCliCommandMock).toHaveBeenCalledWith(
      254,
      'I AM JPR93 MYPASS',
      {
        userRoot: 0,
        current: 0,
        library: 0,
      },
    );
    expect(result).toEqual({
      directoryHandles: {
        userRoot: 1,
        current: 0,
        library: 2,
      },
      bootOption: 3,
    });
  });

  it('should omit password if not specified', async () => {
    executeCliCommandMock.mockResolvedValueOnce({
      controlByte: fsControlByte,
      port: fsPort,
      commandCode: 0,
      resultCode: 0,
      data: Buffer.from([0, 1, 2, 3]),
    });
    const result = await iAm(254, 'JPR93');
    expect(executeCliCommandMock).toHaveBeenCalledWith(254, 'I AM JPR93', {
      userRoot: 0,
      current: 0,
      library: 0,
    });
    expect(result).toEqual({
      directoryHandles: {
        userRoot: 1,
        current: 0,
        library: 2,
      },
      bootOption: 3,
    });
  });

  it('should call throw error on unexpected server reply length', async () => {
    executeCliCommandMock.mockResolvedValueOnce({
      controlByte: fsControlByte,
      port: fsPort,
      commandCode: 0,
      resultCode: 0,
      data: Buffer.from([0]),
    });
    await expect(iAm(254, 'JPR93', 'MYPASS')).rejects.toThrowError(
      'Malformed response from station 254: success but not enough data',
    );
  });
});
