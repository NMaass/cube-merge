import { Helmet } from 'react-helmet-async'

interface StructuredDataProps {
  data: Record<string, any>
}

export function StructuredData({ data }: StructuredDataProps) {
  const structuredData = {
    '@context': 'https://schema.org',
    ...data
  }

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(structuredData, null, 0)}
      </script>
    </Helmet>
  )
}

export function WebApplicationStructuredData() {
  const data = {
    '@type': 'WebApplication',
    name: 'Cube Merge',
    description: 'Compare two MTG cube lists side by side, annotate card changes, and collaborate in real time with your playgroup.',
    url: 'https://cubediff.app/',
    applicationCategory: 'GameApplication',
    operatingSystem: 'Web Browser',
    browserRequirements: 'Requires JavaScript. Supports Chrome, Firefox, Safari, Edge.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    },
    creator: {
      '@type': 'Organization',
      name: 'Cube Merge'
    },
    featureList: [
      'Compare MTG cube lists side by side',
      'Real-time collaboration',
      'Card change annotations',
      'Visual diff highlighting',
      'Export comparison reports'
    ],
    screenshot: 'https://cubediff.app/favicon.svg'
  }

  return <StructuredData data={data} />
}
