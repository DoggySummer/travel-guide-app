import { CATEGORY_TAG_CLASS } from '@/lib/categories'
import type { Category } from '@/lib/schema'

export function CategoryTag({ category }: { category: Category }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-label font-semibold ${CATEGORY_TAG_CLASS[category]}`}>
      {category}
    </span>
  )
}
