/* eslint-disable @typescript-eslint/no-unused-vars */
import { driver } from '@jprayner/piconet-nodejs';
import { waitForReceiveTxEvent, waitForDataOrStatus, fsControlByte, stripCRs } from '../common';
import { load } from './load';
import { readDirAccessObjectInfo } from './objectInfo';

jest.mock('@jprayner/piconet-nodejs');
jest.mock('../common');

const driverMock = jest.mocked(driver);
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

describe('load protocol handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load file successfully', async () => {
    setupTransmitMock();
    setupWaitForReceiveTxEventMock();

    const fileData = Buffer.from('ABC');
    waitForDataOrStatusMock.mockResolvedValueOnce(
      {
        type: 'data',
        data: fileData,
      },
    );

    waitForDataOrStatusMock.mockResolvedValueOnce(
      {
        type: 'status',
        controlByte: fsControlByte,
        port: statusPort,
        commandCode,
        resultCode: 0,
        data: Buffer.from([]),
      },
    );

    const result = await load(254, 'FNAME');
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

    driverMock.transmit.mockImplementation(
      async (
        station: number,
        network: number,
        controlByte: number,
        port: number,
        data: Buffer,
        extraScoutData?: Buffer,
      ) => {
        return Promise.resolve({
          type: 'TxResultEvent',
          result: 'OOPS',
        });
      },
    );
  
    await expect(load(254, 'FNAME')).rejects.toThrowError('Failed to send LOAD command to station 254');
  });

  it('should handle truncated server response correctly', async () => {
    stripCRsMock.mockImplementation((str: string) => str.replace(/\r/g, ''));
    setupTransmitMock();

    waitForReceiveTxEventMock.mockImplementation(
      async (station: number, controlByte: number, replyPorts: number[]) => {
        return Promise.resolve({
          controlByte,
          port: dataPort,
          commandCode: 0,
          resultCode: 0,
          data: Buffer.from([]),
        });
      },
    );
  
  
    await expect(load(254, 'FNAME')).rejects.toThrowError('Malformed response in LOAD from station 254: success but not enough data');
  });

  it('should report load file error correctly', async () => {
    stripCRsMock.mockImplementation((str: string) => str.replace(/\r/g, ''));

    setupTransmitMock();
    
    waitForReceiveTxEventMock.mockImplementation(
      async (station: number, controlByte: number, replyPorts: number[]) => {
        return Promise.resolve({
          controlByte,
          port: replyPorts[0],
          commandCode: 0,
          resultCode: 1,
          data: Buffer.from('Load failed: Something bad happened', 'ascii'),
        });
      },
    );

    await expect(load(254, 'FNAME')).rejects.toThrowError('Something bad happened');
  });

  it('should load report mid-transfer file load error correctly', async () => {
    stripCRsMock.mockImplementation((str: string) => str.replace(/\r/g, ''));

    setupTransmitMock();
    setupWaitForReceiveTxEventMock();

    waitForDataOrStatusMock.mockResolvedValueOnce(
      {
        type: 'status',
        controlByte: fsControlByte,
        port: statusPort,
        commandCode,
        resultCode: 1,
        data: Buffer.from('Oh dear, oh dear\r'),
      },
    );

    await expect(load(254, 'FNAME')).rejects.toThrowError('Load failed during delivery: Oh dear, oh dear');
  });
});

const setupTransmitMock = () => {
  driverMock.transmit.mockImplementation(
    async (
      station: number,
      network: number,
      controlByte: number,
      port: number,
      data: Buffer,
      extraScoutData?: Buffer,
    ) => {
      return Promise.resolve({
        type: 'TxResultEvent',
        result: 'OK',
      });
    },
  );
};

const setupWaitForReceiveTxEventMock = () => {
  waitForReceiveTxEventMock.mockImplementation(
    async (station: number, controlByte: number, replyPorts: number[]) => {
      const header = Buffer.alloc(14);
      header.writeUInt32LE(loadAddr, 0);
      header.writeUInt32LE(execAddr, 4);
      header.writeUInt16LE(size, 8);
      header[10] = 0x00;
      header[11] = access;
      header.writeUInt16LE(date, 12);
      const dirName12Chars = Buffer.from('FNAME       ');
      const trailer = Buffer.from([
        0xff,
        0x4c,
      ]);
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
