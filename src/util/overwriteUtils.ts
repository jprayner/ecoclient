import { getKeyPress, logProgress } from '../common';

export enum FileType {
  File,
  Directory,
}

export enum OverwritePromptResult {
  Continue,
  Skip,
}

export const promptOverwrite = async (
  filename: string,
  overwriteTracker: FileOverwriteTracker,
) => {
  if (overwriteTracker.isOverwriteAllSelected) {
    return true;
  }

  if (!process.stdin.isTTY) {
    console.error(`File already exists: ${filename}`);
    process.exit(1);
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    logProgress(
      `File ${filename} will be overwritten, OK? [Y]es/[A]ll/[S]kip/[Q]uit]`,
    );

    const key = await getKeyPress();
    logProgress('');
    switch (key) {
      case 'y':
      case 'Y':
        return true;
        break;
      case 'a':
      case 'A':
        overwriteTracker.selectOverwriteAll();
        return true;
        break;
      case 's':
      case 'S':
        return false;
        break;
      case 'q':
      case 'Q':
        logProgress('');
        process.exit(1);
    }
  }
};

export class FileOverwriteTracker {
  constructor(private overwriteAll: boolean) {}

  public get isOverwriteAllSelected() {
    return this.overwriteAll;
  }

  public selectOverwriteAll() {
    this.overwriteAll = true;
  }
}
