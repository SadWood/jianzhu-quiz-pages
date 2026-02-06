import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEYS = {
  progress: 'quiz_progress_v1',
  records: 'quiz_records_v1',
  wrongbook: 'quiz_wrongbook_v1',
  prefs: 'quiz_prefs_v1'
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function loadLocal(key, fallback) {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  return safeJsonParse(raw, fallback)
}

function saveLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function shuffle(items) {
  const list = [...items]
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

function normalizeOptions(options) {
  const entries = Object.entries(options || {})
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => [String(key).toUpperCase(), String(value)])
    .sort((a, b) => a[0].localeCompare(b[0]))

  return Object.fromEntries(entries)
}

function normalizeFormulaText(text) {
  return String(text ?? '')
    .replace(/\\+lambda/gi, 'λ')
    .replace(/\\+mu/gi, 'μ')
    .replace(/\\+rho/gi, 'ρ')
    .replace(/\\+alpha/gi, 'α')
    .replace(/\\+beta/gi, 'β')
    .replace(/\\+gamma/gi, 'γ')
    .replace(/\\+times/gi, '×')
    .replace(/\\+cdot/gi, '·')
    .toLowerCase()
}

export const useQuizStore = defineStore('quiz', () => {
  const loading = ref(false)
  const error = ref('')

  const questionMap = ref({})
  const chapterIndex = ref([])

  const selectedSubject = ref('')
  const selectedChapter = ref('')
  const keyword = ref('')

  const randomOrder = ref(false)
  const onlyWrong = ref(false)

  const queue = ref([])
  const currentPos = ref(0)

  const selectedOption = ref('')
  const submitted = ref(false)
  const showImage = ref(false)

  const records = ref({})
  const wrongbook = ref([])
  const progress = ref({})

  const allQuestions = computed(() => Object.values(questionMap.value))

  const subjectOptions = computed(() => chapterIndex.value)

  const chapterOptions = computed(() => {
    const target = chapterIndex.value.find((item) => item.name === selectedSubject.value)
    return target ? target.chapters : []
  })

  const currentQuestion = computed(() => {
    if (!queue.value.length) return null
    const questionId = queue.value[currentPos.value]
    return questionMap.value[questionId] || null
  })

  const doneCount = computed(() => {
    return queue.value.filter((id) => Boolean(records.value[id])).length
  })

  const correctCount = computed(() => {
    return queue.value.filter((id) => records.value[id]?.correct === true).length
  })

  const wrongCount = computed(() => wrongbook.value.length)

  const progressRate = computed(() => {
    if (!queue.value.length) return 0
    return Math.round((doneCount.value / queue.value.length) * 100)
  })

  const accuracyRate = computed(() => {
    if (!doneCount.value) return 0
    return Math.round((correctCount.value / doneCount.value) * 100)
  })

  const canSubmit = computed(() => Boolean(currentQuestion.value) && Boolean(selectedOption.value) && !submitted.value)
  const isLastQuestion = computed(() => currentPos.value >= queue.value.length - 1)

  function persistAll() {
    saveLocal(STORAGE_KEYS.records, records.value)
    saveLocal(STORAGE_KEYS.wrongbook, wrongbook.value)
    saveLocal(STORAGE_KEYS.progress, progress.value)
    saveLocal(STORAGE_KEYS.prefs, {
      randomOrder: randomOrder.value,
      onlyWrong: onlyWrong.value,
      selectedSubject: selectedSubject.value,
      selectedChapter: selectedChapter.value,
      keyword: keyword.value
    })
  }

  function syncQuestionState() {
    showImage.value = false
    const q = currentQuestion.value
    if (!q) {
      selectedOption.value = ''
      submitted.value = false
      return
    }

    const record = records.value[q.id]
    if (record) {
      selectedOption.value = record.selected
      submitted.value = true
    } else {
      selectedOption.value = ''
      submitted.value = false
    }
  }

  function buildQueue() {
    if (!selectedSubject.value || !selectedChapter.value) {
      queue.value = []
      currentPos.value = 0
      syncQuestionState()
      return
    }

    const keywordText = keyword.value.trim()
    const normalizedKeyword = normalizeFormulaText(keywordText)

    let list = allQuestions.value
      .filter((item) => item.subject === selectedSubject.value && item.chapter === selectedChapter.value)
      .filter((item) => {
        if (!keywordText) return true
        if (normalizeFormulaText(item.question).includes(normalizedKeyword)) return true
        return Object.values(item.options).some((text) => normalizeFormulaText(text).includes(normalizedKeyword))
      })

    if (onlyWrong.value) {
      const wrongSet = new Set(wrongbook.value)
      list = list.filter((item) => wrongSet.has(item.id))
    }

    list.sort((a, b) => a.page - b.page)

    let ids = list.map((item) => item.id)
    if (randomOrder.value) {
      ids = shuffle(ids)
    }

    queue.value = ids

    const progressKey = `${selectedSubject.value}__${selectedChapter.value}__${onlyWrong.value ? 'wrong' : 'all'}__${randomOrder.value ? 'rand' : 'seq'}__${keywordText}`
    const cachedPos = progress.value[progressKey]

    currentPos.value = Number.isInteger(cachedPos) && cachedPos >= 0 && cachedPos < ids.length ? cachedPos : 0

    syncQuestionState()
    persistAll()
  }

  function saveProgress() {
    const key = `${selectedSubject.value}__${selectedChapter.value}__${onlyWrong.value ? 'wrong' : 'all'}__${randomOrder.value ? 'rand' : 'seq'}__${keyword.value.trim()}`
    progress.value[key] = currentPos.value
    persistAll()
  }

  function selectQuestionByIndex(index) {
    if (index < 0 || index >= queue.value.length) return
    currentPos.value = index
    syncQuestionState()
    saveProgress()
  }

  function nextQuestion() {
    if (!queue.value.length) return
    if (currentPos.value < queue.value.length - 1) {
      currentPos.value += 1
      syncQuestionState()
      saveProgress()
    }
  }

  function prevQuestion() {
    if (!queue.value.length) return
    if (currentPos.value > 0) {
      currentPos.value -= 1
      syncQuestionState()
      saveProgress()
    }
  }

  function submitAnswer() {
    const q = currentQuestion.value
    if (!q || !selectedOption.value || submitted.value) return false

    const selected = selectedOption.value.toUpperCase()
    const correct = selected === q.answer
    records.value[q.id] = {
      selected,
      correct,
      answeredAt: new Date().toISOString()
    }

    if (!correct) {
      if (!wrongbook.value.includes(q.id)) {
        wrongbook.value.push(q.id)
      }
    } else {
      wrongbook.value = wrongbook.value.filter((id) => id !== q.id)
    }

    submitted.value = true
    persistAll()
    return correct
  }

  function resetCurrentRecord() {
    const q = currentQuestion.value
    if (!q) return

    delete records.value[q.id]
    wrongbook.value = wrongbook.value.filter((id) => id !== q.id)
    selectedOption.value = ''
    submitted.value = false
    persistAll()
  }

  function toggleImage() {
    showImage.value = !showImage.value
  }

  function setSubject(subject) {
    selectedSubject.value = subject
    const chapterNames = chapterOptions.value.map((item) => item.name)
    if (!chapterNames.includes(selectedChapter.value)) {
      selectedChapter.value = chapterNames[0] || ''
    }
    buildQueue()
  }

  function setChapter(chapter) {
    selectedChapter.value = chapter
    buildQueue()
  }

  function setKeyword(text) {
    keyword.value = text
    buildQueue()
  }

  function setRandomOrder(value) {
    randomOrder.value = value
    buildQueue()
  }

  function setOnlyWrong(value) {
    onlyWrong.value = value
    buildQueue()
  }

  async function init() {
    loading.value = true
    error.value = ''

    try {
      records.value = loadLocal(STORAGE_KEYS.records, {})
      wrongbook.value = loadLocal(STORAGE_KEYS.wrongbook, [])
      progress.value = loadLocal(STORAGE_KEYS.progress, {})
      const prefs = loadLocal(STORAGE_KEYS.prefs, {})

      randomOrder.value = Boolean(prefs.randomOrder)
      onlyWrong.value = Boolean(prefs.onlyWrong)
      keyword.value = typeof prefs.keyword === 'string' ? prefs.keyword : ''

      const [bankRes, indexRes] = await Promise.all([
        fetch(`${import.meta.env.BASE_URL}data/question-bank.json`),
        fetch(`${import.meta.env.BASE_URL}data/chapter-index.json`)
      ])

      if (!bankRes.ok || !indexRes.ok) {
        throw new Error('题库文件加载失败')
      }

      const bankData = await bankRes.json()
      const indexData = await indexRes.json()

      const map = {}
      for (const item of bankData.questions || []) {
        map[item.id] = {
          ...item,
          options: normalizeOptions(item.options)
        }
      }

      questionMap.value = map
      chapterIndex.value = indexData.subjects || []

      if (!selectedSubject.value) {
        selectedSubject.value = prefs.selectedSubject || chapterIndex.value[0]?.name || ''
      }

      const chapterNames = chapterOptions.value.map((item) => item.name)
      selectedChapter.value = chapterNames.includes(prefs.selectedChapter)
        ? prefs.selectedChapter
        : chapterNames[0] || ''

      buildQueue()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化失败'
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    subjectOptions,
    chapterOptions,
    selectedSubject,
    selectedChapter,
    keyword,
    randomOrder,
    onlyWrong,
    queue,
    currentPos,
    currentQuestion,
    selectedOption,
    submitted,
    showImage,
    doneCount,
    correctCount,
    wrongCount,
    progressRate,
    accuracyRate,
    canSubmit,
    isLastQuestion,
    init,
    setSubject,
    setChapter,
    setKeyword,
    setRandomOrder,
    setOnlyWrong,
    selectQuestionByIndex,
    nextQuestion,
    prevQuestion,
    submitAnswer,
    resetCurrentRecord,
    toggleImage
  }
})
