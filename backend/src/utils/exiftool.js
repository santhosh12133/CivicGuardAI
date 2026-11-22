const { ExifTool } = require('exiftool-vendored');

// One shared ExifTool process pool for the whole API. Call exiftool.end() on
// shutdown (the test suite does) so the child processes do not keep Node alive.
const exiftool = new ExifTool({ taskTimeoutMillis: 5000 });

module.exports = { exiftool };
