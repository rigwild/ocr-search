/**
 * OCR Search - 🔍 Find files that contain some text with OCR
 * Copyright (C) 2021  rigwild <me@rigwild.dev> (https://github.com/rigwild)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

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
  words?: string[]

  /** Should the OCR scanned content of each file be saved to a txt file (e.g. "file.png.txt") */
  saveOcr?: boolean

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

  /** File extensions to ignore when looking for files (e.g. `new Set(['.pdf', '.jpg'])`) */
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

export type Progress = { visited: Set<string>; matched: Map<string, { text: string; matches: string[] }> }
export type ProgressJson = { visited: string[]; matched: { [path: string]: { text: string; matches: string[] } } }

/** @see https://github.com/tesseract-ocr/tesseract/blob/main/doc/tesseract.1.asc */
export type TesseractConfig = Parameters<typeof tesseractRecognize>[1]

export type WorkerMethods = { scanFile: typeof scanFile; pdfToImages: typeof pdfToImages }

export type WorkerPool = Pool<ModuleThread<WorkerMethods>>

export const cleanStr = (str: string) =>
  str
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export const logProgress = (visitedCount: number, totalFilesCount: number, str: string) => {
  const visitedCountPadded = visitedCount.toString().padStart(totalFilesCount.toString().length)
  console.log(`[${visitedCountPadded}/${totalFilesCount}] ${str}`)
}

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
export const pdfToImages = async (
  filePath: string,
  firstPage?: number,
  lastPage?: number
): Promise<Array<{ name: string; path: string }>> => {
  // pdftoppm -f 1 -l 5 -png file.pdf output-images-prefix
  const pageParams: string[] = []
  if (firstPage) pageParams.push('-f', `${firstPage}`)
  if (lastPage) pageParams.push('-l', `${lastPage}`)
  await execa('pdftoppm', [...pageParams, '-png', filePath, filePath])
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
  const text = !process.env.FAKE_OCR_TEXT ? await ocr(file.path, tesseractConfig) : process.env.FAKE_OCR_TEXT
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

export const getTreeFilesCount = (tree: dirTree.DirectoryTree) => {
  let count = 0
  if (tree.type === 'file') {
    count++
  } else if (tree.type === 'directory' && tree.children) {
    tree.children.forEach(x => (count += getTreeFilesCount(x)))
  }
  return count
}

export const getTree = async (scannedDir: string) => {
  if (!(await fs.pathExists(scannedDir))) throw new Error('File or directory not found')

  const tree = dirTree(scannedDir, { attributes: ['type', 'extension'] })

  // Convert all relative paths to absolute paths
  const relativeToAbsolute = (tree: dirTree.DirectoryTree) => {
    tree.path = path.resolve(tree.path)
    if (tree.type === 'directory' && tree.children) {
      tree.children.forEach(relativeToAbsolute)
    }
  }
  relativeToAbsolute(tree)

  return tree
}
