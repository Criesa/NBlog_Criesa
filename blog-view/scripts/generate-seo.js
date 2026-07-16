const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')

const distDir = path.resolve(__dirname, '../dist')
const indexPath = path.join(distDir, 'index.html')
const apiBase = trimTrailingSlash(process.env.SEO_API_BASE || 'https://api.criesa.cn/blog')
const siteUrl = trimTrailingSlash(process.env.SEO_SITE_URL || 'https://criesa.cn')
const detailPath = String(process.env.SEO_DETAIL_PATH || 'seo/blog').replace(/^\/+|\/+$/g, '')

function trimTrailingSlash(value) {
	return value.replace(/\/+$/, '')
}

function escapeHtml(value) {
	return String(value == null ? '' : value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

function escapeXml(value) {
	return escapeHtml(value)
}

function plainText(value) {
	return String(value == null ? '' : value)
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/\s+/g, ' ')
		.trim()
}

function truncate(value, maxLength) {
	const chars = Array.from(value)
	return chars.length > maxLength ? `${chars.slice(0, maxLength - 1).join('')}…` : value
}

function requestJson(url, redirectCount = 0) {
	return new Promise((resolve, reject) => {
		const client = url.startsWith('https:') ? https : http
		const request = client.get(url, {
			headers: {
				Accept: 'application/json',
				'User-Agent': 'NBlog-SEO-Generator/1.0'
			}
		}, response => {
			if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
				response.resume()
				if (redirectCount >= 5) {
					reject(new Error(`Too many redirects while requesting ${url}`))
					return
				}
				resolve(requestJson(new URL(response.headers.location, url).toString(), redirectCount + 1))
				return
			}

			let body = ''
			response.setEncoding('utf8')
			response.on('data', chunk => {
				body += chunk
			})
			response.on('end', () => {
				if (response.statusCode < 200 || response.statusCode >= 300) {
					reject(new Error(`HTTP ${response.statusCode} while requesting ${url}`))
					return
				}
				try {
					resolve(JSON.parse(body))
				} catch (error) {
					reject(new Error(`Invalid JSON returned by ${url}: ${error.message}`))
				}
			})
		})
		request.setTimeout(20000, () => request.destroy(new Error(`Request timed out: ${url}`)))
		request.on('error', reject)
	})
}

function assertSuccessfulResponse(response, url) {
	if (!response || response.code !== 200 || !response.data) {
		throw new Error(`API request failed: ${url}${response && response.msg ? ` (${response.msg})` : ''}`)
	}
	return response.data
}

async function getPublicBlogs() {
	const blogs = []
	let pageNum = 1
	let totalPage = 1

	do {
		const url = `${apiBase}/blogs?pageNum=${pageNum}`
		const data = assertSuccessfulResponse(await requestJson(url), url)
		totalPage = data.totalPage || 1
		blogs.push(...(data.list || []).filter(blog => !blog.privacy && !blog.password))
		pageNum += 1
	} while (pageNum <= totalPage)

	return blogs
}

function createJsonLd(blog, summary, author, canonicalUrl) {
	return JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'BlogPosting',
		headline: blog.title,
		description: summary,
		datePublished: blog.createTime,
		dateModified: blog.updateTime || blog.createTime,
		author: {
			'@type': 'Person',
			name: author
		},
		mainEntityOfPage: canonicalUrl,
		articleSection: blog.category && blog.category.name,
		keywords: (blog.tags || []).map(tag => tag.name).join(',')
	}).replace(/</g, '\\u003c')
}

function createArticleHtml(blog, summary, author) {
	const category = blog.category && blog.category.name
	const tags = (blog.tags || []).map(tag => `<li>${escapeHtml(tag.name)}</li>`).join('')
	const published = blog.createTime ? new Date(blog.createTime).toISOString() : ''

	return `<main class="seo-article" data-seo-prerendered="true">
	<article itemscope itemtype="https://schema.org/BlogPosting">
		<header>
			<h1 itemprop="headline">${escapeHtml(blog.title)}</h1>
			<p>${category ? `<span itemprop="articleSection">${escapeHtml(category)}</span> · ` : ''}<time itemprop="datePublished" datetime="${escapeHtml(published)}">${escapeHtml(published.slice(0, 10))}</time></p>
			<p itemprop="description">${escapeHtml(summary)}</p>
		</header>
		<div itemprop="articleBody">${blog.content || ''}</div>
		${tags ? `<ul aria-label="文章标签">${tags}</ul>` : ''}
		<footer>作者：<span itemprop="author">${escapeHtml(author)}</span></footer>
	</article>
</main>`
}

function createPrerenderedPage(shell, blog, listItem, siteInfo, author) {
	const canonicalUrl = `${siteUrl}/blog/${blog.id}`
	const suffix = siteInfo.webTitleSuffix || ''
	const title = `${blog.title}${suffix}`
	const summary = truncate(plainText(listItem.description) || plainText(blog.content), 160)
	const jsonLd = createJsonLd(blog, summary, author, canonicalUrl)
	const articleHtml = createArticleHtml(blog, summary, author)
	const head = [
		`<title>${escapeHtml(title)}</title>`,
		`<meta name="description" content="${escapeHtml(summary)}">`,
		`<meta name="robots" content="index,follow,max-image-preview:large">`,
		`<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
		`<meta property="og:type" content="article">`,
		`<meta property="og:title" content="${escapeHtml(title)}">`,
		`<meta property="og:description" content="${escapeHtml(summary)}">`,
		`<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
		`<meta property="article:published_time" content="${escapeHtml(blog.createTime || '')}">`,
		`<meta property="article:modified_time" content="${escapeHtml(blog.updateTime || blog.createTime || '')}">`,
		`<script type="application/ld+json">${jsonLd}</script>`
	].join('\n\t')

	return shell
		.replace(/<title>[\s\S]*?<\/title>/i, head)
		.replace(/<div\s+id=(?:"app"|'app'|app)\s*><\/div>/i, `<div id="app">${articleHtml}</div>`)
}

function createSitemap(entries) {
	const urls = [
		{loc: `${siteUrl}/`, priority: '1.0'},
		{loc: `${siteUrl}/archives`, priority: '0.8'},
		...entries.map(entry => ({
			loc: `${siteUrl}/blog/${entry.id}`,
			lastmod: entry.updateTime || entry.createTime,
			priority: '0.7'
		}))
	]

	const body = urls.map(url => {
		const lastmod = url.lastmod ? `\n\t\t<lastmod>${escapeXml(new Date(url.lastmod).toISOString())}</lastmod>` : ''
		return `\t<url>\n\t\t<loc>${escapeXml(url.loc)}</loc>${lastmod}\n\t\t<priority>${url.priority}</priority>\n\t</url>`
	}).join('\n')

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

async function main() {
	if (!fs.existsSync(indexPath)) {
		throw new Error(`Build output not found: ${indexPath}. Run npm run build first.`)
	}

	const shell = fs.readFileSync(indexPath, 'utf8')
	const siteEndpoint = `${apiBase}/site`
	const siteData = assertSuccessfulResponse(await requestJson(siteEndpoint), siteEndpoint)
	const siteInfo = siteData.siteInfo || {}
	const author = (siteData.introduction && siteData.introduction.name) || 'Criesa'
	const list = await getPublicBlogs()
	const sitemapEntries = []

	for (const listItem of list) {
		const detailEndpoint = `${apiBase}/${detailPath}?id=${encodeURIComponent(listItem.id)}`
		const blog = assertSuccessfulResponse(await requestJson(detailEndpoint), detailEndpoint)
		if (blog.password) {
			continue
		}

		const outputDir = path.join(distDir, 'blog', String(blog.id))
		fs.mkdirSync(outputDir, {recursive: true})
		fs.writeFileSync(path.join(outputDir, 'index.html'), createPrerenderedPage(shell, blog, listItem, siteInfo, author), 'utf8')
		sitemapEntries.push(blog)
	}

	fs.writeFileSync(path.join(distDir, 'sitemap.xml'), createSitemap(sitemapEntries), 'utf8')
	fs.writeFileSync(path.join(distDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`, 'utf8')
	console.log(`Generated SEO pages for ${sitemapEntries.length} public articles.`)
}

main().catch(error => {
	console.error(`[SEO] ${error.message}`)
	process.exitCode = 1
})
