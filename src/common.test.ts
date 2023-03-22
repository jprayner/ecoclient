/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  driver,
  EconetEvent,
  RxImmediateEvent,
  TxResultEvent,
  RxTransmitEvent,
} from '@jprayner/piconet-nodejs';
import {
  executeCliCommand,
  fsControlByte,
  fsPort,
  initConnection,
  responseMatcher,
  waitForAckEvent,
  waitForDataOrStatus,
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

    await initConnection('/dev/abc', 2);
    expect(connectSpy).toHaveBeenCalledWith('/dev/abc');
    expect(setEconetStationSpy).toHaveBeenCalledWith(2);
    expect(setModeSpy).toHaveBeenCalledWith('LISTEN');
  });
});

describe('common.waitForDataOrStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should wait for data event', async () => {
    const dataPort = 90;
    const statusPort = 91;
    jest
      .spyOn(driver, 'waitForEvent')
      .mockImplementation(
        async (
          callback: (event: EconetEvent) => boolean,
          timeoutMs: number,
        ) => {
          return Promise.resolve(
            dummyReplyRxTransmitEvent({
              fsStation: 254,
              fsNet: 0,
              localStation: 1,
              localNet: 0,
              controlByte: fsControlByte,
              replyPort: dataPort,
              commandCode: 0,
              resultCode: 0,
              data: Buffer.from([]),
            }),
          );
        },
      );

    const result = await waitForDataOrStatus(
      254,
      fsControlByte,
      dataPort,
      statusPort,
    );
    expect(result.type).toEqual('data');
  });

  it('should reject truncated data event', async () => {
    const dataPort = 90;
    const statusPort = 91;
    jest
      .spyOn(driver, 'waitForEvent')
      .mockImplementation(
        async (
          callback: (event: EconetEvent) => boolean,
          timeoutMs: number,
        ) => {
          const replyEvent = dummyReplyRxTransmitEvent({
            fsStation: 254,
            fsNet: 0,
            localStation: 1,
            localNet: 0,
            controlByte: fsControlByte,
            replyPort: dataPort,
            commandCode: 0,
            resultCode: 0,
            data: Buffer.from([]),
          });
          replyEvent.dataFrame = replyEvent.dataFrame.slice(0, 1);
          return Promise.resolve(replyEvent);
        },
      );

    await expect(
      waitForDataOrStatus(254, fsControlByte, dataPort, statusPort),
    ).rejects.toThrowError('Malformed response from station 254');
  });

  it('should reject truncated status event', async () => {
    const dataPort = 90;
    const statusPort = 91;
    jest
      .spyOn(driver, 'waitForEvent')
      .mockImplementation(
        async (
          callback: (event: EconetEvent) => boolean,
          timeoutMs: number,
        ) => {
          const replyEvent = dummyReplyRxTransmitEvent({
            fsStation: 254,
            fsNet: 0,
            localStation: 1,
            localNet: 0,
            controlByte: fsControlByte,
            replyPort: statusPort,
            commandCode: 0,
            resultCode: 0,
            data: Buffer.from([]),
          });
          replyEvent.dataFrame = replyEvent.dataFrame.slice(0, 1);
          return Promise.resolve(replyEvent);
        },
      );

    await expect(
      waitForDataOrStatus(254, fsControlByte, dataPort, statusPort),
    ).rejects.toThrowError('Malformed response from station 254');
  });

  it('should wait for status event', async () => {
    const dataPort = 90;
    const statusPort = 91;
    jest
      .spyOn(driver, 'waitForEvent')
      .mockImplementation(
        async (
          callback: (event: EconetEvent) => boolean,
          timeoutMs: number,
        ) => {
          return Promise.resolve(
            dummyReplyRxTransmitEvent({
              fsStation: 254,
              fsNet: 0,
              localStation: 1,
              localNet: 0,
              controlByte: fsControlByte,
              replyPort: statusPort,
              commandCode: 0,
              resultCode: 0,
              data: Buffer.from([]),
            }),
          );
        },
      );

    const result = await waitForDataOrStatus(
      254,
      fsControlByte,
      dataPort,
      statusPort,
    );
    expect(result.type).toEqual('status');
  });

  it('should reject unexpected event type', async () => {
    const dataPort = 90;
    const statusPort = 91;
    jest
      .spyOn(driver, 'waitForEvent')
      .mockImplementation(
        async (
          callback: (event: EconetEvent) => boolean,
          timeoutMs: number,
        ) => {
          return Promise.resolve(dummyReplyRxImmediateEvent());
        },
      );

    await expect(
      waitForDataOrStatus(254, fsControlByte, dataPort, statusPort),
    ).rejects.toThrowError('Unexpected response from station 254');
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
      .spyOn(driver, 'waitForEvent')
      .mockImplementation(
        async (
          callback: (event: EconetEvent) => boolean,
          timeoutMs: number,
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
      .spyOn(driver, 'waitForEvent')
      .mockImplementation(
        async (
          callback: (event: EconetEvent) => boolean,
          timeoutMs: number,
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

describe('common.waitForAckEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should direct driver to accept valid ack events', async () => {
    const ackEvent = new RxTransmitEvent(
      Buffer.from([1, 0, 254, 0, 0, 0, 90]),
      Buffer.from([]),
    );
    const waitForEventSpy = jest
      .spyOn(driver, 'waitForEvent')
      .mockImplementation(
        async (
          callback: (event: EconetEvent) => boolean,
          timeoutMs: number,
        ) => {
          return Promise.resolve(ackEvent);
        },
      );
    await waitForAckEvent(254, 90);
    const matcher = waitForEventSpy.mock.calls[0][0];
    expect(matcher(ackEvent)).toBe(true);
  });

  it('should direct driver to reject non-ack events', async () => {
    const nonAckEvent = new RxImmediateEvent(
      Buffer.from([1, 0, 254, 0, 0, 0, 90]),
      Buffer.from([]),
    );
    const waitForEventSpy = jest
      .spyOn(driver, 'waitForEvent')
      .mockImplementation(
        async (
          callback: (event: EconetEvent) => boolean,
          timeoutMs: number,
        ) => {
          return Promise.resolve(nonAckEvent);
        },
      );
    await waitForAckEvent(254, 90);
    const matcher = waitForEventSpy.mock.calls[0][0];
    expect(matcher(nonAckEvent)).toBe(false);
  });
});
