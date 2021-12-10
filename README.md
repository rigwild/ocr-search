# Bulk Files OCR Text Finder

[![Node.js CI](https://github.com/rigwild/bulk-files-ocr-search/workflows/Node.js%20CI/badge.svg)](https://github.com/rigwild/bulk-files-ocr-search/actions)
[![npm package](https://img.shields.io/npm/v/bulk-files-ocr-search.svg?logo=npm)](https://www.npmjs.com/package/bulk-files-ocr-search)
[![npm downloads](https://img.shields.io/npm/dw/bulk-files-ocr-search)](https://www.npmjs.com/package/bulk-files-ocr-search)
[![license](https://img.shields.io/npm/l/bulk-files-ocr-search?color=blue)](./LICENSE)

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

No matter how you decide to use this package, you need to install Tesseract OCR anyway. If you have some PDF files, they need to be converted with additional packages

```sh
# OCR Package (non-linux, see https://github.com/tesseract-ocr/tesseract#installing-tesseract)
sudo apt install tesseract-ocr

# PDF to JPEG conversion command-line (for Windows, see https://stackoverflow.com/a/53960829 - MacOS `brew install poppler`)
sudo apt install poppler-utils
```

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
   * Tesseract OCR config, will default to english language `{ lang: 'eng' }`
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

The standalone OCR and PDF to images functions are also exported.

```ts
import path from 'path'
import { ocr } from 'bulk-files-ocr-search'

const file = path.resolve(__dirname, '..', 'test', '_testFiles', 'sample.jpg')

// Tesseract configuration
const tesseractConfig: TesseractConfig = {
  lang: 'eng'
}

// Should the string be normalized (lowercase, accents removed, whitespace removed)
const shouldCleanStr: boolean | undefined = true

// OCR
const text = await ocr(file, tesseractConfig, shouldCleanStr)
console.log(text)

// ---

const filePdf = path.resolve(__dirname, '..', 'test', '_testFiles', 'sample.pdf')

// PDF to images
const res = await pdfToImages(filePdf)
console.log(res) // Files are generated on the file system, 1 file per page
```

## License

[The MIT License](./LICENSE)
