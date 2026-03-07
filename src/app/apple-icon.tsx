import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)',
          borderRadius: '24px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '80px',
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-3px',
            }}
          >
            MC
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
