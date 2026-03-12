<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useBagStore } from '@/stores/bag'
import { useStatusStore } from '@/stores/status'
import { useToastStore } from '@/stores/toast'

const accountStore = useAccountStore()
const bagStore = useBagStore()
const statusStore = useStatusStore()
const toastStore = useToastStore()

const { currentAccountId, currentAccount } = storeToRefs(accountStore)
const { items, itemsByType, loading: bagLoading, originItems } = storeToRefs(bagStore)
const { status, loading: statusLoading, error: statusError, realtimeConnected } = storeToRefs(statusStore)

const imageErrors = ref<Record<string | number, boolean>>({})
const activeTab = ref<'all' | 'seeds' | 'fruits' | 'superFruits' | 'others'>('all')
const selectedItems = ref<Map<number | string, any>>(new Map())
const isSelling = ref(false)

// 根据当前选中的标签页返回对应的物品
const displayItems = computed(() => {
  switch (activeTab.value) {
    case 'seeds':
      return itemsByType.value.seeds
    case 'fruits':
      return itemsByType.value.fruits
    case 'superFruits':
      return itemsByType.value.superFruits
    case 'others':
      return itemsByType.value.others
    default:
      return items.value
  }
})

const selectedCount = computed(() => selectedItems.value.size)

const totalSelectedValue = computed(() => {
  let total = 0
  selectedItems.value.forEach((item) => {
    const price = Number(item.price || 0)
    const count = Number(item.count || 0)
    total += price * count
  })
  return total
})

function toggleItemSelection(item: any) {
  const key = item.id
  if (selectedItems.value.has(key)) {
    selectedItems.value.delete(key)
  }
  else {
    selectedItems.value.set(key, item)
  }
}

function selectAll() {
  displayItems.value.forEach((item) => {
    selectedItems.value.set(item.id, item)
  })
}

function clearSelection() {
  selectedItems.value.clear()
}

async function handleSellSelected() {
  if (!currentAccountId.value || selectedItems.value.size === 0)
    return

  // 根据选中物品的 id匹配 originItems 中的原始物品
  const itemsToSell = []
  for (const selectedItem of selectedItems.value.values()) {
    const matchedOriginItems = originItems.value?.filter(
      originItem => originItem.id === selectedItem.id,
    )
    if (matchedOriginItems && matchedOriginItems.length > 0) {
      // 将所有匹配的原始物品都加入出售列表
      itemsToSell.push(...matchedOriginItems)
    }
  }

  isSelling.value = true
  try {
    const result = await bagStore.sellItems(currentAccountId.value, itemsToSell)
    if (result.ok) {
      toastStore.success(`成功出售 ${selectedItems.value.size} 种物品，获得 ${result.data?.gain || 0} 金币`)
      clearSelection()
      await loadBag()
    }
    else {
      toastStore.error(result.error || '出售失败')
    }
  }
  catch (e) {
    toastStore.error(e instanceof Error ? e.message : '出售失败')
  }
  finally {
    isSelling.value = false
  }
}

function getPriceClass(item: any) {
  const priceId = Number(item?.priceId || 0)
  if (priceId === 1005)
    return 'text-amber-400 dark:text-amber-300'
  if (priceId === 1002)
    return 'text-sky-400 dark:text-sky-300'
  return 'text-gray-400'
}

async function loadBag() {
  if (!currentAccountId.value)
    return

  const acc = currentAccount.value
  if (!acc)
    return

  if (!realtimeConnected.value)
    await statusStore.fetchStatus(currentAccountId.value)

  if (acc.running && status.value?.connection?.connected)
    await bagStore.fetchBag(currentAccountId.value)

  imageErrors.value = {}
}

onMounted(() => {
  loadBag()
})

watch(currentAccountId, () => {
  loadBag()
})

useIntervalFn(loadBag, 60000)
</script>

<template>
  <div class="space-y-4">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="flex items-center gap-2 text-2xl font-bold">
        <div class="i-carbon-inventory-management" />
        背包
      </h2>
      <div v-if="items.length" class="text-sm text-gray-500">
        共 {{ items.length }} 种物品
        <span v-if="itemsByType.seeds.length"> · 种子 {{ itemsByType.seeds.length }}</span>
        <span v-if="itemsByType.fruits.length"> · 果实 {{ itemsByType.fruits.length }}</span>
        <span v-if="itemsByType.superFruits.length"> · 超变果实 {{ itemsByType.superFruits.length }}</span>
        <span v-if="itemsByType.others.length"> · 其他 {{ itemsByType.others.length }}</span>
      </div>
    </div>

    <!-- 多选操作栏 -->
    <div v-if="selectedCount > 0" class="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-blue-700 dark:text-blue-300">
            已选择 {{ selectedCount }} 种物品
          </span>
          <span class="text-xs text-blue-600 dark:text-blue-400">
            总价值：{{ totalSelectedValue }} 金
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="clearSelection"
            class="px-3 py-1.5 text-xs font-medium rounded-md transition bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
          >
            取消选择
          </button>
          <button
            @click="handleSellSelected"
            :disabled="isSelling || selectedCount === 0"
            class="px-4 py-1.5 text-xs font-medium rounded-md transition bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isSelling ? '出售中...' : `出售 (${selectedCount})` }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="bagLoading || statusLoading" class="flex justify-center py-12">
      <div class="i-svg-spinners-90-ring-with-bg text-4xl text-blue-500" />
    </div>

    <div v-else-if="!currentAccountId" class="rounded-lg bg-white p-8 text-center text-gray-500 shadow dark:bg-gray-800">
      请选择账号后查看背包
    </div>

    <div v-else-if="statusError" class="border border-red-200 rounded-lg bg-red-50 p-8 text-center text-red-500 shadow dark:border-red-800 dark:bg-red-900/20">
      <div class="mb-2 text-lg font-bold">
        获取数据失败
      </div>
      <div class="text-sm">
        {{ statusError }}
      </div>
    </div>

    <div v-else-if="!status?.connection?.connected" class="flex flex-col items-center justify-center gap-4 rounded-lg bg-white p-12 text-center text-gray-500 shadow dark:bg-gray-800">
      <div class="i-carbon-connection-signal-off text-4xl text-gray-400" />
      <div>
        <div class="text-lg text-gray-700 font-medium dark:text-gray-300">
          账号未登录
        </div>
        <div class="mt-1 text-sm text-gray-400">
          请先运行账号或检查网络连接
        </div>
      </div>
    </div>

    <div v-else-if="items.length === 0" class="rounded-lg bg-white p-8 text-center text-gray-500 shadow dark:bg-gray-800">
      无可展示物品
    </div>

    <div v-else class="space-y-4">
      <!-- 分类标签页 -->
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-700">
        <div class="flex flex-wrap gap-2">
          <button
            @click="activeTab = 'all'"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition"
            :class="[
              activeTab === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
            ]"
          >
            全部 {{ items.length }}
          </button>
          <button
            @click="activeTab = 'seeds'"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition"
            :class="[
              activeTab === 'seeds'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
            ]"
          >
            种子 {{ itemsByType.seeds.length }}
          </button>
          <button
            @click="activeTab = 'fruits'"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition"
            :class="[
              activeTab === 'fruits'
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
            ]"
          >
            果实 {{ itemsByType.fruits.length }}
          </button>
          <button
            @click="activeTab = 'superFruits'"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition"
            :class="[
              activeTab === 'superFruits'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
            ]"
          >
            超变果实 {{ itemsByType.superFruits.length }}
          </button>
          <button
            @click="activeTab = 'others'"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition"
            :class="[
              activeTab === 'others'
                ? 'bg-gray-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
            ]"
          >
            其他 {{ itemsByType.others.length }}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="selectAll"
            class="px-3 py-1.5 text-xs font-medium rounded-md transition bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300"
          >
            全选
          </button>
          <button
            @click="clearSelection"
            class="px-3 py-1.5 text-xs font-medium rounded-md transition bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
          >
            取消全选
          </button>
        </div>
      </div>

      <!-- 物品网格 -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-5 md:grid-cols-4 sm:grid-cols-3 xl:grid-cols-6">
        <div
          v-for="item in displayItems"
          :key="item.id"
          @click="toggleItemSelection(item)"
          class="group relative flex flex-col items-center border rounded-lg p-3 transition cursor-pointer border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 hover:shadow-md"
          :class="[
            selectedItems.has(item.id)
              ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
              : 'border-gray-200 bg-white',
          ]"
        >
          <!-- 选择标记 -->
          <div
            class="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 transition"
            :class="[
              selectedItems.has(item.id)
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700',
            ]"
          >
            <div
              v-if="selectedItems.has(item.id)"
              class="i-carbon-checkmark text-sm"
            />
          </div>

          <div class="absolute right-2 top-2 text-xs text-gray-400 font-mono">
            #{{ item.id }}
          </div>

          <div
            class="thumb-wrap mb-2 mt-6 h-16 w-16 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-700/50"
            :data-fallback="(item.name || '物').slice(0, 1)"
          >
            <img
              v-if="item.image && !imageErrors[item.id]"
              :src="item.image"
              :alt="item.name"
              class="max-h-full max-w-full object-contain"
              loading="lazy"
              @error="imageErrors[item.id] = true"
            >
            <div v-else class="text-2xl text-gray-400 font-bold uppercase">
              {{ (item.name || '物').slice(0, 1) }}
            </div>
          </div>

          <div class="mb-1 w-full truncate px-2 text-center text-sm font-bold" :title="item.name">
            {{ item.name || `物品${item.id}` }}
          </div>

          <div class="mb-2 flex flex-col items-center gap-0.5 text-xs text-gray-400">
            <span v-if="item.uid">UID: {{ item.uid }}</span>
            <span>
              类型: {{ item.itemType || 0 }}
              <span v-if="item.level > 0"> · Lv{{ item.level }}</span>
              <span v-if="item.price > 0" :class="getPriceClass(item)"> · {{ item.price }}{{ item.priceUnit || '金' }}</span>
            </span>
          </div>

          <div class="mt-auto font-medium" :class="item.hoursText ? 'text-blue-500' : 'text-gray-600 dark:text-gray-300'">
            {{ item.hoursText || `x${item.count || 0}` }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.thumb-wrap.fallback img {
  display: none;
}

.thumb-wrap.fallback::after {
  content: attr(data-fallback);
  font-size: 1.5rem;
  font-weight: bold;
  color: #9ca3af;
  text-transform: uppercase;
}
</style>
