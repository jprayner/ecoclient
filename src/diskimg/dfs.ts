import { existsSync, mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';
import { saveFileInfo } from '../common';

const bytesPerSector = 256;
const sectorsPerTrack = 10;
const minTracks = 40;
const minDiskSize = bytesPerSector * sectorsPerTrack * minTracks;

export enum DfsBootOption {
  None = 0,
  Load = 1,
  Run = 2,
  Exec = 3,
}

export const parseSingleSidedDiskImage = (buffer: Buffer): DfsDiskSide => {
  const header = parseCatalogueHeader(buffer);

  const image = new DfsDiskSide(header.diskName, header.cycleNum);
  image.bootOption = header.bootOption;

  for (let i = 0; i < header.numFiles; i++) {
    const entry = CatalogueEntry.parse(buffer, i);
    if (entry.startSector < 2 || entry.startSector > header.numSectors) {
      throw new Error(
        `invalid start sector ${entry.startSector} reported in catalogue entry ${i} (${entry.name})`,
      );
    }

    const fileOffset = entry.startSector * bytesPerSector;
    const fileData = buffer.slice(fileOffset, fileOffset + entry.length);
    const file = new File(
      entry.name,
      entry.dir,
      entry.isLocked,
      entry.loadAddress,
      entry.executionAddress,
      fileData,
    );
    image.addFile(file);
  }

  return image;
};

export const parseDoubleSidedDiskImage = (buffer: Buffer): DfsDiskSide[] => {
  const { numTracks } = parseCatalogueHeader(buffer);

  const expectedBytes = bytesPerSector * sectorsPerTrack * numTracks * 2; // x2 because 2 sides
  if (buffer.length !== expectedBytes) {
    throw new Error(
      'truncated DSD disk image (expected ${expectedBytes} bytes, got ${buffer.length} bytes)',
    );
  }

  const side0Tracks = [];
  const side1Tracks = [];
  for (let trackNum = 0; trackNum < numTracks * 2; trackNum++) {
    const trackOffset = trackNum * bytesPerSector * sectorsPerTrack;
    const trackBuffer = buffer.slice(
      trackOffset,
      trackOffset + bytesPerSector * sectorsPerTrack,
    );

    if (trackNum % 2 === 0) {
      side0Tracks.push(trackBuffer);
    } else {
      side1Tracks.push(trackBuffer);
    }
  }

  return [
    parseSingleSidedDiskImage(Buffer.concat(side0Tracks)),
    parseSingleSidedDiskImage(Buffer.concat(side1Tracks)),
  ];
};

export class DfsDiskSide {
  private _title: string;

  private _files: File[] = [];

  private _cycleNum = 0;

  private _bootOption = DfsBootOption.None;

  constructor(title: string, cycleNum: number | undefined) {
    this._title = title;
    if (cycleNum !== undefined) {
      this._cycleNum = cycleNum;
    }
  }

  public addFile(file: File) {
    if (this._files.length >= 31) {
      throw new Error('too many files');
    }

    this._files.push(file);
  }

  public get title(): string {
    return this._title;
  }

  public get files(): File[] {
    return this._files;
  }

  public get cycleNum(): number {
    return this._cycleNum;
  }

  public set cycleNum(value: number) {
    this._cycleNum = value;
  }

  public get bootOption(): DfsBootOption {
    return this._bootOption;
  }

  public set bootOption(value: DfsBootOption) {
    this._bootOption = value;
  }

  public extractFiles(directoryPath: string) {
    for (const file of this._files) {
      if (file.dir !== '$' && !existsSync(path.join(directoryPath, file.dir))) {
        mkdirSync(path.join(directoryPath, file.dir));
      }

      const filePath =
        file.dir === '$'
          ? path.join(directoryPath, file.name)
          : path.join(directoryPath, file.dir, file.name);

      writeFileSync(filePath, file.data);
      saveFileInfo(filePath, {
        originalFilename: file.name,
        loadAddr: file.loadAddress,
        execAddr: file.executionAddress,
      });
    }
  }
}

export class File {
  constructor(
    private _name: string,
    private _dir: string,
    private _isLocked: boolean,
    private _loadAddress: number,
    private _executionAddress: number,
    private _data: Buffer,
  ) {}

  public get name(): string {
    return this._name;
  }

  public get dir(): string {
    return this._dir;
  }

  public get isLocked(): boolean {
    return this._isLocked;
  }

  public get loadAddress(): number {
    return this._loadAddress;
  }

  public get executionAddress(): number {
    return this._executionAddress;
  }

  public get data(): Buffer {
    return this._data;
  }
}

class CatalogueEntry {
  constructor(
    private _name: string,
    private _dir: string,
    private _isLocked: boolean,
    private _loadAddress: number,
    private _executionAddress: number,
    private _length: number,
    private _startSector: number,
  ) {}

  public toString(): string {
    return `${this._dir}.${this._name.padEnd(7)} ${this._loadAddress
      .toString(16)
      .toUpperCase()
      .padStart(8, '0')} ${this._executionAddress
      .toString(16)
      .toUpperCase()
      .padStart(8, '0')} ${this._length.toString(10).padStart(8, ' ')} ${
      this._isLocked ? 'L/' : ' /'
    } ${this._startSector}`;
  }

  public static parse(buffer: Buffer, index: number): CatalogueEntry {
    if (buffer.length < 512) {
      throw new Error('buffer must be at least 512 bytes long');
    }

    if (index < 0 || index > 31) {
      throw new Error('directory index must be between 0 and 31');
    }

    const sector0Offset = (index + 1) * 8;
    const sector0Entry = buffer.slice(sector0Offset, sector0Offset + 8);

    const sector1Offset = sector0Offset + 256;
    const sector1Entry = buffer.slice(sector1Offset, sector1Offset + 8);

    const name = sector0Entry.slice(0, 7).toString('ascii').trim();
    const dir = String.fromCharCode(sector0Entry[7] & 0b01111111);
    const isLocked = (sector0Entry[7] & 0b10000000) !== 0;

    return new CatalogueEntry(
      name,
      dir,
      isLocked,
      sector1Entry.readUInt16LE(0) | ((sector1Entry[6] & 0b00001100) << 14),
      sector1Entry.readUInt16LE(2) | ((sector1Entry[6] & 0b11000000) << 10),
      sector1Entry.readUInt16LE(4) | ((sector1Entry[6] & 0b00110000) << 12),
      sector1Entry.readUint8(7) | ((sector1Entry[6] & 0b00000011) << 8),
    );
  }

  public get name(): string {
    return this._name;
  }

  public get dir(): string {
    return this._dir;
  }

  public get isLocked(): boolean {
    return this._isLocked;
  }

  public get loadAddress(): number {
    return this._loadAddress;
  }

  public get executionAddress(): number {
    return this._executionAddress;
  }

  public get length(): number {
    return this._length;
  }

  public get startSector(): number {
    return this._startSector;
  }
}

const parseCatalogueHeader = (buffer: Buffer) => {
  if (buffer.length < minDiskSize) {
    throw new Error(
      `truncated DFS disk image: expected >= ${minDiskSize} bytes, got ${buffer.length} bytes`,
    );
  }

  const sector0Offset = 0;
  const sector0Entry = buffer.slice(sector0Offset, sector0Offset + 8);

  const sector1Offset = 256;
  const sector1Entry = buffer.slice(sector1Offset, sector1Offset + 8);

  const diskName =
    sector0Entry.toString('ascii').replace(/\0/g, ' ').trim() +
    sector1Entry.slice(0, 4).toString('ascii').replace(/\0/g, ' ').trim();
  const cycleNum = bcdToNumber(sector1Entry[4]);

  const numFiles = sector1Entry[5] >> 3;
  const bootOptionAsNum = (sector1Entry[6] & 0b11110000) >> 4;
  const numSectors = ((sector1Entry[6] & 0b00001111) << 8) + sector1Entry[7];
  const numTracks = numSectors / sectorsPerTrack;

  if (numTracks !== 40 && numTracks !== 80) {
    throw new Error(
      `invalid number of tracks ${numTracks} reported in catalogue (must be 40 or 80)`,
    );
  }

  if (bootOptionAsNum < 0 || bootOptionAsNum > 3) {
    throw new Error(
      `invalid boot option ${bootOptionAsNum} reported in catalogue`,
    );
  }
  const bootOption = bootOptionAsNum as DfsBootOption;

  return {
    diskName,
    cycleNum,
    bootOption,
    numFiles,
    numSectors,
    numTracks,
  };
};

const bcdToNumber = (bcd: number): number => {
  return (bcd >> 4) * 10 + (bcd & 0b00001111);
};
