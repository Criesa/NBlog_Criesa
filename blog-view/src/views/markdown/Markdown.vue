<template>
	<div class="markdown-page">
		<main class="markdown-layout" :class="{'markdown-index-layout': mode === 'index'}">
			<section class="ui padded segment markdown-viewer" v-loading="loading" element-loading-text="正在加载 Markdown">
				<el-alert v-if="error" :title="error" type="error" show-icon :closable="false"/>
				<template v-else-if="!loading">
					<template v-if="mode === 'index'">
						<div class="markdown-index-header">
							<div>
								<h1>Markdown 文档</h1>
								<p>共 {{ documents.length }} 个文档</p>
							</div>
							<el-input v-model.trim="keyword" clearable prefix-icon="el-icon-search" placeholder="搜索文件名或路径"/>
						</div>
						<div class="markdown-file-list" v-if="filteredFiles.length">
							<router-link class="markdown-file" v-for="file in filteredFiles" :key="file.path" :to="getViewerUrl(file.path)">
								<div class="markdown-file-main">
									<i class="file alternate outline icon"></i>
									<div>
										<strong>{{ file.displayName }}</strong>
										<span>{{ file.path }}</span>
									</div>
								</div>
								<div class="markdown-file-version">
									<el-tag size="mini" type="info">{{ file.latestVersion }} / 共 {{ file.versionCount }} 个版本</el-tag>
									<time>{{ formatModifiedTime(file.mtime) }}</time>
								</div>
							</router-link>
						</div>
						<div class="markdown-empty" v-else>{{ keyword ? '没有找到匹配的 Markdown 文件' : '暂无已发布的 Markdown 文件' }}</div>
					</template>
					<template v-else>
						<div class="markdown-header">
							<h2 class="ui header">{{ title }}</h2>
							<div class="markdown-header-actions">
								<el-select v-if="documentVersions.length" v-model="currentVersionPath" size="small" @change="switchVersion">
									<el-option v-for="version in documentVersions" :key="version.path" :label="`${version.versionLabel} · ${formatModifiedTime(version.mtime)}`" :value="version.path"/>
								</el-select>
								<a :href="sourceUrl" target="_blank" rel="noopener noreferrer">查看 Markdown 原文件</a>
							</div>
						</div>
						<div class="ui divider"></div>
						<div class="typo js-toc-content markdown-content match-braces rainbow-braces" v-viewer v-html="html"></div>
					</template>
				</template>
			</section>
			<aside class="markdown-toc" v-if="mode === 'document' && !loading && !error">
				<Tocbot/>
			</aside>
		</main>
		<el-backtop style="box-shadow: none;background: none;z-index: 9999;">
			<img src="/img/paper-plane.png" alt="回到顶部" class="backtop-image">
		</el-backtop>
	</div>
</template>

<script>
	import axios from 'axios'
	import {marked} from 'marked'
	import sanitizeHtml from 'sanitize-html'
	import Tocbot from '@/components/sidebar/Tocbot'
	import {SET_IS_BLOG_RENDER_COMPLETE} from '@/store/mutations-types'

	export default {
		name: 'Markdown',
		components: {Tocbot},
		data() {
			return {
				currentVersionPath: '',
				documents: [],
				documentVersions: [],
				error: '',
				files: [],
				html: '',
				keyword: '',
				loading: true,
				mode: 'document',
				sourceUrl: '',
				title: 'Markdown 阅读'
			}
		},
		computed: {
			filteredFiles() {
				const keyword = this.keyword.toLowerCase()
				return keyword ? this.documents.filter(document => {
					return document.displayName.toLowerCase().includes(keyword) || document.versions.some(version => version.path.toLowerCase().includes(keyword))
				}) : this.documents
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
			this.loadRoute(to)
		},
		created() {
			this.loadRoute()
		},
		methods: {
			getMarkdownPath(route = this.$route) {
				const path = route.params.pathMatch || ''
				if (!path) {
					return []
				}
				const segments = path.split('/')
				if (path.includes('\\') || path.includes('\0') || segments.some(segment => !segment || segment === '.' || segment === '..')) {
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
			getViewerUrl(path) {
				return `/markdown/${path.split('/').map(segment => encodeURIComponent(segment)).join('/')}`
			},
			formatModifiedTime(value) {
				if (!value) {
					return ''
				}
				return new Intl.DateTimeFormat('zh-CN', {
					year: 'numeric',
					month: '2-digit',
					day: '2-digit'
				}).format(new Date(value))
			},
			getDocumentBaseName(name) {
				return name.replace(/\.md$/i, '').replace(/-[0-9a-f]{12}$/i, '')
			},
			buildVersionedDocuments(files) {
				const groups = new Map()
				files.forEach(file => {
					const baseName = this.getDocumentBaseName(file.name)
					const key = baseName.toLowerCase()
					if (!groups.has(key)) {
						groups.set(key, {baseName, versions: []})
					}
					groups.get(key).versions.push(file)
				})
				return Array.from(groups.values()).map(group => {
					const versions = group.versions
						.sort((left, right) => {
							const timeDifference = new Date(left.mtime).getTime() - new Date(right.mtime).getTime()
							return timeDifference || left.path.localeCompare(right.path, 'zh-CN')
						})
						.map((version, index) => Object.assign({}, version, {
							versionLabel: `v${index + 1}`,
							versionNumber: index + 1
						}))
					const latest = versions[versions.length - 1]
					return Object.assign({}, latest, {
						displayName: group.baseName,
						latestVersion: latest.versionLabel,
						versionCount: versions.length,
						versions
					})
				}).sort((left, right) => {
					const timeDifference = new Date(right.mtime).getTime() - new Date(left.mtime).getTime()
					return timeDifference || left.displayName.localeCompare(right.displayName, 'zh-CN')
				})
			},
			async getIndexFiles(segments = [], visited = {count: 0}) {
				visited.count += 1
				if (visited.count > 200) {
					throw new Error('Markdown 目录数量过多')
				}
				const basePath = segments.map(segment => encodeURIComponent(segment)).join('/')
				const response = await axios.get(`/markdown-index/${basePath}${basePath ? '/' : ''}`, {
					timeout: 10000,
					params: {_t: Date.now()}
				})
				const entries = Array.isArray(response.data) ? response.data : []
				const files = entries
					.filter(entry => entry.type === 'file' && entry.name.toLowerCase().endsWith('.md'))
					.map(entry => ({
						name: entry.name,
						path: segments.concat(entry.name).join('/'),
						mtime: entry.mtime
					}))
				const directories = entries.filter(entry => entry.type === 'directory')
				const nestedFiles = await Promise.all(directories.map(entry => this.getIndexFiles(segments.concat(entry.name), visited)))
				return files.concat(...nestedFiles)
			},
			async loadMarkdownIndex() {
				this.mode = 'index'
				this.title = 'Markdown 文档'
				this.sourceUrl = ''
				this.files = await this.getIndexFiles()
				this.documents = this.buildVersionedDocuments(this.files)
				this.updateDocumentTitle()
			},
			async loadDocumentVersions(currentPath) {
				const files = await this.getIndexFiles()
				const currentFileName = currentPath.split('/').pop()
				const currentKey = this.getDocumentBaseName(currentFileName).toLowerCase()
				const document = this.buildVersionedDocuments(files).find(item => item.displayName.toLowerCase() === currentKey)
				if (!document) {
					this.documentVersions = []
					this.currentVersionPath = ''
					return
				}
				this.documentVersions = document.versions.slice().reverse()
				this.currentVersionPath = currentPath
			},
			switchVersion(path) {
				const currentPath = this.$route.params.pathMatch || ''
				if (path && path !== currentPath) {
					this.$router.push(this.getViewerUrl(path))
				}
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
			async loadRoute(route = this.$route) {
				this.loading = true
				this.error = ''
				this.html = ''
				this.documentVersions = []
				this.currentVersionPath = ''
				try {
					const segments = this.getMarkdownPath(route)
					if (!segments.length) {
						await this.loadMarkdownIndex()
						return
					}
					this.mode = 'document'
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
					try {
						await this.loadDocumentVersions(segments.join('/'))
					} catch (versionError) {
						this.documentVersions = []
					}
					this.updateDocumentTitle()
				} catch (error) {
					this.error = error.response && error.response.status === 404 ? 'Markdown 文件不存在' : (error.message || 'Markdown 加载失败')
				} finally {
					this.loading = false
					this.$nextTick(() => {
						if (!this.error && this.mode === 'document') {
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
				document.title = this.title
			}
		}
	}
</script>

<style scoped>
	.markdown-page {
		min-height: 100vh;
		padding: 32px 24px 56px;
		background: #f5f7fa;
	}

	.markdown-layout {
		display: grid;
		grid-template-columns: minmax(0, 960px) 280px;
		align-items: start;
		justify-content: center;
		gap: 24px;
		max-width: 1280px;
		margin: 0 auto;
	}

	.markdown-index-layout {
		grid-template-columns: minmax(0, 960px);
	}

	.markdown-viewer {
		min-height: 320px;
		margin: 0 !important;
		border: 0 !important;
		border-radius: 8px !important;
		box-shadow: 0 2px 12px rgba(31, 45, 61, 0.08) !important;
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

	.markdown-header-actions {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-shrink: 0;
	}

	.markdown-header-actions .el-select {
		width: 150px;
	}

	.markdown-content {
		padding: 0.5rem 0;
		overflow-wrap: anywhere;
	}

	.markdown-index-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 32px;
		padding-bottom: 20px;
		border-bottom: 1px solid #ebeef5;
	}

	.markdown-index-header h1 {
		margin: 0 0 8px;
		font-size: 28px;
	}

	.markdown-index-header p {
		margin: 0;
		color: #909399;
	}

	.markdown-index-header .el-input {
		width: 320px;
	}

	.markdown-file-list {
		display: grid;
		gap: 1px;
		margin-top: 16px;
		background: #ebeef5;
		border: 1px solid #ebeef5;
		border-radius: 6px;
		overflow: hidden;
	}

	.markdown-file {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 15px 18px;
		background: #fff;
		color: #303133;
		transition: background 0.2s ease;
	}

	.markdown-file:hover {
		background: #f5f7fa;
		color: #409eff;
	}

	.markdown-file-main {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.markdown-file-main > i {
		margin-right: 14px;
		font-size: 22px;
		color: #909399;
	}

	.markdown-file-main strong,
	.markdown-file-main span {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.markdown-file-main span,
	.markdown-file time {
		margin-top: 4px;
		font-size: 13px;
		color: #909399;
	}

	.markdown-file-version {
		display: flex;
		align-items: flex-end;
		flex-direction: column;
		gap: 6px;
		flex-shrink: 0;
	}

	.markdown-empty {
		padding: 80px 20px;
		text-align: center;
		color: #909399;
	}

	.markdown-toc {
		position: sticky;
		top: 24px;
		min-width: 0;
	}

	.backtop-image {
		width: 40px;
		height: 40px;
	}

	@media screen and (max-width: 1024px) {
		.markdown-layout {
			grid-template-columns: minmax(0, 1fr);
		}

		.markdown-toc {
			position: static;
			grid-row: 1;
		}
	}

	@media screen and (max-width: 767px) {
		.markdown-page {
			padding: 12px 0 32px;
		}

		.markdown-viewer {
			border-radius: 0 !important;
		}

		.markdown-toc {
			padding: 0 12px;
		}

		.markdown-index-header {
			align-items: stretch;
			flex-direction: column;
			gap: 16px;
		}

		.markdown-index-header .el-input {
			width: 100%;
		}

		.markdown-file {
			align-items: flex-start;
			flex-direction: column;
			gap: 6px;
		}

		.markdown-file-version {
			align-items: flex-start;
		}

		.markdown-header {
			align-items: flex-start;
			flex-direction: column;
		}

		.markdown-header-actions {
			align-items: flex-start;
			flex-direction: column;
			width: 100%;
		}
	}
</style>
