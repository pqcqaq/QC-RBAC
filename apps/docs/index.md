---
layout: doc
title: 项目官网
description: 面向真实业务演进的认证、授权与多端接入底座。
aside: false
outline: false
pageClass: landing-page
---

<div class="landing">
  <section class="landing-hero">
    <div class="landing-hero-copy">
      <p class="landing-kicker">Authentication · Authorization · Multi-Client</p>
      <h1 class="landing-title">从账号体系开始，直接搭一套能继续长成产品的底座。</h1>
      <p class="landing-lede">
        这套工程先把最容易在后期失控的基础能力做成明确边界：客户端身份、认证策略、RBAC、菜单驱动路由、
        OAuth/OIDC、文件上传补偿、Excel 导出与多端共享 API。然后再让业务在其上继续长，而不是先堆页面再返工。
      </p>
      <div class="landing-actions">
        <a class="landing-link landing-link--primary" href="/guide/quick-start">快速开始</a>
        <a class="landing-link landing-link--ghost" href="/guide/development">开发指南</a>
      </div>
    </div>

    <aside class="landing-panel">
      <p class="landing-panel-label">Current Coverage</p>
      <h2 class="landing-panel-title">一个仓库，统一承接认证、控制台与移动端。</h2>
      <p class="landing-panel-copy">
        文档站本身也来自同一个 monorepo，方便你在阅读实现说明时直接对照真实代码。
      </p>
      <div class="landing-stat-list">
        <div class="landing-stat">
          <strong>3</strong>
          <span>客户端类型</span>
          <small>Web、微信小程序、原生 App</small>
        </div>
        <div class="landing-stat">
          <strong>2</strong>
          <span>OAuth 角色</span>
          <small>既能做 Provider，也能接第三方登录</small>
        </div>
        <div class="landing-stat">
          <strong>7+</strong>
          <span>核心模块</span>
          <small>认证、RBAC、菜单、上传、导出、实时、审计</small>
        </div>
      </div>
    </aside>
  </section>

  <section class="landing-section">
    <div class="landing-section-head">
      <p class="landing-section-label">Why It Exists</p>
      <h2>它不是演示模板，而是一个可以继续维护的基础工程。</h2>
      <p class="landing-section-copy">
        项目的重点不是“页面长什么样”，而是先把系统级约束搭稳。这样后续无论是控制台、SaaS 后台、
        内部运营平台，还是多端统一账号体系，都有一个清晰、可复用、可审计的起点。
      </p>
    </div>

    <div class="landing-grid">
      <article class="landing-card">
        <h3>Client + Strategy 双层认证</h3>
        <p>先识别接入方，再选择认证策略。Web、Uni、小程序、App 都能在同一套服务里治理。</p>
      </article>
      <article class="landing-card">
        <h3>菜单驱动控制台</h3>
        <p>控制台页面不是写死在前端路由里，而是由菜单树、权限与页面注册表共同决定。</p>
      </article>
      <article class="landing-card">
        <h3>OAuth / OIDC 双向能力</h3>
        <p>既可以作为别人的认证中心，也能把外部 OAuth 供应商接入到自己的登录页。</p>
      </article>
      <article class="landing-card">
        <h3>数据层统一治理</h3>
        <p>Snowflake ID、审计字段和软删除都在 Prisma 扩展层统一处理，不依赖业务页自觉维护。</p>
      </article>
      <article class="landing-card">
        <h3>可靠上传与补偿</h3>
        <p>单片、本地、S3 兼容直传与后台定时补偿都已接通，避免只覆盖 happy path。</p>
      </article>
      <article class="landing-card">
        <h3>导出与下载解耦</h3>
        <p>后端按配置生成 Excel，前端通过统一下载组合式封装处理复杂流式下载与进度反馈。</p>
      </article>
    </div>
  </section>

  <section class="landing-section">
    <div class="landing-section-head">
      <p class="landing-section-label">System Map</p>
      <h2>所有端都围绕同一套身份边界与共享类型协作。</h2>
    </div>

    <MermaidDiagram
      label="Monorepo Runtime Overview"
      :code="[
        'flowchart LR',
        '  subgraph ClientSide[Clients]',
        '    WEB[Web Console]',
        '    UNI[Uni Mobile]',
        '    DOCS[VitePress Docs]',
        '    OAPP[OAuth Test Application]',
        '  end',
        '',
        '  subgraph Shared[Shared Contract]',
        '    COMMON[packages/api-common]',
        '  end',
        '',
        '  subgraph Backend[Backend Services]',
        '    AUTH[Auth + Session]',
        '    RBAC[RBAC + Menus]',
        '    OIDC[OAuth / OIDC]',
        '    FILE[Upload + Timers]',
        '  end',
        '',
        '  DB[(PostgreSQL)]',
        '  REDIS[(Redis)]',
        '',
        '  WEB --> COMMON',
        '  UNI --> COMMON',
        '  COMMON --> AUTH',
        '  COMMON --> RBAC',
        '  COMMON --> FILE',
        '  OAPP --> OIDC',
        '  AUTH --> DB',
        '  RBAC --> DB',
        '  OIDC --> DB',
        '  FILE --> DB',
        '  AUTH --> REDIS',
      ].join('\n')"
    />
  </section>

  <section class="landing-section">
    <div class="landing-section-head">
      <p class="landing-section-label">Read In Order</p>
      <h2>先理解问题，再启动项目，最后读开发实现。</h2>
    </div>

    <div class="doc-index">
      <a href="/guide/introduction">介绍：项目边界、能力范围与适用场景</a>
      <a href="/guide/quick-start">快速开始：环境、种子数据与运行命令</a>
      <a href="/architecture/tech-stack">技术选型：为什么是这组工具与层次</a>
      <a href="/guide/development">开发指南：现有功能如何真正实现</a>
      <a href="/support/sponsor">赞助：如何支持项目继续演进</a>
    </div>
  </section>

  <section class="landing-section">
    <div class="landing-section-head">
      <p class="landing-section-label">Engineering Principles</p>
      <h2>先定边界，再写页面；先做系统能力，再接业务需求。</h2>
    </div>

    <ul class="landing-flow">
      <li><strong>把身份能力前置。</strong> 认证方式、客户端、OAuth 和刷新令牌统一进入后端约束，而不是散落在前端组件里。</li>
      <li><strong>把导航做成数据。</strong> 控制台路由通过菜单树与权限共同驱动，天然更适合后台系统演进。</li>
      <li><strong>把运维视角做进模型。</strong> 审计、软删除、导出、上传巡检、实时频道这些能力都不是附属脚本，而是正式模块。</li>
      <li><strong>把共享边界抽出来。</strong> `packages/api-common` 负责跨端请求配置、类型与权限常量，避免端与端之间再次分叉。</li>
    </ul>
  </section>
</div>
