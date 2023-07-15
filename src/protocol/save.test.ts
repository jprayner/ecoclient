import { driver, RxTransmitEvent } from '@jprayner/piconet-nodejs';
import * as common from '../common';
import { save } from './save';

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('../common', () => ({
  __esModule: true,
  ...jest.requireActual('../common'),
}));

const replyPort = 0x90;
const ackPort = 0x91;
const dataPort = 0x92;
const commandPort = 0x99;

const loadAddr = 0x802bffff;
const execAddr = 0x000dffff;

const localStation = 1;
const fsStation = 254;
const network = 0;
const successResultCode = 0;
const errorResultCode = 1;

interface RxDataTransmitProps {
  fsStation: number;
  fsNet: number;
  localStation: number;
  localNet: number;
  controlByte: number;
  replyPort: number;
  data: Buffer;
}

describe('save protocol handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save file successfully (single block)', async () => {
    const fileData = Buffer.from('ABC');
    const blockSize = 4;

    const transmitSpy = jest.spyOn(driver, 'transmit').mockResolvedValue({
      success: true,
      description: 'OK',
    });

    jest
      .spyOn(common, 'waitForReceiveTxEvent')
      .mockResolvedValue(dummySaveCommandResponse(blockSize));

    jest
      .spyOn(driver, 'eventQueueWait')
      .mockResolvedValueOnce(dummySaveStatusOkEvent());

    await save(254, fileData, 'FNAME', loadAddr, execAddr, {
      userRoot: 0,
      current: 1,
      library: 2,
    });

    expect(transmitSpy).toHaveBeenCalledWith(
      fsStation,
      network,
      common.fsControlByte,
      commandPort,
      expectedSaveTxMessage(fileData),
    );
    expect(transmitSpy).toHaveBeenCalledWith(
      fsStation,
      network,
      common.fsControlByte,
      dataPort,
      fileData,
    );
  });

  it('should save file successfully (multiple blocks)', async () => {
    const fileData = Buffer.from('ABCDEF');
    const blockSize = 4;

    const transmitSpy = jest.spyOn(driver, 'transmit').mockResolvedValue({
      success: true,
      description: 'OK',
    });

    const waitForReceiveTxEventSpy = jest
      .spyOn(common, 'waitForReceiveTxEvent')
      .mockResolvedValue(dummySaveCommandResponse(blockSize));

    const waitForAckEventSpy = jest
      .spyOn(driver, 'eventQueueWait')
      .mockResolvedValueOnce(dummyAckEvent());

    const waitForSaveStatusSpy = jest
      .spyOn(driver, 'eventQueueWait')
      .mockResolvedValueOnce(dummySaveStatusOkEvent());

    await save(254, fileData, 'FNAME', loadAddr, execAddr, {
      userRoot: 0,
      current: 1,
      library: 2,
    });

    expect(transmitSpy).toHaveBeenCalledWith(
      fsStation,
      network,
      common.fsControlByte,
      commandPort,
      expectedSaveTxMessage(fileData),
    );
    expect(waitForReceiveTxEventSpy).toHaveBeenCalledTimes(1);
    expect(transmitSpy).toHaveBeenCalledWith(
      fsStation,
      network,
      common.fsControlByte,
      dataPort,
      Buffer.from('ABCD'),
    );
    expect(waitForAckEventSpy).toHaveBeenCalled();
    expect(transmitSpy).toHaveBeenCalledWith(
      fsStation,
      network,
      common.fsControlByte,
      dataPort,
      Buffer.from('EF'),
    );
    expect(waitForSaveStatusSpy).toHaveBeenCalled();
  });

  it('should report file server error from save command', async () => {
    const fileData = Buffer.from('ABC');

    jest.spyOn(driver, 'transmit').mockResolvedValue({
      success: true,
      description: 'OK',
    });

    jest
      .spyOn(common, 'waitForReceiveTxEvent')
      .mockResolvedValue(dummySaveCommandErrorResponse());

    await expect(
      save(254, fileData, 'FNAME', loadAddr, execAddr, {
        userRoot: 0,
        current: 1,
        library: 2,
      }),
    ).rejects.toThrow('Guru meditation error');
  });

  it('should report error sending command to file server', async () => {
    const fileData = Buffer.from('ABC');

    jest.spyOn(driver, 'transmit').mockResolvedValue({
      success: false,
      description: 'NOK',
    });

    await expect(
      save(254, fileData, 'FNAME', loadAddr, execAddr, {
        userRoot: 0,
        current: 1,
        library: 2,
      }),
    ).rejects.toThrow('Failed to send SAVE command to station 254');
  });

  it('should retry block on error', async () => {
    const fileData = Buffer.from('ABCDEF');
    const blockSize = 4;

    const transmitSpy = jest
      .spyOn(driver, 'transmit')
      .mockResolvedValueOnce({
        success: true,
        description: 'OK',
      })
      .mockResolvedValueOnce({
        success: false,
        description: 'Argh!',
      })
      .mockResolvedValueOnce({
        success: true,
        description: 'OK',
      })
      .mockResolvedValueOnce({
        success: true,
        description: 'OK',
      });

    const waitForReceiveTxEventSpy = jest
      .spyOn(common, 'waitForReceiveTxEvent')
      .mockResolvedValue(dummySaveCommandResponse(blockSize));

    const waitForAckEventSpy = jest
      .spyOn(driver, 'eventQueueWait')
      .mockResolvedValueOnce(dummyAckEvent());

    const waitForSaveStatusSpy = jest
      .spyOn(driver, 'eventQueueWait')
      .mockResolvedValueOnce(dummySaveStatusOkEvent());

    await save(254, fileData, 'FNAME', loadAddr, execAddr, {
      userRoot: 0,
      current: 1,
      library: 2,
    });

    expect(transmitSpy).toHaveBeenNthCalledWith(
      1,
      fsStation,
      network,
      common.fsControlByte,
      commandPort,
      expectedSaveTxMessage(fileData),
    );
    expect(waitForReceiveTxEventSpy).toHaveBeenCalledTimes(1);
    expect(transmitSpy).toHaveBeenNthCalledWith(
      2,
      fsStation,
      network,
      common.fsControlByte,
      dataPort,
      Buffer.from('ABCD'),
    );
    expect(transmitSpy).toHaveBeenNthCalledWith(
      3,
      fsStation,
      network,
      common.fsControlByte,
      dataPort,
      Buffer.from('ABCD'),
    );
    expect(waitForAckEventSpy).toHaveBeenCalled();
    expect(transmitSpy).toHaveBeenNthCalledWith(
      4,
      fsStation,
      network,
      common.fsControlByte,
      dataPort,
      Buffer.from('EF'),
    );
    expect(waitForSaveStatusSpy).toHaveBeenCalled();
  });
});

const dummySaveCommandResponse = (blockSize: number) => {
  return {
    controlByte: common.fsControlByte,
    port: replyPort,
    commandCode: 0,
    resultCode: successResultCode,
    data: Buffer.from([dataPort, blockSize & 0xff, (blockSize >> 8) & 0xff]),
  };
};

const dummySaveCommandErrorResponse = () => {
  return {
    controlByte: common.fsControlByte,
    port: replyPort,
    commandCode: 0,
    resultCode: errorResultCode,
    data: Buffer.from('Guru meditation error'),
  };
};

const dummyAckEvent = () => {
  return dummyDataRxTransmitEvent({
    fsStation,
    fsNet: network,
    localStation,
    localNet: network,
    controlByte: common.fsControlByte,
    replyPort: ackPort,
    data: Buffer.from([]),
  });
};

const dummySaveStatusOkEvent = () => {
  return dummyDataRxTransmitEvent({
    fsStation,
    fsNet: network,
    localStation,
    localNet: network,
    controlByte: common.fsControlByte,
    replyPort: replyPort,
    data: Buffer.from([0, successResultCode, 0x00, 0x00, 0x00]),
  });
};

const expectedSaveTxMessage = (data: Buffer) => {
  const saveCommandData = Buffer.concat([
    Buffer.from([
      loadAddr & 0xff,
      (loadAddr >> 8) & 0xff,
      (loadAddr >> 16) & 0xff,
      (loadAddr >> 24) & 0xff,
    ]),
    Buffer.from([
      execAddr & 0xff,
      (execAddr >> 8) & 0xff,
      (execAddr >> 16) & 0xff,
      (execAddr >> 24) & 0xff,
    ]),
    Buffer.from([
      data.length & 0xff,
      (data.length >> 8) & 0xff,
      (data.length >> 16) & 0xff,
    ]),
    Buffer.from('FNAME\r'),
  ]);
  return common.standardTxMessage(
    replyPort,
    0x01,
    {
      userRoot: ackPort,
      current: 1,
      library: 2,
    },
    saveCommandData,
  );
};

const dummyDataRxTransmitEvent = (
  props: RxDataTransmitProps,
): RxTransmitEvent => {
  const scoutFrame = Buffer.from([
    props.localStation,
    props.localNet,
    props.fsStation,
    props.fsNet,
    props.controlByte,
    props.replyPort,
  ]);

  const dataFrameHeader = Buffer.from([
    props.localStation,
    props.localNet,
    props.fsStation,
    props.fsNet,
  ]);
  const dataFrame = Buffer.concat([dataFrameHeader, props.data]);

  const result = new RxTransmitEvent(scoutFrame, dataFrame);
  return result;
};
