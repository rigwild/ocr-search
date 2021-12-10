// @ts-check
const path = require('path')
const { scanDir } = require('./dist/index') // bulk-files-ocr-search

const words = ['hello', 'match this', '<<<<<']

/**
 * @type {import('./dist/utils').TesseractConfig}
 * @see https://github.com/tesseract-ocr/tessdata_fast
 */
const tesseractConfig = { lang: 'eng' }

const scannedDir = path.resolve(__dirname, '..', 'data')

const progressFile = path.resolve(__dirname, '..', 'progress.json')
const matchesLogFile = path.resolve(__dirname, '..', 'matches.txt')

console.time('scan')
scanDir(scannedDir, { words, shouldConsoleLog: true, progressFile, matchesLogFile, tesseractConfig }).then(() => {
  console.log('Scan finished!')
  console.timeEnd('scan')
})
