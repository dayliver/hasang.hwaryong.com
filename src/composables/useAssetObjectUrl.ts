import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { getAsset } from '../lib/assetStore'

/** IndexedDB 자산 → 화면용 object URL (자동 정리) */
export function useAssetObjectUrl(assetId: Ref<string | undefined | null>) {
  const url = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  let currentUrl: string | null = null

  function revoke() {
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl)
      currentUrl = null
    }
    url.value = null
  }

  async function load(id: string | null | undefined) {
    revoke()
    error.value = null
    if (!id) {
      loading.value = false
      return
    }
    loading.value = true
    try {
      const asset = await getAsset(id)
      if (!asset) {
        error.value = '올린 파일을 찾을 수 없습니다.'
        return
      }
      currentUrl = URL.createObjectURL(asset.blob)
      url.value = currentUrl
    } catch (err) {
      error.value = err instanceof Error ? err.message : '파일을 불러오지 못했습니다.'
    } finally {
      loading.value = false
    }
  }

  watch(assetId, (id) => void load(id), { immediate: true })

  onBeforeUnmount(() => revoke())

  return { url, loading, error }
}
