import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '@/api'

export const useBagStore = defineStore('bag', () => {
  const allItems = ref<any[]>([])
  const originItems = ref<Array<{ id: number, count: number, uid: number }>>([])
  const loading = ref(false)

  // 物品类型定义
  const ITEM_TYPES = {
    SEED: 5, // 种子
    FRUIT: 6, // 普通果实
    SUPER_FRUIT: 17, // 超变果实
  }

  const items = computed(() => {
    // Filter out hidden items (e.g. coins, coupons, exp which are shown in dashboard)
    const hiddenIds = new Set([1, 1001, 1002, 1101, 1011, 1012, 3001, 3002])
    return allItems.value.filter((it: any) => !hiddenIds.has(Number(it.id || 0)))
  })

  const dashboardItems = computed(() => {
    const targetIds = new Set([1011, 1012, 3001, 3002])
    return allItems.value.filter((it: any) => targetIds.has(Number(it.id || 0)))
  })

  // 按类型分类的物品
  const itemsByType = computed(() => {
    const grouped = {
      seeds: [] as any[], // 种子
      fruits: [] as any[], // 普通果�?
      superFruits: [] as any[], // 超变果实
      others: [] as any[], // 其他
    }

    items.value.forEach((item: any) => {
      const itemType = Number(item.itemType || 0)

      if (itemType === ITEM_TYPES.SEED) {
        grouped.seeds.push(item)
      }
      else if (itemType === ITEM_TYPES.FRUIT) {
        grouped.fruits.push(item)
      }
      else if (itemType === ITEM_TYPES.SUPER_FRUIT) {
        grouped.superFruits.push(item)
      }
      else {
        grouped.others.push(item)
      }
    })

    return grouped
  })

  async function fetchBag(accountId: string) {
    if (!accountId)
      return
    loading.value = true
    try {
      const res = await api.get('/api/bag', {
        headers: { 'x-account-id': accountId },
      })
      if (res.data.ok && res.data.data) {
        allItems.value = Array.isArray(res.data.data.items) ? res.data.data.items : []
        originItems.value = Array.isArray(res.data.data.originItems) ? res.data.data.originItems : []
      }
    }
    catch (e) {
      console.error(e)
    }
    finally {
      loading.value = false
    }
  }

  async function sellItems(accountId: string, items: Array<{ id: number | string, count: number | string, uid?: number | string }>) {
    if (!accountId || !items || items.length === 0)
      return { ok: false, error: '参数无效' }

    try {
      const res = await api.post('/api/bag/sell', {
        items,
      }, {
        headers: { 'x-account-id': accountId },
      })
      return res.data
    }
    catch (e) {
      console.error(e)
      return { ok: false, error: e instanceof Error ? e.message : '出售失败' }
    }
  }

  async function useItems(accountId: string, items: Array<{ itemId?: number | string, id?: number | string, count?: number | string, uid?: number | string }>) {
    if (!accountId || !items || items.length === 0)
      return { ok: false, error: '参数无效' }

    try {
      const res = await api.post('/api/bag/use', {
        items,
      }, {
        headers: { 'x-account-id': accountId },
      })
      return res.data
    }
    catch (e) {
      console.error(e)
      return { ok: false, error: e instanceof Error ? e.message : '使用失败' }
    }
  }

  return { items, itemsByType, allItems, dashboardItems, originItems, loading, fetchBag, sellItems, useItems }
})
