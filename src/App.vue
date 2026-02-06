<script setup>
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuizStore } from './stores/quiz'

const store = useQuizStore()

const {
  loading,
  error,
  subjectOptions,
  chapterOptions,
  selectedSubject,
  selectedChapter,
  keyword,
  randomOrder,
  onlyWrong,
  currentQuestion,
  currentPos,
  queue,
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
} = storeToRefs(store)

onMounted(() => {
  store.init()
})

const currentAnswer = computed(() => currentQuestion.value?.answer || '')

const questionImageUrl = computed(() => {
  const q = currentQuestion.value
  if (!q?.imagePath) return ''
  return `${import.meta.env.BASE_URL}${q.imagePath}`
})

const questionIndexText = computed(() => {
  if (!queue.value.length) return '0 / 0'
  return `${currentPos.value + 1} / ${queue.value.length}`
})

function handleSubmit() {
  store.submitAnswer()
}

function handleJump(index) {
  store.selectQuestionByIndex(index)
}

function formatDisplayText(text) {
  return String(text ?? '')
    .replace(/\\+lambda/gi, 'λ')
    .replace(/\\+mu/gi, 'μ')
    .replace(/\\+rho/gi, 'ρ')
    .replace(/\\+alpha/gi, 'α')
    .replace(/\\+beta/gi, 'β')
    .replace(/\\+gamma/gi, 'γ')
    .replace(/\\+times/gi, '×')
    .replace(/\\+cdot/gi, '·')
}
</script>

<template>
  <div class="min-h-screen p-3 md:p-5">
    <header
      class="mb-4 flex flex-col gap-3 rounded-2xl border-2 border-accent bg-[#fff9eff0] p-4 md:flex-row md:items-center md:justify-between"
    >
      <div>
        <p class="m-0 tracking-wide text-[#936530]">建筑考试速刷系统</p>
        <h1
          class="mt-1 text-3xl font-normal md:text-4xl"
          style="font-family: var(--font-display)"
        >
          建筑题库答题站
        </h1>
      </div>
      <div class="flex flex-wrap gap-2 text-sm text-[#f9f3e6]">
        <span class="rounded-full bg-main px-3 py-1"
          >进度 {{ progressRate }}%</span
        >
        <span class="rounded-full bg-main px-3 py-1"
          >正确率 {{ accuracyRate }}%</span
        >
        <span class="rounded-full bg-main px-3 py-1"
          >错题 {{ wrongCount }}</span
        >
      </div>
    </header>

    <main
      class="grid grid-cols-1 gap-3 xl:grid-cols-[260px_minmax(0,1fr)_260px]"
    >
      <aside
        class="rounded-2xl border border-[#c2a67b] bg-[#fffcf5eb] p-4 shadow-[0_8px_22px_rgba(90,63,33,0.10)]"
      >
        <h2 class="mb-3 text-lg font-semibold">练习设置</h2>

        <label class="mb-3 flex flex-col gap-1.5">
          <span>学科</span>
          <select
            class="w-full rounded-xl border border-[#bfa27a] bg-[#fffdf8] px-3 py-2"
            :value="selectedSubject"
            @change="store.setSubject($event.target.value)"
          >
            <option
              v-for="item in subjectOptions"
              :key="item.name"
              :value="item.name"
            >
              {{ item.name }}
            </option>
          </select>
        </label>

        <label class="mb-3 flex flex-col gap-1.5">
          <span>章节</span>
          <select
            class="w-full rounded-xl border border-[#bfa27a] bg-[#fffdf8] px-3 py-2"
            :value="selectedChapter"
            @change="store.setChapter($event.target.value)"
          >
            <option
              v-for="item in chapterOptions"
              :key="item.name"
              :value="item.name"
            >
              {{ item.name }}（{{ item.count }}题）
            </option>
          </select>
        </label>

        <label class="mb-3 flex flex-col gap-1.5">
          <span>关键词搜索</span>
          <input
            class="w-full rounded-xl border border-[#bfa27a] bg-[#fffdf8] px-3 py-2"
            :value="keyword"
            type="text"
            placeholder="输入题干关键词"
            @input="store.setKeyword($event.target.value)"
          />
        </label>

        <label class="mb-2 flex items-center gap-2">
          <input
            type="checkbox"
            :checked="randomOrder"
            @change="store.setRandomOrder($event.target.checked)"
          />
          <span>随机顺序</span>
        </label>

        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            :checked="onlyWrong"
            @change="store.setOnlyWrong($event.target.checked)"
          />
          <span>只刷错题</span>
        </label>
      </aside>

      <section
        class="rounded-2xl border border-[#c2a67b] bg-[#fffcf5eb] p-4 shadow-[0_8px_22px_rgba(90,63,33,0.10)]"
      >
        <div
          v-if="loading"
          class="rounded-xl border border-dashed border-[#bca27f] p-5 text-center"
        >
          题库加载中...
        </div>
        <div
          v-else-if="error"
          class="rounded-xl border border-[#d38a86] bg-[#fff6f4] p-5 text-center text-[#7a1a16]"
        >
          {{ error }}
        </div>
        <div
          v-else-if="!currentQuestion"
          class="rounded-xl border border-dashed border-[#bca27f] p-5 text-center"
        >
          当前筛选条件下暂无题目
        </div>

        <template v-else>
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="mb-1 text-sm text-[#91653a]">
                {{ currentQuestion.subject }} / {{ currentQuestion.chapter }}
              </p>
              <h2 class="text-lg leading-8 md:text-xl">
                {{ formatDisplayText(currentQuestion.question) }}
              </h2>
            </div>
            <span
              class="inline-flex h-8 min-w-[76px] items-center justify-center rounded-full bg-[#e0cfb4] px-3 font-bold"
            >
              {{ questionIndexText }}
            </span>
          </div>

          <ul class="mt-4 grid gap-2.5">
            <li v-for="(text, key) in currentQuestion.options" :key="key">
              <button
                class="flex w-full cursor-pointer items-start gap-2 rounded-xl border border-[#cfb996] bg-[#fffdf7] px-3 py-2.5 text-left transition hover:-translate-y-px hover:shadow-[0_8px_14px_rgba(85,63,37,0.12)] disabled:cursor-not-allowed disabled:opacity-80"
                :class="[
                  selectedOption === key
                    ? 'border-[#315f86] shadow-[inset_0_0_0_1px_#315f86]'
                    : '',
                  submitted && key === currentAnswer
                    ? 'border-[#288448] bg-[#ecf9f0]'
                    : '',
                  submitted && selectedOption === key && key !== currentAnswer
                    ? 'border-[#b02a24] bg-[#fff0ee]'
                    : '',
                ]"
                :disabled="submitted"
                @click="selectedOption = key"
              >
                <strong>{{ key }}.</strong>
                <span>{{ formatDisplayText(text) }}</span>
              </button>
            </li>
          </ul>

          <div class="mt-3 flex flex-wrap gap-2">
            <button
              class="cursor-pointer rounded-xl border border-main bg-linear-to-br from-[#2b5f84] to-[#17384f] px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canSubmit"
              @click="handleSubmit"
            >
              提交答案
            </button>
            <button
              class="cursor-pointer rounded-xl border border-[#b6996f] bg-[#fdf7eb] px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="currentPos === 0"
              @click="store.prevQuestion()"
            >
              上一题
            </button>
            <button
              class="cursor-pointer rounded-xl border border-[#b6996f] bg-[#fdf7eb] px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isLastQuestion"
              @click="store.nextQuestion()"
            >
              下一题
            </button>
            <button
              class="cursor-pointer rounded-xl border border-[#b6996f] bg-[#fdf7eb] px-3 py-2"
              @click="store.resetCurrentRecord()"
            >
              重做本题
            </button>
          </div>

          <div
            v-if="submitted"
            class="mt-3 rounded-xl p-3"
            :class="
              selectedOption === currentAnswer
                ? 'border border-[#64ad7d] bg-[#ebf9f0]'
                : 'border border-[#d87f7a] bg-[#fff1ef]'
            "
          >
            <p v-if="selectedOption === currentAnswer">回答正确</p>
            <p v-else>
              回答错误，你选择了 {{ selectedOption }}，正确答案是
              {{ currentAnswer }}
            </p>
          </div>

          <div v-if="currentQuestion.hasImage" class="mt-3">
            <button
              class="cursor-pointer rounded-xl border border-[#b6996f] bg-[#fdf7eb] px-3 py-2"
              @click="store.toggleImage()"
            >
              {{ showImage ? '隐藏题图' : '查看题图（可能含答案）' }}
            </button>
            <img
              v-if="showImage"
              class="mt-2 w-full rounded-xl border border-[#d7c5a8] bg-white"
              :src="questionImageUrl"
              alt="题目图片"
              loading="lazy"
            />
          </div>
        </template>
      </section>

      <aside
        class="rounded-2xl border border-[#c2a67b] bg-[#fffcf5eb] p-4 shadow-[0_8px_22px_rgba(90,63,33,0.10)]"
      >
        <h2 class="mb-3 text-lg font-semibold">学习统计</h2>
        <p class="mb-1">当前题组：{{ queue.length }} 题</p>
        <p class="mb-1">已完成：{{ doneCount }} 题</p>
        <p class="mb-1">答对：{{ correctCount }} 题</p>
        <p class="mb-1">错题本：{{ wrongCount }} 题</p>

        <div
          class="mt-3 grid max-h-[58vh] grid-cols-6 gap-1.5 overflow-auto pr-1 md:grid-cols-10 xl:grid-cols-5"
        >
          <button
            v-for="(id, index) in queue"
            :key="id"
            class="cursor-pointer rounded-lg border border-[#c8ae87] bg-[#fff8ea] px-0 py-1.5 text-xs"
            :class="
              index === currentPos ? 'border-main bg-main text-white' : ''
            "
            :title="`第${index + 1}题`"
            @click="handleJump(index)"
          >
            {{ index + 1 }}
          </button>
        </div>
      </aside>
    </main>
  </div>
</template>
