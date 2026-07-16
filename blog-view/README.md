# blog-view

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

构建结束后会从线上 API 拉取所有公开且无密码保护的文章，并生成：

- `dist/blog/{id}/index.html`：爬虫无需执行 JavaScript 即可读取的文章页
- `dist/sitemap.xml`：公开文章站点地图
- `dist/robots.txt`：爬虫规则及站点地图地址

默认使用 `https://api.criesa.cn/blog` 和 `https://criesa.cn`。其它环境可在构建前设置：

```bash
SEO_API_BASE=https://api.example.com/blog SEO_SITE_URL=https://example.com npm run build
```

部署时请先发布 `blog-api`，再构建 `blog-view`，因为生成器会调用新增的 `/seo/blog` 只读接口。该接口不会污染文章浏览量统计。

部署 Nginx 时需使用 [nginx.conf.example](./nginx.conf.example) 中的 `try_files $uri/index.html $uri /index.html;`，确保 `/blog/{id}` 返回预渲染文章，而不是 SPA 首页空壳。

仅重新生成 SEO 文件（需要已有 `dist/index.html`）：

```bash
npm run generate:seo
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).
