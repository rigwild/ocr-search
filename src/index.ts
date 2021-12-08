import os from 'os'
import fs from 'fs-extra'
import dirTree from 'directory-tree'
import { spawn, Pool, Worker } from 'threads'

import { getTree, loadProgress, Progress, saveProgress, ScanOptions, WorkerMethods, WorkerPool } from './utils'

export { Progress, ScanOptions }

/** Internal function */
export const visitDir = async (
  dir: dirTree.DirectoryTree,
  {
    progress,
    pool,
    words,
    progressFile,
    outputLogFile,
    tesseractConfig
  }: { progress: Progress; pool: WorkerPool } & Pick<
    ScanOptions,
    'words' | 'progressFile' | 'outputLogFile' | 'tesseractConfig'
  >
) => {
  console.log(`\n🔍 Look dir ${dir.path}`)
  for (const child of dir.children!) {
    if (child.type === 'file') visitFile(child, { progress, pool, words, outputLogFile, tesseractConfig })
    else await visitDir(child, { progress, pool, words, outputLogFile, tesseractConfig })
  }

  if (progressFile) {
    await pool.settled(true)
    await saveProgress(progressFile, progress)
  }

  // We do not mark directories as visited in case the user adds new files
  // to them in the future!
}

/** Internal function */
export const visitFile = (
  file: dirTree.DirectoryTree,
  {
    progress,
    pool,
    words,
    outputLogFile,
    tesseractConfig
  }: { progress: Progress; pool: WorkerPool } & Pick<ScanOptions, 'words' | 'outputLogFile' | 'tesseractConfig'>
) => {
  if (file.name === '.gitkeep') return

  if (progress.visited.has(file.path)) {
    console.log(`⏩ Skip     ${file.path}`)
    return
  }

  pool.queue(async ({ scanFile }: WorkerMethods) => {
    const scanRes = await scanFile(file, words, tesseractConfig)
    if (scanRes && scanRes.matches.length > 0) {
      let str = ''
      str += `\n✅ MATCH!   ${file.path}\n`
      str += `Words: ${scanRes.matches.join()}\n`
      str += `Text:\n${scanRes.text.join('\n')}\n`
      console.log(str)

      if (outputLogFile) {
        await fs.promises.writeFile(outputLogFile, `${str}\n----------------\n`, { flag: 'a' })
      }
    } else {
      console.log(`❌ No match ${file.path}`)
    }

    // Mark as visited
    progress.visited.add(file.path)
  })
}

export const scanDir = async (
  scannedDir: string,
  { words = ['MATCH_ALL'], progressFile, outputLogFile, workerPoolSize, tesseractConfig }: ScanOptions
) => {
  // Do not use all CPU cores as default, it makes the OCR process way slower!
  if (!workerPoolSize) workerPoolSize = os.cpus().length > 3 ? os.cpus().length - 2 : 1

  const pool: WorkerPool = Pool(() => spawn<WorkerMethods>(new Worker('./worker')), { size: workerPoolSize })
  const progress = await loadProgress(progressFile)

  const dir = await getTree(scannedDir)
  await visitDir(dir, { words, progress, pool, progressFile, outputLogFile, tesseractConfig })

  await pool.terminate()
}
