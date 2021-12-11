# OCR Search

[![Node.js CI](https://github.com/rigwild/ocr-search/workflows/Node.js%20CI/badge.svg)](https://github.com/rigwild/ocr-search/actions)
[![npm package](https://img.shields.io/npm/v/ocr-search.svg?logo=npm)](https://www.npmjs.com/package/ocr-search)
[![npm downloads](https://img.shields.io/npm/dw/ocr-search)](https://www.npmjs.com/package/ocr-search)
[![license](https://img.shields.io/npm/l/ocr-search?color=blue)](./LICENSE)

🔍 Find files that contain some text with [OCR](https://en.wikipedia.org/wiki/Optical_character_recognition).

Supported file formats:

- Images: JPEG, PNG, [WebP](https://en.wikipedia.org/wiki/WebP)
- Documents: PDF

Unsupported file formats:

- Images: [AVIF](https://en.wikipedia.org/wiki/AVIF), [WebP 2 (`.wp2`)](https://en.wikipedia.org/wiki/WebP#WebP_2), [JPEG XL (`.jxl`)](https://en.wikipedia.org/wiki/JPEG_XL)
- Documents: Office (`.docx`, `.xlsx`, `.pptx`, ...)

[Tesseract OCR](https://github.com/tesseract-ocr/tesseract) is used internally ([Tesseract Documentation](https://github.com/tesseract-ocr/tesseract/blob/main/doc/tesseract.1.asc)). For PDF to PNG conversion, [Poppler](https://poppler.freedesktop.org/) is used.

This package uses [worker threads](https://nodejs.org/api/worker_threads.html) to make use of your CPU cores and be faster.

**Notes:**

- The OCR will provide bad results for rotated files/non-straight text.
  - 90/180 degrees rotations seems to output a good result
  - You may want to pre-process your files somehow to make the text straight!
- Files will be matched if at least 1 of the words is found in the text contained in it.

## Install

No matter how you decide to use this package, you need to install Tesseract OCR anyway. If you have some PDF files, they need to be converted with additional packages.

```sh
# OCR Package (non-linux, see https://github.com/tesseract-ocr/tesseract#installing-tesseract)
sudo apt install tesseract-ocr

# PDF to JPEG conversion command-line (for Windows, see https://stackoverflow.com/a/53960829 - MacOS `brew install poppler`)
# You can skip this if you don't plan to scan PDF files
sudo apt install poppler-utils
```

### OCR Language

If you want to use another language than English, download then install the required language from the [Tesseract OCR Languages Models repository](https://github.com/tesseract-ocr/tessdata_fast).

```sh
# French language
wget https://github.com/tesseract-ocr/tessdata_fast/raw/main/fra.traineddata
sudo cp fra.traineddata /usr/share/tesseract-ocr/4.00/tessdata/
```

## Use with CLI

This will install the `ocr-search` CLI.

```sh
pnpm i -g ocr-search
```

```
$ ocr-search --help

  🔍 Find files that contain some text with OCR

  Usage
    $ ocr-search --words "<words_list>" <input_files>

  To delete images created from PDF files pages extractions, check the other provided command:
    $ ocr-search --help

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

  https://github.com/rigwild/ocr-search
```

Another CLI is provided to easily remove all extracted PDF pages images.

```
$ ocr-search-clean --help

  🗑️ Find and remove all images from PDF pages extractions

  Usage
    $ ocr-search-clean <input_files>

  https://github.com/rigwild/ocr-search
```

## Use with provided runner

```sh
git clone https://github.com/rigwild/ocr-search.git
cd ocr-search
pnpm install # or npm install -D
pnpm build
```

Put all your files/directories in the [`data`](./data) directory. They can be in subfolders.

The progress will be printed to the console and saved in the `progress.json` file.

The list of files that match at least one of the provided words and their content will be saved to the `matches.txt` file.

```sh
node run.js
```

See [`run.js`](./run.js).

## Use Programatically

### Install

```sh
pnpm i ocr-search
```

### Directory scan

```ts
import path from 'path'
import { scanDir, TesseractConfig } from 'ocr-search'

// The list of options
export type ScanOptions = {
  /**
   * List of words to search (if one is matched, the file is matched)
   *
   * If not provided, every files will get matched (useful to do mass OCR and save the result)
   */
  words?: string[]

  /** Should the logs be printed to the console? (default = false) */
  shouldConsoleLog?: boolean

  /** Should the matches file content be printed to the console? (default = true) */
  shouldConsoleLogMatches?: boolean

  /**
   * If provided, the progress will be saved to a file
   *
   * When stopped, the process will start from where it stopped last time by looking there
   */
  progressFile?: string

  /** If provided, every file path and their text content that were matched are logged to this file */
  matchesLogFile?: string

  /** File extensions to ignore when looking for files */
  ignoreExt?: Set<string>

  /* Extract PDF files starting at this page, first page is 1 (1-indexed) (default = 1) */
  pdfExtractFirst?: number

  /* Extract PDF files until this page, last page if overflow (1-indexed) (default = last page of PDF file) */
  pdfExtractLast?: number

  /**
   * Amount of worker threads to use (default = your total CPU cores - 2)
   *
   * Note: Using all your available cores may slow down the process!
   */
  workerPoolSize?: number

  /**
   * Tesseract OCR config, will default `{ lang: 'eng', oem: 1, psm: 1 }`
   *
   * @see https://github.com/tesseract-ocr/tesseract/blob/main/doc/tesseract.1.asc
   */
  tesseractConfig?: TesseractConfig
}

const scannedDir = path.resolve(__dirname, 'data')
const words = ['hello', 'match this', '<<<<<']
const tesseractConfig: TesseractConfig = { lang: 'fra', oem: 1, psm: 1 }

console.time('scan')

await scanDir(scannedDir, {
  words,
  shouldConsoleLog: true,
  tesseractConfig
})

console.log('Scan finished!')
console.timeEnd('scan')
```

### Perform OCR on a single file

```ts
import path from 'path'
import { ocr } from 'ocr-search'

const file = path.resolve(__dirname, '..', 'test', '_testFiles', 'sample.jpg')

// Tesseract configuration
const tesseractConfig: TesseractConfig = { lang: 'eng', oem: 1, psm: 1 }

// Should the string be normalized? (lowercase, accents removed, whitespace removed)
const shouldCleanStr: boolean | undefined = true

const text = await ocr(file, tesseractConfig, shouldCleanStr)
console.log(text)
```

### PDF to images conversion

Convert PDF pages to PNG. Files are generated on the file system, 1 file per PDF page.

```ts
import path from 'path'
import { pdfToImages } from 'ocr-search'

const filePdf = path.resolve(__dirname, '..', 'test', '_testFiles', 'sample.pdf')

// Extract from page 1 to page 3 (1-indexed)
const res = await pdfToImages(filePdf, 1, 3)
console.log(res) // Paths to generated PNG files
```

## License

[GNU Affero General Public License v3.0](./LICENSE)
