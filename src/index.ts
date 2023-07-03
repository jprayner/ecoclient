#! /usr/bin/env node
import { driver } from '@jprayner/piconet-nodejs';
import { Command } from '@commander-js/extra-typings';

import { ConfigOptions, initConnection } from './common';
import { PKG_VERSION } from './version';
import { getLocalStationNum, getServerStationNum } from './config';
import { commandIAm } from './command/iAm';
import { commandSetFileserver } from './command/setFileserver';
import { commandGetStatus } from './command/getStatus';
import { commandSetStation } from './command/setStation';
import { commandSetMetadata } from './command/setMetadata';
import { commandNotify } from './command/notify';
import { commandDir } from './command/dir';
import { commandMonitor } from './command/monitor';
import { commandBye } from './command/bye';
import { commandDelete } from './command/delete';
import { commandGet } from './command/get';
import { commandPut } from './command/put';
import { commandLoad } from './command/load';
import { commandSave } from './command/save';
import { commandCat } from './command/cat';
import { commandCdir } from './command/cdir';
import { commandAccess } from './command/access';

type CliOptions = {
  debug?: true | undefined;
  devicename?: string | undefined;
  station?: string | undefined;
  fileserver?: string | undefined;
};

const program = new Command()
  .name('ecoclient')
  .description('Econet fileserver client')
  .version(PKG_VERSION)
  .option('-d, --debug', 'enable debug output')
  .option('-n, --devicename <string>', 'specify device name/path')
  .option('-s, --station <number>', 'specify local Econet station number')
  .option('-fs, --fileserver <number>', 'specify fileserver station number');

program
  .command('set-fs')
  .description('set fileserver')
  .argument('<station>', 'station number')
  .action(async station => {
    await errorHandlingWrapper(commandSetFileserver, station);
  });

program
  .command('set-station')
  .description('set Econet station')
  .argument('<station>', 'station number')
  .action(async station => {
    await errorHandlingWrapper(commandSetStation, station);
  });

program
  .command('status')
  .description('display status info for ecoclient and board')
  .action(async () => {
    const config = await resolveConfig(program.opts());
    await errorHandlingWrapper(commandGetStatus, config);
  });

program
  .command('set-metadata')
  .description('set metadata storage mechanism (inf|filename|none)')
  .argument('<type>', '(inf|filename|none)')
  .action(async metadataType => {
    await errorHandlingWrapper(commandSetMetadata, metadataType);
  });

program
  .command('i-am')
  .description('login to fileserver like a "*I AM" command')
  .argument('<username>', 'username')
  .argument('[password]', 'password')
  .action(async (username, password) => {
    const config = await resolveConfig(program.opts());
    await connectionWrapper(
      commandIAm,
      config,
      config.serverStation,
      username,
      password || '',
    );
  });

program
  .command('notify')
  .description(
    'send notification message to a station like a "*NOTIFY" command',
  )
  .argument('<station>', 'station number')
  .argument('<message>', 'message')
  .action(async (station, message) => {
    const config = await resolveConfig(program.opts());
    await connectionWrapper(commandNotify, config, station, message);
  });

program
  .command('dir')
  .description('change current directory')
  .argument('[dir]', 'directory path', '')
  .action(async dirPath => {
    const config = await resolveConfig(program.opts());
    await connectionWrapper(commandDir, config, config.serverStation, dirPath);
  });

program
  .command('monitor')
  .description('listen for network traffic like a "*NETMON" command')
  .action(async () => {
    const config = await resolveConfig(program.opts());
    await connectionWrapper(commandMonitor, config);
  });

program
  .command('bye')
  .description('logout of fileserver like a "*BYE" command')
  .action(async () => {
    const config = await resolveConfig(program.opts());
    await connectionWrapper(commandBye, config, config.serverStation);
  });

program
  .command('delete')
  .description('delete file on fileserver')
  .argument('<path>', 'file path')
  .action(async filePath => {
    const config = await resolveConfig(program.opts());
    await connectionWrapper(
      commandDelete,
      config,
      config.serverStation,
      filePath,
    );
  });

program
  .command('get')
  .description('get file from fileserver using "LOAD" command')
  .argument('<filename>', 'filename')
  .option('-r, --recurse', 'recurse subdirectories')
  .option('-f, --force', 'force overwrite of existing files')
  .action(async (filename, commandOpts) => {
    const config = await resolveConfig(program.opts());
    await connectionWrapper(
      commandGet,
      config,
      config.serverStation,
      filename,
      commandOpts.recurse || false,
      commandOpts.force || false,
    );
  });

program
  .command('put')
  .description('put file to fileserver using "SAVE" command')
  .argument('<filename>', 'filename')
  .action(async filename => {
    const config = await resolveConfig(program.opts());
    await connectionWrapper(commandPut, config, config.serverStation, filename);
  });

program
  .command('load')
  .description('load basic file and detokenise (needs basictool installed)')
  .argument('<filename>', 'filename')
  .action(async filename => {
    const config = await resolveConfig(program.opts());
    await connectionWrapper(
      commandLoad,
      config,
      config.serverStation,
      filename,
    );
  });

program
  .command('save')
  .description('save basic file after detokenising (needs basictool installed)')
  .argument('<localPath>', 'path to file on local filesystem')
  .argument(
    '[destPath]',
    'path to file on fileserver (defaults to filename part of localPath)',
  )
  .action(async (localPath, destPath) => {
    const config = await resolveConfig(program.opts());
    await connectionWrapper(
      commandSave,
      config,
      config.serverStation,
      localPath,
      destPath,
    );
  });

program
  .command('cat')
  .description('get catalogue of directory from fileserver')
  .argument('[dirPath]', 'directory path', '')
  .action(async dirPath => {
    const config = await resolveConfig(program.opts());
    await connectionWrapper(commandCat, config, config.serverStation, dirPath);
  });

program
  .command('cdir')
  .description('create directory on fileserver')
  .argument('<dirPath>', 'directory path')
  .action(async dirPath => {
    const config = await resolveConfig(program.opts());
    await connectionWrapper(commandCdir, config, config.serverStation, dirPath);
  });

program
  .command('access')
  .description('set access on fileserver')
  .argument('<path>', 'file path')
  .argument('<accessString>', 'access string')
  .action(async (remotePath, accessString) => {
    const config = await resolveConfig(program.opts());
    await connectionWrapper(
      commandAccess,
      config,
      config.serverStation,
      remotePath,
      accessString,
    );
  });

const main = () => {
  program.parse(process.argv);
};

const resolveConfig = async (cliOptions: CliOptions) => {
  const deviceName =
    typeof cliOptions.devicename === 'string'
      ? cliOptions.devicename
      : undefined;

  const serverStationOption = cliOptions.fileserver;
  const serverStation =
    typeof serverStationOption === 'string'
      ? parseInt(serverStationOption)
      : await getServerStationNum();

  const stationOption = cliOptions.station;
  const localStation =
    typeof stationOption === 'string'
      ? parseInt(stationOption)
      : await getLocalStationNum();
  if (typeof localStation === 'undefined') {
    throw new Error(
      'You must specify an econet station number for this machine using the --station option (or store a default value using the set-station command)',
    );
  }

  const debugOption = cliOptions.debug;
  const debugEnabled = typeof debugOption === 'boolean' ? debugOption : false;

  return {
    deviceName,
    serverStation,
    localStation,
    debugEnabled,
  } as ConfigOptions;
};

/**
 * Wraps a command function so a thrown error is sensibly logged and a non-zero status code is returned.
 *
 * @param operation The function to wrap.
 * @param parameters The parameters to pass to operation.
 * @returns The result of the operation.
 */
async function errorHandlingWrapper<Args extends unknown[], Return>(
  operation: (...operationParameters: Args) => Promise<Return>,
  ...parameters: Args
): Promise<Return> {
  try {
    return await operation(...parameters);
  } catch (e: unknown) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

/**
 * Wraps a command function so that a connection with the fileserver is established
 * before it is invoked and then closed afterwards. It further decorates the function
 * with some error handling using {@link errorHandlingWrapper}.
 *
 * Note that this decorator is not necessary for commands that do not require a connection
 * e.g. for setting configuration options.
 *
 * @param operation The function to wrap.
 * @param parameters The parameters to pass to operation.
 * @returns The result of the operation.
 */
async function connectionWrapper<Args extends unknown[], Return>(
  operation: (...operationParameters: Args) => Promise<Return>,
  configOptions: ConfigOptions,
  ...parameters: Args
): Promise<Return> {
  driver.setDebugEnabled(configOptions.debugEnabled);
  await initConnection(
    configOptions.deviceName,
    configOptions.localStation,
    configOptions.debugEnabled,
  );

  try {
    return await errorHandlingWrapper(operation, ...parameters);
  } finally {
    try {
      await driver.setMode('STOP');
    } catch (e: unknown) {
      console.error(
        'Failed to STOP driver: ' +
          (e instanceof Error ? e.message : 'unknown error'),
      );
    }
    await driver.close();
  }
}

main();
