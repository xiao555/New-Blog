const fs = require('fs')
const path = require('path')
const express = require('express')
const favicon = require('serve-favicon')
const compression = require('compression')
const HTMLStream = require('vue-ssr-html-stream')
const resolve = file => path.resolve(__dirname, file)

const isProd = process.env.NODE_ENV === 'production'
const serverInfo =
  `express/${require('express/package.json').version} ` +
  `vue-server-renderer/${require('vue-server-renderer/package.json').version}`

const app = express()

let renderer
let template
if (isProd) {
  // In production: create server renderer using server bundle and index HTML
  // template from real fs.
  // The server bundle is generated by vue-ssr-webpack-plugin.
  const bundle = require('./dist/vue-ssr-bundle.json')
  // src/index.template.html is processed by html-webpack-plugin to inject
  // build assets and output as dist/index.html.
  template = handleHtml(fs.readFileSync(resolve('./dist/index.html'), 'utf-8'))
  renderer = createRenderer(bundle)
} else {
  // In development: setup the dev server with watch and hot-reload,
  // and create a new renderer on bundle / index template update.
  require('./build/setup-dev-server')(app, (bundle, template) => {
    renderer = createRenderer(bundle)
    template = template
  })
}

function handleHtml(string) {
  const layoutSections = string.split('<div id="app"></div>')
  const preAppHTML = layoutSections[0]
  const postAppHTML = layoutSections[1]
  return preAppHTML + postAppHTML
  // return string
  // return {
  //   head: preAppHTML,
  //   tail: postAppHTML
  // }
}

function createRenderer (bundle) {
  // https://github.com/vuejs/vue/blob/dev/packages/vue-server-renderer/README.md#why-use-bundlerenderer
  return require('vue-server-renderer').createBundleRenderer(bundle, {
    cache: require('lru-cache')({
      max: 1000,
      maxAge: 1000 * 60 * 15
    })
  })
}

const serve = (path, cache) => express.static(resolve(path), {
  maxAge: cache && isProd ? 60 * 60 * 24 * 7 : 0
})

app.use(compression({ threshold: 0 }))
app.use(favicon('./public/header.jpg'))
app.use('/dist', serve('./dist', true))
// app.use('/static', serve('./dist/static', true))
app.use('/public', serve('./public', true))
// app.use('/style.css', serve('./dist/style.css', true))
// app.use('/manifest.json', serve('./manifest.json', true))
app.use('/service-worker.js', serve('./dist/service-worker.js'))

app.get('*', (req, res) => {
  if (!renderer) {
    return res.end('waiting for compilation... refresh in a moment.')
  }

  const s = Date.now()

  res.setHeader("Content-Type", "text/html")
  res.setHeader("Server", serverInfo)

  const errorHandler = err => {
    if (err && err.code === 404) {
      res.status(404).end('404 | Page Not Found')
    } else {
      // Render Error Page or Redirect
      res.status(500).end('500 | Internal Server Error')
      console.error(`error during render : ${req.url}`)
      console.error(err)
    }
  }
  const context = { url: req.url }
  renderer.renderToStream(context)
    .on('error', errorHandler)
    .once('data', () => {
      const { title, link, meta } = context.meta.inject()
      const titleText = title.text()
      const metaData = `${titleText}${meta.text()}${link.text()}`
      const chunk = template.replace('<title></title>', metaData)
    })
    .on('end', () => console.log(`whole request: ${Date.now() - s}ms`))
    .pipe(new HTMLStream({ context, template }))
    .pipe(res)
})

const port = process.env.PORT || 5050
app.listen(port, () => {
  console.log(`server started at localhost:${port}`)
})
