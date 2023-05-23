/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  driver,
  EventQueue,
  RxTransmitEvent,
  TxResultEvent,
} from '@jprayner/piconet-nodejs';
import { waitForReceiveTxEvent, fsControlByte, stripCRs } from '../common';
import { load } from './load';

jest.mock('../common');

const waitForReceiveTxEventMock = jest.mocked(waitForReceiveTxEvent);
const stripCRsMock = jest.mocked(stripCRs);

const dataPort = 0x92;
const replyPort = 0x90;
const commandCode = 0x0a;

const loadAddr = 0x802bffff;
const execAddr = 0x000dffff;
const size = 0x03;
const access = 0xa3;
const date = 0x464e;

interface RxDataTransmitProps {
  fsStation: number;
  fsNet: number;
  localStation: number;
  localNet: number;
  controlByte: number;
  replyPort: number;
  data: Buffer;
}

interface RxReplyTransmitProps {
  fsStation: number;
  fsNet: number;
  localStation: number;
  localNet: number;
  controlByte: number;
  replyPort: number;
  commandCode: number;
  resultCode: number;
  data: Buffer;
}

describe('load protocol handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load file successfully', async () => {
    setupTransmitMock();
    setupWaitForReceiveTxEventMock();

    const localStation = 1;
    const fsStation = 254;
    const network = 0;
    const resultCode = 0;
    const fileData = Buffer.from('ABC');

    jest
      .spyOn(driver, 'eventQueueWait')
      .mockImplementationOnce(async (queue: EventQueue, timeoutMs: number) => {
        return Promise.resolve(
          dummyDataRxTransmitEvent({
            fsStation,
            fsNet: network,
            localStation,
            localNet: network,
            controlByte: fsControlByte,
            replyPort: dataPort,
            data: fileData,
          }),
        );
      });

    jest
      .spyOn(driver, 'eventQueueWait')
      .mockImplementationOnce(async (queue: EventQueue, timeoutMs: number) => {
        return Promise.resolve(
          dummyReplyRxTransmitEvent({
            fsStation,
            fsNet: network,
            localStation,
            localNet: network,
            controlByte: fsControlByte,
            replyPort,
            commandCode: 0,
            resultCode,
            data: Buffer.from([]),
          }),
        );
      });

    const result = await load(254, 'FNAME', {
      userRoot: 0,
      current: 1,
      library: 2,
    });
    expect(result.actualFilename).toEqual('FNAME');
    expect(result.loadAddr).toEqual(loadAddr);
    expect(result.execAddr).toEqual(execAddr);
    expect(result.size).toEqual(size);
    expect(result.actualSize).toEqual(size);
    expect(result.access).toEqual(access);
    expect(result.date).toEqual(date);
    expect(result.data.toString('ascii')).toEqual('ABC');
  });

  it('should handle no server response correctly', async () => {
    stripCRsMock.mockImplementation((str: string) => str.replace(/\r/g, ''));

    jest
      .spyOn(driver, 'transmit')
      .mockImplementation(
        async (
          station: number,
          network: number,
          controlByte: number,
          port: number,
          data: Buffer,
          extraScoutData?: Buffer,
        ) => {
          return Promise.resolve(new TxResultEvent(false, 'OOPS'));
        },
      );

    await expect(
      load(254, 'FNAME', { userRoot: 0, current: 1, library: 2 }),
    ).rejects.toThrowError('Failed to send LOAD command to station 254');
  });

  it('should handle truncated server response correctly', async () => {
    stripCRsMock.mockImplementation((str: string) => str.replace(/\r/g, ''));
    setupTransmitMock();

    waitForReceiveTxEventMock.mockImplementation(
      async (
        station: number,
        controlByte: number | undefined,
        replyPorts: number[],
      ) => {
        return Promise.resolve({
          controlByte: controlByte || 0,
          port: dataPort,
          commandCode: 0,
          resultCode: 0,
          data: Buffer.from([]),
        });
      },
    );

    await expect(
      load(254, 'FNAME', { userRoot: 0, current: 1, library: 2 }),
    ).rejects.toThrowError(
      'Malformed response in LOAD from station 254: success but not enough data',
    );
  });

  it('should report load file error correctly', async () => {
    stripCRsMock.mockImplementation((str: string) => str.replace(/\r/g, ''));

    setupTransmitMock();

    waitForReceiveTxEventMock.mockImplementation(
      async (
        station: number,
        controlByte: number | undefined,
        replyPorts: number[],
      ) => {
        return Promise.resolve({
          controlByte: controlByte || 0,
          port: replyPorts[0],
          commandCode: 0,
          resultCode: 1,
          data: Buffer.from('Load failed: Something bad happened', 'ascii'),
        });
      },
    );

    await expect(
      load(254, 'FNAME', { userRoot: 0, current: 1, library: 2 }),
    ).rejects.toThrowError('Something bad happened');
  });

  it('should load report mid-transfer file load error correctly', async () => {
    stripCRsMock.mockImplementation((str: string) => str.replace(/\r/g, ''));

    setupTransmitMock();
    setupWaitForReceiveTxEventMock();

    const localStation = 1;
    const fsStation = 254;
    const network = 0;
    const resultCode = 1;

    jest
      .spyOn(driver, 'eventQueueWait')
      .mockImplementationOnce(async (queue: EventQueue, timeoutMs: number) => {
        return Promise.resolve(
          dummyReplyRxTransmitEvent({
            fsStation,
            fsNet: network,
            localStation,
            localNet: network,
            controlByte: fsControlByte,
            replyPort,
            commandCode: 0,
            resultCode,
            data: Buffer.from('Oh dear, oh dear\r'),
          }),
        );
      });

    await expect(
      load(254, 'FNAME', { userRoot: 0, current: 1, library: 2 }),
    ).rejects.toThrowError('Load failed: Oh dear, oh dear');
  });
});

const setupTransmitMock = () => {
  return jest
    .spyOn(driver, 'transmit')
    .mockImplementation(
      async (
        station: number,
        network: number,
        controlByte: number,
        port: number,
        data: Buffer,
        extraScoutData?: Buffer,
      ) => {
        return Promise.resolve(new TxResultEvent(true, 'OK'));
      },
    );
};

const setupWaitForReceiveTxEventMock = () => {
  waitForReceiveTxEventMock.mockImplementation(
    async (
      station: number,
      controlByte: number | undefined,
      replyPorts: number[],
    ) => {
      const header = Buffer.alloc(14);
      header.writeUInt32LE(loadAddr, 0);
      header.writeUInt32LE(execAddr, 4);
      header.writeUInt16LE(size, 8);
      header[10] = 0x00;
      header[11] = access;
      header.writeUInt16LE(date, 12);
      const dirName12Chars = Buffer.from('FNAME       ');
      const trailer = Buffer.from([0xff, 0x4c]);
      return Promise.resolve({
        controlByte: controlByte || 0,
        port: dataPort,
        commandCode: 0,
        resultCode: 0,
        data: Buffer.concat([header, dirName12Chars, trailer]),
      });
    },
  );
};

const dummyReplyRxTransmitEvent = (
  props: RxReplyTransmitProps,
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
    props.commandCode,
    props.resultCode,
  ]);
  const dataFrame = Buffer.concat([dataFrameHeader, props.data]);

  const result = new RxTransmitEvent(scoutFrame, dataFrame);
  return result;
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
