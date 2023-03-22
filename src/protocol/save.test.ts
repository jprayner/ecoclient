/* eslint-disable @typescript-eslint/no-unused-vars */
import { driver, TxResultEvent } from '@jprayner/piconet-nodejs';
import {
  waitForReceiveTxEvent,
  waitForDataOrStatus,
  fsControlByte,
  stripCRs,
} from '../common';
import { load } from './load';
import { readDirAccessObjectInfo } from './objectInfo';

jest.mock('../common');

const waitForReceiveTxEventMock = jest.mocked(waitForReceiveTxEvent);
const waitForDataOrStatusMock = jest.mocked(waitForDataOrStatus);
const stripCRsMock = jest.mocked(stripCRs);

const dataPort = 0x92;
const statusPort = 0x90;
const commandCode = 0x0a;

const loadAddr = 0x802bffff;
const execAddr = 0x000dffff;
const size = 0x03;
const access = 0xa3;
const date = 0x464e;

describe('save protocol handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save file successfully', async () => {
    setupTransmitMock();
    setupWaitForReceiveTxEventMock();

    const fileData = Buffer.from('ABC');
    waitForDataOrStatusMock.mockResolvedValueOnce({
      type: 'data',
      data: fileData,
    });

    waitForDataOrStatusMock.mockResolvedValueOnce({
      type: 'status',
      controlByte: fsControlByte,
      port: statusPort,
      commandCode,
      resultCode: 0,
      data: Buffer.from([]),
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

  const setupTransmitMock = () => {
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
          return Promise.resolve(new TxResultEvent(true, 'OK'));
        },
      );
  };

  const setupWaitForReceiveTxEventMock = () => {
    waitForReceiveTxEventMock.mockImplementation(
      async (station: number, controlByte: number, replyPorts: number[]) => {
        const header = Buffer.alloc(14);
        header[0] = 0x80; // data port
        header[1] = header.writeInt16LE(0x0b, 1);
        // TODO: YOU ARE HERE
        header.writeUInt32LE(loadAddr, 0);
        header.writeUInt32LE(execAddr, 4);
        header.writeUInt16LE(size, 8);
        header[10] = 0x00;
        header[11] = access;
        header.writeUInt16LE(date, 12);
        const dirName12Chars = Buffer.from('FNAME       ');
        const trailer = Buffer.from([0xff, 0x4c]);
        return Promise.resolve({
          controlByte,
          port: dataPort,
          commandCode: 0,
          resultCode: 0,
          data: Buffer.concat([header, dirName12Chars, trailer]),
        });
      },
    );
  };
});
