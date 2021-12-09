# Bulk Files OCR Text Finder

[![Node.js CI](https://github.com/rigwild/bulk-files-ocr-search/workflows/Node.js%20CI/badge.svg)](https://github.com/rigwild/bulk-files-ocr-search/actions)
[![npm package](https://img.shields.io/npm/v/bulk-files-ocr-search.svg?logo=npm)](https://www.npmjs.com/package/bulk-files-ocr-search)
[![npm downloads](https://img.shields.io/npm/dw/bulk-files-ocr-search)](https://www.npmjs.com/package/bulk-files-ocr-search)
[![license](https://img.shields.io/npm/l/bulk-files-ocr-search?color=blue)](./LICENSE)

🔍 Find files that contain some text with [OCR](https://en.wikipedia.org/wiki/Optical_character_recognition).

Supported file formats:

- Images: JPG, PNG, [WebP](https://en.wikipedia.org/wiki/WebP)
- Documents: PDF

Unsupported file formats:

- Images: [AVIF](https://en.wikipedia.org/wiki/AVIF), [WebP 2 (`.wp2`)](https://en.wikipedia.org/wiki/WebP#WebP_2), [JPEG XL (`.jxl`)](https://en.wikipedia.org/wiki/JPEG_XL)
- Documents: Office (`.docx`, `.xlsx`, `.pptx`, ...)

[Tesseract OCR](https://github.com/tesseract-ocr/tesseract/blob/main/doc/tesseract.1.asc) is used internally.

This package uses [worker threads](https://nodejs.org/api/worker_threads.html) to make use of your CPU cores and be faster.

**Notes:**

- The OCR will only provide relevant results if your files are in a proper orientation (text is horizontal and not upside-down).
- Files will be matched if at least 1 of the words is found in the text contained in it.

## Install

No matter how you decide to use this package, you need to install [Tesseract OCR](https://github.com/tesseract-ocr/tesseract/blob/main/doc/tesseract.1.asc) anyway.

```sh
sudo apt install tesseract-ocr
```

See [Installing Tesseract](https://github.com/tesseract-ocr/tesseract#installing-tesseract).

### OCR Language

If you want to use another language than English, download then install the required language from the [Tesseract OCR Languages Models repository](https://github.com/tesseract-ocr/tessdata_fast).

```sh
# French language
wget https://github.com/tesseract-ocr/tessdata_fast/raw/main/fra.traineddata
sudo cp fra.traineddata /usr/share/tesseract-ocr/4.00/tessdata/
```

## Run from provided runner

```sh
git clone bulk-files-ocr-search
cd bulk-files-ocr-search
# npm install -D
pnpm install
pnpm build
```

Put all your files/directories in the [`data`](./data) directory. They can be in subfolders.

The progress will be printed to the console and saved in the `progress.json` file.

The list of files that match at least one of the provided words and their content will be saved to the `matches.txt` file.

```sh
node run.js
```

See [`run.js`](./run.js).

## Run Programatically

```sh
pnpm i bulk-files-ocr-search
```

```ts
import path from 'path'
import { scanDir, TesseractConfig } from 'bulk-files-ocr-search'

// The list of options
export type ScanOptions = {
  /**
   * List of words to search (if one is matched, the file is matched)
   *
   * If not provided, every files will get matched (useful to do mass OCR and save the result)
   */
  words: string[] | ['MATCH_ALL']

  /**
   * Should the logs be printed to the console? (default = false)
   */
  shouldConsoleLog?: boolean

  /**
   * If provided, the progress will be saved to a file
   *
   * When stopped, the process will start from where it stopped last time by looking there
   */
  progressFile?: string

  /**
   * If provided, every file path and their text content that were matched are logged to this file
   */
  outputLogFile?: string

  /**
   * Amount of worker threads to use (default = your total CPU cores - 2)
   *
   * Note: Using all your available cores may slow down the process!
   */
  workerPoolSize?: number

  /**
   * Tesseract OCR config, will default to english language
   *
   * @see https://github.com/tesseract-ocr/tesseract/blob/main/doc/tesseract.1.asc
   */
  tesseractConfig?: TesseractConfig
}

const words = ['hello', 'match this', '<<<<<']

const scannedDir = path.resolve(__dirname, 'data')
const progressFile = path.resolve(__dirname, 'progress.json')
const outputLogFile = path.resolve(__dirname, 'matches.txt')
const tesseractConfig: TesseractConfig = { lang: 'eng' }

console.time('scan')

await scanDir(scannedDir, {
  words,
  shouldConsoleLog: true,
  progressFile,
  outputLogFile,
  tesseractConfig
})

console.log('Scan finished!')
console.timeEnd('scan')
```

The standalone OCR function is also exported.

```ts
import path from 'path'
import { ocr } from 'bulk-files-ocr-search'

const file = path.resolve(__dirname, '..', 'test', '_testFiles', 'sample.jpg')

// Tesseract configuration
const tesseractConfig: TesseractConfig = {}

// Should the string be normalized (lowercase, accents removed, whitespace removed)
const shouldCleanStr: boolean = true

const text = await ocr(file, tesseractConfig, shouldCleanStr)
console.log(text)
```

## License

[The MIT License](./LICENSE)
