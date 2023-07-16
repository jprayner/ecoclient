import { driver } from '@jprayner/piconet-nodejs';
import * as common from '../common';
import { examineDir } from './examine';

const replyPort = 0x90;
const successResultCode = 0;

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('../common', () => ({
  __esModule: true,
  ...jest.requireActual('../common'),
}));

describe('examine protocol handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully examine directory', async () => {
    jest.spyOn(driver, 'transmit').mockResolvedValue({
      success: true,
      description: 'OK',
    });

    jest
      .spyOn(common, 'waitForReceiveTxEvent')
      .mockResolvedValueOnce(dummyExamineCommandSuccessResponse())
      .mockResolvedValueOnce(dummyExamineCommandCompleteResponse());

    const result = await examineDir(254, 'D1', {
      userRoot: 1, // Unusual handling for SAVE: ack port lives here
      current: 2,
      library: 3,
    });

    expect(result).toEqual([
      {
        access: 'WR/R',
        date: '24/02/23',
        execAddress: 'FFFFFFFF',
        id: '0001',
        loadAddress: 'FFFFFFFF',
        name: 'MYFILE1',
        sizeBytes: 16,
      },
      {
        access: 'LWR/R',
        date: '23/02/23',
        execAddress: '87654321',
        id: '0022',
        loadAddress: '12345678',
        name: 'MYFILE2',
        sizeBytes: 32,
      },
    ]);
  });
});

const dummyExamineCommandSuccessResponse = () => {
  const resultStr = [
    'MYFILE1   FFFFFFFF FFFFFFFF 00010   WR/R  24/02/23  0001',
    'MYFILE2   12345678 87654321 00020  LWR/R  23/02/23  0022',
  ].join('\0');
  return {
    controlByte: common.fsControlByte,
    port: replyPort,
    commandCode: 0,
    resultCode: successResultCode,
    data: Buffer.concat([Buffer.from([2, 0]), Buffer.from(resultStr)]),
  };
};

const dummyExamineCommandCompleteResponse = () => {
  return {
    controlByte: common.fsControlByte,
    port: replyPort,
    commandCode: 0,
    resultCode: successResultCode,
    data: Buffer.from([0, 0]),
  };
};
