import { driver, EconetEvent, RxDataEvent } from '@jprayner/piconet-nodejs';
import { sleepMs } from '../common';

export const commandMonitor = async () => {
  const queue = driver.eventQueueCreate(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (event: EconetEvent) => true,
  );

  await driver.setMode('MONITOR');

  let complete = false;

  process.on('SIGINT', () => {
    complete = true;
  });

  while (!complete) {
    const event = driver.eventQueueShift(queue);

    if (typeof event === 'undefined') {
      await sleepMs(10);
      continue;
    }

    if (event instanceof RxDataEvent) {
      console.log(event.toString());
    }
  }
};
