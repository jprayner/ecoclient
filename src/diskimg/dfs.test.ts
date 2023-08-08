import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import {
  DfsBootOption,
  parseDoubleSidedDiskImage,
  parseSingleSidedDiskImage,
} from './dfs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('dfs', () => {
  it('should parse a single-sided disk successfully', () => {
    const buffer = readFileSync('test/resource/games.ssd');
    const result = parseSingleSidedDiskImage(buffer);
    expect(result.title).toEqual('GAMES.SSD');
    expect(result.bootOption).toEqual(DfsBootOption.Exec);
    expect(result.cycleNum).toEqual(56);
    expect(result.files.length).toEqual(26);
    expect(result.files[0].name).toEqual('ASTDEL');
    expect(result.files[0].data.length).toEqual(9547);
    expect(result.files[0].isLocked).toEqual(false);
    expect(result.files[0].loadAddress).toEqual(0xa00);
    expect(result.files[0].executionAddress).toEqual(0xd22);
    expect(result.files[0].dir).toEqual('$');
  });

  it('should parse a double-sided disk successfully', () => {
    const buffer = readFileSync('test/resource/sigma.dsd');
    const result = parseDoubleSidedDiskImage(buffer);

    const side0 = result[0];
    expect(side0.title).toEqual('SIGMA');
    expect(side0.bootOption).toEqual(DfsBootOption.Exec);
    expect(side0.cycleNum).toEqual(31);
    expect(side0.files.length).toEqual(24);
    expect(side0.files[0].name).toEqual('C2LOAD');
    expect(side0.files[0].data.length).toEqual(260);
    expect(side0.files[0].isLocked).toEqual(false);
    expect(side0.files[0].loadAddress).toEqual(0x31900);
    expect(side0.files[0].executionAddress).toEqual(0x38023);
    expect(side0.files[0].dir).toEqual('$');

    const side1 = result[1];
    expect(side1.title).toEqual('');
    expect(side1.bootOption).toEqual(DfsBootOption.None);
    expect(side1.cycleNum).toEqual(7);
    expect(side1.files.length).toEqual(7);
    expect(side1.files[0].name).toEqual('WC6');
    expect(side1.files[0].data.length).toEqual(1023);
    expect(side1.files[0].isLocked).toEqual(false);
    expect(side1.files[0].loadAddress).toEqual(0x37c00);
    expect(side1.files[0].executionAddress).toEqual(0x37c00);
    expect(side1.files[0].dir).toEqual('$');
  });

  it('should extract a single-sided disk successfully', () => {
    const buffer = readFileSync('test/resource/games.ssd');
    const diskImage = parseSingleSidedDiskImage(buffer);

    const dirPath = mkdtempSync(join(tmpdir(), 'dfstest-'));
    try {
      diskImage.extractFiles(dirPath);
      expect(readdirSync(dirPath)).toMatchSnapshot();

      const bootFileContents = readFileSync(join(dirPath, '!BOOT'));
      expect(bootFileContents.toString('ascii')).toEqual('CLS\rCHAIN"!MENU"\r');

      const bootFileInfContents = readFileSync(join(dirPath, '!BOOT.inf'));
      expect(bootFileInfContents.toString('ascii')).toEqual(
        '!BOOT      0003FFFF 0003FFFF\n',
      );
    } finally {
      rmSync(dirPath, { recursive: true });
    }
  });

  it('should extract a double-sided disk successfully', () => {
    const buffer = readFileSync('test/resource/sigma.dsd');
    const diskImages = parseDoubleSidedDiskImage(buffer);

    const dirPath = mkdtempSync(join(tmpdir(), 'dfstest-'));
    try {
      mkdirSync(join(dirPath, '0'));
      diskImages[0].extractFiles(join(dirPath, '0'));

      mkdirSync(join(dirPath, '1'));
      diskImages[1].extractFiles(join(dirPath, '1'));

      expect(readdirSync(join(dirPath, '0'))).toMatchSnapshot();
      expect(readdirSync(join(dirPath, '1'))).toMatchSnapshot();
    } finally {
      rmSync(dirPath, { recursive: true });
    }
  });

  it('should reject a truncated disk image', () => {
    expect(() => parseSingleSidedDiskImage(Buffer.alloc(0))).toThrowError(
      'truncated DFS disk image: expected >= 102400 bytes, got 0 bytes',
    );
  });

  it('should reject a disk image with unexpected number of tracks', () => {
    const buffer = readFileSync('test/resource/games.ssd');
    buffer[256 + 7] = 255;
    expect(() => parseSingleSidedDiskImage(buffer)).toThrowError(
      'invalid number of tracks 102.3 reported in catalogue (must be 40 or 80)',
    );
  });

  it('should reject a disk image with invalid boot option', () => {
    const buffer = readFileSync('test/resource/games.ssd');
    buffer[256 + 6] = buffer[256 + 6] | 0b11110000;
    expect(() => parseSingleSidedDiskImage(buffer)).toThrowError(
      'invalid boot option 15 reported in catalogue',
    );
  });

  it('should reject a disk image with invalid start sector in catalogue entry', () => {
    const buffer = readFileSync('test/resource/games.ssd');
    buffer[255 + 8 + 7] = 255; // +256 gives == sector 1, +8 == 1st cat entry, +7 == startSector
    expect(() => parseSingleSidedDiskImage(buffer)).toThrowError(
      'invalid start sector 948 reported in catalogue entry 0 (ASTDEL)',
    );
  });
});
