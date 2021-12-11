#!/usr/bin/env node

// @ts-check

import fs from 'fs-extra'
import meow from 'meow'
import dirTree from 'directory-tree'

const cli = meow(
  `
  Usage
    $ ocr-search-clean-extracted <input_files>

  https://github.com/rigwild/bulk-files-ocr-search
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
