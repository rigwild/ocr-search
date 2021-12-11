import os from 'os'
import fs from 'fs-extra'
import dirTree from 'directory-tree'
import { spawn, Pool, Worker } from 'threads'

import {
  getTree,
  loadProgress,
  logProgress,
  Progress,
  saveProgress,
  ocr,
  ScanOptions,
  WorkerMethods,
  WorkerPool,
  isSupportedExtension,
  pdfToImages,
  isPdfAlreadyExtractedToImages,
  getPdfExtractedImages,
  getTreeFilesCount
} from './utils'

export { Progress, ScanOptions, ocr, pdfToImages }

let scannedFilesSinceLastSaveProgressCount = 0
let visitedCount = 1
let totalFilesCount = 0

/** Internal function */
export const visitDir = async (
  dir: dirTree.DirectoryTree,
  progress: Progress,
  pool: WorkerPool,
  options: Omit<ScanOptions, 'workerPoolSize'>
) => {
  if (options.shouldConsoleLog)
    console.log(`${' '.repeat(totalFilesCount.toString().length * 2 + 3)} 🔍 Scan directory   ${dir.path}`)

  for (const child of dir.children!) {
    if (child.type === 'file') await visitFile(child, progress, pool, options)
    else if (child.type === 'directory') await visitDir(child, progress, pool, options)
  }

  await pool.settled(true)
  if (options.progressFile) await saveProgress(options.progressFile, progress)

  // We do not mark directories as visited in case the user adds new files
  // in them in the future!
}

/** Internal function */
export const visitFile = async (
  file: dirTree.DirectoryTree,
  progress: Progress,
  pool: WorkerPool,
  options: Omit<ScanOptions, 'workerPoolSize'>
) => {
  if (file.name === '.gitkeep') return

  if (options.ignoreExt?.has(file.extension!)) {
    if (options.shouldConsoleLog) logProgress(visitedCount, totalFilesCount, `☢️ Ignored .ext    ${file.path}`)
    return
  }

  if (!isSupportedExtension(file.extension!)) {
    if (options.shouldConsoleLog) logProgress(visitedCount, totalFilesCount, `👽 Unsupported file ${file.path}`)
    // Mark as visited
    progress.visited.add(file.path)
    visitedCount++
    return
  }

  if (progress.visited.has(file.path)) {
    if (options.shouldConsoleLog) logProgress(visitedCount, totalFilesCount, `⏩ Skip visited     ${file.path}`)
    visitedCount++
    return
  }

  // Convert PDF pages to images
  if (file.extension === '.pdf') {
    let images: Array<{ name: string; path: string }> = []

    let hasAlreadyExtractedPdf = false

    try {
      if (!(await isPdfAlreadyExtractedToImages(file.path))) {
        let first: number | undefined = undefined
        let last: number | undefined = undefined
        if (options.pdfExtractFirst) first = options.pdfExtractFirst
        if (options.pdfExtractLast) last = options.pdfExtractLast

        images = await pdfToImages(file.path, first, last)
        totalFilesCount += images.length

        if (options.shouldConsoleLog) logProgress(visitedCount, totalFilesCount, `✨ Extracted PDF    ${file.path}`)
      } else {
        images = await getPdfExtractedImages(file.path)
        hasAlreadyExtractedPdf = true

        if (options.shouldConsoleLog) logProgress(visitedCount, totalFilesCount, `📄 PDF is ready     ${file.path}`)
      }
    } catch (error: any) {
      {
        console.log('💥 ERROR! PDF FAIL! ', file.path)
        console.error(error)
      }
    }

    if (!hasAlreadyExtractedPdf) {
      for (const image of images) {
        // Convert to directoryTree format
        const imageTreeFormat: dirTree.DirectoryTree = {
          name: image.name,
          path: image.path,
          size: -1,
          type: 'file',
          extension: '.png'
        }
        await visitFile(imageTreeFormat, progress, pool, options)
      }
    }

    // Mark PDF as visited to not convert it again
    progress.visited.add(file.path)
    visitedCount++
    return
  }

  pool.queue(async ({ scanFile }: WorkerMethods) => {
    try {
      const scanRes = await scanFile(file, options.words, options.tesseractConfig)
      if (scanRes && scanRes.matches.length > 0) {
        let str = ''
        str += `✅ MATCH!           ${file.path}`

        if (options.shouldConsoleLog && !options.shouldConsoleLogMatches) {
          logProgress(visitedCount, totalFilesCount, str)
        }

        str += `\nWords: ${scanRes.matches.join()}\n`
        str += `Text:\n${scanRes.text}`

        if (options.shouldConsoleLog && options.shouldConsoleLogMatches) {
          logProgress(visitedCount, totalFilesCount, str)
        }

        // Save in the matched Map
        progress.matched.set(file.path, scanRes)
        if (options.matchesLogFile) {
          await fs.promises.writeFile(options.matchesLogFile, `${str}\n----------------\n`, { flag: 'a' })
        }
      } else {
        if (options.shouldConsoleLog) logProgress(visitedCount, totalFilesCount, `❌ No words matched ${file.path}`)
      }
    } catch (error: any) {
      {
        console.log('💥 ERROR! Scan fail ', file.path)
        console.error(error)
      }
      // FIXME: Should the error be bubbled up for programmatic usage?
    }

    // Mark as visited
    progress.visited.add(file.path)
    visitedCount++

    if (options.progressFile) {
      scannedFilesSinceLastSaveProgressCount++
      // Save progress every 5 scans
      if (options.progressFile && scannedFilesSinceLastSaveProgressCount > 5) {
        await saveProgress(options.progressFile, progress)
        scannedFilesSinceLastSaveProgressCount = 0
      }
    }
  })
}

export const scanDir = async (scannedDir: string, options: ScanOptions = {}) => {
  if (!options.words) options.words = ['MATCH_ALL']
  if (!options.shouldConsoleLog) options.shouldConsoleLog = false

  // Do not use all CPU cores as default, it makes the OCR process way slower!
  if (!options.workerPoolSize) options.workerPoolSize = os.cpus().length > 3 ? os.cpus().length - 2 : 1

  const pool: WorkerPool = Pool(() => spawn<WorkerMethods>(new Worker('./worker')), { size: options.workerPoolSize })
  const progress = await loadProgress(options.progressFile)

  const tree = await getTree(scannedDir)
  totalFilesCount = getTreeFilesCount(tree)

  if (tree.type === 'directory') await visitDir(tree, progress, pool, options)
  else if (tree.type === 'file') await visitFile(tree, progress, pool, options)

  await pool.terminate()

  return progress
}
