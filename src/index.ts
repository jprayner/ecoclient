#! /usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs';
import * as path from 'path';

import {
  driver,
  EconetEvent,
  ErrorEvent,
  RxDataEvent,
} from '@jprayner/piconet-nodejs';
import { Command, CommandOptions, Option } from 'commander';
import { initConnection, loadFileInfo, saveFileInfo, sleepMs } from './common';
import { load } from './protocol/load';
import { save } from './protocol/save';
import { readDirAccessObjectInfo } from './protocol/objectInfo';
import { iAm } from './protocol/iAm';
import { examineDir } from './protocol/examine';
import { access, bye, cdir, deleteFile } from './protocol/simpleCli';
import { notify } from './protocol/notify';
import { PKG_VERSION } from './version';
import {
  getLocalStationNum,
  getServerStationNum,
  setHandleCurrentDir,
  setHandleLibDir,
  setHandleUserRootDir,
  setLocalStationNum,
  setServerStationNum,
  getHandles,
} from './config';
import { spawnSync } from 'child_process';
import { dir } from './protocol/dir';
import { basename } from 'path';

const basicLoadAddr = 0xffff0e00;
const basicExecAddr = 0xffff2b80;

/**
 * Options which may come from config or be overridden at the command line.
 */
type ConfigOptions = {
  deviceName: string;
  localStation: number;
  serverStation: number;
};

const commandSetStation = async (station: string) => {
  await setLocalStationNum(parseInt(station));
};

const commandSetFileserver = async (station: string) => {
  await setServerStationNum(parseInt(station));
};

const commandNotify = async (
  options: CommandOptions,
  station: string,
  message: string,
) => {
  await notify(parseInt(station), message);
};

const commandMonitor = async () => {
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

    if (event instanceof ErrorEvent) {
      console.error(`ERROR: ${event.description}`);
      return;
    }
    
    if (event instanceof RxDataEvent) {
      console.log(event.toString());
    }  
  }
};

const commandIAm = async (
  options: ConfigOptions,
  username: string,
  password: string,
) => {
  const result = await iAm(options.serverStation, username, password);
  await setHandleUserRootDir(result.directoryHandles.userRoot);
  await setHandleCurrentDir(result.directoryHandles.current);
  await setHandleLibDir(result.directoryHandles.library);
};

const commandDir = async (options: ConfigOptions, dirPath: string) => {
  const dirInfo = await dir(options.serverStation, dirPath, await getHandles());
  await setHandleCurrentDir(dirInfo.handleCurrentDir);
};

const commandBye = async (options: ConfigOptions) => {
  await bye(options.serverStation, await getHandles());
};

const commandCdir = async (options: ConfigOptions, dirPath: string) => {
  await cdir(options.serverStation, dirPath, await getHandles());
};

const commandDelete = async (options: ConfigOptions, pathToDelete: string) => {
  await deleteFile(options.serverStation, pathToDelete, await getHandles());
};

const commandAccess = async (
  options: ConfigOptions,
  pathToSetAccess: string,
  accessString: string,
) => {
  await access(
    options.serverStation,
    pathToSetAccess,
    accessString,
    await getHandles(),
  );
};

const commandGet = async (options: ConfigOptions, filename: string) => {
  const result = await load(
    options.serverStation,
    filename,
    await getHandles(),
  );
  fs.writeFileSync(result.actualFilename, result.data);
  saveFileInfo(result.actualFilename, {
    originalFilename: result.actualFilename,
    loadAddr: result.loadAddr,
    execAddr: result.execAddr,
  });
};

const commandPut = async (options: ConfigOptions, filename: string) => {
  const fileInfo = loadFileInfo(filename);
  const fileData = fs.readFileSync(filename);
  const fileTitle = `${path.basename(filename)}`;
  await save(
    options.serverStation,
    fileData,
    fileInfo?.originalFilename || fileTitle,
    fileInfo?.loadAddr || basicLoadAddr,
    fileInfo?.execAddr || basicExecAddr,
    await getHandles(),
  );
};

const commandLoad = async (options: ConfigOptions, filename: string) => {
  const result = await load(
    options.serverStation,
    filename,
    await getHandles(),
  );
  const tempFile = `${result.actualFilename}.tmp`;
  fs.writeFileSync(tempFile, result.data);

  try {
    const spawnResult = spawnSync('basictool', [tempFile]);
    if (spawnResult.error) {
      throw spawnResult.error;
    }
    fs.writeFileSync(`${result.actualFilename}.bas`, spawnResult.stdout);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    console.error(
      'Failed to launch basictool utility which is required to convert tokenised BASIC' +
        `file to/from text format. Is it installed and in your PATH? Error is: "${msg}"`,
    );
  }

  fs.rmSync(tempFile, { force: true });
};

const commandSave = async (
  options: ConfigOptions,
  localPath: string,
  optionalDestPath: string | undefined,
) => {
  const localFilenameNoBasSuffix = basename(localPath).replace(/\.bas$/, '');
  const destPath = optionalDestPath || localFilenameNoBasSuffix;

  let spawnResult;
  try {
    spawnResult = spawnSync('basictool', ['-t', `${localPath}`]);
    if (spawnResult.error) {
      throw spawnResult.error;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    console.error(
      'Failed to launch basictool utility which is required to convert tokenised BASIC' +
        `file to/from text. Is it installed and in your PATH? Error is: "${msg}"`,
    );
    await driver.close();
    return;
  }

  await save(
    options.serverStation,
    spawnResult.stdout,
    `${destPath}`,
    basicLoadAddr,
    basicExecAddr,
    await getHandles(),
  );
};

const commandCat = async (options: ConfigOptions, dirPath: string) => {
  const dirInfo = await readDirAccessObjectInfo(
    options.serverStation,
    dirPath,
    await getHandles(),
  );
  const files = await examineDir(
    options.serverStation,
    dirPath,
    await getHandles(),
  );

  console.log(
    `[${dirInfo.dirName} (${dirInfo.cycleNum}) - ${
      dirInfo.isOwner ? 'Owner' : 'Public'
    }]`,
  );
  for (const f of files) {
    console.log(
      `${f.name.padEnd(10)} ${f.loadAddress.padEnd(8)} ${f.execAddress.padEnd(
        8,
      )}  ${f.sizeBytes.toString(10).padStart(8)} ${f.access.padEnd(10)} ${
        f.date
      } ${f.id}`,
    );
  }
};

const main = () => {
  const program = new Command();

  program
    .name('ecoclient')
    .description('Econet fileserver client')
    .version(PKG_VERSION);

  program
    .command('set-fs')
    .description('set fileserver')
    .argument('<station>', 'station number')
    .action(errorHandlingDecorator(commandSetFileserver));

  program
    .command('set-station')
    .description('set Econet station')
    .argument('<station>', 'station number')
    .action(errorHandlingDecorator(commandSetStation));

  program
    .command('notify')
    .description(
      'send notification message to a station like a "*NOTIFY" command',
    )
    .argument('<station>', 'station number')
    .argument('<message>', 'message')
    .addOption(
      new Option('-dev, --device <string>', 'specify Pico serial device'),
    )
    .action(connectionDecorator(commandNotify));

  program
    .command('monitor')
    .description('listen for network traffic like a "*NETMON" command')
    .addOption(
      new Option('-dev, --device <string>', 'specify Pico serial device'),
    )
    .action(connectionDecorator(commandMonitor));

  program
    .command('i-am')
    .description('login to fileserver like a "*I AM" command')
    .argument('<username>', 'username')
    .argument('[password]', 'password')
    .addOption(
      new Option('-dev, --device <string>', 'specify Pico serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local Econet station number',
      ),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      ).default(254),
    )
    .action(connectionDecorator(commandIAm));

  program
    .command('bye')
    .description('logout of fileserver like a "*BYE" command')
    .addOption(
      new Option('-dev, --device <string>', 'specify Pico serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local Econet station number',
      ),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      ).default(254),
    )
    .action(connectionDecorator(commandBye));

  program
    .command('dir')
    .description('change current directory')
    .argument('[dir]', 'directory path', '')
    .addOption(
      new Option('-dev, --device <string>', 'specify Pico serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local Econet station number',
      ),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      ).default(254),
    )
    .action(connectionDecorator(commandDir));

  program
    .command('get')
    .description('get file from fileserver using "LOAD" command')
    .argument('<filename>', 'filename')
    .addOption(
      new Option('-dev, --device <string>', 'specify Pico serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local Econet station number',
      ),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      ).default(254),
    )
    .action(connectionDecorator(commandGet));

  program
    .command('put')
    .description('get file from fileserver using "SAVE" command')
    .argument('<filename>', 'filename')
    .addOption(
      new Option('-dev, --device <string>', 'specify Pico serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local Econet station number',
      ),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      ).default(254),
    )
    .action(connectionDecorator(commandPut));

  program
    .command('load')
    .description('load basic file and detokenise (needs basictool installed)')
    .argument('<filename>', 'filename')
    .addOption(
      new Option('-dev, --device <string>', 'specify Pico serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local Econet station number',
      ),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      ).default(254),
    )
    .action(connectionDecorator(commandLoad));

  program
    .command('save')
    .description(
      'save basic file after detokenising (needs basictool installed)',
    )
    .argument('<localPath>', 'path to file on local filesystem')
    .argument(
      '[destPath]',
      'path to file on fileserver (defaults to filename part of localPath)',
    )
    .addOption(
      new Option('-dev, --device <string>', 'specify Pico serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local Econet station number',
      ),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      ).default(254),
    )
    .action(connectionDecorator(commandSave));

  program
    .command('cat')
    .description('get catalogue of directory from fileserver')
    .argument('[dirPath]', 'directory path', '')
    .addOption(
      new Option('-dev, --device <string>', 'specify Pico serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local Econet station number',
      ),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      ).default(1),
    )
    .action(connectionDecorator(commandCat));

  program
    .command('cdir')
    .description('create directory on fileserver')
    .argument('<dirPath>', 'directory path')
    .addOption(
      new Option('-dev, --device <string>', 'specify Pico serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local Econet station number',
      ),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      ).default(254),
    )
    .action(connectionDecorator(commandCdir));

  program
    .command('delete')
    .description('delete file on fileserver')
    .argument('<path>', 'file path')
    .addOption(
      new Option('-dev, --device <string>', 'specify Pico serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local Econet station number',
      ),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      ).default(254),
    )
    .action(connectionDecorator(commandDelete));

  program
    .command('access')
    .description('set access on fileserver')
    .argument('<path>', 'file path')
    .argument('<accessString>', 'access string')
    .addOption(
      new Option('-dev, --device <string>', 'specify Pico serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local Econet station number',
      ),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      ).default(254),
    )
    .action(connectionDecorator(commandAccess));

  program.parse(process.argv);
};

/**
 * Wraps a command function so that a connection with the fileserver is established
 * before it is invoked and then closed afterwards. It further decorates the function
 * with some error handling using {@link errorHandlingDecorator}.
 *
 * Note that this decorator is not necessary for commands that do not require a connection
 * e.g. for setting configuration options.
 *
 * @param fn The function to wrap.
 * @returns The decorated function.
 */
const connectionDecorator =
  (fn: (...args: any[]) => Promise<void>) =>
  async (...args: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const options: object = args[args.length - 1];
    const configOptions = await resolveOptions(options);
    await initConnection(configOptions.deviceName, configOptions.localStation);

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await errorHandlingDecorator(fn)(configOptions, ...args);
    } finally {
      await driver.close();
    }
  };

/**
 * Wraps a command function so that any errors are caught and logged to the console nicely.
 *
 * @param fn The function to wrap.
 * @returns The decorated function.
 */
const errorHandlingDecorator =
  (fn: (...args: any[]) => Promise<void>) =>
  async (...args: any[]) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await fn(...args);
    } catch (e: unknown) {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  };

const stringOption = (options: object, key: string): string | undefined => {
  for (const [k, v] of Object.entries(options)) {
    if (k === key && typeof v === 'string') {
      return v;
    }
  }

  return undefined;
};

const intOption = (
  options: object,
  key: string,
  defaultValue: number | undefined,
): number | undefined => {
  for (const [k, v] of Object.entries(options)) {
    if (k === key && typeof v === 'string') {
      return parseInt(v, 10);
    }
  }

  return defaultValue;
};

const resolveOptions = async (options: object) => {
  const deviceName = stringOption(options, 'deviceName');
  const serverStation = intOption(
    options,
    'fileserver',
    await getServerStationNum(),
  );
  const localStation = intOption(
    options,
    'station',
    await getLocalStationNum(),
  );
  if (typeof localStation === 'undefined') {
    throw new Error(
      'You must specify an econet station number for this machine using the --station option (or store a default value using the set-station command)',
    );
  }
  if (typeof serverStation === 'undefined') {
    throw new Error('You must specify a fileserver number');
  }
  return { deviceName, serverStation, localStation } as ConfigOptions;
};

main();
