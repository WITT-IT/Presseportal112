 Next.js 15.5.22
   - Local:        http://localhost:3000
   - Network:      http://0.0.0.0:3000
 ✓ Starting...
 ✓ Ready in 125ms
Directus nicht erreichbar: {
  errors: [
    {
      message: `You don't have permission to access collection "posts" or it does not exist. Queried in root.`,
      extensions: [Object]
    }
  ],
  response: Response {
    status: 403,
    statusText: 'Forbidden',
    headers: Headers {
      'alt-svc': 'h3=":443"; ma=2592000',
      'content-length': '263',
      'content-security-policy': "script-src 'self' 'unsafe-eval';worker-src 'self' blob:;child-src 'self' blob:;img-src 'self' data: blob: https://raw.githubusercontent.com https://avatars.githubusercontent.com;media-src 'self';connect-src 'self' https://* wss://*;default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';object-src 'none';script-src-attr 'none';style-src 'self' https: 'unsafe-inline'",
      'content-type': 'application/json; charset=utf-8',
      'cross-origin-opener-policy': 'same-origin-allow-popups',
      date: 'Mon, 27 Jul 2026 11:59:12 GMT',
      etag: 'W/"107-vTgsec7u2/w8lGe4UK41rH9GaiQ"',
      vary: 'Accept-Encoding',
      'x-powered-by': 'Directus'
    },
    body: ReadableStream { locked: true, state: 'closed', supportsBYOB: true },
    bodyUsed: true,
    ok: false,
    redirected: false,
    type: 'default',
    url: 'https://directus.witt-itsolutions.de/items/posts?fields=id&filter=%7B%22is_public%22%3A%7B%22_eq%22%3Atrue%7D%2C%22organization%22%3A%7B%22gewerk%22%3A%7B%22_eq%22%3A%22feuerwehr%22%7D%7D%7D&limit=-1'
  }
}
Login fehlgeschlagen: Error: Invalid user credentials.
    at f (.next/server/chunks/193.js:1:17750)
    at async w (.next/server/app/api/auth/login/route.js:1:1130)
    at async k (.next/server/app/api/auth/login/route.js:1:4244)
    at async g (.next/server/app/api/auth/login/route.js:1:5247)
    at async C (.next/server/app/api/auth/login/route.js:1:6369) {
  status: 401
}
 ⨯ [Error: {"errors":[{"message":"You don't have permission to access collection \"posts\" or it does not exist. Queried in root.","extensions":{"reason":"You don't have permission to access collection \"posts\" or it does not exist. Queried in root.","code":"FORBIDDEN"}}],"response":{"url":"https://directus.witt-itsolutions.de/items/posts?fields=tags&filter=%7B%22is_public%22%3A%7B%22_eq%22%3Atrue%7D%7D&limit=-1"}}] {
  digest: '718960714'
}
 ⨯ [Error: {"errors":[{"message":"You don't have permission to access collection \"posts\" or it does not exist. Queried in root.","extensions":{"reason":"You don't have permission to access collection \"posts\" or it does not exist. Queried in root.","code":"FORBIDDEN"}}],"response":{"url":"https://directus.witt-itsolutions.de/items/posts?fields=tags&filter=%7B%22is_public%22%3A%7B%22_eq%22%3Atrue%7D%7D&limit=-1"}}] {
  digest: '718960714' 
