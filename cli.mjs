#!/usr/bin/env node

// @ts-check

import meow from 'meow'
import { scanDir } from './dist/index.js'

const cli = meow(
  `
  Usage
    $ ocr-search --words "<words_list>" <input_files>

  Required
    --words List of comma-separated words to search (if "MATCH_ALL", will match everything for mass OCR extraction)
    
  Options
    --progressFile     File to save progress to, will start from where it stopped last time by looking there (none="none")  [default="progress.json"]
    --matchesLogFile   Log all matches to this file (none="none") [default="matches.txt"]
    --no-console-logs  Silence console logs
    --workers          Amount of worker threads to use (default is total CPU cores count - 2)

  OCR Options - See https://github.com/tesseract-ocr/tesseract/blob/main/doc/tesseract.1.asc
    --lang  Tesseract OCR LANG configuration [default="eng"]
    --oem   Tesseract OCR OEM configuration [default="1"]
    --psm   Tesseract OCR PSM configuration [default="1"]

  Examples
    Scan the "scanned-dir" directory and match all the files containing "system", "wiki" and "hello"
      $ ocr-search --words "system,wiki,hello" scanned-dir

    Scan the glob-matched files "*" and match all files (mass OCR text extraction)
      $ ocr-search --words MATCH_ALL *

    Use a specific Tesseract OCR configuration
      $ ocr-search --words "wiki,hello" --lang fra --oem 1 --psm 3 scanned-dir

    Do not save progress and do not log matches to file
      $ ocr-search --words "wiki,hello" --progressFile none --matchesLogFile none scanned-dir

  https://github.com/rigwild/bulk-files-ocr-search
`,
  {
    // @ts-ignore
    importMeta: import.meta,
    flags: {
      words: {
        type: 'string',
        isRequired: true
      },
      consoleLogs: {
        type: 'boolean',
        default: true
      },
      progressFile: {
        type: 'string',
        default: 'progress.json'
      },
      matchesLogFile: {
        type: 'string',
        default: 'matches.txt'
      },

      lang: {
        type: 'string'
      },
      oem: {
        type: 'number'
      },
      psm: {
        type: 'number'
      },
      workers: {
        type: 'number'
      }
    }
  }
)

/** @type {import('./dist/utils.js').ScanOptions} */
const config = {
  words: cli.flags.words && cli.flags.words !== 'MATCH_ALL' ? cli.flags.words.split(',') : undefined,
  shouldConsoleLog: cli.flags.consoleLogs,
  progressFile: cli.flags.progressFile !== 'none' ? cli.flags.progressFile : undefined,
  matchesLogFile: cli.flags.matchesLogFile !== 'none' ? cli.flags.matchesLogFile : undefined,
  tesseractConfig: {
    lang: cli.flags.lang,
    oem: cli.flags.oem,
    psm: cli.flags.psm
  },
  workerPoolSize: cli.flags.workers
}

;(async () => {
  for (const input of cli.input) {
    await scanDir(input, config)
  }
})()
