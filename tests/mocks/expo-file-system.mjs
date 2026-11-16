/** For business logic tests only. File picker/share operations require an iOS test. */
export class File {
  constructor() { throw new Error('File I/O must be tested on the device'); }
}
export class Directory {
  constructor() { throw new Error('File I/O must be tested on the device'); }
}
export const Paths = { cache: null, document: null };
