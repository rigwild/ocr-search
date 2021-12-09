// @ts-check

/** @type {import('ava').TestFn} */
// @ts-ignore
const test = require('ava')
const path = require('path')
const fs = require('fs-extra')

const { scanDir, ocr, pdfToImages } = require('../dist')

const testFiles = path.resolve(__dirname, '_testFiles')
const tempFiles = path.resolve(__dirname, '_tempFiles')

const avif = path.resolve(testFiles, 'avif.avif')
const jpg = path.resolve(testFiles, 'jpg.jpg')
const jxl = path.resolve(testFiles, 'jxl.jxl')
const pdf = path.resolve(testFiles, 'pdf.pdf')
const png = path.resolve(testFiles, 'png.png')
const webp = path.resolve(testFiles, 'webp.webp')
const wp2 = path.resolve(testFiles, 'wp2.wp2')

const jpg15 = path.resolve(testFiles, 'jpg15.jpg')
const jpg45 = path.resolve(testFiles, 'jpg45.jpg')
const jpg90 = path.resolve(testFiles, 'jpg90.jpg')
const jpg135 = path.resolve(testFiles, 'jpg135.jpg')
const jpg180 = path.resolve(testFiles, 'jpg180.jpg')
const jpg225 = path.resolve(testFiles, 'jpg225.jpg')
const jpg270 = path.resolve(testFiles, 'jpg270.jpg')
const jpg315 = path.resolve(testFiles, 'jpg315.jpg')

const progressFile = path.resolve(tempFiles, 'progress.json')
const outputLogFile = path.resolve(tempFiles, 'log.txt')
const pdfTemp = path.resolve(tempFiles, 'pdf.pdf')

const expected = 'in my customary seat and with as fair an imitation of'

test('pdf to images', async t => {
  await fs.copyFile(pdf, pdfTemp)

  const res = await pdfToImages(pdfTemp)
  t.is(res[0].name, `${path.basename(pdfTemp)}.1.jpg`)
  t.is(res[1].name, `${path.basename(pdfTemp)}.2.jpg`)
  t.true(await fs.pathExists(`${pdfTemp}.1.jpg`))
  t.true(await fs.pathExists(`${pdfTemp}.2.jpg`))
})

test('ocr avif is not supported', async t => {
  await t.throwsAsync(ocr(avif))
})

test('ocr jpg', async t => {
  t.true((await ocr(jpg)).includes(expected))
})

test('ocr jxl is not supported', async t => {
  await t.throwsAsync(ocr(jxl))
})

test('ocr png', async t => {
  t.true((await ocr(png)).includes(expected))
})

test('ocr webp', async t => {
  t.true((await ocr(webp)).includes(expected))
})

test('ocr wp2 is not supported', async t => {
  await t.throwsAsync(ocr(wp2))
})

test.only('ocr rotated text', async t => {
  t.timeout(25000)
  // t.log('jpg ' + (await ocr(jpg)))
  // t.log('jpg15 ' + (await ocr(jpg15)))
  // t.log('jpg45 ' + (await ocr(jpg45)))
  // t.log('jpg90 ' + (await ocr(jpg90)))
  // t.log('jpg135 ' + (await ocr(jpg135)))
  // t.log('jpg180 ' + (await ocr(jpg180)))
  // t.log('jpg225 ' + (await ocr(jpg225)))
  // t.log('jpg270 ' + (await ocr(jpg270)))
  // t.log('jpg315 ' + (await ocr(jpg315)))

  t.true((await ocr(jpg)).includes(expected))
  t.true((await ocr(jpg90)).includes(expected))
  t.true((await ocr(jpg180)).includes(expected))
  t.true((await ocr(jpg270)).includes(expected))

  t.false((await ocr(jpg15)).includes(expected))
  t.false((await ocr(jpg45)).includes(expected))
  t.false((await ocr(jpg135)).includes(expected))
  t.false((await ocr(jpg225)).includes(expected))
  t.false((await ocr(jpg315)).includes(expected))
})

// ---

test.serial('scanDir', async t => {
  t.timeout(25000)
  const res = await scanDir(testFiles, { words: expected.split(' '), workerPoolSize: 2 })

  // All should be visited

  t.is(res.visited.size, 9)

  t.true(res.visited.has(jpg))
  t.true(res.visited.has(pdf))
  t.true(res.visited.has(`${pdf}.1.jpg`))
  t.true(res.visited.has(`${pdf}.2.jpg`))
  t.true(res.visited.has(png))
  t.true(res.visited.has(webp))

  t.true(res.visited.has(avif))
  t.true(res.visited.has(jxl))
  t.true(res.visited.has(wp2))

  // --

  // Only supported should be matched

  t.true(res.matched.has(jpg))
  t.false(res.matched.has(pdf))
  t.true(res.visited.has(`${pdf}.1.jpg`))
  t.true(res.visited.has(`${pdf}.2.jpg`))
  t.true(res.matched.has(png))
  t.true(res.matched.has(webp))

  t.false(res.matched.has(avif))
  t.false(res.matched.has(jxl))
  t.false(res.matched.has(wp2))

  // --

  // All words should be matched

  t.deepEqual(res.matched.get(jpg).matches, expected.split(' '))
  t.deepEqual(res.matched.get(`${pdf}.1.jpg`).matches, expected.split(' '))
  t.deepEqual(res.matched.get(`${pdf}.2.jpg`).matches, expected.split(' '))
  t.deepEqual(res.matched.get(png).matches, expected.split(' '))
  t.deepEqual(res.matched.get(webp).matches, expected.split(' '))

  // Extracted content should be valid

  t.true(res.matched.get(jpg).text.includes(expected))
  t.true(res.matched.get(`${pdf}.1.jpg`).text.includes(expected))
  t.true(res.matched.get(`${pdf}.2.jpg`).text.includes(expected))
  t.true(res.matched.get(png).text.includes(expected))
  t.true(res.matched.get(webp).text.includes(expected))
})

test.serial('scanDir with unmatched word should not match anything', async t => {
  t.timeout(25000)
  const res = await scanDir(testFiles, { words: ['hey random reader! 👋'], workerPoolSize: 2 })
  t.is(res.visited.size, 9)
  t.is(res.matched.size, 0)
})

test.serial('scanDir with no words provided should match all', async t => {
  t.timeout(25000)
  const res = await scanDir(testFiles, { workerPoolSize: 2 })
  t.is(res.visited.size, 9)

  // Check words
  ;[...res.matched.values()].forEach(x => t.deepEqual(x.matches, ['MATCH_ALL']))
  // Check text
  t.true([...res.matched.values()].every(x => x.text.includes(expected)))
})

test.serial('scanDir should save progress and log file', async t => {
  t.timeout(25000)
  await scanDir(testFiles, { progressFile, outputLogFile, workerPoolSize: 2 })
  t.true(await fs.pathExists(progressFile))
  t.true(await fs.pathExists(outputLogFile))

  const progress = /** @type {import('../dist/utils').ProgressJson} */ (await fs.readJSON(progressFile))
  t.is(progress.visited.length, 9)

  // Check words
  Object.values(progress.matched).forEach(x => t.deepEqual(x.matches, ['MATCH_ALL']))
  // Check text
  t.true(Object.values(progress.matched).every(x => x.text.includes(expected)))
})

test.after(async () => {
  await fs.remove(progressFile)
  await fs.remove(outputLogFile)
  await fs.remove(pdfTemp)
  await fs.remove(`${pdfTemp}.1.jpg`)
  await fs.remove(`${pdfTemp}.2.jpg`)
})
