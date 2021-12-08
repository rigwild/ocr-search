import { expose } from 'threads/worker'
import { scanFile } from './utils'

expose({ scanFile })
