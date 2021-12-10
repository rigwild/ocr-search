import os from 'os'
import fs from 'fs-extra'
import dirTree from 'directory-tree'
import { spawn, Pool, Worker } from 'threads'

import {
  getTree,
  loadProgress,
  Progress,
  saveProgress,
  ocr,
  ScanOptions,
  WorkerMethods,
  WorkerPool,
  isSupportedExtension,
  pdfToImages,
  isPdfAlreadyExtractedToImages,
  getPdfExtractedImages
} from './utils'

export { Progress, ScanOptions, ocr, pdfToImages }

let scannedFilesSinceLastSaveProgressCount = 0

/** Internal function */
export const visitDir = async (
  dir: dirTree.DirectoryTree,
  {
    progress,
    pool,
    words,
    shouldConsoleLog,
    progressFile,
    matchesLogFile,
    tesseractConfig
  }: { progress: Progress; pool: WorkerPool } & Pick<
    ScanOptions,
    'words' | 'shouldConsoleLog' | 'progressFile' | 'matchesLogFile' | 'tesseractConfig'
  >
) => {
  if (shouldConsoleLog) console.log(`🔍 Scan directory   ${dir.path}`)
  for (const child of dir.children!) {
    if (child.type === 'file')
      await visitFile(child, {
        progress,
        pool,
        words,
        shouldConsoleLog,
        progressFile,
        matchesLogFile: matchesLogFile,
        tesseractConfig
      })
    else
      await visitDir(child, {
        progress,
        pool,
        words,
        shouldConsoleLog,
        progressFile,
        matchesLogFile: matchesLogFile,
        tesseractConfig
      })
  }

  await pool.settled(true)
  if (progressFile) await saveProgress(progressFile, progress)

  // We do not mark directories as visited in case the user adds new files
  // in them in the future!
}

/** Internal function */
export const visitFile = async (
  file: dirTree.DirectoryTree,
  {
    progress,
    pool,
    words,
    shouldConsoleLog,
    progressFile,
    matchesLogFile,
    tesseractConfig
  }: { progress: Progress; pool: WorkerPool } & Pick<
    ScanOptions,
    'words' | 'shouldConsoleLog' | 'progressFile' | 'matchesLogFile' | 'tesseractConfig'
  >
) => {
  if (file.name === '.gitkeep') return

  if (!isSupportedExtension(file.extension!)) {
    if (shouldConsoleLog) console.log(`👽 Unsupported file ${file.path}`)
    // Mark as visited
    progress.visited.add(file.path)
    return
  }

  if (progress.visited.has(file.path)) {
    if (shouldConsoleLog) console.log(`⏩ Skip visited     ${file.path}`)
    return
  }

  // Convert PDF pages to images
  if (file.extension === '.pdf') {
    let images: Array<{ name: string; path: string }> = []

    if (!isPdfAlreadyExtractedToImages(file.path)) {
      images = await pdfToImages(file.path)
      if (shouldConsoleLog) console.log(`✨ Extracted PDF    ${file.path}`)
    } else {
      images = await getPdfExtractedImages(file.path)
      if (shouldConsoleLog) console.log(`📄 PDF is ready     ${file.path}`)
    }

    for (const image of images) {
      // Convert to directoryTree format
      const imageTreeFormat: dirTree.DirectoryTree = {
        name: image.name,
        path: image.path,
        size: -1,
        type: 'file',
        extension: '.png'
      }
      await visitFile(imageTreeFormat, {
        progress,
        pool,
        words,
        shouldConsoleLog,
        progressFile,
        matchesLogFile: matchesLogFile,
        tesseractConfig
      })
    }

    // Mark PDF as visited to not convert it again
    progress.visited.add(file.path)
    return
  }

  pool.queue(async ({ scanFile }: WorkerMethods) => {
    try {
      const scanRes = await scanFile(file, words, tesseractConfig)
      if (scanRes && scanRes.matches.length > 0) {
        let str = ''
        str += `\n✅ MATCH!           ${file.path}\n`
        str += `Words: ${scanRes.matches.join()}\n`
        str += `Text:\n${scanRes.text}\n`
        if (shouldConsoleLog) console.log(str)

        // Save in the matched Map
        progress.matched.set(file.path, scanRes)
        if (matchesLogFile) {
          await fs.promises.writeFile(matchesLogFile, `${str}\n----------------\n`, { flag: 'a' })
        }
      } else {
        if (shouldConsoleLog) console.log(`❌ No words matched ${file.path}`)
      }
    } catch (error: any) {
      if (shouldConsoleLog) {
        console.log('💥 ERROR! Scan fail ', file.path)
        console.error(error)
      }
      // FIXME: Should the error be bubbled up for programmatic usage?
    }

    // Mark as visited
    progress.visited.add(file.path)

    if (progressFile) {
      scannedFilesSinceLastSaveProgressCount++
      // Save progress every 5 scans
      if (progressFile && scannedFilesSinceLastSaveProgressCount > 5) {
        await saveProgress(progressFile, progress)
        scannedFilesSinceLastSaveProgressCount = 0
      }
    }
  })
}

export const scanDir = async (
  scannedDir: string,
  {
    words = ['MATCH_ALL'],
    shouldConsoleLog = false,
    matchesLogFile,
    workerPoolSize,
    tesseractConfig,
    progressFile
  }: ScanOptions = {}
) => {
  // Do not use all CPU cores as default, it makes the OCR process way slower!
  if (!workerPoolSize) workerPoolSize = os.cpus().length > 3 ? os.cpus().length - 2 : 1

  const pool: WorkerPool = Pool(() => spawn<WorkerMethods>(new Worker('./worker')), { size: workerPoolSize })
  const progress = await loadProgress(progressFile)
  const dir = await getTree(scannedDir)
  await visitDir(dir, {
    words,
    progress,
    pool,
    shouldConsoleLog,
    progressFile,
    matchesLogFile: matchesLogFile,
    tesseractConfig
  })

  await pool.terminate()

  return progress
}
