/* eslint-disable @typescript-eslint/no-unused-vars */
import { driver, EconetEvent, RxTransmitEvent, RxImmediateEvent } from '@jprayner/piconet-nodejs';
import { stat } from 'fs';
import { executeCliCommand, fsControlByte, fsPort, initConnection, responseMatcher, waitForAckEvent, waitForDataOrStatus } from './common';

jest.mock('@jprayner/piconet-nodejs');
const driverMock = jest.mocked(driver, true);

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
  return {
    type: 'RxImmediateEvent',
    scoutFrame: Buffer.from(''),
    dataFrame: Buffer.from(''),
  };
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
  return {
    type: 'RxTransmitEvent',
    scoutFrame: Buffer.from([
      props.localStation,
      props.localNet,
      props.fsStation,
      props.fsNet,
      props.controlByte,
      props.replyPort,
    ]),
    dataFrame,
    receiveId: 0,
  };
};

describe('common.initConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully initialise driver', async () => {
    await initConnection('/dev/abc', 2);
    expect(driverMock.connect).toHaveBeenCalledWith('/dev/abc');
    expect(driverMock.setEconetStation).toHaveBeenCalledWith(2);
    expect(driverMock.setMode).toHaveBeenCalledWith('LISTEN');
  });
});

describe('common.waitForDataOrStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should wait for data event', async () => {
    const dataPort = 90;
    const statusPort = 91;
    driverMock.waitForEvent.mockImplementation(
      async (callback: (event: EconetEvent) => boolean, timeoutMs: number) => {
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

    const result = await waitForDataOrStatus(254, fsControlByte, dataPort, statusPort);
    expect(result.type).toEqual('data');
  });

  it('should reject truncated data event', async () => {
    const dataPort = 90;
    const statusPort = 91;
    driverMock.waitForEvent.mockImplementation(
      async (callback: (event: EconetEvent) => boolean, timeoutMs: number) => {
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

    await expect(waitForDataOrStatus(254, fsControlByte, dataPort, statusPort)).rejects.toThrowError('Malformed response from station 254');
  });

  it('should reject truncated status event', async () => {
    const dataPort = 90;
    const statusPort = 91;
    driverMock.waitForEvent.mockImplementation(
      async (callback: (event: EconetEvent) => boolean, timeoutMs: number) => {
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

    await expect(waitForDataOrStatus(254, fsControlByte, dataPort, statusPort)).rejects.toThrowError('Malformed response from station 254');
  });

  it('should wait for status event', async () => {
    const dataPort = 90;
    const statusPort = 91;
    driverMock.waitForEvent.mockImplementation(
      async (callback: (event: EconetEvent) => boolean, timeoutMs: number) => {
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

    const result = await waitForDataOrStatus(254, fsControlByte, dataPort, statusPort);
    expect(result.type).toEqual('status');
  });

  it('should reject unexpected event type', async () => {
    const dataPort = 90;
    const statusPort = 91;
    driverMock.waitForEvent.mockImplementation(
      async (callback: (event: EconetEvent) => boolean, timeoutMs: number) => {
        return Promise.resolve(dummyReplyRxImmediateEvent());
      },
    );

    await expect(waitForDataOrStatus(254, fsControlByte, dataPort, statusPort)).rejects.toThrowError('Unexpected response from station 254');
  });
});

describe('common.executeCliCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute a command successfully', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    driverMock.waitForEvent.mockImplementation(
      async (callback: (event: EconetEvent) => boolean, timeoutMs: number) => {
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
    const resultPromise = executeCliCommand(254, 'BYE');
    const result = await resultPromise;

    expect(driverMock.transmit).toHaveBeenCalled();
    expect(driverMock.waitForEvent).toHaveBeenCalled();
    expect(result.resultCode).toBe(0);
  });

  it('should throw error when no response received from server', async () => {
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
          result: 'invalid station number',
        });
      },
    );
    await expect(executeCliCommand(254, 'BYE')).rejects.toThrowError(
      'Failed to send command to station 254: invalid station number',
    );
    expect(driverMock.transmit).toHaveBeenCalled();
    expect(driverMock.waitForEvent).not.toHaveBeenCalled();
  });

  it('should feed back error message when server rejects command', async () => {
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
    driverMock.waitForEvent.mockImplementation(
      async (callback: (event: EconetEvent) => boolean, timeoutMs: number) => {
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
    await expect(executeCliCommand(254, 'BYE')).rejects.toThrowError(
      'Bad things are occuring',
    );
    expect(driverMock.transmit).toHaveBeenCalled();
    expect(driverMock.waitForEvent).toHaveBeenCalled();
  });
});

describe('common.responseMatcher', () => {
  it('should successfully match an appropriate response from Piconet', async () => {
    const matcher = responseMatcher(254, 0, fsControlByte, [fsPort]);
    const result = matcher({
      type: 'RxTransmitEvent',
      scoutFrame: Buffer.from([1, 0, 254, 0, fsControlByte, fsPort]),
      dataFrame: Buffer.from([]),
      receiveId: 0,
    });
    expect(result).toBe(true);
  });

  it('should not match a undesired response from Piconet', async () => {
    const matcher = responseMatcher(253, 0, fsControlByte, [fsPort]);
    const result = matcher({
      type: 'RxTransmitEvent',
      scoutFrame: Buffer.from([1, 0, 254, 0, fsControlByte, fsPort]),
      dataFrame: Buffer.from([]),
      receiveId: 0,
    });
    expect(result).toBe(false);
  });
});

describe('common.waitForAckEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should direct driver to accept valid ack events', async () => {
    await waitForAckEvent(254, 90);
    const matcher = driverMock.waitForEvent.mock.calls[0][0];
    const ackEvent = {
      type: 'RxTransmitEvent',
      scoutFrame: Buffer.from([1, 0, 254, 0, 0, 0, 90]),
      dataFrame: Buffer.from([]),
      receiveId: 0,
    } as EconetEvent;
    expect(matcher(ackEvent)).toBe(true);
  });

  it('should direct driver to reject non-ack events', async () => {
    await waitForAckEvent(254, 90);
    const matcher = driverMock.waitForEvent.mock.calls[0][0];
    const ackEvent = {
      type: 'RxImmediateEvent',
      scoutFrame: Buffer.from([1, 0, 254, 0, 0, 0, 90]),
      dataFrame: Buffer.from([]),
      receiveId: 0,
    } as EconetEvent;
    expect(matcher(ackEvent)).toBe(false);
  });
});
