<template>
	<!--文章目录-->
	<div class="ui segments m-toc toc-wrapper m-box">
		<div class="ui secondary segment">
			<i class="list ul icon"></i>本文目录
		</div>
		<div class="ui yellow segment">
			<div class="js-toc"></div>
		</div>
	</div>
</template>

<script>
	import {mapState} from 'vuex'

	export default {
		name: "Tocbot",
		data() {
			return {
				initialized: false,
				pendingActiveHref: ''
			}
		},
		computed: {
			...mapState(['isBlogRenderComplete'])
		},
		mounted() {
			// 有可能组件创建比较慢，文章渲染已经完成，watch的时候，isBlogRenderComplete已经是true，监听不到 isBlogRenderComplete 的改变，也就不会执行watch中的方法
			// 就需要在 mounted 中init
			if (window.document.querySelector('.js-toc-content')) {
				this.initTocbot()
			}
		},
		watch: {
			//文章渲染完成时，生成目录
			isBlogRenderComplete() {
				if (this.isBlogRenderComplete) {
					this.initTocbot()
				}
			}
		},
		beforeDestroy() {
			this.destroyTocbot()
		},
		methods: {
			initTocbot() {
				if (this.initialized || !window.tocbot || !window.document.querySelector('.js-toc') || !window.document.querySelector('.js-toc-content')) {
					return
				}

				window.tocbot.init({
					// Where to render the table of contents.
					tocSelector: '.js-toc',
					// Where to grab the headings to build the table of contents.
					contentSelector: '.js-toc-content',
					// Which headings to grab inside of the contentSelector element.
					headingSelector: 'h1,h2,h3,h4',
					// Element to add the positionFixedClass to.
					positionFixedSelector: '.m-toc',
					// Smooth scrolling enabled.
					scrollSmooth: true,
					// Smooth scroll duration.
					scrollSmoothDuration: 420,
					//到顶部导航条的距离
					scrollSmoothOffset: -55,
					// Headings offset between the headings and the top of the document (this is meant for minor adjustments).
					// Can also be used to account for scroll height discrepancies from the use of css scroll-padding-top
					headingsOffset: -18,
					// 目录靠近页面底部时，Tocbot 会受最大滚动距离影响而选中前面的标题。
					// 滚动结束后重新确认用户实际点击的目录项。
					onClick: this.handleTocClick,
					scrollEndCallback: this.handleTocScrollEnd
				})
				this.initialized = true
			},
			destroyTocbot() {
				if (this.initialized && window.tocbot) {
					window.tocbot.destroy()
				}
				this.initialized = false
				this.pendingActiveHref = ''
			},
			handleTocClick(event) {
				const link = event.target.closest('.toc-link')
				if (!link) {
					return
				}
				this.pendingActiveHref = link.getAttribute('href') || ''
				this.applyClickedActive()
			},
			handleTocScrollEnd() {
				this.applyClickedActive()
				this.pendingActiveHref = ''
			},
			applyClickedActive() {
				if (!this.pendingActiveHref) {
					return
				}

				const links = Array.from(window.document.querySelectorAll('.js-toc .toc-link'))
				const activeLink = links.find(link => link.getAttribute('href') === this.pendingActiveHref)
				if (!activeLink) {
					return
				}

				links.forEach(link => link.classList.remove('is-active-link'))
				window.document.querySelectorAll('.js-toc .toc-list-item').forEach(item => item.classList.remove('is-active-li'))
				window.document.querySelectorAll('.js-toc .toc-list.is-collapsible').forEach(list => list.classList.add('is-collapsed'))

				activeLink.classList.add('is-active-link')
				const activeItem = activeLink.closest('.toc-list-item')
				if (activeItem) {
					activeItem.classList.add('is-active-li')
					let parent = activeItem.parentElement
					while (parent && parent.closest('.js-toc')) {
						if (parent.classList.contains('toc-list')) {
							parent.classList.remove('is-collapsed')
						}
						parent = parent.parentElement
					}
				}

			}
		}
	}
</script>

<style>
	.m-toc {
		z-index: 10 !important;
	}

	.m-toc .toc {
		overflow-y: auto
	}

	.m-toc .toc > ul {
		overflow: hidden;
		position: relative
	}

	.m-toc .toc > ul li {
		list-style: none
	}

	.m-toc .toc-list {
		list-style-type: none;
		margin: 0;
		padding-left: 10px
	}

	.m-toc .toc-list li a {
		display: block;
		padding: 4px 0;
		font-weight: 300;
	}

	.m-toc .toc-list li a:hover {
		color: #fbbd08;
	}

	.m-toc a.toc-link {
		color: currentColor;
		height: 100%
	}

	.m-toc .is-collapsible {
		max-height: 1000px;
		overflow: hidden;
		transition: all 300ms ease-in-out
	}

	.m-toc .is-collapsed {
		max-height: 0
	}

	.m-toc.is-position-fixed {
		position: sticky !important;
		top: 60px
	}

	.m-toc .is-active-link {
		font-weight: 700;
		color: #fbbd08 !important;
	}

	.m-toc .toc-link::before {
		background-color: #EEE;
		content: ' ';
		display: inline-block;
		height: 0;
		left: 0;
		margin-top: -1px;
		position: absolute;
		width: 2px
	}

	.m-toc .is-active-link::before {
		background-color: #54BC4B
	}
</style>
