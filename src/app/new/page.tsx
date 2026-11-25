'use client'

import dynamic from 'next/dynamic'

// 위저드는 sessionStorage에서 초안을 바로 읽으므로 서버 렌더링을 하지 않는다.
const Wizard = dynamic(() => import('@/features/wizard/Wizard'), { ssr: false })

export default function NewPlanPage() {
  return <Wizard />
}
