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

// @ts-check

/** @type {import('ava').TestFn} */
// @ts-ignore
const test = require('ava')
const path = require('path')
const fs = require('fs-extra')

const { scanDir, ocr, pdfToImages } = require('../dist')

const testFiles = path.resolve(__dirname, '_testFiles')
const tempFiles = path.resolve(__dirname, '_tempFiles')

const scannedDir = path.resolve(testFiles, 'scanned')
const rotatedDir = path.resolve(testFiles, 'rotated')

const avif = path.resolve(scannedDir, 'avif.avif')
const jpg = path.resolve(scannedDir, 'jpg.jpg')
const jxl = path.resolve(scannedDir, 'jxl.jxl')
const pdf = path.resolve(scannedDir, 'pdf.pdf')
const png = path.resolve(scannedDir, 'png.png')
const webp = path.resolve(scannedDir, 'webp.webp')
const wp2 = path.resolve(scannedDir, 'wp2.wp2')

const webp15 = path.resolve(rotatedDir, 'webp15.webp')
const webp45 = path.resolve(rotatedDir, 'webp45.webp')
const webp90 = path.resolve(rotatedDir, 'webp90.webp')
const webp135 = path.resolve(rotatedDir, 'webp135.webp')
const webp180 = path.resolve(rotatedDir, 'webp180.webp')
const webp225 = path.resolve(rotatedDir, 'webp225.webp')
const webp270 = path.resolve(rotatedDir, 'webp270.webp')
const webp315 = path.resolve(rotatedDir, 'webp315.webp')

const progressFile = path.resolve(tempFiles, 'progress.json')
const matchesLogFile = path.resolve(tempFiles, 'log.txt')

const pdfTemp = path.resolve(tempFiles, 'pdf.pdf')
const pdf2Temp = path.resolve(tempFiles, 'pdf2.pdf')

const expected = 'through a model of open collaboration, using a wiki-based editing system'

test('pdf extract all pages to png images', async t => {
  await fs.copyFile(pdf, pdfTemp)

  const res = await pdfToImages(pdfTemp)
  t.is(res[0].name, `${path.basename(pdfTemp)}-1.png`)
  t.is(res[1].name, `${path.basename(pdfTemp)}-2.png`)
  t.is(res[2].name, `${path.basename(pdfTemp)}-3.png`)
  t.is(res[3].name, `${path.basename(pdfTemp)}-4.png`)
  t.true(await fs.pathExists(`${pdfTemp}-1.png`))
  t.true(await fs.pathExists(`${pdfTemp}-2.png`))
  t.true(await fs.pathExists(`${pdfTemp}-3.png`))
  t.true(await fs.pathExists(`${pdfTemp}-4.png`))
})

test('pdf extract some pages to png images', async t => {
  await fs.copyFile(pdf, pdf2Temp)

  const res = await pdfToImages(pdf2Temp, 2, 3)
  t.is(res[0].name, `${path.basename(pdf2Temp)}-2.png`)
  t.is(res[1].name, `${path.basename(pdf2Temp)}-3.png`)
  t.false(await fs.pathExists(`${pdf2Temp}-1.png`))
  t.true(await fs.pathExists(`${pdf2Temp}-2.png`))
  t.true(await fs.pathExists(`${pdf2Temp}-3.png`))
  t.false(await fs.pathExists(`${pdf2Temp}-4.png`))
})

// --

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

test('ocr rotated text', async t => {
  t.timeout(25000)
  // t.log('webp15 ' + (await ocr(webp15)))
  // t.log('webp45 ' + (await ocr(webp45)))
  // t.log('webp90 ' + (await ocr(webp90)))
  // t.log('webp135 ' + (await ocr(webp135)))
  // t.log('webp180 ' + (await ocr(webp180)))
  // t.log('webp225 ' + (await ocr(webp225)))
  // t.log('webp270 ' + (await ocr(webp270)))
  // t.log('webp315 ' + (await ocr(webp315)))

  t.true((await ocr(webp90)).includes(expected))
  t.true((await ocr(webp180)).includes(expected))
  t.true((await ocr(webp270)).includes(expected))

  t.false((await ocr(webp15)).includes(expected))
  t.false((await ocr(webp45)).includes(expected))
  t.false((await ocr(webp135)).includes(expected))
  t.false((await ocr(webp225)).includes(expected))
  t.false((await ocr(webp315)).includes(expected))
})

// ---

test.serial('scanDir', async t => {
  t.timeout(25000)
  const res = await scanDir(scannedDir, { words: expected.split(' '), workerPoolSize: 2 })

  // All should be visited
  t.is(res.visited.size, 20)
  t.true(res.visited.has(jpg))
  t.true(res.visited.has(pdf))
  t.true(res.visited.has(`${pdf}-1.png`))
  t.true(res.visited.has(`${pdf}-2.png`))
  t.true(res.visited.has(`${pdf}-3.png`))
  t.true(res.visited.has(`${pdf}-4.png`))
  t.true(res.visited.has(png))
  t.true(res.visited.has(webp))
  t.true(res.visited.has(avif))
  t.true(res.visited.has(jxl))
  t.true(res.visited.has(wp2))

  t.true(res.visited.has(`${jpg}.ocr-content.txt`))
  t.false(res.visited.has(`${pdf}.ocr-content.txt`)) // Not generated!
  t.true(res.visited.has(`${pdf}-1.png.ocr-content.txt`))
  t.true(res.visited.has(`${pdf}-2.png.ocr-content.txt`))
  t.true(res.visited.has(`${pdf}-3.png.ocr-content.txt`))
  t.true(res.visited.has(`${pdf}-4.png.ocr-content.txt`))
  t.true(res.visited.has(`${png}.ocr-content.txt`))
  t.true(res.visited.has(`${webp}.ocr-content.txt`))
  t.false(res.visited.has(`${avif}.ocr-content.txt`))
  t.false(res.visited.has(`${jxl}.ocr-content.txt`))
  t.false(res.visited.has(`${wp2}.ocr-content.txt`))

  // Only supported should be matched
  t.true(res.matched.has(jpg))
  t.false(res.matched.has(pdf))
  t.true(res.visited.has(`${pdf}-1.png`))
  t.true(res.visited.has(`${pdf}-2.png`))
  t.true(res.visited.has(`${pdf}-3.png`))
  t.true(res.visited.has(`${pdf}-4.png`))
  t.true(res.matched.has(png))
  t.true(res.matched.has(webp))
  t.false(res.matched.has(avif))
  t.false(res.matched.has(jxl))
  t.false(res.matched.has(wp2))

  // All words should be matched
  t.deepEqual(res.matched.get(jpg).matches, expected.split(' '))
  t.deepEqual(res.matched.get(`${pdf}-1.png`).matches, expected.split(' '))
  t.deepEqual(res.matched.get(`${pdf}-2.png`).matches, expected.split(' '))
  t.deepEqual(res.matched.get(`${pdf}-3.png`).matches, expected.split(' '))
  t.deepEqual(res.matched.get(`${pdf}-4.png`).matches, expected.split(' '))
  t.deepEqual(res.matched.get(png).matches, expected.split(' '))
  t.deepEqual(res.matched.get(webp).matches, expected.split(' '))

  // Extracted content should be valid
  t.true(res.matched.get(jpg).text.includes(expected))
  t.true(res.matched.get(`${pdf}-1.png`).text.includes(expected))
  t.true(res.matched.get(`${pdf}-2.png`).text.includes(expected))
  t.true(res.matched.get(`${pdf}-3.png`).text.includes(expected))
  t.true(res.matched.get(`${pdf}-4.png`).text.includes(expected))
  t.true(res.matched.get(png).text.includes(expected))
  t.true(res.matched.get(webp).text.includes(expected))
})

test('scanDir with unmatched word should match nothing', async t => {
  process.env.FAKE_OCR_TEXT = expected
  const config = /** @type {Parameters<typeof scanDir>[1] & { fakeScan: { text: string; matches: string[] } }} */ ({
    words: ['hey random reader! 👋'],
    workerPoolSize: 2
  })
  const res = await scanDir(scannedDir, config)

  t.is(res.visited.size, 20)
  t.is(res.matched.size, 0)
})

test('scanDir with no words provided should match all', async t => {
  process.env.FAKE_OCR_TEXT = expected
  const res = await scanDir(scannedDir, {
    workerPoolSize: 2
  })

  t.is(res.visited.size, 20)
  t.is(res.matched.size, 8)
  ;[...res.matched.values()].forEach(x => t.deepEqual(x.matches, ['MATCH_ALL']))
})

test('scanDir should save progress, ocr-content .txt files and log file', async t => {
  process.env.FAKE_OCR_TEXT = expected
  await scanDir(scannedDir, {
    progressFile,
    matchesLogFile,
    saveOcr: true,
    workerPoolSize: 2
  })

  t.true(await fs.pathExists(progressFile))
  t.true(await fs.pathExists(matchesLogFile))

  const progress = /** @type {import('../dist/utils').ProgressJson} */ (await fs.readJSON(progressFile))

  t.is(progress.visited.length, 20)
  t.is(Object.keys(progress.matched).length, 8)
  Object.values(progress.matched).forEach(x => t.deepEqual(x.matches, ['MATCH_ALL']))
})

test('scanDir should ignore extensions', async t => {
  process.env.FAKE_OCR_TEXT = expected
  const res = await scanDir(scannedDir, {
    ignoreExt: new Set(['.pdf', '.jpg', '.webp']),
    workerPoolSize: 2
  })

  t.is(res.visited.size, 20)
  t.is(res.matched.size, 5)
  ;[...res.matched.values()].forEach(x => t.deepEqual(x.matches, ['MATCH_ALL']))
})

test.after(async () => {
  await fs.remove(progressFile)
  await fs.remove(matchesLogFile)

  await fs.remove(pdfTemp)
  await fs.remove(`${pdfTemp}-1.png`)
  await fs.remove(`${pdfTemp}-2.png`)
  await fs.remove(`${pdfTemp}-3.png`)
  await fs.remove(`${pdfTemp}-4.png`)

  await fs.remove(pdf2Temp)
  await fs.remove(`${pdf2Temp}-2.png`)
  await fs.remove(`${pdf2Temp}-3.png`)
})
