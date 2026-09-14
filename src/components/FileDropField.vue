<script setup lang="ts">
import { ref } from 'vue'
import { saveUploadedFile, type AssetKind } from '../lib/assetStore'

const props = withDefaults(
  defineProps<{
    kind: AssetKind
    fileName?: string
    /** 안내 문구 */
    hint?: string
    accept?: string
  }>(),
  {
    hint: '',
  },
)

const emit = defineEmits<{
  uploaded: [payload: { id: string; name: string }]
  cleared: []
}>()

const inputEl = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const busy = ref(false)
const error = ref('')

const acceptAttr =
  props.accept ||
  (props.kind === 'musicxml'
    ? '.musicxml,.xml,.mxl,application/xml,text/xml'
    : 'image/*,.png,.jpg,.jpeg,.webp,.gif,.svg')

const title =
  props.kind === 'musicxml' ? '악보 파일 올리기' : '이미지 올리기'
const defaultHint =
  props.hint ||
  (props.kind === 'musicxml'
    ? 'MusicXML / MXL 파일을 선택하거나 여기로 끌어다 놓으세요'
    : '이미지 파일을 선택하거나 여기로 끌어다 놓으세요')

function openPicker() {
  inputEl.value?.click()
}

async function handleFiles(files: FileList | File[] | null) {
  error.value = ''
  const file = files?.[0]
  if (!file) return
  busy.value = true
  try {
    const record = await saveUploadedFile(file, props.kind)
    emit('uploaded', { id: record.id, name: record.name })
  } catch (err) {
    error.value = err instanceof Error ? err.message : '업로드에 실패했습니다.'
  } finally {
    busy.value = false
    if (inputEl.value) inputEl.value.value = ''
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragging.value = false
  void handleFiles(e.dataTransfer?.files ?? null)
}

function clear() {
  error.value = ''
  emit('cleared')
}
</script>

<template>
  <div class="upload">
    <div
      class="drop"
      :class="{ dragging, hasFile: !!fileName, busy }"
      role="button"
      tabindex="0"
      @click="openPicker"
      @keydown.enter.prevent="openPicker"
      @keydown.space.prevent="openPicker"
      @dragenter.prevent="dragging = true"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop="onDrop"
    >
      <input
        ref="inputEl"
        class="sr-only"
        type="file"
        :accept="acceptAttr"
        @change="handleFiles(($event.target as HTMLInputElement).files)"
      />
      <template v-if="fileName">
        <p class="file-name">{{ fileName }}</p>
        <p class="sub">클릭하면 다른 파일로 바꿀 수 있습니다</p>
      </template>
      <template v-else>
        <p class="lead">{{ title }}</p>
        <p class="sub">{{ defaultHint }}</p>
        <span class="pick-btn">파일 선택</span>
      </template>
      <p v-if="busy" class="busy-label">올리는 중…</p>
    </div>
    <div v-if="fileName" class="actions">
      <button type="button" class="btn ghost" @click.stop="openPicker">다시 선택</button>
      <button type="button" class="btn ghost" @click.stop="clear">지우기</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.upload {
  display: grid;
  gap: 0.5rem;
}

.drop {
  position: relative;
  display: grid;
  gap: 0.35rem;
  justify-items: start;
  padding: 1rem 1.1rem;
  border: 1.5px dashed var(--line);
  border-radius: 0.65rem;
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.drop:hover,
.drop.dragging {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  background: color-mix(in srgb, var(--accent-soft) 55%, var(--surface));
}

.drop.hasFile {
  border-style: solid;
}

.drop.busy {
  opacity: 0.7;
  pointer-events: none;
}

.lead,
.file-name {
  margin: 0;
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--ink);
}

.sub {
  margin: 0;
  font-size: 0.82rem;
  color: var(--muted);
  line-height: 1.45;
}

.pick-btn {
  margin-top: 0.35rem;
  display: inline-flex;
  padding: 0.4rem 0.75rem;
  border-radius: 0.4rem;
  background: var(--ink);
  color: var(--bg);
  font-size: 0.85rem;
  font-weight: 600;
}

.busy-label {
  position: absolute;
  right: 0.85rem;
  top: 0.85rem;
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
}

.actions {
  display: flex;
  gap: 0.4rem;
}

.error {
  margin: 0;
  color: #a33;
  font-size: 0.85rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
