import { useEffect, useState } from 'react'

export function checkIsWebView() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || navigator.vendor || window.opera || ''
  const isAndroidWV = /;\s*wv|Version\/.*Chrome/i.test(ua)
  const isIOSWV = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(ua)
  const isRN = Boolean(window.ReactNativeWebView)
  const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches || Boolean(window.navigator?.standalone)
  return Boolean(isAndroidWV || isIOSWV || isRN || isStandalone)
}

export function useDeviceType() {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false))
  const [isTablet, setIsTablet] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 768 && window.innerWidth <= 1024 : false))
  const [isWebView] = useState(() => checkIsWebView())

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      setIsMobile(w <= 768)
      setIsTablet(w > 768 && w <= 1024)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return { isMobile, isTablet, isDesktop: !isMobile && !isTablet, isWebView }
}

export function useIsMobile() {
  const { isMobile, isWebView } = useDeviceType()
  return isMobile || isWebView
}

