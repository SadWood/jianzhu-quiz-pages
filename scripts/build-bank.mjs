import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// OCR 题干里“图例”可能识别成“图列”，这里统一按图题处理。
const FIGURE_PATTERN = /如图|见图|如下图|图中|下列图|图示|图例|图列/

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const webDir = path.resolve(__dirname, '..')
const webPublicDir = path.join(webDir, 'public')
const dataDir = path.join(webPublicDir, 'data')
const publicOutputDir = path.join(webPublicDir, 'output')
const defaultOutputRoot = path.join(webDir, 'output')

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function listDirs(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true }))
}

function parsePageNumber(fileName) {
  const match = fileName.match(/page-(\d+)\.dpi100\.json$/)
  return match ? Number.parseInt(match[1], 10) : 0
}

function toPageId(fileName) {
  const match = fileName.match(/(page-\d+)\.dpi100\.json$/)
  return match ? match[1] : path.basename(fileName, '.json')
}

function isOptionEmpty(options) {
  if (!options || typeof options !== 'object') {
    return true
  }

  const entries = Object.entries(options)
  if (entries.length === 0) {
    return true
  }

  return entries.every(([, value]) => String(value ?? '').trim() === '')
}

async function copyIfExists(src, dest) {
  try {
    await fs.access(src)
    await ensureDir(path.dirname(dest))
    await fs.copyFile(src, dest)
    return true
  } catch {
    return false
  }
}

function getOutputRootFromArgs() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log('用法: bun scripts/build-bank.mjs [output路径] [--output 路径]')
    console.log(`默认路径: ${defaultOutputRoot}`)
    process.exit(0)
  }

  let customPath = ''
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]

    if (arg === '--output') {
      customPath = args[i + 1] || ''
      i += 1
      continue
    }

    if (arg.startsWith('--output=')) {
      customPath = arg.slice('--output='.length)
      continue
    }

    if (!arg.startsWith('-') && !customPath) {
      customPath = arg
    }
  }

  const target = customPath || defaultOutputRoot
  return path.isAbsolute(target) ? target : path.resolve(process.cwd(), target)
}

async function assertValidOutputRoot(outputRoot) {
  try {
    const stat = await fs.stat(outputRoot)
    if (!stat.isDirectory()) {
      throw new Error(`不是目录: ${outputRoot}`)
    }
  } catch {
    throw new Error(
      [
        `未找到可用 output 目录: ${outputRoot}`,
        `默认读取: ${defaultOutputRoot}`,
        '可通过参数指定路径，例如:',
        '  bun scripts/build-bank.mjs ../output',
        '  bun scripts/build-bank.mjs --output ../output'
      ].join('\n')
    )
  }
}

async function build(outputRoot) {
  await ensureDir(dataDir)
  await assertValidOutputRoot(outputRoot)

  const subjects = await listDirs(outputRoot)
  const questions = []
  const chapterIndex = []

  for (const subject of subjects) {
    const cacheSubjectDir = path.join(outputRoot, subject, 'cache')
    const imagesSubjectDir = path.join(outputRoot, subject, 'images')

    const chapters = await listDirs(cacheSubjectDir)
    const subjectNode = { name: subject, chapters: [] }

    for (const chapter of chapters) {
      const chapterCacheDir = path.join(cacheSubjectDir, chapter)
      const files = (await fs.readdir(chapterCacheDir))
        .filter((name) => name.endsWith('.dpi100.json'))
        .sort((a, b) => parsePageNumber(a) - parsePageNumber(b))

      let count = 0

      for (const fileName of files) {
        const filePath = path.join(chapterCacheDir, fileName)
        const raw = JSON.parse(await fs.readFile(filePath, 'utf-8'))
        if (!Array.isArray(raw) || raw.length === 0) {
          continue
        }

        const record = raw[0]
        const questionText = (record.题目 || '').trim()
        const options = record.选项 || {}
        const answer = (record.答案 || '').toString().trim().toUpperCase()

        const pageId = toPageId(fileName)
        const pageNumber = parsePageNumber(fileName)

        const relativeImagePath = path
          .join('output', subject, 'images', chapter, `${pageId}.png`)
          .replaceAll(path.sep, '/')
        const sourceImagePath = path.join(imagesSubjectDir, chapter, `${pageId}.png`)
        const targetImagePath = path.join(publicOutputDir, subject, 'images', chapter, `${pageId}.png`)

        let hasImage = false
        let imagePath = null

        const shouldShowImageButton = FIGURE_PATTERN.test(questionText) || isOptionEmpty(options)

        if (shouldShowImageButton) {
          const copied = await copyIfExists(sourceImagePath, targetImagePath)
          hasImage = copied
          imagePath = copied ? relativeImagePath : null
        }

        questions.push({
          id: `${subject}/${chapter}/${pageId}`,
          subject,
          chapter,
          page: pageNumber,
          question: questionText,
          options,
          answer,
          hasImage,
          imagePath
        })
        count += 1
      }

      subjectNode.chapters.push({
        name: chapter,
        count
      })
    }

    chapterIndex.push(subjectNode)
  }

  const bank = {
    version: 'v1',
    generatedAt: new Date().toISOString(),
    total: questions.length,
    questions
  }

  const index = {
    generatedAt: new Date().toISOString(),
    subjects: chapterIndex
  }

  await fs.writeFile(path.join(dataDir, 'question-bank.json'), JSON.stringify(bank, null, 2), 'utf-8')
  await fs.writeFile(path.join(dataDir, 'chapter-index.json'), JSON.stringify(index, null, 2), 'utf-8')

  console.log(`题库构建完成：${questions.length} 题（来源: ${outputRoot}）`)
}

const outputRoot = getOutputRootFromArgs()

build(outputRoot).catch((error) => {
  console.error('题库构建失败:', error)
  process.exit(1)
})
