import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'メンズカタリ | メンズ医療・美容の総合メディア',
    short_name: 'メンズカタリ',
    description:
      'AGA・ED・脱毛・スキンケアなどメンズ医療・美容に関する正確な情報をお届けする総合メディア',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1a202c',
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
