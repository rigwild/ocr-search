import fs from 'fs-extra'
import { recognize as tesseractRecognize } from 'node-tesseract-ocr'
import dirTree from 'directory-tree'

import type { ModuleThread, Pool } from 'threads'

export type ScanOptions = {
  /**
   * List of words to search (if one is matched, the file is matched)
   * If not provided, every files will get matched (useful to do mass OCR and save the result)
   */
  words: string[] | ['MATCH_ALL']
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

export type Progress = { visited: Set<string> }

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

export const ocr = async (path: string, tesseractConfig: TesseractConfig = {}) => {
  // Apply default options
  if (!tesseractConfig.lang) tesseractConfig.lang = 'eng'
  if (!tesseractConfig.oem) tesseractConfig.oem = 1
  if (!tesseractConfig.psm) tesseractConfig.psm = 3

  const text = await tesseractRecognize(path, tesseractConfig)

  return text
    .split('\n')
    .map(cleanStr)
    .filter(x => x)
}

export const findMatches = (input: string[], words: ScanOptions['words']): string[] => {
  if (words.length === 1 && words[0] === 'MATCH_ALL') return ['MATCH_ALL']

  const matches = []
  for (const line of input) {
    for (const word of words) {
      if (line.includes(word)) matches.push(word)
    }
  }
  return matches
}

export const scanFile = async (
  file: dirTree.DirectoryTree,
  words: ScanOptions['words'],
  tesseractConfig?: TesseractConfig
) => {
  if (file.extension! !== '.jpg') return
  try {
    const text = await ocr(file.path, tesseractConfig)
    const matches = findMatches(text, words)
    return { text, matches }
  } catch (error: any) {
    console.log('----- ERROR!!!!!', file.name)
    console.error(error)
  }
}

export const loadProgress = async (progressFile?: string): Promise<Progress> => {
  if (!progressFile || !(await fs.pathExists(progressFile))) return { visited: new Set() }

  const progressJson: { visited: string[] } = await fs.readJson(progressFile)
  console.log('Progress')
  console.log(progressJson)
  // Convert JSON array to Set
  return {
    visited: new Set(progressJson.visited)
  }
}

export const saveProgress = async (progressFile: string, progress: Progress): Promise<void> => {
  // Convert Set to JSON array
  const progressJson: { [visitedDirName: string]: string[] } = {}
  Object.entries(progress).forEach(([k, v]) => (progressJson[k] = [...v]))
  await fs.writeJson(progressFile, progressJson, { spaces: 2 })
}

export const getTree = async (scannedDir: string) => {
  if (!(await fs.pathExists(scannedDir))) throw new Error('`data` directory not found')
  return dirTree(scannedDir, { attributes: ['size', 'type', 'extension'] })
}
