import { useEffect, useRef, useState } from 'react'

export function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null)
  const [error, setError] = useState('')
  const [stream, setStream] = useState(null)

  useEffect(() => {
    async function start() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        setStream(s)
        if (videoRef.current) {
          videoRef.current.srcObject = s
        }
      } catch (err) {
        console.error(err)
        setError('Could not access camera. Please ensure you have given permission.')
      }
    }
    start()

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const capture = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(videoRef.current, 0, 0)
    
    canvas.toBlob((blob) => {
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
      onCapture(file)
      close()
    }, 'image/jpeg', 0.8)
  }

  const close = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 text-white">
        <div className="text-lg font-semibold">Camera</div>
        <button onClick={close} className="rounded-full bg-white/20 p-2 hover:bg-white/30">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="relative flex flex-grow items-center justify-center overflow-hidden">
        {error ? (
          <div className="p-6 text-center text-white">{error}</div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="flex h-32 items-center justify-center bg-black/50 p-6">
        {!error && (
          <button
            onClick={capture}
            className="h-20 w-20 rounded-full border-4 border-white bg-transparent p-1 transition-transform active:scale-90"
          >
            <div className="h-full w-full rounded-full bg-white" />
          </button>
        )}
      </div>
    </div>
  )
}
