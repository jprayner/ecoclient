import * as fs from 'fs';
import * as path from 'path';

import { driver } from '@jprayner/piconet-nodejs';
import { Command, Option } from 'commander';
import { initConnection } from './common';
import { load } from './protocol/load';
import { save } from './protocol/save';
import { readDirAccessObjectInfo } from './protocol/objectInfo';
import { iAm } from './protocol/iAm';
import { examineDir } from './protocol/examine';
import { access, bye, cdir, deleteFile } from './protocol/simpleCli';
import { PKG_VERSION } from './version';

const stringOption = (options: object, key: string): string | undefined => {
  for (const [k, v] of Object.entries(options)) {
    if (k === key && typeof v === 'string') {
      return v;
    }
  }

  return undefined;
};

const intOption = (options: object, key: string): number | undefined => {
  for (const [k, v] of Object.entries(options)) {
    if (k === key && typeof v === 'string') {
      return parseInt(v, 10);
    }
  }

  return undefined;
};

const resolveOptions = (options: object) => {
  const deviceName = stringOption(options, 'deviceName');
  const serverStation = intOption(options, 'fileserver');
  const localStation = intOption(options, 'station');
  if (typeof localStation === 'undefined') {
    throw new Error(
      'You must specify an econet station number for this machine',
    );
  }
  if (typeof serverStation === 'undefined') {
    throw new Error('You must specify a fileserver number');
  }
  return { deviceName, serverStation, localStation };
};

const commandIAm = async (
  username: string,
  password: string,
  options: object,
) => {
  const { deviceName, serverStation, localStation } = resolveOptions(options);
  await initConnection(deviceName, localStation);
  await iAm(serverStation, username, password);
  await driver.close();
};

const commandBye = async (options: object) => {
  const { deviceName, serverStation, localStation } = resolveOptions(options);
  await initConnection(deviceName, localStation);
  await bye(serverStation);
  await driver.close();
};

const commandCdir = async (dirPath: string, options: object) => {
  const { deviceName, serverStation, localStation } = resolveOptions(options);
  await initConnection(deviceName, localStation);
  await cdir(serverStation, dirPath);
  await driver.close();
};

const commandDelete = async (pathToDelete: string, options: object) => {
  const { deviceName, serverStation, localStation } = resolveOptions(options);
  await initConnection(deviceName, localStation);
  await deleteFile(serverStation, pathToDelete);
  await driver.close();
};

const commandAccess = async (
  pathToSetAccess: string,
  accessString: string,
  options: object,
) => {
  const { deviceName, serverStation, localStation } = resolveOptions(options);
  await initConnection(deviceName, localStation);
  await access(serverStation, pathToSetAccess, accessString);
  await driver.close();
};

const commandGet = async (filename: string, options: object) => {
  const { deviceName, serverStation, localStation } = resolveOptions(options);
  await initConnection(deviceName, localStation);
  const result = await load(serverStation, filename);
  fs.writeFileSync(result.actualFilename, result.data);
  await driver.close();
};

const commandPut = async (filename: string, options: object) => {
  const { deviceName, serverStation, localStation } = resolveOptions(options);
  await initConnection(deviceName, localStation);
  const fileData = fs.readFileSync(filename);
  const fileTitle = `${path.basename(filename)}\r`;
  await save(serverStation, fileData, fileTitle, 0xffff0e00, 0xffff2b80);
  await driver.close();
};

const commandCat = async (dirPath: string, options: object) => {
  const { deviceName, serverStation, localStation } = resolveOptions(options);
  await initConnection(deviceName, localStation);
  const result = await examineDir(serverStation, dirPath);
  console.log(JSON.stringify(result, null, 4));
  const result2 = await readDirAccessObjectInfo(serverStation, dirPath);
  console.log(JSON.stringify(result2, null, 4));
  await driver.close();
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
      new Option('-dev, --device <string>', 'specify PICO serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local econet station number',
      ).env('ECONET_STATION'),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      )
        .default(254)
        .env('ECONET_FS_STATION'),
    )
    .action(commandIAm);

  program
    .command('bye')
    .description('logout of fileserver like a "*BYE" command')
    .addOption(
      new Option('-dev, --device <string>', 'specify PICO serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local econet station number',
      ).env('ECONET_STATION'),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      )
        .default(254)
        .env('ECONET_FS_STATION'),
    )
    .action(async () => {
      await commandBye(program);
    });

  program
    .command('get')
    .description('get file from fileserver using "LOAD" command')
    .argument('<filename>', 'filename')
    .addOption(
      new Option('-dev, --device <string>', 'specify PICO serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local econet station number',
      ).env('ECONET_STATION'),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      )
        .default(254)
        .env('ECONET_FS_STATION'),
    )
    .action(commandGet);

  program
    .command('put')
    .description('get file from fileserver using "SAVE" command')
    .argument('<filename>', 'filename')
    .addOption(
      new Option('-dev, --device <string>', 'specify PICO serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local econet station number',
      ).env('ECONET_STATION'),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      )
        .default(254)
        .env('ECONET_FS_STATION'),
    )
    .action(commandPut);

  program
    .command('cat')
    .description('get catalogue of directory from fileserver')
    .argument('<dirPath>', 'directory path')
    .addOption(
      new Option('-dev, --device <string>', 'specify PICO serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local econet station number',
      ).env('ECONET_STATION'),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      )
        .default(1)
        .env('ECONET_FS_STATION'),
    )
    .action(commandCat);

  program
    .command('cdir')
    .description('create directory on fileserver')
    .argument('<dirPath>', 'directory path')
    .addOption(
      new Option('-dev, --device <string>', 'specify PICO serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local econet station number',
      ).env('ECONET_STATION'),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      )
        .default(254)
        .env('ECONET_FS_STATION'),
    )
    .action(commandCdir);

  program
    .command('delete')
    .description('delete file on fileserver')
    .argument('<path>', 'file path')
    .addOption(
      new Option('-dev, --device <string>', 'specify PICO serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local econet station number',
      ).env('ECONET_STATION'),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      )
        .default(254)
        .env('ECONET_FS_STATION'),
    )
    .action(commandDelete);

  program
    .command('access')
    .description('set access on fileserver')
    .argument('<path>', 'file path')
    .argument('<accessString>', 'access string')
    .addOption(
      new Option('-dev, --device <string>', 'specify PICO serial device'),
    )
    .addOption(
      new Option(
        '-s, --station <number>',
        'specify local econet station number',
      ).env('ECONET_STATION'),
    )
    .addOption(
      new Option(
        '-fs, --fileserver <number>',
        'specify fileserver station number',
      )
        .default(254)
        .env('ECONET_FS_STATION'),
    )
    .action(commandAccess);

  program.parse(process.argv);
};

void main();
