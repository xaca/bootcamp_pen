import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export function QrCode({ value, size = 180, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(value, { width: size, margin: 1 }).then((url) => !cancelled && setSrc(url))
    return () => {
      cancelled = true
    }
  }, [value, size])
  return src ? <img className="qr" src={src} width={size} height={size} alt={label} /> : null
}
