#! /usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs';
import * as path from 'path';

import { driver, ErrorEvent, RxDataEvent } from '@jprayner/piconet-nodejs';
import { Command, Option } from 'commander';
import { initConnection, loadFileInfo, saveFileInfo } from './common';
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

const commandIAm = async (
  username: string,
  password: string,
  options: object,
) => {
  const { deviceName, serverStation, localStation } = await resolveOptions(
    options,
  );
  await initConnection(deviceName, localStation);

  const result = await iAm(serverStation, username, password);
  await setHandleUserRootDir(result.directoryHandles.userRoot);
  await setHandleCurrentDir(result.directoryHandles.current);
  await setHandleLibDir(result.directoryHandles.library);

  await driver.close();
};

const commandDir = async (dirPath: string, options: object) => {
  const { deviceName, serverStation, localStation } = await resolveOptions(
    options,
  );
  await initConnection(deviceName, localStation);
  const dirInfo = await dir(serverStation, dirPath, await getHandles());
  await setHandleCurrentDir(dirInfo.handleCurrentDir);

  await driver.close();
};

const commandBye = async (options: object) => {
  const { deviceName, serverStation, localStation } = await resolveOptions(
    options,
  );
  await initConnection(deviceName, localStation);
  await bye(serverStation, await getHandles());
  await driver.close();
};

const commandCdir = async (dirPath: string, options: object) => {
  const { deviceName, serverStation, localStation } = await resolveOptions(
    options,
  );
  await initConnection(deviceName, localStation);
  await cdir(serverStation, dirPath, await getHandles());
  await driver.close();
};

const commandDelete = async (pathToDelete: string, options: object) => {
  const { deviceName, serverStation, localStation } = await resolveOptions(
    options,
  );
  await initConnection(deviceName, localStation);
  await deleteFile(serverStation, pathToDelete, await getHandles());
  await driver.close();
};

const commandAccess = async (
  pathToSetAccess: string,
  accessString: string,
  options: object,
) => {
  const { deviceName, serverStation, localStation } = await resolveOptions(
    options,
  );
  await initConnection(deviceName, localStation);
  await access(
    serverStation,
    pathToSetAccess,
    accessString,
    await getHandles(),
  );
  await driver.close();
};

const commandGet = async (filename: string, options: object) => {
  const { deviceName, serverStation, localStation } = await resolveOptions(
    options,
  );
  await initConnection(deviceName, localStation);
  const result = await load(serverStation, filename, await getHandles());
  fs.writeFileSync(result.actualFilename, result.data);
  saveFileInfo(result.actualFilename, {
    originalFilename: result.actualFilename,
    loadAddr: result.loadAddr,
    execAddr: result.execAddr,
  });
  await driver.close();
};

const basicLoadAddr = 0xffff0e00;
const basicExecAddr = 0xffff2b80;
const commandPut = async (filename: string, options: object) => {
  const { deviceName, serverStation, localStation } = await resolveOptions(
    options,
  );
  await initConnection(deviceName, localStation);
  const fileInfo = loadFileInfo(filename);
  const fileData = fs.readFileSync(filename);
  const fileTitle = `${path.basename(filename)}`;
  await save(
    serverStation,
    fileData,
    fileInfo?.originalFilename || fileTitle,
    fileInfo?.loadAddr || basicLoadAddr,
    fileInfo?.execAddr || basicExecAddr,
    await getHandles(),
  );
  await driver.close();
};

const commandLoad = async (filename: string, options: object) => {
  // TODO: do this stuff in wrapper
  const { deviceName, serverStation, localStation } = await resolveOptions(
    options,
  );
  await initConnection(deviceName, localStation);
  const result = await load(serverStation, filename, await getHandles());
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

  // TODO: do this stuff in wrapper
  await driver.close();
};

const commandSave = async (
  localPath: string,
  optionalDestPath: string | undefined,
  options: object,
) => {
  const { deviceName, serverStation, localStation } = await resolveOptions(
    options,
  );
  await initConnection(deviceName, localStation);
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
    serverStation,
    spawnResult.stdout,
    `${destPath}`,
    basicLoadAddr,
    basicExecAddr,
    await getHandles(),
  );

  await driver.close();
};

const commandCat = async (dirPath: string, options: object) => {
  const { deviceName, serverStation, localStation } = await resolveOptions(
    options,
  );
  await initConnection(deviceName, localStation);
  const dirInfo = await readDirAccessObjectInfo(
    serverStation,
    dirPath,
    await getHandles(),
  );
  const files = await examineDir(serverStation, dirPath, await getHandles());

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
  await driver.close();
};

const commandSetStation = async (station: string) => {
  await setLocalStationNum(parseInt(station));
};

const commandSetFileserver = async (station: string) => {
  await setServerStationNum(parseInt(station));
};

const commandNotify = async (
  station: string,
  message: string,
  options: object,
) => {
  const { deviceName, localStation } = await resolveOptions(options);
  await initConnection(deviceName, localStation);
  await notify(parseInt(station), message);
  await driver.close();
};

const commandMonitor = async (options: object) => {
  const { deviceName, localStation } = await resolveOptions(options);
  await initConnection(deviceName, localStation);
  driver.addListener(event => {
    if (event instanceof ErrorEvent) {
      console.error(`ERROR: ${event.description}`);
      return;
    } else if (event instanceof RxDataEvent) {
      console.log(event.toString());
    }
  });

  await driver.setMode('MONITOR');

  process.on('SIGINT', () => {
    driver
      .close()
      .then(() => {
        process.exit();
      })
      .catch((err: Error) => {
        console.error(err.toString());
      });
  });
};

const main = () => {
  const program = new Command();

  program
    .name('ecoclient')
    .description('Econet fileserver client')
    .version(PKG_VERSION);

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
    .action(errorHnd(commandIAm));

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
    .action(errorHnd(commandBye));

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
    .action(errorHnd(commandDir));

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
    .action(errorHnd(commandGet));

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
    .action(errorHnd(commandPut));

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
    .action(errorHnd(commandLoad));

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
    .action(errorHnd(commandSave));

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
    .action(errorHnd(commandCat));

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
    .action(errorHnd(commandCdir));

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
    .action(errorHnd(commandDelete));

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
    .action(errorHnd(commandAccess));

  program
    .command('set-fs')
    .description('set fileserver')
    .argument('<station>', 'station number')
    .action(errorHnd(commandSetFileserver));

  program
    .command('set-station')
    .description('set Econet station')
    .argument('<station>', 'station number')
    .action(errorHnd(commandSetStation));

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
    .action(errorHnd(commandNotify));

  program
    .command('monitor')
    .description('listen for network traffic like a "*NETMON" command')
    .addOption(
      new Option('-dev, --device <string>', 'specify Pico serial device'),
    )
    .action(errorHnd(commandMonitor));

  program.parse(process.argv);
};

const errorHnd =
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
  return { deviceName, serverStation, localStation };
};

main();
