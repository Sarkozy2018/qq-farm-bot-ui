<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import api from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAccountStore } from '@/stores/account'
import { useToastStore } from '@/stores/toast'

const accountStore = useAccountStore()
const toastStore = useToastStore()

const { currentAccountId, accounts } = storeToRefs(accountStore)

const seeds = ref<any[]>([])
const stealCropBlacklist = ref<number[]>([])
const loading = ref(false)
const seedsLoading = ref(false)
const saving = ref(false)
const hasUnsavedChanges = ref(false)
const showTooltip = ref(false)

const currentAccountName = computed(() => {
  const acc = accounts.value.find((a: any) => a.id === currentAccountId.value)
  return acc ? (acc.nick || acc.name || acc.id) : null
})

const blacklistSeeds = computed(() => {
  if (!seeds.value) {
    return []
  }
  return seeds.value.filter(s => stealCropBlacklist.value.includes(s.seedId))
})

const nonBlacklistSeeds = computed(() => {
  if (!seeds.value) {
    return []
  }
  // 过滤非黑名单作物，并按价格升序排序
  return seeds.value
    .filter(s => !stealCropBlacklist.value.includes(s.seedId))
    .sort((a, b) => a.price - b.price)
})

async function fetchStealCropBlacklist() {
  if (!currentAccountId.value) {
    return
  }
  loading.value = true
  try {
    const { data } = await api.get('/api/steal-crop-blacklist', {
      headers: { 'x-account-id': currentAccountId.value },
    })
    if (data && data.ok) {
      stealCropBlacklist.value = data.data || []
    }
  }
  catch (e) {
    console.error('Failed to fetch steal crop blacklist:', e)
    toastStore.error('获取黑名单失败')
  }
  finally {
    loading.value = false
  }
}

async function loadSeeds() {
  if (!currentAccountId.value) {
    return
  }
  seedsLoading.value = true
  try {
    const { data } = await api.get('/api/analytics', {
      headers: { 'x-account-id': currentAccountId.value },
    })
    if (data && data.ok && Array.isArray(data.data)) {
      // analytics 返回的字段：level, seedPrice, image
      seeds.value = data.data.map((item: any) => ({
        seedId: item.seedId,
        name: item.name,
        requiredLevel: item.level || 0,
        price: item.fruitPrice || 0, // 使用单个果子的价格
        seedImage: item.image,
      }))
    }
  }
  catch (e) {
    console.error('Failed to fetch seeds from analytics:', e)
    toastStore.error('获取作物列表失败')
  }
  finally {
    seedsLoading.value = false
  }
}

async function toggleStealCrop(seedId: number) {
  if (!currentAccountId.value) {
    return
  }
  // 只更新本地状态，不立即保存
  const index = stealCropBlacklist.value.indexOf(seedId)
  if (index > -1) {
    stealCropBlacklist.value.splice(index, 1)
  }
  else {
    stealCropBlacklist.value.push(seedId)
  }
  hasUnsavedChanges.value = true
  toastStore.success('操作成功（需保存配置）')
}

async function saveBlacklist() {
  if (!currentAccountId.value) {
    return
  }
  saving.value = true
  try {
    // 一次性保存整个黑名单列表
    const { data } = await api.post('/api/steal-crop-blacklist/toggle', {
      seedIds: stealCropBlacklist.value,
    }, {
      headers: { 'x-account-id': currentAccountId.value },
    })
    if (data && data.ok) {
      stealCropBlacklist.value = data.data || []
      hasUnsavedChanges.value = false
      toastStore.success('黑名单配置已保存')
    }
    else {
      toastStore.error(data?.error || '保存失败')
    }
  }
  catch (e: any) {
    console.error('Failed to save blacklist:', e)
    toastStore.error('保存失败')
  }
  finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (currentAccountId.value) {
    await Promise.all([
      fetchStealCropBlacklist(),
      loadSeeds(),
    ])
  }
})

watch(currentAccountId, async () => {
  if (currentAccountId.value) {
    await Promise.all([
      fetchStealCropBlacklist(),
      loadSeeds(),
    ])
  }
})
</script>

<template>
  <div class="friend-patrol-page">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl text-gray-900 font-bold dark:text-gray-100">
        好友巡查
      </h1>
      <p v-if="currentAccountName" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        当前账户：{{ currentAccountName }}
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="loading && stealCropBlacklist.length === 0" class="py-12 text-center">
      <div class="i-svg-spinners-ring-resize mx-auto mb-4 text-3xl text-blue-500" />
      <p class="text-gray-500">加载中...</p>
    </div>

    <!-- No Account State -->
    <div v-else-if="!currentAccountId" class="py-12 text-center">
      <div class="rounded-full bg-gray-50 p-4 dark:bg-gray-700/50">
        <div class="i-carbon-user-settings text-4xl text-gray-400 dark:text-gray-500" />
      </div>
      <h3 class="mt-4 text-lg text-gray-900 font-medium dark:text-gray-100">
        需要登录账户
      </h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        请先登录账户以配置偷菜黑名单
      </p>
    </div>

    <!-- Crop Blacklist Section -->
    <div v-else class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <!-- Section Header -->
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <h2 class="text-lg text-gray-900 font-bold dark:text-gray-100">
            作物黑名单
          </h2>
          <div class="relative">
            <div
              class="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-blue-300 bg-blue-50 text-blue-600 transition-all hover:bg-blue-100 hover:shadow-sm dark:border-blue-600 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900"
              @mouseenter="showTooltip = true"
              @mouseleave="showTooltip = false"
              @click="showTooltip = !showTooltip"
            >
              <span class="text-xs font-bold leading-none">?</span>
            </div>
            <!-- Tooltip -->
            <div
              v-if="showTooltip"
              class="absolute left-6 top-0 z-10 w-80 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm shadow-lg dark:border-blue-900/50 dark:bg-blue-900/90"
              @mouseenter="showTooltip = true"
              @mouseleave="showTooltip = false"
            >
              <h4 class="mb-2 flex items-center gap-2 text-blue-900 font-medium dark:text-blue-100">
                <div class="i-carbon-information" />
                使用说明
              </h4>
              <ul class="space-y-1 text-blue-800 dark:text-blue-200">
                <li>• 左侧显示所有可用作物，右侧显示已加入黑名单的作物</li>
                <li>• 点击左侧作物可加入黑名单，点击右侧作物可移除</li>
                <li>• 点击右上角「保存配置」按钮保存当前配置</li>
                <li>• 黑名单配置按账号独立保存，互不影响</li>
                <li>• 自动偷取时会跳过黑名单中的作物</li>
                <li>• 手动偷取时也会过滤黑名单作物</li>
              </ul>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <BaseButton
            variant="primary"
            size="sm"
            :loading="saving"
            :disabled="!hasUnsavedChanges"
            @click="saveBlacklist"
          >
            保存配置
            <span v-if="hasUnsavedChanges" class="ml-1 inline-block h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
          </BaseButton>
          <span v-if="hasUnsavedChanges" class="text-xs text-orange-600 dark:text-orange-400">
            有未保存的更改
          </span>
        </div>
      </div>

      <!-- Content Grid -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- All Seeds List -->
        <div class="card flex flex-col rounded-lg bg-white shadow dark:bg-gray-800">
          <div class="border-b bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
            <h3 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
              <div class="i-carbon-list" />
              全部作物 ({{ nonBlacklistSeeds.length }})
            </h3>
          </div>
          <div class="flex-1 overflow-y-auto p-4" style="max-height: calc(100vh - 280px);">
            <div v-if="seedsLoading" class="py-8 text-center text-gray-500">
              <div class="i-svg-spinners-ring-resize mx-auto mb-2 text-2xl" />
              <p>正在加载作物列表...</p>
            </div>
            <div v-else-if="!seeds || seeds.length === 0" class="py-8 text-center text-gray-500">
              <div class="i-carbon-seed text-4xl opacity-50" />
              <p class="mt-2">暂无作物数据</p>
              <p class="text-sm mt-1">请检查账号是否已解锁农场功能</p>
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="seed in nonBlacklistSeeds"
                :key="seed.seedId"
                class="group flex cursor-pointer items-center justify-between rounded border border-gray-200 bg-gray-50 p-3 transition-all hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-700/50 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
                @click="toggleStealCrop(seed.seedId)"
              >
                <div class="flex items-center gap-3">
                  <img v-if="seed.seedImage" :src="seed.seedImage" :alt="seed.name" class="h-12 w-12 rounded object-cover" />
                  <div v-else class="flex h-12 w-12 items-center justify-center rounded bg-gray-200 dark:bg-gray-600">
                    <div class="i-carbon-image text-2xl text-gray-400" />
                  </div>
                  <div>
                    <div class="text-sm text-gray-900 font-medium dark:text-gray-100">
                      {{ seed.name }}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      Lv.{{ seed.requiredLevel }} · ¥{{ seed.price }}
                    </div>
                  </div>
                </div>
                <div class="opacity-0 text-xs text-blue-600 transition-opacity group-hover:opacity-100 dark:text-blue-400">
                  点击加入黑名单 →
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Blacklist -->
        <div class="card flex flex-col rounded-lg bg-white shadow dark:bg-gray-800">
          <div class="border-b bg-red-50/50 px-4 py-3 dark:border-red-900/30 dark:bg-red-900/20">
            <h3 class="flex items-center gap-2 text-base text-red-900 font-bold dark:text-red-100">
              <div class="i-carbon-warning-alt" />
              偷菜黑名单 ({{ blacklistSeeds.length }})
            </h3>
          </div>
          <div class="flex-1 overflow-y-auto p-4" style="max-height: calc(100vh - 280px);">
            <div v-if="blacklistSeeds.length === 0" class="py-12 text-center text-gray-500">
              <div class="mb-3 text-5xl">🚫</div>
              <p class="text-gray-700 font-medium dark:text-gray-300">暂无黑名单作物</p>
              <p class="mt-2 text-sm text-gray-400">
                点击左侧作物可加入黑名单<br />
                黑名单中的作物在自动偷取时会被跳过
              </p>
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="seed in blacklistSeeds"
                :key="seed.seedId"
                class="group flex cursor-pointer items-center justify-between rounded border border-red-200 bg-red-50 p-3 transition-all hover:border-red-300 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/20 dark:hover:border-red-700 dark:hover:bg-red-900/30"
                @click="toggleStealCrop(seed.seedId)"
              >
                <div class="flex items-center gap-3">
                  <img v-if="seed.seedImage" :src="seed.seedImage" :alt="seed.name" class="h-12 w-12 rounded object-cover" />
                  <div v-else class="flex h-12 w-12 items-center justify-center rounded bg-gray-200 dark:bg-gray-600">
                    <div class="i-carbon-image text-2xl text-gray-400" />
                  </div>
                  <div>
                    <div class="text-sm text-gray-900 font-medium dark:text-gray-100">
                      {{ seed.name }}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      Lv.{{ seed.requiredLevel }} · ¥{{ seed.price }}
                    </div>
                  </div>
                </div>
                <div class="opacity-0 text-xs text-red-600 transition-opacity group-hover:opacity-100 dark:text-red-400">
                  ← 点击移除
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="postcss">
.friend-patrol-page {
  @apply min-h-screen p-6;
}
</style>
