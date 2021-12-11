#!/usr/bin/env node

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

import fs from 'fs-extra'
import meow from 'meow'
import dirTree from 'directory-tree'

const cli = meow(
  `
  Usage
    $ ocr-search-clean <input_files>

  https://github.com/rigwild/ocr-search
`,
  {
    // @ts-ignore
    importMeta: import.meta,
    description: '🗑️ Find and remove all images from PDF pages extractions'
  }
)

/** @param {dirTree.DirectoryTree} tree */
const cleanExtractedRecursive = async tree => {
  if (tree.type === 'file' && tree.name.match(/^.+\.pdf-\d+\.png$/)) {
    await fs.remove(tree.path)
    console.log(`Removed ${tree.path}`)
  } else if (tree.type === 'directory' && tree.children) {
    for (const child of tree.children) {
      await cleanExtractedRecursive(child)
    }
  }
}

;(async () => {
  for (const input of cli.input) {
    const tree = dirTree(input, { attributes: ['type'] })
    await cleanExtractedRecursive(tree)
  }
})()
