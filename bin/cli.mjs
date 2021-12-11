#!/usr/bin/env node

// @ts-check

import meow from 'meow'
import { scanDir } from '../dist/index.js'

const cli = meow(
  `
  Usage
    $ ocr-search --words "<words_list>" <input_files>

  Required
    --words List of comma-separated words to search (if "MATCH_ALL", will match everything for mass OCR extraction)
    
  Options
    --ignoreExt         List of comma-separated file extensions to ignore
    --pdfExtractFirst   Range start of the pages to extract from PDF files (1-indexed)
    --pdfExtractLast    Range end of the pages to extract from PDF files, last page if overflow (1-indexed)
    --progressFile      File to save progress to, will start from where it
                        stopped last time by looking there (no file, use "none")  [default="progress.json"]
    --matchesLogFile    Log all matches to this file (no file, use "none") [default="matches.txt"]
    --no-console-logs   Silence all console logs
    --no-show-matches   Do not print matched files text content to the console [default="false"]
    --workers           Amount of worker threads to use (default is total CPU cores count - 2)

  OCR Options - See https://github.com/tesseract-ocr/tesseract/blob/main/doc/tesseract.1.asc
    --lang  Tesseract OCR LANG configuration [default="eng"]
    --oem   Tesseract OCR OEM configuration [default="1"]
    --psm   Tesseract OCR PSM configuration [default="1"]

  Examples
    Scan the "scanned-dir" directory and match all the files containing "system", "wiki" and "hello"
      $ ocr-search --words "system,wiki,hello" scanned-dir

    Scan the glob-matched files "*" and match all files (mass OCR text extraction)
      $ ocr-search --words MATCH_ALL *

    Skip .pdf and .webp files
      $ ocr-search --words "wiki,hello" --ignoreExt "pdf,webp" scanned-dir

    Extract only page 3 to 6 in all PDF files (1-indexed)
      $ ocr-search --words "wiki,hello" --pdfExtractFirst 3 --pdfExtractLast 6 scanned-dir

    Use a specific Tesseract OCR configuration
      $ ocr-search --words "wiki,hello" --lang fra --oem 1 --psm 3 scanned-dir

    Do not save progress and do not log matches to file
      $ ocr-search --words "wiki,hello" --progressFile none --matchesLogFile none scanned-dir
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
      showMatches: {
        type: 'boolean',
        default: true
      },
      progressFile: {
        type: 'string',
        default: 'progress.json'
      },
      ignoreExt: {
        type: 'string'
      },
      pdfExtractFirst: {
        type: 'number'
      },
      pdfExtractLast: {
        type: 'number'
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

/** @type {import('../dist/utils.js').ScanOptions} */
const config = {
  words: cli.flags.words && cli.flags.words !== 'MATCH_ALL' ? cli.flags.words.split(',') : undefined,
  shouldConsoleLog: cli.flags.consoleLogs,
  progressFile: cli.flags.progressFile !== 'none' ? cli.flags.progressFile : undefined,
  shouldConsoleLogMatches: cli.flags.showMatches,
  ignoreExt: cli.flags.ignoreExt ? new Set(cli.flags.ignoreExt.split(',')) : undefined,
  pdfExtractFirst: cli.flags.pdfExtractFirst,
  pdfExtractLast: cli.flags.pdfExtractLast,
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
