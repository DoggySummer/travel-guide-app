import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const paperlogy = localFont({
  src: [
    { path: './fonts/Paperlogy-4Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Paperlogy-6SemiBold.ttf', weight: '600', style: 'normal' },
    { path: './fonts/Paperlogy-7Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-paperlogy',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '여행 가이드',
  description: 'AI가 짜주는 내 여행 계획',
  icons: {
    icon: '/icons/favicon-32.png',
    apple: '/icons/apple-touch-icon-180.png',
  },
  appleWebApp: { capable: true, title: '여행 가이드', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fdfbf7',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={paperlogy.variable}>
      <body>
        <div className="mx-auto min-h-dvh w-full max-w-[560px]">{children}</div>
      </body>
    </html>
  )
}
