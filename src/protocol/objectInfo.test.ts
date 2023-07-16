/* eslint-disable @typescript-eslint/no-unused-vars */
import { driver, TxResultEvent } from '@jprayner/piconet-nodejs';
import { waitForReceiveTxEvent } from '../common';
import { readAccessObjectInfo, readDirAccessObjectInfo } from './objectInfo';

jest.mock('../common');

const waitForReceiveTxEventMock = jest.mocked(waitForReceiveTxEvent);

describe('objectInfo protocol handler', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('readDirAccessObjectInfo', () => {
    it('should read directory object info successfully', async () => {
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

      waitForReceiveTxEventMock.mockImplementation(
        async (queue: driver.EventQueue, serverStation: number) => {
          const header = Buffer.from([0, 0, 0]);
          const dirName10Chars = Buffer.from('SOMEDIR   ');
          const trailer = Buffer.from([
            0x00, // 0x00 = owner, anything else = public
            0x10, // cycle number
          ]);
          return Promise.resolve({
            controlByte: 0x80,
            port: 0x90,
            commandCode: 0,
            resultCode: 0,
            data: Buffer.concat([header, dirName10Chars, trailer]),
          });
        },
      );

      const result = await readDirAccessObjectInfo(254, '$', {
        userRoot: 0,
        current: 1,
        library: 2,
      });
      expect(result).toEqual({
        dirName: 'SOMEDIR',
        isOwner: true,
        cycleNum: 0x10,
      });
    });

    it('should throw error if server fails to respond to read directory object info', async () => {
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
            return Promise.resolve(
              new TxResultEvent(false, 'Something bad happened'),
            );
          },
        );

      await expect(
        readDirAccessObjectInfo(254, '$', {
          userRoot: 0,
          current: 1,
          library: 2,
        }),
      ).rejects.toThrowError(
        'Failed to send object info command (0x12) to station 254: Something bad happened',
      );
    });

    it('should throw error if server returns malformed response from read directory object info', async () => {
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

      waitForReceiveTxEventMock.mockImplementation(
        async (queue: driver.EventQueue, serverStation: number) => {
          return Promise.resolve({
            controlByte: 0x80,
            port: 0x90,
            commandCode: 0,
            resultCode: 1,
            data: Buffer.from([0, 0, 0]),
          });
        },
      );

      await expect(
        readDirAccessObjectInfo(254, '$', {
          userRoot: 0,
          current: 1,
          library: 2,
        }),
      ).rejects.toThrowError(
        'Malformed response from station 254: success but not enough data',
      );
    });
  });

  describe('readAccessObjectInfo', () => {
    it('should read file object info successfully', async () => {
      jest
        .spyOn(driver, 'transmit')
        .mockResolvedValue(new TxResultEvent(true, 'OK'));

      waitForReceiveTxEventMock.mockImplementation(
        async (queue: driver.EventQueue, serverStation: number) => {
          const data = Buffer.from([
            0x01, // file exists
            0x08 | 0x04 | 0x01, // WR/R
            0x00,
          ]);
          return Promise.resolve({
            controlByte: 0x80,
            port: 0x90,
            commandCode: 0,
            resultCode: 0,
            data,
          });
        },
      );

      const result = await readAccessObjectInfo(254, 'MYFILE', {
        userRoot: 0,
        current: 1,
        library: 2,
      });
      expect(result).toEqual({
        fileExists: true,
        access: 'WR/R',
      });
    });
  });
});
