import { getKeyPress, logProgress } from '../common';

export enum FileType {
  File,
  Directory,
}

export const promptDelete = async (
  filename: string,
  type: FileType,
  deletePromptTracker: DeletePromptTracker,
) => {
  if (deletePromptTracker.isDeleteAllSelected) {
    return true;
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    logProgress(
      `${
        type === FileType.File ? 'File' : 'Directory'
      } ${filename} will be deleted, OK? [Y]es/[A]ll/[S]kip/[Q]uit]`,
    );

    const key = await getKeyPress();
    logProgress('');
    switch (key) {
      case 'y':
      case 'Y':
        return true;
      case 'a':
      case 'A':
        deletePromptTracker.selectDeleteAll();
        return true;
      case 's':
      case 'S':
        return false;
      case 'q':
      case 'Q':
        logProgress('');
        process.exit(1);
    }
  }
};

export class DeletePromptTracker {
  constructor(private deleteAll: boolean) {}

  public get isDeleteAllSelected() {
    return this.deleteAll;
  }

  public selectDeleteAll() {
    this.deleteAll = true;
  }
}
