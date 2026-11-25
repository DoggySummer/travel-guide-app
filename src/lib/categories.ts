import type { Category } from './schema'

export const CATEGORY_TAG_CLASS: Record<Category, string> = {
  랜드마크: 'bg-cat-landmark-bg text-cat-landmark-fg',
  음식점: 'bg-cat-food-bg text-cat-food-fg',
  숙소: 'bg-cat-stay-bg text-cat-stay-fg',
  이동: 'bg-cat-move-bg text-cat-move-fg',
  쇼핑: 'bg-cat-shop-bg text-cat-shop-fg',
  자연: 'bg-cat-nature-bg text-cat-nature-fg',
}

// Google Maps 마커·선은 Tailwind 클래스를 쓸 수 없어서 globals.css 토큰과 같은 값을 여기에만 둔다.
// 토큰을 바꾸면 이 값도 함께 바꾼다.
export const CATEGORY_PIN_COLOR: Record<Category, string> = {
  랜드마크: '#5b4e8c',
  음식점: '#b0664a',
  숙소: '#8a7a4e',
  이동: '#4a6e96',
  쇼핑: '#a85273',
  자연: '#4a7c5e',
}

export const ROUTE_COLOR = '#2b2a26'
