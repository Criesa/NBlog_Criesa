<template>
	<div class="ui padded attached segment m-padded-tb-large markdown-viewer" v-loading="loading" element-loading-text="正在加载 Markdown">
		<el-alert v-if="error" :title="error" type="error" show-icon :closable="false"/>
		<template v-else-if="!loading">
			<div class="markdown-header">
				<h2 class="ui header">{{ title }}</h2>
				<a :href="sourceUrl" target="_blank" rel="noopener noreferrer">查看 Markdown 原文件</a>
			</div>
			<div class="ui divider"></div>
			<div class="typo js-toc-content markdown-content match-braces rainbow-braces" v-viewer v-html="html"></div>
		</template>
	</div>
</template>

<script>
	import axios from 'axios'
	import {marked} from 'marked'
	import sanitizeHtml from 'sanitize-html'
	import {SET_IS_BLOG_RENDER_COMPLETE} from '@/store/mutations-types'

	export default {
		name: 'Markdown',
		data() {
			return {
				error: '',
				html: '',
				loading: true,
				sourceUrl: '',
				title: 'Markdown 阅读'
			}
		},
		computed: {
			webTitleSuffix() {
				return this.$store.state.siteInfo.webTitleSuffix || ''
			}
		},
		watch: {
			webTitleSuffix() {
				this.updateDocumentTitle()
			}
		},
		beforeRouteEnter(to, from, next) {
			next(vm => vm.$store.commit(SET_IS_BLOG_RENDER_COMPLETE, false))
		},
		beforeRouteLeave(to, from, next) {
			this.destroyTocbot()
			next()
		},
		beforeRouteUpdate(to, from, next) {
			this.destroyTocbot()
			this.$store.commit(SET_IS_BLOG_RENDER_COMPLETE, false)
			next()
			this.loadMarkdown(to)
		},
		created() {
			this.loadMarkdown()
		},
		methods: {
			getMarkdownPath(route = this.$route) {
				const path = route.params.pathMatch || ''
				const segments = path.split('/')
				if (!path || path.includes('\\') || path.includes('\0') || segments.some(segment => !segment || segment === '.' || segment === '..')) {
					throw new Error('Markdown 文件路径无效')
				}
				if (!segments[segments.length - 1].toLowerCase().endsWith('.md')) {
					throw new Error('只支持浏览 .md 文件')
				}
				return segments
			},
			getSourceUrl(segments) {
				return `/codex-images/${segments.map(segment => encodeURIComponent(segment)).join('/')}`
			},
			resolveContentUrl(url) {
				if (!url || url.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) {
					return url
				}
				const resolved = new URL(url, new URL(this.sourceUrl, window.location.origin))
				if (resolved.origin !== window.location.origin || !resolved.pathname.startsWith('/codex-images/')) {
					return '#'
				}
				return `${resolved.pathname}${resolved.search}${resolved.hash}`
			},
			renderMarkdown(markdown) {
				const renderer = new marked.Renderer()
				const originalLink = renderer.link.bind(renderer)
				const originalImage = renderer.image.bind(renderer)
				renderer.link = (href, title, text) => originalLink(this.resolveContentUrl(href), title, text)
				renderer.image = (href, title, text) => originalImage(this.resolveContentUrl(href), title, text)
				const rendered = marked.parse(markdown, {
					gfm: true,
					headerIds: true,
					mangle: false,
					renderer
				})
				return sanitizeHtml(rendered, {
					allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
					allowedAttributes: {
						'*': ['id'],
						a: ['href', 'name', 'target', 'rel'],
						code: ['class'],
						img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
						pre: ['class']
					},
					allowedSchemes: ['http', 'https', 'mailto'],
					transformTags: {
						a: (tagName, attribs) => ({
							tagName,
							attribs: Object.assign({}, attribs, {target: '_blank', rel: 'noopener noreferrer'})
						}),
						img: (tagName, attribs) => ({
							tagName,
							attribs: Object.assign({}, attribs, {loading: 'lazy'})
						})
					}
				})
			},
			getDocumentTitle(markdown, segments) {
				const heading = markdown.match(/^#\s+(.+)$/m)
				return heading ? heading[1].replace(/[*_`\[\]]/g, '').trim() : segments[segments.length - 1].replace(/\.md$/i, '')
			},
			async loadMarkdown(route = this.$route) {
				this.loading = true
				this.error = ''
				this.html = ''
				try {
					const segments = this.getMarkdownPath(route)
					this.sourceUrl = this.getSourceUrl(segments)
					const response = await axios.get(this.sourceUrl, {
						params: {_t: Date.now()},
						responseType: 'text',
						timeout: 10000,
						transformResponse: [data => data]
					})
					const markdown = typeof response.data === 'string' ? response.data : String(response.data)
					this.title = this.getDocumentTitle(markdown, segments)
					this.html = this.renderMarkdown(markdown)
					this.updateDocumentTitle()
				} catch (error) {
					this.error = error.response && error.response.status === 404 ? 'Markdown 文件不存在' : (error.message || 'Markdown 加载失败')
				} finally {
					this.loading = false
					this.$nextTick(() => {
						if (!this.error) {
							Prism.highlightAll()
							this.$store.commit(SET_IS_BLOG_RENDER_COMPLETE, true)
						}
					})
				}
			},
			destroyTocbot() {
				if (window.tocbot) {
					window.tocbot.destroy()
				}
			},
			updateDocumentTitle() {
				document.title = this.title + this.webTitleSuffix
			}
		}
	}
</script>

<style scoped>
	.markdown-viewer {
		min-height: 320px;
	}

	.markdown-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.markdown-header .header {
		margin: 0;
	}

	.markdown-content {
		padding: 0.5rem 0;
		overflow-wrap: anywhere;
	}

	@media screen and (max-width: 767px) {
		.markdown-header {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
