/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  driver,
  EconetEvent,
  RxImmediateEvent,
  TxResultEvent,
  RxTransmitEvent,
} from '@jprayner/piconet-nodejs';
import { readFileSync, rmSync, writeFileSync } from 'fs';
import {
  executeCliCommand,
  fileInfoFromFilename,
  fsControlByte,
  fsPort,
  initConnection,
  isLoadExecFilename,
  isValidFilename,
  loadFileInfo,
  responseMatcher,
  saveFileInfo,
} from './common';

interface RxTransmitProps {
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

const dummyReplyRxImmediateEvent = (): RxImmediateEvent => {
  return new RxImmediateEvent(Buffer.from(''), Buffer.from(''));
};

const dummyReplyRxTransmitEvent = (props: RxTransmitProps): RxTransmitEvent => {
  const header = Buffer.from([
    props.localStation,
    props.localNet,
    props.fsStation,
    props.fsNet,
    props.commandCode,
    props.resultCode,
  ]);
  const dataFrame = Buffer.concat([header, props.data]);
  const result = new RxTransmitEvent(
    Buffer.from([
      props.localStation,
      props.localNet,
      props.fsStation,
      props.fsNet,
      props.controlByte,
      props.replyPort,
    ]),
    dataFrame,
  );
  return result;
};

describe('common.initConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully initialise driver', async () => {
    const connectSpy = jest
      .spyOn(driver, 'connect')
      .mockImplementation(async (port: string | undefined) =>
        Promise.resolve(),
      );
    const setEconetStationSpy = jest
      .spyOn(driver, 'setEconetStation')
      .mockImplementation(async (station: number) => Promise.resolve());
    const setModeSpy = jest
      .spyOn(driver, 'setMode')
      .mockImplementation(async (mode: string) => Promise.resolve());

    await initConnection('/dev/abc', 2, false);
    expect(connectSpy).toHaveBeenCalledWith('/dev/abc');
    expect(setEconetStationSpy).toHaveBeenCalledWith(2);
    expect(setModeSpy).toHaveBeenCalledWith('LISTEN');
  });
});

describe('common.executeCliCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute a command successfully', async () => {
    const transmitSpy = jest
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
    const waitForEventSpy = jest
      .spyOn(driver, 'eventQueueWait')
      .mockImplementation(
        async (
          queue: driver.EventQueue,
          timeoutMs: number,
          description?: string,
        ) => {
          return Promise.resolve(
            dummyReplyRxTransmitEvent({
              fsStation: 254,
              fsNet: 0,
              localStation: 1,
              localNet: 0,
              controlByte: fsControlByte,
              replyPort: fsPort,
              commandCode: 0,
              resultCode: 0,
              data: Buffer.from([]),
            }),
          );
        },
      );
    const resultPromise = executeCliCommand(254, 'BYE', {
      userRoot: 0,
      current: 1,
      library: 2,
    });
    const result = await resultPromise;

    expect(transmitSpy).toHaveBeenCalled();
    expect(waitForEventSpy).toHaveBeenCalled();
    expect(result.resultCode).toBe(0);
  });

  it('should throw error when no response received from server', async () => {
    const transmitSpy = jest
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
            new TxResultEvent(false, 'invalid station number'),
          );
        },
      );
    const waitForEventSpy = jest.spyOn(driver, 'waitForEvent');
    await expect(
      executeCliCommand(254, 'BYE', { userRoot: 0, current: 1, library: 2 }),
    ).rejects.toThrowError(
      'Failed to send command to station 254: invalid station number',
    );
    expect(transmitSpy).toHaveBeenCalled();
    expect(waitForEventSpy).not.toHaveBeenCalled();
  });

  it('should feed back error message when server rejects command', async () => {
    const transmitSpy = jest
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
    const waitForEventSpy = jest
      .spyOn(driver, 'eventQueueWait')
      .mockImplementation(
        async (
          queue: driver.EventQueue,
          timeoutMs: number,
          description?: string,
        ) => {
          return Promise.resolve(
            dummyReplyRxTransmitEvent({
              fsStation: 254,
              fsNet: 0,
              localStation: 1,
              localNet: 0,
              controlByte: fsControlByte,
              replyPort: fsPort,
              commandCode: 0,
              resultCode: 1,
              data: Buffer.from('Bad things are occuring'),
            }),
          );
        },
      );
    await expect(
      executeCliCommand(254, 'BYE', { userRoot: 0, current: 1, library: 2 }),
    ).rejects.toThrowError('Bad things are occuring');
    expect(transmitSpy).toHaveBeenCalled();
    expect(waitForEventSpy).toHaveBeenCalled();
  });
});

describe('common.responseMatcher', () => {
  it('should successfully match an appropriate response from Piconet', () => {
    const matcher = responseMatcher(254, 0, fsControlByte, [fsPort]);
    const result = matcher(
      new RxTransmitEvent(
        Buffer.from([1, 0, 254, 0, fsControlByte, fsPort]),
        Buffer.from([]),
      ),
    );
    expect(result).toBe(true);
  });

  it('should not match a undesired response from Piconet', () => {
    const matcher = responseMatcher(253, 0, fsControlByte, [fsPort]);
    const result = matcher(
      new RxTransmitEvent(
        Buffer.from([1, 0, 254, 0, fsControlByte, fsPort]),
        Buffer.from([]),
      ),
    );
    expect(result).toBe(false);
  });
});

describe('common.saveFileInfo', () => {
  const tempFilename = 'tempFile';

  afterEach(() => {
    rmSync(`${tempFilename}.inf`, { force: true });
  });

  it('should save file info correctly', () => {
    const fileInfo = {
      originalFilename: 'testFile',
      loadAddr: 0xffff1234,
      execAddr: 0xffffabcd,
    };

    saveFileInfo(tempFilename, fileInfo);
    const fileInfoLines = readFileSync(`${tempFilename}.inf`)
      .toString('utf-8')
      .split('\n');
    expect(fileInfoLines.length).toBe(2);
    expect(fileInfoLines[0]).toBe('testFile   FFFF1234 FFFFABCD');
    expect(fileInfoLines[1]).toBe('');
  });
});

describe('common.isValidFilename', () => {
  it('should accept valid filenames', () => {
    expect(isValidFilename('1')).toBe(true);
    expect(isValidFilename('HELLO')).toBe(true);
    expect(isValidFilename('hello')).toBe(true);
    expect(isValidFilename('!BOOT')).toBe(true);
    expect(isValidFilename('MY_FILE')).toBe(true);
    expect(isValidFilename('MY-FILE')).toBe(true);
  });

  it('should reject invalid filenames', () => {
    expect(isValidFilename('')).toBe(false);
    expect(isValidFilename('12345678901')).toBe(false);
    expect(isValidFilename('X&Y')).toBe(false);
    expect(isValidFilename('"FILE')).toBe(false);
  });
});

describe('common.isLoadExecFilename', () => {
  it('should match appropriate filenames', () => {
    expect(isLoadExecFilename('SJMON,FFFF1B00,FFFF1B00')).toBe(true);
    expect(isLoadExecFilename('1,FFFF1B00,FFFF1B00')).toBe(true);
    expect(isLoadExecFilename('a,FFFF1B00,FFFF1B00')).toBe(true);
    expect(isLoadExecFilename('A,FFFF1B00,FFFF1B00')).toBe(true);
    expect(isLoadExecFilename('A_FILE,FFFF1B00,FFFF1B00')).toBe(true);
    expect(isLoadExecFilename('A-FILE,FFFF1B00,FFFF1B00')).toBe(true);
    expect(isLoadExecFilename('SJMON,FFFF1B00,FFFF1B00')).toBe(true);
    expect(isLoadExecFilename('sjmon,FFFF1B00,FFFF1B00')).toBe(true);
    expect(isLoadExecFilename('sjmon,ffff1B00,FFFF1B00')).toBe(true);
    expect(isLoadExecFilename('sjmon,00000000,FFFF1B00')).toBe(true);
  });

  it('should not match appropriate filenames', () => {
    expect(isLoadExecFilename('SJMON')).toBe(false);
    expect(isLoadExecFilename('sjmon,GGGGGGGG,FFFF1B00')).toBe(false);
    expect(isLoadExecFilename('sjmon,ffff1B00,FFFF1B00XXXX')).toBe(false);
    expect(isLoadExecFilename('sjmon$00000000$FFFF1B00')).toBe(false);
  });
});

describe('common.fileInfoFromFilename', () => {
  it('should extract name and load/exec addresses correctly', () => {
    expect(fileInfoFromFilename('SJMON,00000001,00000002')).toEqual({
      originalFilename: 'SJMON',
      loadAddr: 0x00000001,
      execAddr: 0x00000002,
    });
    expect(fileInfoFromFilename('SJMON,FFFFFFFE,FFFFFFFF')).toEqual({
      originalFilename: 'SJMON',
      loadAddr: 0xfffffffe,
      execAddr: 0xffffffff,
    });
    expect(fileInfoFromFilename('SOME-FILE,FFFFFFFE,FFFFFFFF')).toEqual({
      originalFilename: 'SOME-FILE',
      loadAddr: 0xfffffffe,
      execAddr: 0xffffffff,
    });
    expect(fileInfoFromFilename('SOME_FILE,FFFFFFFE,FFFFFFFF')).toEqual({
      originalFilename: 'SOME_FILE',
      loadAddr: 0xfffffffe,
      execAddr: 0xffffffff,
    });
  });
});

describe('common.loadFileInfo', () => {
  const tempFilename = 'tempFile';

  afterEach(() => {
    rmSync(`${tempFilename}.inf`, { force: true });
  });

  it('should load valid file info correctly', () => {
    const infoBuffer = Buffer.from('testFile   FFFF1234 FFFFABCD');
    writeFileSync(`${tempFilename}.inf`, infoBuffer);

    const result = loadFileInfo(tempFilename);
    expect(result).toBeDefined();
    expect(result?.originalFilename).toBe('testFile');
    expect(result?.loadAddr).toBe(0xffff1234);
    expect(result?.execAddr).toBe(0xffffabcd);
  });

  it('should accept info file with 6-digit hex chars in load and execution addresses', () => {
    const infoBuffer = Buffer.from('testFile   123456 654321');
    writeFileSync(`${tempFilename}.inf`, infoBuffer);

    const result = loadFileInfo(tempFilename);
    expect(result).toBeDefined();
    expect(result?.originalFilename).toBe('testFile');
    expect(result?.loadAddr).toBe(0x123456);
    expect(result?.execAddr).toBe(0x654321);
  });

  it('should accept info file with 6-digit hex chars in load and execution addresses, extending MSB when 0xff', () => {
    const infoBuffer = Buffer.from('testFile   FFFF12 FF0000');
    writeFileSync(`${tempFilename}.inf`, infoBuffer);

    const result = loadFileInfo(tempFilename);
    expect(result).toBeDefined();
    expect(result?.originalFilename).toBe('testFile');
    expect(result?.loadAddr).toBe(0xffffff12);
    expect(result?.execAddr).toBe(0xffff0000);
  });

  it('should reject empty info file', () => {
    const infoBuffer = Buffer.from('');
    expect(writeFileSync(`${tempFilename}.inf`, infoBuffer)).toBeUndefined();
  });

  it('should reject info file with insufficient entries', () => {
    const infoBuffer = Buffer.from('testFile   FFFF1234');
    expect(writeFileSync(`${tempFilename}.inf`, infoBuffer)).toBeUndefined();
  });

  it('should reject info file with non-hex chars in load addr', () => {
    const infoBuffer = Buffer.from('testFile   HELLOMUM FFFFABCD');
    expect(writeFileSync(`${tempFilename}.inf`, infoBuffer)).toBeUndefined();
  });

  it('should reject info file with wrong number of hex chars in exec addr', () => {
    const infoBuffer = Buffer.from('testFile   FFFF1234 FFFFABC');
    expect(writeFileSync(`${tempFilename}.inf`, infoBuffer)).toBeUndefined();
  });

  it('should reject info file with non-hex chars in exec addr', () => {
    const infoBuffer = Buffer.from('testFile   FFFF1234 HELLOMUM');
    expect(writeFileSync(`${tempFilename}.inf`, infoBuffer)).toBeUndefined();
  });
});
