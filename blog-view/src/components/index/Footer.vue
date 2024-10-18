<template>
	<footer class="ui inverted vertical segment m-padded-tb-large m-opacity">
		<div class="ui center aligned container">
			<div class="ui inverted divided stackable grid">

				<div class="three wide column">
					<div class="ui link list">
						<h4 class="ui inverted header m-text-thin m-text-spaced">{{ siteInfo.footerImgTitle }}</h4>
						<div class="item">
							<img :src="siteInfo.footerImgUrl" class="ui rounded image" alt="" style="width: 100px">
						</div>
					</div>
				</div>

				<div class="six wide column">
					<h4 class="ui inverted header m-text-thin m-text-spaced">最新博客</h4>
					<div class="ui inverted link list">
						<a href="javascript:;" @click.prevent="toBlog(item)" v-for="item in newBlogList" :key="item.id" class="item m-text-thin m-padded-tb-small">{{ item.title }}</a>
					</div>
				</div>

				<div class="seven wide column">
					<p id="hitokotoText" class="m-text-thin m-text-spaced m-opacity-mini">{{ hitokoto.hitokoto }}</p>
					<p id="hitokotoFrom" class="m-text-thin m-text-spaced m-opacity-mini" style="float: right" v-text="hitokoto.from?`——《${hitokoto.from}》`:''"></p>
				</div>
			</div>

			<div class="ui inverted section divider"></div>

			<p class="m-text-thin m-text-spaced m-opacity-tiny">
				<span style="margin-right: 10px" v-if="siteInfo.copyright">{{ siteInfo.copyright.title }}</span>
				<router-link to="/" style="color:#ffe500" v-if="siteInfo.copyright">{{ siteInfo.copyright.siteName }}</router-link>
				<span style="margin: 0 15px" v-if="siteInfo.copyright && siteInfo.beian">|</span>
				<a rel="external nofollow noopener" href="https://beian.miit.gov.cn/" target="_blank" style="color:#ffe500">{{ siteInfo.beian }}</a>
				<span style="margin: 0 15px" v-if="siteInfo.copyright && siteInfo.beian">|</span>
				<span>本网站由
					<a href="https://www.upyun.com/?utm_source=lianmeng&utm_medium=referral" target="_blank">
						<img src="../../assets/img/又拍云_logo5.png" alt="又拍云" class="upyun">
					</a>提供CDN加速/云存储服务
				</span>
			</p>

			<div class="github-badge" v-for="(item,index) in badges" :key="index">
				<a rel="external nofollow noopener" :href="item.url" target="_blank" :title="item.title">
					<span class="badge-subject">{{ item.subject }}</span>
					<span class="badge-value" :class="`bg-${item.color}`">{{ item.value }}</span>
				</a>
			</div>

			<div style="margin-top: 10px;" v-if="siteInfo.siteLaunchDate">
				<p class="m-text-thin m-text-spaced m-opacity-tiny">
					本站已勉强运行: {{ uptime }}
				</p>
  			</div>

		</div>
	</footer>
</template>

<script>
	export default {
		name: "Footer",
		props: {
			siteInfo: {
				type: Object,
				required: true
			},
			badges: {
				type: Array,
				required: true
			},
			newBlogList: {
				type: Array,
				required: true
			},
			hitokoto: {
				type: Object,
				required: true
			}
		},
		data() {
			return {
				intervalId: null, // 用于存储 setInterval 的 ID
				uptime: '0天' // 初始化运行时间
			};
		},
		methods: {
			toBlog(blog) {
				this.$store.dispatch('goBlogPage', blog)
			},
			updateUptime() {
				const siteLaunchDate = new Date(this.siteInfo.siteLaunchDate);
				const now = new Date();
				const diff = now.getTime() - siteLaunchDate.getTime();
				const days = Math.floor(diff / (1000 * 60 * 60 * 24));
				const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
				const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
				const seconds = Math.floor((diff % (1000 * 60)) / 1000);
				this.uptime = `${days}天${hours}小时${minutes}分${seconds}秒`;
			},
		},
		mounted() {
			// 初始更新一次运行时间
			this.updateUptime();
			// 每秒更新一次时间
			this.intervalId = setInterval(this.updateUptime, 1000);
		},
		beforeUnmount() {
			// 清除定时器
			if (this.intervalId) {
				clearInterval(this.intervalId);
			}
		}
	};
</script>

<style scoped>
	@import "../../assets/css/badge.css";

	.github-badge a {
		color: #fff;
	}

	.upyun {
		height: 30px;
    	margin-bottom: -10px;
    	margin-right: 5px;
	}
</style>