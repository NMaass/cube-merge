export async function onRequest(context: EventContext<unknown, string, unknown>) {
  const url = new URL(context.request.url)
  const targetPath = url.pathname.replace('/cubecobra', '')
  const targetUrl = `https://cubecobra.com${targetPath}${url.search}`

  const response = await fetch(targetUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'cube-merge/1.0',
    },
  })

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
