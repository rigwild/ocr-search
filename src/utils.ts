import fs from 'fs-extra'
import path from 'path'
import { recognize as tesseractRecognize } from 'node-tesseract-ocr'
import execa from 'execa'
import dirTree from 'directory-tree'
import type { ModuleThread, Pool } from 'threads'

export type ScanOptions = {
  /**
   * List of words to search (if one is matched, the file is matched)
   *
   * If not provided, every files will get matched (useful to do mass OCR and save the result)
   */
  words?: string[] | ['MATCH_ALL']

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
  matchesLogFile?: string

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

export type Progress = { visited: Set<string>; matched: Map<string, { text: string; matches: string[] }> }
export type ProgressJson = { visited: string[]; matched: { [path: string]: { text: string; matches: string[] } } }

/** @see https://github.com/tesseract-ocr/tesseract/blob/main/doc/tesseract.1.asc */
export type TesseractConfig = Parameters<typeof tesseractRecognize>[1]

export type WorkerMethods = { scanFile: typeof scanFile }

export type WorkerPool = Pool<ModuleThread<WorkerMethods>>

export const cleanStr = (str: string) =>
  str
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/**
 * @param filePath Path to the image to extract text from
 * @param tesseractConfig Tesseract configuration
 * @param shouldCleanStr Should the string be normalized (lowercase, accents removed, whitespace removed)
 * @returns Text content
 */
export const ocr = async (filePath: string, tesseractConfig: TesseractConfig = {}, shouldCleanStr = true) => {
  // Apply default options
  if (!tesseractConfig.lang) tesseractConfig.lang = 'eng'
  if (!tesseractConfig.oem) tesseractConfig.oem = 1
  // PSM 1 seems to output better result for rotated content
  if (!tesseractConfig.psm) tesseractConfig.psm = 1

  const text = await tesseractRecognize(filePath, tesseractConfig)
  return text
    .split('\n')
    .map(x => (shouldCleanStr ? cleanStr(x) : x))
    .filter(x => x)
    .join('\n')
}

/**
 * Does the file `file.pdf-1.png` exist?
 * @param filePath Path to the PDF file
 * @returns The PDF is already extracted
 */
export const isPdfAlreadyExtractedToImages = async (filePath: string) => {
  const fileName = path.basename(filePath)
  let files = await fs.readdir(path.dirname(filePath))
  return files.some(x => x === `${fileName}-1.png`)
}

/**
 * Given a PDF file, find its extracted pages images path
 * @param filePath Path to the PDF file
 * @returns Extracted pages path
 */
export const getPdfExtractedImages = async (filePath: string): Promise<Array<{ name: string; path: string }>> => {
  const fileName = path.basename(filePath)
  const files = await fs.readdir(path.dirname(filePath))
  return files
    .filter(x => x.startsWith(fileName) && x !== fileName)
    .map(x => ({ name: x, path: path.resolve(path.dirname(filePath), x) }))
}

/**
 * Extract all the pages of a PDF to PDF images
 *
 * @param filePath Path to the PDF to be converted
 * @returns List of generated output images path
 */
export const pdfToImages = async (filePath: string): Promise<Array<{ name: string; path: string }>> => {
  // pdftoppm -png file.pdf output-images-prefix
  await execa('pdftoppm', ['-png', filePath, filePath])
  return getPdfExtractedImages(filePath)
}

/**
 * Find all words that were matched in text
 *
 * If words is `['MATCH_ALL']`, it will just skip the search as it will match every files
 * @param input
 * @param words
 * @returns List of matched words
 */
export const findMatches = (input: string, words: ScanOptions['words']): string[] => {
  if (!words || (words.length === 1 && words[0] === 'MATCH_ALL')) {
    return ['MATCH_ALL']
  }
  return words.filter(word => input.includes(word))
}

export const isSupportedExtension = (ext: string) => ['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(ext)

export const scanFile = async (
  file: dirTree.DirectoryTree,
  words: ScanOptions['words'],
  tesseractConfig?: TesseractConfig
) => {
  const text = await ocr(file.path, tesseractConfig)
  const matches = findMatches(text, words)
  return { text, matches }
}

export const loadProgress = async (progressFile?: string): Promise<Progress> => {
  if (!progressFile || !(await fs.pathExists(progressFile))) {
    return { visited: new Set(), matched: new Map() }
  }

  const progressJson: ProgressJson = await fs.readJson(progressFile)
  return {
    visited: new Set(progressJson.visited),
    matched: new Map(Object.entries(progressJson.matched))
  }
}

export const saveProgress = async (progressFile: string, progress: Progress): Promise<void> => {
  const progressJson: ProgressJson = {
    visited: [...progress.visited],
    matched: Object.fromEntries([...progress.matched.entries()])
  }

  await fs.writeJson(progressFile, progressJson, { spaces: 2 })
}

export const getTree = async (scannedDir: string) => {
  if (!(await fs.pathExists(scannedDir))) throw new Error('Directory not found')
  return dirTree(scannedDir, { attributes: ['size', 'type', 'extension'] })
}
