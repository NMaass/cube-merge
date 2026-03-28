import { Helmet } from 'react-helmet-async'

interface DynamicSEOProps {
  title: string
  description: string
  canonical?: string
  ogImage?: string
  type?: 'website' | 'article'
  structuredData?: Record<string, any>
}

export function DynamicSEO({
  title,
  description,
  canonical,
  ogImage = "/favicon.svg",
  type = "website",
  structuredData
}: DynamicSEOProps) {
  const fullTitle = title.includes('Cube Merge') ? title : `${title} | Cube Merge`
  const currentUrl = canonical || (typeof window !== 'undefined' ? window.location.href : 'https://cube-merge.pages.dev/')

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={currentUrl} />
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:image" content={ogImage} />
      
      {/* Twitter */}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            ...structuredData
          }, null, 0)}
        </script>
      )}
    </Helmet>
  )
}
